#!/usr/bin/env python3
"""
Parser per file XML di esportazione ODI Load Plan + Scenari.
Supporta: SnpLoadPlan, SnpPlanAgent, SnpLpStep, SnpScen, SnpScenStep, SnpScenTask.
"""
from pathlib import Path
from typing import Optional
from lxml import etree as ET


def _parse_xml_objects(xml_path: str):
    """Yield (class_name, obj_element) for all Object in a SunopsisExport XML."""
    tree = ET.parse(str(xml_path), ET.XMLParser(recover=True, huge_tree=True))
    for obj in tree.getroot().findall("Object"):
        cls = obj.get("class", "").split(".")[-1]
        yield cls, obj


def _get_field(obj, field_name, default=None):
    for field in obj.findall("Field"):
        if field.get("name") == field_name:
            text = field.text
            if text is None or text.strip().lower() == "null":
                return default
            return text.strip()
    return default


class OdiLoadPlanParser:
    def __init__(self, xml_path: str, scenario_paths: Optional[list[str]] = None):
        self.xml_path = Path(xml_path)

        self.load_plan = {}
        self.plan_agents = {}
        self.lp_steps = {}
        self.lp_vars = {}
        self.lp_step_vars = {}
        self.fk_refs = []

        # Scenario data (populated from scenario files)
        self.scenarios = {}
        self.scen_steps = {}
        self.scen_tasks = {}

        self._parse_loadplan_file()
        if scenario_paths:
            for sp in scenario_paths:
                self._parse_scenario_file(sp)
        self._build_step_tree()
        self._link_scenarios_to_steps()

    # ------------------------------------------------------------------
    # Load Plan file parsing
    # ------------------------------------------------------------------
    def _parse_loadplan_file(self):
        """Parse the load plan XML file for all supported object types."""
        for class_name, obj in _parse_xml_objects(str(self.xml_path)):
            if class_name == "SnpLoadPlan":
                self._parse_load_plan(obj)
            elif class_name == "SnpPlanAgent":
                self._parse_plan_agent(obj)
            elif class_name == "SnpLpStep":
                self._parse_lp_step(obj)
            elif class_name == "SnpLpVar":
                self._parse_lp_var(obj)
            elif class_name == "SnpLpStepVar":
                self._parse_lp_step_var(obj)
            elif class_name == "SnpFKXRef":
                self._parse_fk_ref(obj)

    def _parse_load_plan(self, obj):
        self.load_plan = {
            "load_plan_name": _get_field(obj, "LoadPlanName"),
            "i_load_plan": _get_field(obj, "ILoadPlan"),
            "global_id": _get_field(obj, "GlobalId"),
            "first_date": _get_field(obj, "FirstDate"),
            "last_date": _get_field(obj, "LastDate"),
            "first_user": _get_field(obj, "FirstUser"),
            "last_user": _get_field(obj, "LastUser"),
            "ind_sess_log": _get_field(obj, "IndSessLog"),
            "ind_step_log": _get_field(obj, "IndStepLog"),
            "keep_log_hdays": _get_field(obj, "KeepLogHdays"),
            "task_log_level": _get_field(obj, "TaskLogLevel"),
            "sess_keywords": _get_field(obj, "SessKeywords"),
            "cec_lpr_behavior": _get_field(obj, "CecLprBehavior"),
            "max_cec_lpr": _get_field(obj, "MaxCecLpr"),
            "i_scen_folder": _get_field(obj, "IScenFolder"),
        }

    def _parse_plan_agent(self, obj):
        agent_no = _get_field(obj, "IPlanAgent")
        self.plan_agents[agent_no] = {
            "i_plan_agent": agent_no,
            "lagent_name": _get_field(obj, "LagentName"),
            "context_code": _get_field(obj, "ContextCode"),
            "scen_name": _get_field(obj, "ScenName"),
            "scen_version": _get_field(obj, "ScenVersion"),
            "user_name": _get_field(obj, "UserName"),
            "global_id": _get_field(obj, "GlobalId"),
            "first_date": _get_field(obj, "FirstDate"),
            "last_date": _get_field(obj, "LastDate"),
            "first_user": _get_field(obj, "FirstUser"),
            "last_user": _get_field(obj, "LastUser"),
            "ind_job_type": _get_field(obj, "IndJobType"),
            "log_level": _get_field(obj, "LogLevel"),
            "ind_resident": _get_field(obj, "IndResident"),
            "plan_name": _get_field(obj, "PlanName"),
            "stat_plan": _get_field(obj, "StatPlan"),
            "s_type": _get_field(obj, "SType"),
            "s_hour": _get_field(obj, "SHour"),
            "s_minute": _get_field(obj, "SMinute"),
            "s_second": _get_field(obj, "SSecond"),
            "s_day": _get_field(obj, "SDay"),
            "s_month": _get_field(obj, "SMonth"),
            "s_year": _get_field(obj, "SYear"),
            "s_week_day": _get_field(obj, "SWeekDay"),
            "s_month_day": _get_field(obj, "SMonthDay"),
            "s_begin_date": _get_field(obj, "SBeginDate"),
            "s_end_date": _get_field(obj, "SEndDate"),
            "s_begin_hour": _get_field(obj, "SBeginHour"),
            "s_end_hour": _get_field(obj, "SEndHour"),
            "r_cycle_unit": _get_field(obj, "RCycleUnit"),
            "r_dur_cycle": _get_field(obj, "RDurCycle"),
            "r_dur_interval": _get_field(obj, "RDurInterval"),
            "r_interval_unit": _get_field(obj, "RIntervalUnit"),
            "r_time": _get_field(obj, "RTime"),
            "r_time_error": _get_field(obj, "RTimeError"),
            "r_deadline": _get_field(obj, "RDeadline"),
            "r_deadline_unit": _get_field(obj, "RDeadlineUnit"),
        }

    def _parse_lp_step(self, obj):
        step_no = _get_field(obj, "ILpStep")
        self.lp_steps[step_no] = {
            "i_lp_step": step_no,
            "i_load_plan": _get_field(obj, "ILoadPlan"),
            "lp_step_name": _get_field(obj, "LpStepName"),
            "lp_step_type": _get_field(obj, "LpStepType"),
            "step_order": _get_field(obj, "StepOrder"),
            "par_i_lp_step": _get_field(obj, "ParILpStep"),
            "scen_name": _get_field(obj, "ScenName"),
            "scen_no": _get_field(obj, "ScenNo"),
            "scen_version": _get_field(obj, "ScenVersion"),
            "context_code": _get_field(obj, "ContextCode"),
            "except_behavior": _get_field(obj, "ExceptBehavior"),
            "ind_enabled": _get_field(obj, "IndEnabled"),
            "global_id": _get_field(obj, "GlobalId"),
            "lagent_name": _get_field(obj, "LagentName"),
            "restart_type": _get_field(obj, "RestartType"),
            "step_priority": _get_field(obj, "StepPriority"),
            "step_timeout": _get_field(obj, "StepTimeout"),
            "max_par_error": _get_field(obj, "MaxParError"),
            "sess_keywords": _get_field(obj, "SessKeywords"),
            "var_name": _get_field(obj, "VarName"),
            "var_value": _get_field(obj, "VarValue"),
            "var_op": _get_field(obj, "VarOp"),
            "var_long_value": _get_field(obj, "VarLongValue"),
            "i_lp_step_except": _get_field(obj, "ILpStepExcept"),
        }

    def _parse_lp_var(self, obj):
        var_id = _get_field(obj, "ILpVar")
        self.lp_vars[var_id] = {
            "i_lp_var": var_id,
            "i_load_plan": _get_field(obj, "ILoadPlan"),
            "var_name": _get_field(obj, "VarName"),
            "var_type": _get_field(obj, "VarType"),
            "default_value": _get_field(obj, "DefaultValue"),
            "global_id": _get_field(obj, "GlobalId"),
        }

    def _parse_lp_step_var(self, obj):
        sv_id = _get_field(obj, "ILpStepVar")
        self.lp_step_vars[sv_id] = {
            "i_lp_step_var": sv_id,
            "i_lp_step": _get_field(obj, "ILpStep"),
            "var_name": _get_field(obj, "VarName"),
            "var_value": _get_field(obj, "VarValue"),
            "var_op": _get_field(obj, "VarOp"),
            "var_long_value": _get_field(obj, "VarLongValue"),
            "global_id": _get_field(obj, "GlobalId"),
        }

    def _parse_fk_ref(self, obj):
        self.fk_refs.append({
            "ref_key": _get_field(obj, "RefKey"),
            "ref_obj_global_id": _get_field(obj, "RefObjGlobalId"),
            "ref_obj_fq_name": _get_field(obj, "RefObjFQName"),
            "ref_obj_fq_type": _get_field(obj, "RefObjFQType"),
        })

    # ------------------------------------------------------------------
    # Scenario file parsing
    # ------------------------------------------------------------------
    def _parse_scenario_file(self, path: str):
        """Parse an additional XML file containing SnpScen / SnpScenStep / SnpScenTask."""
        for class_name, obj in _parse_xml_objects(path):
            if class_name == "SnpScen":
                self._parse_scen(obj)
            elif class_name == "SnpScenStep":
                self._parse_scen_step(obj)
            elif class_name == "SnpScenTask":
                self._parse_scen_task(obj)

    def _parse_scen(self, obj):
        scen_no = _get_field(obj, "ScenNo")
        if not scen_no:
            return
        self.scenarios[scen_no] = {
            "scen_no": scen_no,
            "scen_name": _get_field(obj, "ScenName"),
            "scen_version": _get_field(obj, "ScenVersion"),
            "i_mapping": _get_field(obj, "IMapping"),
            "first_date": _get_field(obj, "FirstDate"),
            "last_date": _get_field(obj, "LastDate"),
            "first_user": _get_field(obj, "FirstUser"),
            "last_user": _get_field(obj, "LastUser"),
            "global_id": _get_field(obj, "GlobalId"),
        }

    def _parse_scen_step(self, obj):
        scen_no = _get_field(obj, "ScenNo")
        nno = _get_field(obj, "Nno")
        if not scen_no or not nno:
            return
        key = (scen_no, nno)
        self.scen_steps[key] = {
            "scen_no": scen_no,
            "nno": nno,
            "step_name": _get_field(obj, "StepName"),
            "step_type": _get_field(obj, "StepType"),
            "table_name": _get_field(obj, "TableName"),
            "res_name": _get_field(obj, "ResName"),
            "lschema_name": _get_field(obj, "LschemaName"),
            "mod_code": _get_field(obj, "ModCode"),
            "gen_info": _get_field(obj, "GenInfo"),
        }

    def _parse_scen_task(self, obj):
        scen_no = _get_field(obj, "ScenNo")
        task_no = _get_field(obj, "ScenTaskNo")
        if not scen_no or not task_no:
            return
        key = (scen_no, task_no)
        self.scen_tasks[key] = {
            "scen_no": scen_no,
            "scen_task_no": task_no,
            "task_name1": _get_field(obj, "TaskName1"),
            "task_name2": _get_field(obj, "TaskName2"),
            "task_name3": _get_field(obj, "TaskName3"),
            "task_type": _get_field(obj, "TaskType"),
            "def_txt": _get_field(obj, "DefTxt"),
            "col_txt": _get_field(obj, "ColTxt"),
            "def_lschema_name": _get_field(obj, "DefLschemaName"),
            "col_lschema_name": _get_field(obj, "ColLschemaName"),
            "def_tech_int_name": _get_field(obj, "DefTechIntName"),
            "col_tech_int_name": _get_field(obj, "ColTechIntName"),
            "nno": _get_field(obj, "Nno"),
            "ord_trt": _get_field(obj, "OrdTrt"),
            "map_task_type": _get_field(obj, "MapTaskType"),
        }

    # ------------------------------------------------------------------
    # Post-processing
    # ------------------------------------------------------------------
    def _build_step_tree(self):
        steps_list = list(self.lp_steps.values())

        # Attach step vars
        step_vars_map = {}
        for sv in self.lp_step_vars.values():
            step_id = sv.get("i_lp_step")
            step_vars_map.setdefault(step_id, []).append(sv)
        for step in steps_list:
            step["_step_vars"] = step_vars_map.get(step["i_lp_step"], [])

        child_map = {}
        for step in steps_list:
            parent = step.get("par_i_lp_step")
            child_map.setdefault(parent, []).append(step)

        for step in steps_list:
            step_no = step["i_lp_step"]
            step["children"] = sorted(
                child_map.get(step_no, []),
                key=lambda s: int(s.get("step_order") or 0)
            )

        self._root_steps = sorted(
            child_map.get(None, []),
            key=lambda s: int(s.get("step_order") or 0)
        )

    def _link_scenarios_to_steps(self):
        """Attach scenario details to each LP step that references a scenario."""
        for step in self.lp_steps.values():
            scen_no = step.get("scen_no")
            if scen_no and scen_no in self.scenarios:
                step["_scenario"] = self.scenarios[scen_no]
                # Attach steps
                step["_scen_steps"] = [
                    v for k, v in sorted(self.scen_steps.items())
                    if k[0] == scen_no
                ]
                # Attach tasks with SQL
                step["_scen_tasks"] = [
                    v for k, v in sorted(self.scen_tasks.items(),
                                         key=lambda kv: int(kv[1].get("ord_trt") or 0))
                    if k[0] == scen_no
                ]
            else:
                step["_scenario"] = None
                step["_scen_steps"] = []
                step["_scen_tasks"] = []
            # Recurse children
            self._link_scenarios_to_steps_in_children(step)

    def _link_scenarios_to_steps_in_children(self, step):
        for child in step.get("children", []):
            scen_no = child.get("scen_no")
            if scen_no and scen_no in self.scenarios:
                child["_scenario"] = self.scenarios[scen_no]
                child["_scen_steps"] = [
                    v for k, v in sorted(self.scen_steps.items())
                    if k[0] == scen_no
                ]
                child["_scen_tasks"] = [
                    v for k, v in sorted(self.scen_tasks.items(),
                                         key=lambda kv: int(kv[1].get("ord_trt") or 0))
                    if k[0] == scen_no
                ]
            else:
                child["_scenario"] = None
                child["_scen_steps"] = []
                child["_scen_tasks"] = []
            self._link_scenarios_to_steps_in_children(child)

    @property
    def root_steps(self):
        return self._root_steps

    def to_dict(self):
        return {
            "load_plan": self.load_plan,
            "plan_agents": sorted(self.plan_agents.values(),
                                  key=lambda a: int(a.get("i_plan_agent") or 0)),
            "lp_steps": self._root_steps,
            "lp_vars": sorted(self.lp_vars.values(),
                              key=lambda v: int(v.get("i_lp_var") or 0)),
            "lp_step_vars": sorted(self.lp_step_vars.values(),
                                   key=lambda v: int(v.get("i_lp_step_var") or 0)),
            "fk_refs": self.fk_refs,
            "scenarios": sorted(self.scenarios.values(),
                                key=lambda s: int(s.get("scen_no") or 0)),
            "_scen_steps": self.scen_steps,
            "_scen_tasks": self.scen_tasks,
        }
