#!/usr/bin/env python3
"""
Generatore di documentazione Markdown per ODI Load Plan + Scenari associati.
"""
from pathlib import Path
from typing import Any, Dict, List

STEP_TYPE_LABELS = {
    "SE": "Sequence Executor",
    "S": "Simple Step",
    "F": "For Each",
    "W": "While",
    "SR": "Subroutine",
}

EXCEPT_BEHAVIOR_LABELS = {
    "R": "Ignore and resume",
    "S": "Stop",
    "C": "Stop all",
}

RESTART_TYPE_LABELS = {
    "SF": "From failed step",
    "ST": "From start",
    "S": "From step",
}

TASK_TYPE_LABELS = {
    "L": "Logical",
    "J": "SQL / JDBC",
    "C": "Custom / OS command",
    "E": "Export",
    "I": "Import",
}

SCEN_STEP_TYPE_LABELS = {
    "M": "Mapping",
    "P": "Package",
    "V": "Variable",
}


def _clean(val: Any) -> str:
    if val is None:
        return ""
    return str(val)


def _fmt_schedule(agent: dict) -> str:
    stype = agent.get("s_type")
    if not stype or stype == "I":
        return "Immediate / On-demand"
    if stype == "H":
        parts = [f"Every hour at minute {agent.get('s_minute', '0')}"]
        day = agent.get("s_day")
        month = agent.get("s_month")
        year = agent.get("s_year")
        if day:
            parts.append(f"from day {day}")
        if month:
            parts.append(f"month {month}")
        if year:
            parts.append(f"year {year}")
        return " ".join(parts)
    if stype == "D":
        return f"Daily at {agent.get('s_hour', '0')}:{agent.get('s_minute', '0')}"
    if stype == "W":
        return f"Weekly on day {agent.get('s_week_day', '?')} at {agent.get('s_hour', '0')}:{agent.get('s_minute', '0')}"
    if stype == "M":
        return f"Monthly on day {agent.get('s_month_day', '1')} at {agent.get('s_hour', '0')}:{agent.get('s_minute', '0')}"
    return f"Type {stype}"


def _step_type_label(t: str | None) -> str:
    return STEP_TYPE_LABELS.get(t or "", t or "Unknown")


def _format_sql(text: str | None) -> str:
    if not text:
        return ""
    text = text.strip()
    if not text:
        return ""
    return f"```sql\n{text}\n```"


def _render_step_tree(steps: list, level: int = 0) -> list[str]:
    lines = []
    indent = "  " * level
    for step in steps:
        stype = _step_type_label(step.get("lp_step_type"))
        name = step.get("lp_step_name") or "unnamed"
        enabled = step.get("ind_enabled") == "1"
        badge = "" if enabled else " [DISABLED]"

        lines.append(f"{indent}- **{name}** ({stype}){badge}")

        if step.get("context_code"):
            lines.append(f"{indent}  - Context: `{step['context_code']}`")
        eb = step.get("except_behavior")
        if eb and eb in EXCEPT_BEHAVIOR_LABELS:
            lines.append(f"{indent}  - On error: {EXCEPT_BEHAVIOR_LABELS[eb]}")
        timeout = step.get("step_timeout")
        if timeout and int(timeout) > 0:
            lines.append(f"{indent}  - Timeout: {timeout} min")

        # Link to scenario
        scen = step.get("_scenario")
        if scen:
            lines.append(f"{indent}  - Scenario: `{scen.get('scen_name')}` v{scen.get('scen_version', '')}")

        # Scenario steps (mapping steps with KMs)
        scen_steps = step.get("_scen_steps", [])
        for ss in scen_steps:
            sname = ss.get("step_name") or "unnamed"
            stype_label = SCEN_STEP_TYPE_LABELS.get(ss.get("step_type"), ss.get("step_type", ""))
            target = ss.get("res_name") or ""
            lschema = ss.get("lschema_name") or ""
            mod = ss.get("mod_code") or ""
            lines.append(f"{indent}  - **Step scenario:** {sname} ({stype_label})")
            if target:
                lines.append(f"{indent}    - Target: `{target}`")
            if lschema:
                lines.append(f"{indent}    - Logical schema: `{lschema}`")
            if mod:
                lines.append(f"{indent}    - Technology: `{mod}`")
            # GenInfo KM details
            gi = ss.get("gen_info")
            if gi:
                lines.append(f"{indent}    - Knowledge Modules:")
                for node in gi.split("<node "):
                    if not node.strip():
                        continue
                    nname = _extract_xml_attr(node, "name")
                    ntype = _extract_xml_attr(node, "type")
                    nkm = _extract_xml_attr(node, "km")
                    if nname and nkm:
                        lines.append(f"{indent}      - {ntype}: `{nkm}` → `{nname}`")
                    elif nname and ntype:
                        lines.append(f"{indent}      - {ntype}: `{nname}`")

        # Scenario tasks with SQL
        tasks = step.get("_scen_tasks", [])
        for t in tasks:
            tname = t.get("task_name3") or t.get("task_name1") or "task"
            ttype_label = TASK_TYPE_LABELS.get(t.get("task_type"), t.get("task_type", ""))
            lines.append(f"{indent}  - **Task:** {tname} ({ttype_label})")

            def_txt = t.get("def_txt")
            col_txt = t.get("col_txt")
            if def_txt:
                for line in _format_sql(def_txt).split("\n"):
                    lines.append(f"{indent}    {line}")
            if col_txt:
                for line in _format_sql(col_txt).split("\n"):
                    lines.append(f"{indent}    {line}")

        # Step variables
        for sv in step.get("_step_vars", []):
            sv_name = sv.get("var_name") or ""
            sv_val = sv.get("var_value") or sv.get("var_long_value") or ""
            sv_op = sv.get("var_op") or ""
            op_label = {"S": "=", "A": "+=", "M": "-="}.get(sv_op, sv_op)
            lines.append(f"{indent}  - Var: `{sv_name}` {op_label} `{sv_val}`")

        children = step.get("children", [])
        if children:
            lines.extend(_render_step_tree(children, level + 1))

    return lines


