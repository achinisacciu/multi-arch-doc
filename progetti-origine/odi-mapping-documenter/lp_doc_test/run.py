#!/usr/bin/env python3
"""progetti-origine/odi-mapping-documenter/lp_doc_test/run.py
Analizzatore e documentatore specialistico per LoadPlan Oracle ODI (SnpLoadPlan, SnpLpStep).
Genera il documento Markdown dell'orchestrazione con gerarchia dei passi e diagramma Mermaid.
"""
from __future__ import annotations

import argparse
import os
import sys
import xml.etree.ElementTree as ET


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if isinstance(tag, str) else ""


def parse_loadplan(xml_path: str) -> dict:
    info = {
        "file": os.path.basename(xml_path),
        "name": os.path.splitext(os.path.basename(xml_path))[0],
        "global_id": "—",
        "steps": [],
    }
    try:
        root = ET.parse(xml_path).getroot()
    except Exception as e:
        info["error"] = str(e)
        return info

    for obj in root.iter():
        if not isinstance(obj.tag, str) or _local(obj.tag) != "Object":
            continue
        cls = (obj.get("class") or "").rsplit(".", 1)[-1]
        fields: dict[str, str] = {}
        for f in obj:
            if not isinstance(f.tag, str) or _local(f.tag) != "Field":
                continue
            fn = f.get("name")
            val = (f.text or "").strip()
            if fn and val and val != "null":
                fields[fn] = val

        if cls == "SnpLoadPlan":
            if "LoadPlanName" in fields:
                info["name"] = fields["LoadPlanName"]
            if "GlobalId" in fields:
                info["global_id"] = fields["GlobalId"]

        elif cls == "SnpLpStep":
            step = {
                "id": fields.get("ILpStep", ""),
                "name": fields.get("LpStepName", "Step"),
                "type": fields.get("LpStepType", "SCENARIO"),
                "order": fields.get("StepOrder", "0"),
                "parent_id": fields.get("ParILpStep", "null"),
                "scen_name": fields.get("ScenName", ""),
            }
            info["steps"].append(step)

    # Ordina gli step per ordine di esecuzione
    try:
        info["steps"].sort(key=lambda s: int(s["order"]))
    except (ValueError, TypeError):
        pass

    return info


def generate_loadplan_doc(info: dict, out_file: str, scenarios: list[str] | None = None) -> None:
    os.makedirs(os.path.dirname(out_file), exist_ok=True)
    lines = [
        f"# Scheda di Orchestrazione LoadPlan — {info['name']}",
        "",
        f"_File Sorgente: `{info['file']}` · Global ID: `{info['global_id']}`_",
        "",
        "## 1. Visione d'Insieme del Piano di Caricamento",
        f"Il LoadPlan **`{info['name']}`** definisce l'orchestrazione ed esecuzione batch "
        f"dei flussi ETL. Coordina un totale di **{len(info['steps'])} step operativi**.",
        "",
        "## 2. Sequenza e Albero di Esecuzione degli Step",
    ]

    if info["steps"]:
        lines += [
            "| Ordine | Nome Step | Tipo Step | Scenario Invocato | ID Step | Step Padre |",
            "|---|---|---|---|---|---|",
        ]
        for s in info["steps"]:
            scen_display = f"`{s['scen_name']}`" if s["scen_name"] else "—"
            parent = f"`{s['parent_id']}`" if s["parent_id"] != "null" else "Radice (Root)"
            lines.append(f"| {s['order']} | **`{s['name']}`** | `{s['type']}` | {scen_display} | `{s['id']}` | {parent} |")
        lines.append("")
    else:
        lines += ["_Nessuno step SnpLpStep esplicito rilevato nel file XML._", ""]

    # Diagramma Mermaid del workflow
    lines += [
        "## 3. Diagramma di Flusso di Esecuzione",
        "```mermaid",
        "flowchart TD",
        f'    START(["🚀 Avvio LoadPlan: {info["name"]}"])',
    ]

    if info["steps"]:
        prev_node = "START"
        for i, s in enumerate(info["steps"]):
            node_id = f"STEP_{i}"
            label = f"{s['name']}\\n({s['type']})"
            if s["scen_name"]:
                label += f"\\n▶ {s['scen_name']}"
            lines.append(f'    {node_id}["{label}"]')
            lines.append(f'    {prev_node} --> {node_id}')
            prev_node = node_id
        lines.append(f'    {prev_node} --> END(["🏁 Fine Esecuzione"])')
    else:
        lines.append(f'    START --> END(["🏁 Fine Esecuzione (nessuno step)"])')

    lines += ["```", ""]

    if scenarios:
        lines += [
            "## 4. Scenari Noti nel Perimetro",
            f"Trovati {len(scenarios)} scenari associati nel perimetro di analisi.",
            "",
        ]
        for sc in scenarios[:20]:
            lines.append(f"- `{os.path.basename(sc)}`")
        if len(scenarios) > 20:
            lines.append(f"- … e altri {len(scenarios) - 20} scenari.")
        lines.append("")

    with open(out_file, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="LoadPlan Documenter.")
    parser.add_argument("lp_file", help="Path del file XML del LoadPlan")
    parser.add_argument("--scenarios", nargs="*", default=[], help="Elenco scenari disponibili")
    args = parser.parse_args(argv)

    if not os.path.isfile(args.lp_file):
        print(f"Errore: file non trovato {args.lp_file}", file=sys.stderr)
        return 1

    info = parse_loadplan(args.lp_file)
    here = os.path.dirname(os.path.abspath(__file__))
    outdir = os.path.join(here, "output")
    out_file = os.path.join(outdir, f"{info['name']}_LOADPLAN.md")

    generate_loadplan_doc(info, out_file, args.scenarios)
    print(f"ok: generato {out_file}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
