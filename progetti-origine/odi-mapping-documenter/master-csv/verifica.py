#!/usr/bin/env python3
"""
Verifica - Statistiche sui mapping JSON.

Analizza tutti i file JSON in una directory e produce un report con:
- numero di progetti
- numero di mapping per progetto
- numero di schemi coinvolti per mapping
- numero di tabelle coinvolte per mapping (sources + targets)

Usage:
    python verifica.py <directory_path>

Example:
    python verifica.py ../output
    python verifica.py ../output/Progetto_Esempio
"""

import json
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Set


def find_json_files(root_dir: Path):
    return sorted(root_dir.rglob("*.json"))


def parse_json(file_path: Path) -> Dict[str, Any]:
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


def extract_counts(data: Dict[str, Any], project: str):
    mapping_counts: Dict[str, Dict[str, int]] = {}

    for mapping_name, mapping_data in data.items():
        if not isinstance(mapping_data, dict):
            continue

        schemas: Set[str] = set()
        tables: Set[str] = set()
        source_tables: Set[str] = set()
        target_tables: Set[str] = set()

        for entry in mapping_data.get("sources", []):
            if isinstance(entry, str) and "." in entry:
                schema, table = entry.split(".", 1)
                schemas.add(schema)
                tables.add(table)
                source_tables.add(table)

        for entry in mapping_data.get("targets", []):
            if isinstance(entry, str) and "." in entry:
                schema, table = entry.split(".", 1)
                schemas.add(schema)
                tables.add(table)
                target_tables.add(table)

        mapping_counts[mapping_name] = {
            "schemi": len(schemas),
            "tabelle": len(tables),
            "source_tabelle": len(source_tables),
            "target_tabelle": len(target_tables),
        }

    return mapping_counts


def generate_report(all_data: Dict[str, Dict[str, Dict[str, int]]]) -> str:
    lines: list[str] = []

    total_mappings = sum(len(projects) for projects in all_data.values())
    total_schemas = 0
    total_tables = 0
    total_source_tables = 0
    total_target_tables = 0

    lines.append("=" * 65)
    lines.append("  VERIFICA MAPPING - REPORT STATISTICHE")
    lines.append("=" * 65)
    lines.append("")

    lines.append(f"Progetti trovati: {len(all_data)}")
    lines.append(f"Mapping totali:   {total_mappings}")
    lines.append("")

    for project in sorted(all_data.keys()):
        mappings = all_data[project]
        lines.append("-" * 65)
        lines.append(f"  Progetto: {project}  ({len(mappings)} mapping)")
        lines.append("-" * 65)

        for mname in sorted(mappings.keys()):
            c = mappings[mname]
            total_schemas += c["schemi"]
            total_tables += c["tabelle"]
            total_source_tables += c["source_tabelle"]
            total_target_tables += c["target_tabelle"]
            lines.append(f"    {mname}")
            lines.append(f"      Schemi:        {c['schemi']}")
            lines.append(f"      Tabelle:       {c['tabelle']}  (source: {c['source_tabelle']}, target: {c['target_tabelle']})")

    lines.append("")
    lines.append("=" * 65)
    lines.append(f"  RIEPILOGO")
    lines.append("=" * 65)
    lines.append(f"  Progetti:                    {len(all_data)}")
    lines.append(f"  Mapping:                     {total_mappings}")
    lines.append(f"  Totale tabelle source:       {total_source_tables}")
    lines.append(f"  Totale tabelle target:       {total_target_tables}")
    lines.append(f"  Totale schemi:               {total_schemas}")
    lines.append(f"  Totale tabelle:              {total_tables}")
    lines.append("=" * 65)

    return "\n".join(lines)


def main():
    if sys.stdout.encoding != "utf-8":
        sys.stdout.reconfigure(encoding="utf-8")

    if len(sys.argv) < 2:
        print("Usage: python verifica.py <directory_path>")
        print("Analizza tutti i file JSON nella directory e genera un report statistico.")
        sys.exit(1)

    input_dir = Path(sys.argv[1])

    if not input_dir.is_dir():
        print(f"[Errore] '{input_dir}' non e' una directory valida.")
        sys.exit(1)

    json_files = find_json_files(input_dir)

    if not json_files:
        print(f"[Attenzione] Nessun file JSON trovato in '{input_dir}'.")
        sys.exit(0)

    print(f"Trovati {len(json_files)} file JSON.\n")

    all_data: Dict[str, Dict[str, Dict[str, int]]] = {}

    for json_file in json_files:
        project = json_file.parent.name

        print(f"  [{json_file.relative_to(input_dir)}] -> progetto: {project}")

        try:
            data = parse_json(json_file)
            if not isinstance(data, dict):
                print(f"    [Ignorato] Il file JSON non e' un dizionario valido.")
                continue

            mapping_counts = extract_counts(data, project)
            if project not in all_data:
                all_data[project] = {}
            all_data[project].update(mapping_counts)
            print(f"    Estratti {len(mapping_counts)} mapping.")

        except json.JSONDecodeError as e:
            print(f"    [Errore] JSON non valido: {e}")
        except Exception as e:
            print(f"    [Errore] {e}")

    if not all_data:
        print("Nessun dato estratto.")
        sys.exit(0)

    report = generate_report(all_data)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    script_dir = Path(__file__).parent
    output_path = script_dir / "output" / timestamp / "verifica_mapping.txt"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(report, encoding="utf-8")

    print(f"\n[OK] Report salvato in: {output_path}")
    print(report)


if __name__ == "__main__":
    main()
