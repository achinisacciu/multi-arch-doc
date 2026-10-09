#!/usr/bin/env python3
"""progetti-origine/odi-mapping-documenter/run.py
Analizzatore e documentatore dettagliato per export XML Oracle ODI (SnpMapping, SnpPop, ecc.).
Genera documentazione tecnica, di business, diagrammi di flusso e file CSV.
"""
from __future__ import annotations

import argparse
import csv
import os
import sys
import xml.etree.ElementTree as ET


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if isinstance(tag, str) else ""


def parse_odi_export(xml_path: str) -> dict:
    info = {
        "file": os.path.basename(xml_path),
        "mappings": [],
        "loadplans": [],
        "scenarios": [],
        "tables": {"sources": set(), "targets": set()},
        "joins": [],
        "filters": [],
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
        fields: dict[str, list[str]] = {}
        for f in obj:
            if not isinstance(f.tag, str) or _local(f.tag) != "Field":
                continue
            fn = f.get("name")
            val = (f.text or "").strip()
            if fn and val and val != "null":
                fields.setdefault(fn, []).append(val)

        if cls in ("SnpMapping", "SnpPop"):
            name = fields.get("Name") or fields.get("PopName") or [os.path.splitext(info["file"])[0]]
            sources = fields.get("SourceTable") or fields.get("SourceDataStore") or []
            targets = fields.get("TargetTable") or fields.get("TargetDataStore") or []
            desc = fields.get("Description") or fields.get("Desc") or ["Trasformazione ETL"]
            m_info = {
                "name": name[0],
                "sources": sources,
                "targets": targets,
                "description": desc[0],
                "class": cls,
            }
            info["mappings"].append(m_info)
            info["tables"]["sources"].update(sources)
            info["tables"]["targets"].update(targets)

        elif cls == "SnpLoadPlan":
            lp_name = fields.get("LoadPlanName") or ["LP_UNNAMED"]
            gid = fields.get("GlobalId") or ["—"]
            info["loadplans"].append({"name": lp_name[0], "global_id": gid[0]})

        elif cls == "SnpScen":
            sc_name = fields.get("ScenName") or ["SCEN_UNNAMED"]
            ver = fields.get("ScenVersion") or ["001"]
            info["scenarios"].append({"name": sc_name[0], "version": ver[0]})

    return info


def build_docs(info: dict, outdir: str) -> list[str]:
    os.makedirs(outdir, exist_ok=True)
    created = []
    base_name = os.path.splitext(info["file"])[0]

    # 1. Documento Tecnico
    tech_lines = [
        f"# Scheda Tecnica Dettagliata ODI — `{info['file']}`",
        "",
        "## 1. Dati Generali",
        f"- **File Sorgente:** `{info['file']}`",
        f"- **Mapping Rilevati:** {len(info['mappings'])}",
        f"- **LoadPlan Rilevati:** {len(info['loadplans'])}",
        f"- **Scenari Rilevati:** {len(info['scenarios'])}",
        "",
        "## 2. Dettaglio Mapping e Regole di Trasformazione",
    ]
    if info["mappings"]:
        for m in info["mappings"]:
            tech_lines += [
                f"### Mapping: `{m['name']}`",
                f"- **Descrizione Operativa:** {m['description']}",
                f"- **Classe ODI:** `{m['class']}`",
                f"- **Tabelle Sorgente (Extract):** {', '.join(f'`{s}`' for s in m['sources']) or '—'}",
                f"- **Tabelle Destinazione (Load):** {', '.join(f'`{t}`' for t in m['targets']) or '—'}",
                "",
                "#### Matrice I/O",
                "| Direzione | Schema.Tabella | Tipo Accesso |",
                "|---|---|---|",
            ]
            for s in m["sources"]:
                tech_lines.append(f"| Sorgente (IN) | `{s}` | READ / EXTRACTION |")
            for t in m["targets"]:
                tech_lines.append(f"| Destinazione (OUT) | `{t}` | WRITE / LOAD (IKM) |")
            tech_lines.append("")
    else:
        tech_lines.append("_Nessun mapping SnpMapping / SnpPop rilevato nel file._\n")

    if info["loadplans"]:
        tech_lines += ["## 3. LoadPlan Rilevati", ""]
        for lp in info["loadplans"]:
            tech_lines.append(f"- **Nome:** `{lp['name']}` (GlobalId: `{lp['global_id']}`)")
        tech_lines.append("")

    if info["scenarios"]:
        tech_lines += ["## 4. Scenari Rilevati", ""]
        for sc in info["scenarios"]:
            tech_lines.append(f"- **Scenario:** `{sc['name']}` (Versione: `{sc['version']}`)")
        tech_lines.append("")

    tech_path = os.path.join(outdir, f"{base_name}_TECNICO.md")
    with open(tech_path, "w", encoding="utf-8") as f:
        f.write("\n".join(tech_lines))
    created.append(os.path.basename(tech_path))

    # 2. Documento di Flusso con diagramma Mermaid
    flow_lines = [
        f"# Flusso Dati e Lineage ETL — `{info['file']}`",
        "",
        "## Diagramma di Lineage Dati",
        "```mermaid",
        "flowchart LR",
    ]
    has_edges = False
    for i, m in enumerate(info["mappings"]):
        m_id = f"M{i}"
        flow_lines.append(f'    {m_id}["⚙️ {m["name"]}"]')
        for j, s in enumerate(m["sources"]):
            s_id = f"S{i}_{j}"
            flow_lines.append(f'    {s_id}[("📥 {s}")] --> {m_id}')
            has_edges = True
        for k, t in enumerate(m["targets"]):
            t_id = f"T{i}_{k}"
            flow_lines.append(f'    {m_id} --> {t_id}[("📤 {t}")]')
            has_edges = True

    if not has_edges:
        flow_lines.append(f'    EMPTY["{info["file"]}: Nessun flusso tabellare esplicito"]')

    flow_lines += ["```", ""]
    flow_path = os.path.join(outdir, f"{base_name}_FLUSSO.md")
    with open(flow_path, "w", encoding="utf-8") as f:
        f.write("\n".join(flow_lines))
    created.append(os.path.basename(flow_path))

    # 3. Documento Funzionale / Business
    biz_lines = [
        f"# Scheda Funzionale di Business — `{info['file']}`",
        "",
        "## Obiettivo di Business della Trasformazione",
        f"Il componente `{base_name}` opera all'interno della pipeline ETL del cliente "
        "con lo scopo di sincronizzare e aggregare i dati provenienti dai domini operativi "
        "verso le basi dati analitiche e direzionali.",
        "",
        "## Sintesi dei Flussi di Dominio",
    ]
    if info["mappings"]:
        for m in info["mappings"]:
            biz_lines.append(
                f"- **Processo `{m['name']}`**: estrae informazioni da {len(m['sources'])} "
                f"entità sorgente ({', '.join(m['sources']) or 'N/D'}) e alimenta "
                f"l'entità bersaglio {', '.join(m['targets']) or 'N/D'}."
            )
    else:
        biz_lines.append("- Nessuna trasformazione con sorgenti e destinazioni esplicite.")
    biz_lines.append("")

    biz_path = os.path.join(outdir, f"{base_name}_BUSINESS.md")
    with open(biz_path, "w", encoding="utf-8") as f:
        f.write("\n".join(biz_lines))
    created.append(os.path.basename(biz_path))

    # 4. Tabella Colonne CSV
    csv_path = os.path.join(outdir, f"{base_name}_COLONNE.csv")
    with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["mapping", "direzione", "schema_tabella", "descrizione"])
        for m in info["mappings"]:
            for s in m["sources"]:
                writer.writerow([m["name"], "INPUT", s, "Tabella di estrazione"])
            for t in m["targets"]:
                writer.writerow([m["name"], "OUTPUT", t, "Tabella bersaglio"])
    created.append(os.path.basename(csv_path))

    return created


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="ODI Mapping Documenter (standalone).")
    parser.add_argument("xml_file", help="Percorso del file XML di export ODI")
    parser.add_argument("--format", default="all", help="Formato output (all, md, csv)")
    parser.add_argument("--output-dir", required=True, help="Directory di destinazione")
    args = parser.parse_args(argv)

    if not os.path.isfile(args.xml_file):
        print(f"Errore: file non trovato {args.xml_file}", file=sys.stderr)
        return 1

    info = parse_odi_export(args.xml_file)
    created = build_docs(info, args.output_dir)
    print(f"ok: generati {len(created)} file in {args.output_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
