#!/usr/bin/env python3
"""
Master CSV Generator for ODI Mapping Documenter.

Scans a directory recursively for mapping JSON files and
generates a unified CSV with columns: progetto, mapping, schema, table, tipo.

Usage:
    python run.py <directory_path>

Example:
    python run.py ../output
    python run.py ../output/Progetto_Esempio
"""

import csv
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Tuple


def find_json_files(root_dir: Path) -> List[Path]:
    return sorted(root_dir.rglob("*.json"))


def parse_json(file_path: Path) -> Dict[str, Any]:
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


def extract_rows(data: Dict[str, Any], project: str) -> List[Tuple[str, str, str, str, str]]:
    rows: List[Tuple[str, str, str, str, str]] = []

    for mapping_name, mapping_data in data.items():
        if not isinstance(mapping_data, dict):
            continue

        for source in mapping_data.get("sources", []):
            if isinstance(source, str) and "." in source:
                schema, table = source.split(".", 1)
                rows.append((project, mapping_name, schema, table, "input"))

        for target in mapping_data.get("targets", []):
            if isinstance(target, str) and "." in target:
                schema, table = target.split(".", 1)
                rows.append((project, mapping_name, schema, table, "output"))

    return rows


def generate_csv(rows: List[Tuple[str, str, str, str, str]], output_path: Path):
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(["progetto", "mapping", "schema", "table", "tipo"])
        writer.writerows(rows)


def main():
    if sys.stdout.encoding != "utf-8":
        sys.stdout.reconfigure(encoding="utf-8")

    if len(sys.argv) < 2:
        print("Usage: python run.py <directory_path>")
        print("Scans the directory recursively for all JSON files and generates a master CSV.")
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

    all_rows: List[Tuple[str, str, str, str, str]] = []

    for json_file in json_files:
        project = json_file.parent.name

        print(f"  [{json_file.relative_to(input_dir)}] -> progetto: {project}")

        try:
            data = parse_json(json_file)
            if not isinstance(data, dict):
                print(f"    [Ignorato] Il file JSON non e' un dizionario valido.")
                continue

            rows = extract_rows(data, project)
            all_rows.extend(rows)
            print(f"    Estratte {len(rows)} righe.")

        except json.JSONDecodeError as e:
            print(f"    [Errore] JSON non valido: {e}")
        except Exception as e:
            print(f"    [Errore] {e}")

    if not all_rows:
        print("Nessuna riga estratta.")
        sys.exit(0)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    script_dir = Path(__file__).parent
    output_path = script_dir / "output" / timestamp / "master_csv_input_output.csv"

    generate_csv(all_rows, output_path)

    print(f"\n[OK] Generato CSV con {len(all_rows)} righe.")
    print(f"File salvato in: {output_path}")
    print(f"Progetti: {len(set(r[0] for r in all_rows))} | Mapping: {len(set(r[1] for r in all_rows))}")


if __name__ == "__main__":
    main()