def _extract_xml_attr(chunk: str, attr: str) -> str:
    """Rough extraction of an XML attribute value from a string fragment."""
    import re
    m = re.search(rf'{attr}\s*=\s*"([^"]*)"', chunk)
    return m.group(1) if m else ""


def generate_markdown(data: Dict[str, Any], output_path: Path) -> str:
    lp = data.get("load_plan", {})
    agents = data.get("plan_agents", [])
    steps = data.get("lp_steps", [])
    scenarios = data.get("scenarios", [])
    _all_scen_steps = data.get("_scen_steps", {})
    _all_scen_tasks = data.get("_scen_tasks", {})

    lines = []
    lines.append(f"# Load Plan: {lp.get('load_plan_name', 'N/A')}")
    lines.append("")

    # ── General info ──
    lines.append("## Informazioni Generali")
    lines.append("")
    lines.append("| Campo | Valore |")
    lines.append("|-------|--------|")
    lines.append(f"| **Nome Load Plan** | {_clean(lp.get('load_plan_name'))} |")
    lines.append(f"| **ID Load Plan** | `{_clean(lp.get('i_load_plan'))}` |")
    lines.append(f"| **Global ID** | `{_clean(lp.get('global_id'))}` |")
    lines.append(f"| **Creato il** | {_clean(lp.get('first_date'))} |")
    lines.append(f"| **Ultima modifica** | {_clean(lp.get('last_date'))} |")
    lines.append(f"| **Creato da** | {_clean(lp.get('first_user'))} |")
    lines.append(f"| **Ultimo utente** | {_clean(lp.get('last_user'))} |")
    lines.append(f"| **Task Log Level** | {_clean(lp.get('task_log_level'))} |")
    lines.append(f"| **Keep Log (days)** | {_clean(lp.get('keep_log_hdays'))} |")
    lines.append(f"| **Session Log** | {_clean(lp.get('ind_sess_log'))} |")
    lines.append(f"| **Step Log** | {_clean(lp.get('ind_step_log'))} |")
    lines.append("")

    # ── Agents ──
    if agents:
        lines.append("## Agenti di Esecuzione / Schedulazione")
        lines.append("")
        for agent in agents:
            aname = _clean(agent.get("lagent_name"))
            lines.append(f"### Agente: {aname}")
            lines.append("")
            lines.append("| Campo | Valore |")
            lines.append("|-------|--------|")
            lines.append(f"| **Nome Agente** | {aname} |")
            lines.append(f"| **Contesto** | `{_clean(agent.get('context_code'))}` |")
            lines.append(f"| **Scenario** | {_clean(agent.get('scen_name'))} v{_clean(agent.get('scen_version'))} |")
            lines.append(f"| **Stato** | {_clean(agent.get('stat_plan'))} |")
            lines.append(f"| **Job Type** | {_clean(agent.get('ind_job_type'))} |")
            lines.append(f"| **Log Level** | {_clean(agent.get('log_level'))} |")
            lines.append(f"| **Schedulazione** | {_fmt_schedule(agent)} |")
            if agent.get("r_time"):
                lines.append(f"| **Repeat every** | {_clean(agent.get('r_time'))} {_clean(agent.get('r_interval_unit')) or 'hours'} |")
            if agent.get("r_time_error"):
                lines.append(f"| **Error tolerance** | {_clean(agent.get('r_time_error'))} {_clean(agent.get('r_interval_unit')) or 'hours'} |")
            lines.append(f"| **Creato il** | {_clean(agent.get('first_date'))} |")
            lines.append(f"| **Ultima modifica** | {_clean(agent.get('last_date'))} |")
            lines.append(f"| **Creato da** | {_clean(agent.get('first_user'))} |")
            lines.append("")

    # ── Step tree ──
    if steps:
        lines.append("## Struttura del Load Plan")
        lines.append("")
        lines.extend(_render_step_tree(steps))
        lines.append("")

    # ── LP Variables ──
    lp_vars = data.get("lp_vars", [])
    if lp_vars:
        lines.append("## Variabili del Load Plan")
        lines.append("")
        for v in lp_vars:
            vname = v.get("var_name") or ""
            vtype = v.get("var_type") or ""
            vdef = v.get("default_value") or ""
            lines.append(f"- **{vname}** ({vtype}) = `{vdef}`")
        lines.append("")

    # ── Scenarios summary ──
    if scenarios:
        lines.append("## Scenari Collegati")
        lines.append("")
        for sc in scenarios:
            scno = sc.get("scen_no")
            lines.append(f"### {_clean(sc.get('scen_name'))} v{_clean(sc.get('scen_version'))}")
            lines.append("")
            lines.append("| Campo | Valore |")
            lines.append("|-------|--------|")
            lines.append(f"| **ID Scenario** | `{_clean(scno)}` |")
            lines.append(f"| **Mapping ID** | `{_clean(sc.get('i_mapping'))}` |")
            lines.append(f"| **Global ID** | `{_clean(sc.get('global_id'))}` |")
            lines.append(f"| **Creato il** | {_clean(sc.get('first_date'))} |")
            lines.append(f"| **Da** | {_clean(sc.get('first_user'))} |")
            lines.append("")

            # Steps of this scenario
            ss_list = sorted(
                (v for k, v in _all_scen_steps.items() if k[0] == scno),
                key=lambda s: int(s.get("nno") or 0)
            )
            if ss_list:
                lines.append("#### Passaggi Scenario")
                lines.append("")
                for ss in ss_list:
                    sname = ss.get("step_name") or "unnamed"
                    stype_label = SCEN_STEP_TYPE_LABELS.get(ss.get("step_type"), ss.get("step_type", ""))
                    target = ss.get("res_name") or ""
                    lschema = ss.get("lschema_name") or ""
                    mod = ss.get("mod_code") or ""
                    lines.append(f"- **{sname}** ({stype_label})")
                    if target:
                        lines.append(f"  - Target: `{target}`")
                    if lschema:
                        lines.append(f"  - Logical schema: `{lschema}`")
                    if mod:
                        lines.append(f"  - Technology: `{mod}`")
                    gi = ss.get("gen_info")
                    if gi:
                        lines.append(f"  - Knowledge Modules:")
                        for node in gi.split("<node "):
                            if not node.strip():
                                continue
                            nname = _extract_xml_attr(node, "name")
                            ntype = _extract_xml_attr(node, "type")
                            nkm = _extract_xml_attr(node, "km")
                            if nname and nkm:
                                lines.append(f"    - {ntype}: `{nkm}` → `{nname}`")
                            elif nname and ntype:
                                lines.append(f"    - {ntype}: `{nname}`")
                    lines.append("")

            # Tasks with SQL of this scenario
            tasks_list = sorted(
                (v for k, v in _all_scen_tasks.items() if k[0] == scno),
                key=lambda t: int(t.get("ord_trt") or 0)
            )
            if tasks_list:
                lines.append("#### Task SQL")
                lines.append("")
                for t in tasks_list:
                    tname = t.get("task_name3") or t.get("task_name2") or t.get("task_name1") or "task"
                    ttype_label = TASK_TYPE_LABELS.get(t.get("task_type"), t.get("task_type", ""))
                    lines.append(f"**{tname}** ({ttype_label})")
                    def_txt = t.get("def_txt")
                    col_txt = t.get("col_txt")
                    if def_txt:
                        lines.append(_format_sql(def_txt))
                    if col_txt:
                        lines.append(_format_sql(col_txt))
                    lines.append("")
            lines.append("---")
            lines.append("")

    # ── Footer stats ──
    all_lp_steps = _all_steps(steps)
    total_tasks = sum(len(s.get("_scen_tasks", [])) for s in all_lp_steps)
    total_scen_steps = sum(len(s.get("_scen_steps", [])) for s in all_lp_steps)
    total_sql_tasks = sum(1 for t in _all_scen_tasks.values() if t.get("def_txt") or t.get("col_txt"))
    n_scenarios = len(scenarios)
    lines.append("---")
    lines.append(f"_{len(steps)} step radice, {_count_all_steps(steps)} step LP, "
                 f"{total_scen_steps} passaggi scenario, {total_sql_tasks} task SQL totali._")
    lines.append("")

    text = "\n".join(lines)
    output_path.write_text(text, encoding="utf-8")
    return text


def _all_steps(steps: list) -> list:
    result = []
    for s in steps:
        result.append(s)
        result.extend(_all_steps(s.get("children", [])))
    return result


def _count_all_steps(steps: list) -> int:
    return len(_all_steps(steps))
