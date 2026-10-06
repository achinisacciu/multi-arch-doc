"""Markdown report exporter."""

from __future__ import annotations

from pathlib import Path

from ..models.process import BpmnDocument


def export_markdown(doc: BpmnDocument, output_path: str | Path, *, anonymize: bool = False) -> Path:
    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    if anonymize:
        from ..anonymize import anonymize_document

        doc = anonymize_document(doc)
    md = _render(doc, anonymize=anonymize)
    out.write_text(md, encoding="utf-8")
    return out


def _ensure_wrapped(value: str | None, anonymize: bool) -> str:
    """Return value wrapped in `` if anonymize and not already wrapped; otherwise ensure markdown code style."""
    if value is None or value == "" or value == "—":
        return "—"
    # already wrapped for anonymized doc
    if anonymize and value.startswith("`") and value.endswith("`"):
        return value
    if anonymize:
        # anonymize mode: every extracted value must be in ``
        return f"`{value}`"
    # normal mode: keep existing behavior where IDs etc are in ``, but names may not be
    # caller decides; this helper is for values that should be code in both modes
    return f"`{value}`"


def _cell(value: str | None, anonymize: bool, force_wrap: bool = False) -> str:
    """Helper for markdown table cells. If anonymize, wrap extracted values."""
    if value is None or value == "" or value == "—":
        return "—"
    if anonymize:
        if value.startswith("`") and value.endswith("`"):
            return value
        return f"`{value}`"
    if force_wrap:
        return f"`{value}`"
    return value


