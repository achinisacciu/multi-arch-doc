#!/usr/bin/env python3
"""
ODI 12c CSV Builder Module
Generates a richer CSV from parsed mapping data.

Includes:
- sources / targets / lookups;
- components inventory;
- target attributes;
- expression components;
- aggregate rules;
- join conditions;
- filter conditions;
- knowledge modules;
- execution units;
- scenarios.
"""

import csv
from pathlib import Path
from typing import Any, Dict, List


FIELDNAMES = [
    "Mapping_Name",
    "Mapping_Description",
    "Project",
    "Folder",
    "Category",
    "Component_Name",
    "Component_Type",
    "Datastore",
    "Attribute_Name",
    "Expression",
    "Function",
    "Required",
    "Data_Type",
    "Length",
    "Scale",
    "Details",
]


def _clean(value: Any) -> str:
    if value is None:
        return ""
    return str(value).replace("\r\n", " ").replace("\n", " ").replace("\r", " ")


def generate_csv(data: dict, output_path: Path):
    """
    Genera un file CSV più completo a partire dai dati del mapping.
    """
    mapping = data.get("mapping", {}) or {}

    mapping_name = mapping.get("name") or "Unknown_Mapping"
    mapping_description = mapping.get("description") or ""
    project = mapping.get("project_name") or mapping.get("project_code") or ""
    folder = mapping.get("folder_name") or ""

    rows: List[Dict[str, Any]] = []

    def base_row(category: str, **kwargs) -> Dict[str, Any]:
        row = {field: "" for field in FIELDNAMES}
        row.update({
            "Mapping_Name": mapping_name,
            "Mapping_Description": mapping_description,
            "Project": project,
            "Folder": folder,
            "Category": category,
        })
        row.update(kwargs)
        return {k: _clean(v) for k, v in row.items()}

    # ------------------------------------------------------------------
    # 1. Sorgenti, target, lookup
    # ------------------------------------------------------------------

    for src in data.get("sources", []):
        rows.append(base_row(
            "SOURCE",
            Component_Type="DATASTORE",
            Datastore=src,
            Details="Tabella sorgente",
        ))

    for tgt in data.get("targets", []):
        rows.append(base_row(
            "TARGET",
            Component_Type="DATASTORE",
            Datastore=tgt,
            Details="Tabella target",
        ))

    for lk in data.get("lookups", []):
        rows.append(base_row(
            "LOOKUP",
            Component_Type="DATASTORE",
            Datastore=lk,
            Details="Tabella di lookup",
        ))

    # ------------------------------------------------------------------
    # 2. Inventario componenti
    # ------------------------------------------------------------------

    for comp in data.get("components", []):
        details_parts = []

        if comp.get("alias"):
            details_parts.append(f"Alias: {comp.get('alias')}")

        if comp.get("description"):
            details_parts.append(f"Description: {comp.get('description')}")

        rows.append(base_row(
            "COMPONENT",
            Component_Name=comp.get("name", ""),
            Component_Type=comp.get("type_name", ""),
            Datastore=comp.get("datastore_name", ""),
            Details=" | ".join(details_parts),
        ))

    # ------------------------------------------------------------------
    # 3. Target attributes
    # ------------------------------------------------------------------

    for ta in data.get("target_attributes", []):
        rows.append(base_row(
            "TARGET_ATTRIBUTE",
            Component_Type="DATASTORE",
            Datastore=ta.get("datastore", ""),
            Attribute_Name=ta.get("attribute", ""),
            Expression=ta.get("source_expression", ""),
            Required="Sì" if ta.get("is_required") else "No",
            Data_Type=ta.get("attr_type", ""),
            Length=_clean(ta.get("length", "")),
            Scale=_clean(ta.get("scale", "")),
        ))

    # ------------------------------------------------------------------
    # 4. Expression components
    # ------------------------------------------------------------------

    for expr_comp in data.get("expressions", []):
        comp_name = expr_comp.get("name", "")

        for exp in expr_comp.get("expressions", []):
            rows.append(base_row(
                "EXPRESSION",
                Component_Name=comp_name,
                Component_Type="EXPRESSION",
                Attribute_Name=exp.get("attribute", ""),
                Expression=exp.get("expression", ""),
            ))

    # ------------------------------------------------------------------
    # 5. Aggregates
    # ------------------------------------------------------------------

    for agg_comp in data.get("aggregates", []):
        comp_name = agg_comp.get("name", "")

        for gb in agg_comp.get("group_by", []):
            rows.append(base_row(
                "AGGREGATE_GROUP_BY",
                Component_Name=comp_name,
                Component_Type="AGGREGATE",
                Attribute_Name=gb.get("attribute", ""),
                Expression=gb.get("expression", ""),
                Function="GROUP BY",
            ))

        for aggr in agg_comp.get("aggregations", []):
            rows.append(base_row(
                "AGGREGATE_FUNCTION",
                Component_Name=comp_name,
                Component_Type="AGGREGATE",
                Attribute_Name=aggr.get("attribute", ""),
                Expression=aggr.get("expression", ""),
                Function=aggr.get("function", "AUTO"),
            ))

    # ------------------------------------------------------------------
    # 6. Join conditions
    # ------------------------------------------------------------------

    for join_comp in data.get("join_conditions", []):
        comp_name = join_comp.get("name", "")

        for cond in join_comp.get("conditions", []):
            rows.append(base_row(
                "JOIN_CONDITION",
                Component_Name=comp_name,
                Component_Type="JOIN",
                Attribute_Name="JOIN_CONDITION",
                Expression=cond,
            ))

    # ------------------------------------------------------------------
    # 7. Filter conditions
    # ------------------------------------------------------------------

    for filt_comp in data.get("filter_conditions", []):
        comp_name = filt_comp.get("name", "")

        for cond in filt_comp.get("conditions", []):
            rows.append(base_row(
                "FILTER_CONDITION",
                Component_Name=comp_name,
                Component_Type="FILTER",
                Attribute_Name="FILTER_CONDITION",
                Expression=cond,
            ))

    # ------------------------------------------------------------------
    # 8. Knowledge Modules
    # ------------------------------------------------------------------

    for km in data.get("kms", []):
        rows.append(base_row(
            "KM",
            Component_Name=km.get("name", ""),
            Component_Type="KM",
            Details="Knowledge Module",
        ))

    # ------------------------------------------------------------------
    # 9. Execution units
    # ------------------------------------------------------------------

    for eu in data.get("execution_units", []):
        details = []

        if eu.get("group"):
            details.append(f"Group: {eu.get('group')}")
        if eu.get("logical_schema"):
            details.append(f"Logical Schema: {eu.get('logical_schema')}")
        if eu.get("km"):
            details.append(f"KM: {eu.get('km')}")

        rows.append(base_row(
            "EXECUTION_UNIT",
            Component_Name=eu.get("name", ""),
            Component_Type="EXECUTION_UNIT",
            Details=" | ".join(details),
        ))

    # ------------------------------------------------------------------
    # 10. Scenarios
    # ------------------------------------------------------------------

    for scen in data.get("scenarios", []):
        details = []

        if scen.get("scen_version"):
            details.append(f"Version: {scen.get('scen_version')}")
        if scen.get("last_date"):
            details.append(f"Last Date: {scen.get('last_date')}")
        if scen.get("last_user"):
            details.append(f"Last User: {scen.get('last_user')}")

        rows.append(base_row(
            "SCENARIO",
            Component_Name=scen.get("scen_name", ""),
            Component_Type="SCENARIO",
            Details=" | ".join(details),
        ))

    # ------------------------------------------------------------------
    # Write CSV
    # ------------------------------------------------------------------

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if not rows:
        rows.append(base_row(
            "INFO",
            Details="Nessuna regola o informazione estratta dal mapping.",
        ))

    with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=FIELDNAMES,
            extrasaction="ignore",
        )
        writer.writeheader()
        writer.writerows(rows)

    return output_path