def _render(doc: BpmnDocument, anonymize: bool = False) -> str:
    m = doc.metrics
    lines: list[str] = []
    lines.append("# BPMN Reverse Engineering Report")
    lines.append("")
    lines.append(f"> Tool version: `{doc.tool_version}` | Schema: `{doc.schema_version}`")
    lines.append("")

    # 1 Source
    lines.append("## 1. Source")
    lines.append("")
    # source.filename already wrapped if anonymize
    fn = doc.source.filename if anonymize else f"`{doc.source.filename}`"
    sha = f"`{doc.source.sha256}`"  # sha is derived, not anonymized, but keep as code for readability
    lines.append(f"- **Filename:** {fn}")
    lines.append(f"- **SHA256:** {sha}")
    lines.append(f"- **Size:** {doc.source.size_bytes} bytes")
    lines.append("")

    # 2 Process
    lines.append("## 2. Process")
    lines.append("")
    if not doc.processes:
        lines.append("_No processes found._")
    else:
        lines.append("| ID | Name | Namespace | Executable | Documentation |")
        lines.append("|---|---|---|---|---|")
        for p in doc.processes:
            doc_str = (p.documentation or "").replace("|", "\\|").replace("\n", "<br>")[:120]
            # Use helpers that respect anonymize double-wrap
            pid = p.id if (anonymize and p.id.startswith("`")) else f"`{p.id}`" if not anonymize else _cell(p.id, anonymize, True)
            # Actually p.id already wrapped if anonymize, so above is handled. Simplify:
            pid_cell = p.id if anonymize else f"`{p.id}`"
            # For name/namespace/docs, wrap when anonymize
            name_cell = _cell(p.name, anonymize, False) if anonymize else (p.name or "—")
            ns_cell = _cell(p.namespace, anonymize, False) if anonymize else (p.namespace or "—")
            # documentation: wrap when anonymize
            doc_cell = _cell(doc_str, anonymize, False) if anonymize and doc_str else (doc_str or "—")
            # But to keep markdown table correct, docs with backticks may need escaping; we keep simple.
            if anonymize:
                # Re-derive with proper wrapping for doc_str already wrapped case
                if p.documentation:
                    doc_cell = p.documentation if p.documentation.startswith("`") else f"`{doc_str}`"
                else:
                    doc_cell = "—"
            lines.append(f"| {pid_cell} | {name_cell} | {ns_cell} | {p.is_executable} | {doc_cell} |")
    lines.append("")

    # 3 Metrics (all derived, not wrapped)
    lines.append("## 3. Metrics")
    lines.append("")
    lines.append("| Metric | Count |")
    lines.append("|---|---:|")
    lines.append(f"| Processes | {m.num_processes} |")
    lines.append(f"| Events | {m.num_events} |")
    lines.append(f"| &nbsp;&nbsp;Start Events | {m.num_start_events} |")
    lines.append(f"| &nbsp;&nbsp;End Events | {m.num_end_events} |")
    lines.append(f"| &nbsp;&nbsp;Intermediate | {m.num_intermediate_events} |")
    lines.append(f"| &nbsp;&nbsp;Boundary | {m.num_boundary_events} |")
    lines.append(f"| Activities | {m.num_activities} |")
    lines.append(f"| &nbsp;&nbsp;Service Tasks | {m.num_service_tasks} |")
    lines.append(f"| &nbsp;&nbsp;User Tasks | {m.num_user_tasks} |")
    lines.append(f"| &nbsp;&nbsp;Manual Tasks | {m.num_manual_tasks} |")
    lines.append(f"| &nbsp;&nbsp;Script Tasks | {m.num_script_tasks} |")
    lines.append(f"| &nbsp;&nbsp;Call Activities | {m.num_call_activities} |")
    lines.append(f"| &nbsp;&nbsp;SubProcesses | {m.num_subprocesses} |")
    lines.append(f"| Gateways | {m.num_gateways} |")
    lines.append(f"| Sequence Flows | {m.num_sequence_flows} |")
    lines.append(f"| Message Flows | {m.num_message_flows} |")
    lines.append(f"| Lanes | {m.num_lanes} |")
    lines.append(f"| Participants | {m.num_participants} |")
    lines.append(f"| Extensions | {m.num_extension_elements} |")
    lines.append(f"| Explicit References | {m.num_explicit_references} |")
    lines.append(f"| Unknown Elements | {m.num_unknown_elements} |")
    # Tool 1.5
    if getattr(m, "num_service_implementations", 0) or getattr(m, "num_messages", 0) or getattr(m, "num_unresolved_refs", 0):
        lines.append(f"| Service Implementations | {getattr(m, 'num_service_implementations', 0)} |")
        lines.append(f"| Messages | {getattr(m, 'num_messages', 0)} |")
        lines.append(f"| Interfaces | {getattr(m, 'num_interfaces', 0)} |")
        lines.append(f"| Operations | {getattr(m, 'num_operations', 0)} |")
        lines.append(f"| Unresolved Refs | {getattr(m, 'num_unresolved_refs', 0)} |")
    lines.append("")

    # 4 Start/End
    lines.append("## 4. Start / End Events")
    lines.append("")
    events = [e for e in doc.elements if e.type in {"startEvent", "endEvent", "intermediateCatchEvent", "intermediateThrowEvent", "boundaryEvent"}]
    if not events:
        lines.append("_No events found._")
    else:
        lines.append("| ID | Name | Type | Definitions | Incoming | Outgoing | Documentation |")
        lines.append("|---|---|---|---|---|---|---|")
        for e in events:
            defs = ", ".join(e.event_definitions) if e.event_definitions else "—"
            doc_s_raw = (e.documentation or "—").replace("|", "\\|").replace("\n", " ")[:80]
            id_cell = e.id if anonymize else f"`{e.id}`"
            name_cell = _cell(e.name, anonymize) if anonymize else (e.name or "—")
            type_cell = e.type
            doc_cell = _cell(doc_s_raw, anonymize) if anonymize and e.documentation else doc_s_raw
            if anonymize and e.documentation and e.documentation.startswith("`"):
                doc_cell = e.documentation
            lines.append(f"| {id_cell} | {name_cell} | {type_cell} | {defs} | {len(e.incoming)} | {len(e.outgoing)} | {doc_cell} |")
    lines.append("")

    # 5 Activities
    lines.append("## 5. Activities")
    lines.append("")
    acts = [e for e in doc.elements if "Task" in e.type or e.type in {"task", "callActivity", "subProcess", "adHocSubProcess", "transaction"}]
    if not acts:
        lines.append("_No activities found._")
    else:
        lines.append("| ID | Name | Type | Lane | Incoming | Outgoing | Documentation |")
        lines.append("|---|---|---|---|---|---|---|")
        for e in acts:
            doc_s_raw = (e.documentation or "—").replace("|", "\\|").replace("\n", " ")[:80]
            id_cell = e.id if anonymize else f"`{e.id}`"
            name_cell = _cell(e.name, anonymize) if anonymize else (e.name or "—")
            type_cell = e.type
            lane_val = e.lane_name or e.lane_id or "—"
            lane_cell = lane_val if (anonymize and lane_val.startswith("`")) else _cell(lane_val, anonymize) if anonymize else lane_val
            # incoming/outgoing are lists of ids already wrapped if anonymize
            inc = ", ".join(e.incoming) if e.incoming else "—"
            out = ", ".join(e.outgoing) if e.outgoing else "—"
            # if anonymize, incoming/outgoing already contain ``, keep as is (they are wrapped individually, but joined with comma)
            doc_cell = e.documentation if (anonymize and e.documentation and e.documentation.startswith("`")) else (_cell(doc_s_raw, anonymize) if anonymize and e.documentation else doc_s_raw)
            lines.append(f"| {id_cell} | {name_cell} | {type_cell} | {lane_cell} | {inc} | {out} | {doc_cell} |")
    lines.append("")

    # 6 Gateways
    lines.append("## 6. Gateways")
    lines.append("")
    gates = [e for e in doc.elements if "Gateway" in e.type]
    if not gates:
        lines.append("_No gateways found._")
    else:
        lines.append("| ID | Name | Type | Incoming | Outgoing | Default Flow |")
        lines.append("|---|---|---|---|---|---|")
        for e in gates:
            id_cell = e.id if anonymize else f"`{e.id}`"
            name_cell = _cell(e.name, anonymize) if anonymize else (e.name or "—")
            type_cell = e.type
            default_cell = e.default_flow if (anonymize and e.default_flow and e.default_flow.startswith("`")) else (_cell(e.default_flow, anonymize) if anonymize and e.default_flow else (e.default_flow or "—"))
            if not anonymize:
                default_cell = f"`{e.default_flow}`" if e.default_flow else "—"
            lines.append(f"| {id_cell} | {name_cell} | {type_cell} | {len(e.incoming)} | {len(e.outgoing)} | {default_cell} |")
    lines.append("")

    # 7 Sequence Flows
    lines.append("## 7. Sequence Flows")
    lines.append("")
    if not doc.sequence_flows:
        lines.append("_No sequence flows._")
    else:
        lines.append("| ID | Name | Source → Target | Condition | Default |")
        lines.append("|---|---|---|---|---|")
        for sf in doc.sequence_flows:
            id_cell = sf.id if anonymize else f"`{sf.id}`"
            name_cell = _cell(sf.name, anonymize) if anonymize else (sf.name or "—")
            # source/target already wrapped if anonymize (they are refs)
            src = sf.source_ref if anonymize else f"`{sf.source_ref or '—'}`"
            tgt = sf.target_ref if anonymize else f"`{sf.target_ref or '—'}`"
            # Ensure source/target not double-wrapped: they are already like "`S1`" so keep
            if not anonymize:
                pair = f"`{sf.source_ref or '—'}` → `{sf.target_ref or '—'}`"
            else:
                pair = f"{src} → {tgt}"
            # condition: anonymize wraps it already
            if sf.condition:
                cond_raw = sf.condition.replace("|", "\\|").replace("\n", " ")[:60]
                cond_cell = sf.condition if (anonymize and sf.condition.startswith("`")) else (_cell(cond_raw, anonymize) if anonymize else cond_raw)
                if not anonymize:
                    cond_cell = cond_raw
            else:
                cond_cell = "—"
            lines.append(f"| {id_cell} | {name_cell} | {pair} | {cond_cell} | {sf.is_default} |")
    lines.append("")

    # 8 Message Flows
    lines.append("## 8. Message Flows")
    lines.append("")
    if not doc.message_flows:
        lines.append("_No message flows._")
    else:
        lines.append("| ID | Name | Source → Target |")
        lines.append("|---|---|---|")
        for mf in doc.message_flows:
            id_cell = mf.id if anonymize else f"`{mf.id}`"
            name_cell = _cell(mf.name, anonymize) if anonymize else (mf.name or "—")
            src = mf.source_ref if anonymize else f"`{mf.source_ref or '—'}`"
            tgt = mf.target_ref if anonymize else f"`{mf.target_ref or '—'}`"
            pair = f"{src} → {tgt}" if anonymize else f"`{mf.source_ref or '—'}` → `{mf.target_ref or '—'}`"
            lines.append(f"| {id_cell} | {name_cell} | {pair} |")
    lines.append("")

    # 9 Swimlanes
    lines.append("## 9. Swimlanes")
    lines.append("")
    if not doc.lanes and not doc.participants:
        lines.append("_No lanes/participants._")
    else:
        if doc.participants:
            lines.append("### Participants")
            lines.append("")
            lines.append("| ID | Name | ProcessRef |")
            lines.append("|---|---|---|")
            for p in doc.participants:
                id_cell = p.id if anonymize else f"`{p.id}`"
                name_cell = _cell(p.name, anonymize) if anonymize else (p.name or "—")
                pref = p.process_ref if (anonymize and p.process_ref and p.process_ref.startswith("`")) else (_cell(p.process_ref, anonymize) if anonymize and p.process_ref else (p.process_ref or "—"))
                if not anonymize:
                    pref = f"`{p.process_ref}`" if p.process_ref else "—"
                lines.append(f"| {id_cell} | {name_cell} | {pref} |")
            lines.append("")
        if doc.lanes:
            lines.append("### Lanes")
            lines.append("")
            lines.append("| ID | Name | Flow Nodes |")
            lines.append("|---|---|---|")
            for l in doc.lanes:
                id_cell = l.id if anonymize else f"`{l.id}`"
                name_cell = _cell(l.name, anonymize) if anonymize else (l.name or "—")
                # flow nodes are wrapped individually
                nodes = ", ".join(l.flow_node_refs) if l.flow_node_refs else "—"
                # nodes already contains wrapped ids if anonymize: "`S1`"
                lines.append(f"| {id_cell} | {name_cell} | {nodes} |")
            lines.append("")

    # 10 Explicit References
    lines.append("## 10. Explicit References")
    lines.append("")
    if not doc.references:
        lines.append("_No explicit references._")
    else:
        lines.append("| Source | Attribute | Value | Namespace |")
        lines.append("|---|---|---|---|")
        for r in doc.references:
            src = r.source_element if anonymize else f"`{r.source_element}`"
            val = r.value if anonymize else f"`{r.value}`"
            ns = r.namespace if (anonymize and r.namespace and r.namespace.startswith("`")) else (_cell(r.namespace, anonymize) if anonymize and r.namespace else (r.namespace or "—"))
            if not anonymize and r.namespace:
                ns = r.namespace
            lines.append(f"| {src} | {r.attribute} | {val} | {ns} |")
    lines.append("")

    # 11 Extensions
    lines.append("## 11. Extensions")
    lines.append("")
    if not doc.extensions:
        lines.append("_No extensionElements._")
    else:
        lines.append(f"_Total: {len(doc.extensions)} extension elements._")
        lines.append("")
        from collections import defaultdict

        by_parent: dict[str, list] = defaultdict(list)
        for ext in doc.extensions:
            by_parent[ext.parent_id or "top-level"].append(ext)
        for parent, exts in by_parent.items():
            # parent already wrapped if anonymize
            parent_disp = parent if anonymize else f"`{parent}`"
            lines.append(f"### Parent: {parent_disp} ({len(exts)})")
            lines.append("")
            lines.append("| Tag | Namespace | Attributes | Text |")
            lines.append("|---|---|---|---|")
            for ext in exts[:20]:
                tag_cell = ext.tag if anonymize else f"`{ext.tag}`"
                ns_cell = ext.namespace if (anonymize and ext.namespace and ext.namespace.startswith("`")) else (_cell(ext.namespace, anonymize) if anonymize and ext.namespace else (ext.namespace or "—"))
                if not anonymize and ext.namespace:
                    ns_cell = ext.namespace
                attrs = ", ".join(f"{k}={v}" for k, v in ext.attributes.items()) if ext.attributes else "—"
                # attrs values already wrapped if anonymize (values inside)
                if len(attrs) > 80:
                    attrs = attrs[:77] + "..."
                txt_raw = (ext.text or "—").replace("|", "\\|")[:60]
                txt_cell = ext.text if (anonymize and ext.text and ext.text.startswith("`")) else (_cell(txt_raw, anonymize) if anonymize and ext.text else txt_raw)
                if not anonymize:
                    txt_cell = (ext.text or "—").replace("|", "\\|")[:60]
                lines.append(f"| {tag_cell} | {ns_cell} | {attrs} | {txt_cell} |")
            if len(exts) > 20:
                lines.append(f"| _...+{len(exts)-20} more_ |  |  |  |")
            lines.append("")

    # 12 Execution Paths
    lines.append("## 12. Execution Paths")
    lines.append("")
    if not doc.paths:
        lines.append("_No paths (no start/end or disconnected)._")
    else:
        lines.append(f"_Enumerated {len(doc.paths)} path(s) (limit applied)._")
        lines.append("")
        for p in doc.paths:
            # nodes already wrapped if anonymize
            nodes = " → ".join(p.nodes) if anonymize else " → ".join(f"`{n}`" for n in p.nodes)
            lines.append(f"- **{p.path_id}**: {nodes}")
            conds = ", ".join(p.conditions) if p.conditions else "—"
            lines.append(f"  - Conditions: {conds}")
            if p.flows:
                flows = ", ".join(p.flows) if anonymize else ", ".join(p.flows)
                lines.append(f"  - Flows: {flows}")
        lines.append("")

    # 13 Structural Warnings
    lines.append("## 13. Structural Warnings")
    lines.append("")
    if not doc.structural_warnings:
        lines.append("_No warnings._")
    else:
        lines.append("| Code | Element | Message |")
        lines.append("|---|---|---|")
        for w in doc.structural_warnings:
            elem = w.element_id if (anonymize and w.element_id and w.element_id.startswith("`")) else (f"`{w.element_id}`" if w.element_id else "—")
            msg = w.message if (anonymize and w.message.startswith("`")) else w.message.replace("|", "\\|")
            code = w.code  # derived, not anonymized
            lines.append(f"| {code} | {elem} | {msg} |")
    lines.append("")

    # 14 Raw / Unknown
    lines.append("## 14. Raw / Unknown Elements")
    lines.append("")
    unknowns = [e for e in doc.elements if e.is_unknown]
    if not unknowns:
        lines.append("_No unknown elements._")
    else:
        lines.append("| ID | Original Tag | Namespace | Name | Attributes |")
        lines.append("|---|---|---|---|---|")
        for e in unknowns:
            id_cell = e.id if anonymize else f"`{e.id}`"
            tag = e.original_tag if (anonymize and e.original_tag and e.original_tag.startswith("`")) else (_cell(e.original_tag, anonymize) if anonymize else e.original_tag or "—")
            if not anonymize:
                tag = f"`{e.original_tag}`" if e.original_tag else "—"
            ns = e.namespace if (anonymize and e.namespace and e.namespace.startswith("`")) else (_cell(e.namespace, anonymize) if anonymize and e.namespace else (e.namespace or "—"))
            name_cell = _cell(e.name, anonymize) if anonymize else (e.name or "—")
            attrs = ", ".join(f"{k}={v}" for k, v in e.raw_attributes.items())[:80] if e.raw_attributes else "—"
            lines.append(f"| {id_cell} | {tag} | {ns} | {name_cell} | {attrs or '—'} |")
    lines.append("")

    # 15 Service Implementations (Tool 1.5)
    lines.append("## 15. Service Implementations (Tool 1.5)")
    lines.append("")
    svc_impls = getattr(doc, "service_implementations", []) or []
    if not svc_impls:
        lines.append("_No service implementations detected (Tool 1.5: no operationRef/interfaceRef/extension mapping)._")
        lines.append("")
        lines.append("> Suggerimento: se ti aspettavi mapping WSDL/JCA, verifica che il BPMN contenga `operationRef`, `messageRef` o `extensionElements` con adapter/binding.")
    else:
        lines.append(f"_Total: {len(svc_impls)} service implementation(s) inferred from extensions/references._")
        lines.append("")
        lines.append("| Task ID | Task Name | Type | Operation | Interface | Message | Endpoint | Adapter | Status | Source |")
        lines.append("|---|---|---|---|---|---|---|---|---|---|")
        for impl in svc_impls[:30]:
            # impl may be dict or ServiceImplementation
            if isinstance(impl, dict):
                tid = impl.get("task_id") or impl.get("taskId") or "—"
                tname = impl.get("task_name") or "—"
                ttype = impl.get("task_type") or "—"
                op = impl.get("operation_ref") or "—"
                iface = impl.get("interface_ref") or "—"
                msg = impl.get("message_ref") or "—"
                ep = impl.get("endpoint") or "—"
                adapter = impl.get("adapter") or "—"
                status = impl.get("status") or "—"
                source = impl.get("source") or "—"
            else:
                tid = getattr(impl, "task_id", "—")
                tname = getattr(impl, "task_name", "—") or "—"
                ttype = getattr(impl, "task_type", "—") or "—"
                op = getattr(impl, "operation_ref", "—") or "—"
                iface = getattr(impl, "interface_ref", "—") or "—"
                msg = getattr(impl, "message_ref", "—") or "—"
                ep = getattr(impl, "endpoint", "—") or "—"
                adapter = getattr(impl, "adapter", "—") or "—"
                status = getattr(impl, "status", "—") or "—"
                source = getattr(impl, "source", "—") or "—"
            # anonymize wrapping
            tid_c = tid if (anonymize and isinstance(tid, str) and tid.startswith("`")) else (_cell(tid, anonymize) if anonymize and tid != "—" else f"`{tid}`" if tid != "—" else "—")
            tname_c = _cell(tname, anonymize) if anonymize and tname != "—" else (tname or "—")
            op_c = _cell(op, anonymize) if anonymize and op != "—" else (f"`{op}`" if op != "—" else "—")
            iface_c = _cell(iface, anonymize) if anonymize and iface != "—" else (f"`{iface}`" if iface != "—" else "—")
            ep_c = _cell(ep, anonymize) if anonymize and ep != "—" else (ep[:40] + "..." if len(ep) > 40 else ep) if ep != "—" else "—"
            lines.append(f"| {tid_c} | {tname_c} | {ttype} | {op_c} | {iface_c} | {msg} | {ep_c} | {adapter} | {status} | {source} |")
        if len(svc_impls) > 30:
            lines.append(f"| _...+{len(svc_impls)-30} more_ |  |  |  |  |  |  |  |  |  |")
    lines.append("")
    # 15b Enriched Flows note
    # Check if any element was enriched
    enriched_count = sum(1 for e in doc.elements if getattr(e, "was_incoming_enriched", False) or getattr(e, "was_outgoing_enriched", False))
    if enriched_count:
        lines.append(f"> Nota Tool 1.5: {enriched_count} attività avevano `incoming`/`outgoing` vuoti nel XML e sono stati arricchiti da `sequenceFlow` (backfill). Ora la tabella Attività è auto-descrittiva.")
        lines.append("")

    # 16 Unresolved References (pre-Tool 2)
    lines.append("## 16. Unresolved References (verso Tool 2)")
    lines.append("")
    unresolved = getattr(doc, "unresolved_references", []) or []
    if not unresolved:
        lines.append("_Nessun riferimento irrisolto (o Tool 2 non ancora necessario)._")
    else:
        lines.append(f"_Total: {len(unresolved)} riferimenti che richiederanno resolver WSDL/BPEL/Composite (Tool 2)._")
        lines.append("")
        lines.append("| Source | Attribute | Value | Reason |")
        lines.append("|---|---|---|---|")
        for ur in unresolved[:30]:
            if isinstance(ur, dict):
                src = ur.get("source_element") or ur.get("source") or "—"
                attr = ur.get("attribute") or "—"
                val = ur.get("value") or "—"
                reason = ur.get("reason") or "—"
            else:
                src = getattr(ur, "source_element", "—")
                attr = getattr(ur, "attribute", "—")
                val = getattr(ur, "value", "—")
                reason = getattr(ur, "reason", "—")
            src_c = src if (anonymize and isinstance(src, str) and src.startswith("`")) else (_cell(src, anonymize) if anonymize and src != "—" else f"`{src}`" if src != "—" else "—")
            val_c = val if (anonymize and isinstance(val, str) and val.startswith("`")) else (_cell(val, anonymize) if anonymize and val != "—" else f"`{val}`" if val != "—" else "—")
            lines.append(f"| {src_c} | {attr} | {val_c} | {reason} |")
        if len(unresolved) > 30:
            lines.append(f"| _...+{len(unresolved)-30} more_ |  |  |  |")
    lines.append("")

    lines.append("---")
    lines.append("")
    lines.append("```")
    lines.append("Tool 1.5 = BPMN Semantic Enricher (schema 1.5)")
    lines.append("Tool 1   = BPMN Structural Reverse Engineering")
    lines.append("")
    lines.append("Input:")
    lines.append("BPMN")
    lines.append("")
    lines.append("Output:")
    lines.append("Normalized BPMN Model")
    lines.append("+")
    lines.append("Execution Graph")
    lines.append("+")
    lines.append("Structural Analysis")
    lines.append("")
    lines.append("Next:")
    lines.append("Cross-artifact Dependency Resolution")
    lines.append("```")

    return "\n".join(lines)
