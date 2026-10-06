#!/usr/bin/env python3
"""
Main Entry Point for ODI 12c Mapping XML Parser and Documentation Generator.

Supports:
- single mapping XML files;
- batch processing of folders;
- SmartExport / SunopsisExport files containing multiple mappings.
"""

import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Tuple

# Importazione dei moduli locali
try:
    from csv_builder import generate_csv
    from doc_builder import generate_business_markdown, generate_technical_markdown
    from flow_builder import generate_flow_diagram
    from parser import OdiMappingParser
except ImportError as e:
    print(f"Errore di importazione dei moduli: {e}")
    print("Assicurati di eseguire lo script dalla root del progetto es: 'python run.py ...'")
    sys.exit(1)


def safe_filename(name: str) -> str:
    """Create a filesystem-safe name from a mapping or export name."""
    name = (name or "").strip()
    name = re.sub(r"[^\w-]", "_", name)
    return name.strip("_") or "mapping"


def generate_outputs_for_data(
    data: Dict[str, Any],
    safe_name: str,
    output_dir: Path,
    format_type: str,
) -> Dict[str, Path]:
    """
    Generate documentation outputs for a single mapping dictionary.
    Files are organized into type-based subdirectories (tecnico/, business/, flussi/, csv/).
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    outputs: Dict[str, Path] = {}

    # Technical Markdown
    if format_type in ("technical", "all"):
        subdir = output_dir / "tecnico"
        subdir.mkdir(parents=True, exist_ok=True)
        tech_path = subdir / f"{safe_name}_TECNICO.md"
        generate_technical_markdown(data, tech_path)
        outputs["technical"] = tech_path

    # Business Markdown
    if format_type in ("business", "all"):
        subdir = output_dir / "business"
        subdir.mkdir(parents=True, exist_ok=True)
        bus_path = subdir / f"{safe_name}_BUSINESS.md"
        generate_business_markdown(data, bus_path)
        outputs["business"] = bus_path

    # Flow diagram
    if format_type in ("flow", "all"):
        subdir = output_dir / "flussi"
        subdir.mkdir(parents=True, exist_ok=True)
        flow_path = subdir / f"{safe_name}_FLUSSO.md"
        generate_flow_diagram(data, flow_path)
        outputs["flow"] = flow_path

    # CSV
    if format_type in ("csv", "all"):
        subdir = output_dir / "csv"
        subdir.mkdir(parents=True, exist_ok=True)
        csv_path = subdir / f"{safe_name}_MAPPING_RULES.csv"
        generate_csv(data, csv_path)
        outputs["csv"] = csv_path

    return outputs


def print_outputs(outputs: Dict[str, Path], prefix: str = ""):
    for label, path in outputs.items():
        # Show relative path from output root (subdir/filename)
        parts = path.parts
        if len(parts) >= 2:
            display = f"{parts[-2]}/{parts[-1]}"
        else:
            display = path.name
        print(f"  ✓ {prefix}{label.capitalize()}: {display}")


def process_single_xml(xml_file: Path, output_dir: Path, format_type: str) -> tuple[bool, dict]:
    """
    Process a single XML file.

    If the file contains multiple mappings, it is processed as SmartExport.
    Returns (success, {mapping_name: {sources: [...], targets: [...]}}).
    """
    if not xml_file.is_file():
        print(f"[Errore] Il file XML '{xml_file}' non esiste.")
        return False, {}

    print(f"\nParsing ODI XML: {xml_file.name}")

    try:
        parser = OdiMappingParser(str(xml_file))
    except Exception as e:
        print(f"[Errore] Durante il parsing del file XML: {e}")
        return False, {}

    mapping_ids = parser.mapping_ids()

    if len(mapping_ids) > 1:
        return process_multi_mapping(parser, xml_file, output_dir, format_type)

    # Single mapping or no explicit mapping object
    try:
        data = parser.to_dict()
    except Exception as e:
        print(f"[Errore] Durante la costruzione del dizionario mapping: {e}")
        return False, {}

    mapping_name = data.get("mapping", {}).get("name") or xml_file.stem
    safe_name = safe_filename(mapping_name)

    try:
        outputs = generate_outputs_for_data(
            data=data,
            safe_name=safe_name,
            output_dir=output_dir,
            format_type=format_type,
        )
    except Exception as e:
        print(f"[Errore] Durante la generazione degli output: {e}")
        return False, {}

    print_outputs(outputs)

    summary = {
        mapping_name: {
            "sources": data.get("sources", []),
            "targets": data.get("targets", []),
        }
    }
    return True, summary


def process_multi_mapping(
    parser: OdiMappingParser,
    xml_file: Path,
    output_dir: Path,
    format_type: str,
) -> tuple[bool, dict]:
    """
    Process a SmartExport / SunopsisExport file containing multiple mappings.
    """
    export_name = xml_file.stem
    safe_export = safe_filename(export_name)

    mapping_count = len(parser.mapping_ids())

    print(f"\nSmartExport rilevato: {xml_file.name}")
    print(f"Trovati {mapping_count} mapping.")
    print(f"Output directory: {output_dir.resolve()}")

    if parser.is_smart_export() and not parser.can_scope_mappings():
        print(
            "[⚠️] Attenzione: l'export contiene più mapping ma il parser non ha "
            "trovato informazioni sufficienti per partizionare correttamente gli oggetti.\n"
            "    Verrà usato un fallback globale: ogni mapping potrebbe contenere "
            "anche oggetti provenienti da altri mapping."
        )

    results: List[Dict[str, Any]] = []
    used_names: set[str] = set()
    summary: Dict[str, Any] = {}

    for idx, data in enumerate(parser.to_dict_list(), start=1):
        mapping = data.get("mapping", {}) or {}
        mapping_name = mapping.get("name") or f"{export_name}_mapping_{idx:04d}"

        summary[mapping_name] = {
            "sources": data.get("sources", []),
            "targets": data.get("targets", []),
        }

        base_safe_name = safe_filename(mapping_name)
        candidate_safe_name = base_safe_name
        suffix = 2

        while candidate_safe_name in used_names:
            candidate_safe_name = f"{base_safe_name}_{suffix}"
            suffix += 1

        used_names.add(candidate_safe_name)

        try:
            outputs = generate_outputs_for_data(
                data=data,
                safe_name=candidate_safe_name,
                output_dir=output_dir,
                format_type=format_type,
            )

            print_outputs(outputs, prefix=f"[{idx}/{mapping_count}] ")

            results.append({
                "index": idx,
                "name": mapping_name,
                "project": mapping.get("project_name") or mapping.get("project_code") or "",
                "folder": mapping.get("folder_name") or "",
                "safe_name": candidate_safe_name,
                "outputs": outputs,
                "error": None,
            })

        except Exception as e:
            print(f"  [Errore] Mapping {idx}/{mapping_count}: {e}")
            results.append({
                "index": idx,
                "name": mapping_name,
                "project": mapping.get("project_name") or mapping.get("project_code") or "",
                "folder": mapping.get("folder_name") or "",
                "safe_name": candidate_safe_name,
                "outputs": {},
                "error": str(e),
            })
    if getattr(parser, "scoping_fallback_used", False):
        print(
            "[⚠️] Warning: il partizionamento multi-mapping non è stato completamente affidabile.\n"
            "    Per evitare documenti vuoti, il parser ha usato anche oggetti globali dell'export."
        )
    index_path = output_dir / f"{safe_export}_INDEX.md"

    try:
        generate_smartexport_index(
            parser=parser,
            export_name=export_name,
            results=results,
            index_path=index_path,
        )
        print(f"  ✓ Index: {index_path.name}")
    except Exception as e:
        print(f"[Errore] Durante la generazione dell'indice SmartExport: {e}")

    return any(r.get("outputs") for r in results), summary


def generate_smartexport_index(
    parser: OdiMappingParser,
    export_name: str,
    results: List[Dict[str, Any]],
    index_path: Path,
):
    """
    Generate a Markdown index for a SmartExport containing multiple mappings.
    """
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    total = len(results)
    success = len([r for r in results if r.get("outputs")])
    failed = total - success

    lines: List[str] = []

    lines.append(f"# SmartExport Documentation - {export_name}")
    lines.append("")
    lines.append(f"_Generato il: {now}_")
    lines.append("")

    lines.append("## Informazioni Export")
    lines.append("")
    lines.append("| Campo | Valore |")
    lines.append("|-------|--------|")
    lines.append(f"| **File** | {export_name} |")
    lines.append(f"| **Mapping totali** | {total} |")
    lines.append(f"| **Generati con successo** | {success} |")
    lines.append(f"| **Falliti** | {failed} |")

    admin = parser.admin or {}

    if admin.get("IsSmartExportFile"):
        lines.append(f"| **IsSmartExportFile** | {admin.get('IsSmartExportFile')} |")
    if admin.get("OdiVersion"):
        lines.append(f"| **ODI Version** | {admin.get('OdiVersion')} |")
    if admin.get("RepositoryVersion"):
        lines.append(f"| **Repository Version** | {admin.get('RepositoryVersion')} |")
    if admin.get("OriginWorkRepositoryID"):
        lines.append(f"| **Origin Work Repository ID** | {admin.get('OriginWorkRepositoryID')} |")
    if admin.get("Created"):
        lines.append(f"| **Created** | {admin.get('Created')} |")

    lines.append("")

    includes = parser.smart_export_includes or []
    if includes:
        lines.append("## Oggetti Inclusi nello SmartExport")
        lines.append("")
        for include in includes:
            lines.append(f"- `{include}`")
        lines.append("")

    lines.append("## Mapping Generati")
    lines.append("")
    lines.append("| # | Progetto | Folder | Mapping | Stato | File generati |")
    lines.append("|---:|---|---|---|---|---|")

    for result in results:
        idx = result.get("index", "")
        project = result.get("project", "") or "-"
        folder = result.get("folder", "") or "-"
        name = result.get("name", "")

        if result.get("error"):
            error = str(result.get("error", "")).replace("|", "/")
            lines.append(f"| {idx} | {project} | {folder} | {name} | ❌ | {error} |")
        else:
            index_dir = index_path.parent
            files = "<br>".join(
                f"[{label}]({path.relative_to(index_dir)})"
                for label, path in result.get("outputs", {}).items()
            )
            lines.append(f"| {idx} | {project} | {folder} | {name} | ✅ | {files} |")

    index_path.write_text("\n".join(lines), encoding="utf-8")


def main():
    if sys.stdout.encoding != "utf-8":
        sys.stdout.reconfigure(encoding="utf-8")

    if len(sys.argv) < 2:
        print(
            "Usage: python src/main.py <xml_file_o_cartella> "
            "[--output-dir <dir>] "
            "[--format technical|business|flow|csv|all]"
        )
        sys.exit(1)

    input_path = Path(sys.argv[1])
    output_dir = Path("output")
    format_type = "all"

    # Parse arguments
    i = 2
    while i < len(sys.argv):
        if sys.argv[i] == "--output-dir" and i + 1 < len(sys.argv):
            output_dir = Path(sys.argv[i + 1])
            i += 2
        elif sys.argv[i] == "--format" and i + 1 < len(sys.argv):
            format_type = sys.argv[i + 1].lower()
            i += 2
        else:
            i += 1

    # Create timestamp subdirectory for unique output
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = output_dir / timestamp
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"📂 Directory di output: {output_dir.resolve()}\n")

    # Batch folder mode
    if input_path.is_dir():
        print("=" * 50)
        print(f"📁 Modalità Batch: Lettura cartella '{input_path}'")

        xml_files = list(input_path.rglob("*.xml"))

        if not xml_files:
            print("[Attenzione] Nessun file .xml trovato nella cartella specificata.")
            sys.exit(0)

        print(f"Trovati {len(xml_files)} file XML da processare.\n")

        successi = 0
        fallimenti = 0
        all_summaries: Dict[str, Any] = {}

        for i, xml_file in enumerate(xml_files, 1):
            print(f"[{i}/{len(xml_files)}] Elaborazione di {xml_file.name}...")

            try:
                ok, summary = process_single_xml(xml_file, output_dir, format_type)
                if ok:
                    successi += 1
                    all_summaries.update(summary)
                else:
                    fallimenti += 1
            except Exception as e:
                print(f"  [Errore Inaspettato] su {xml_file.name}: {e}")
                fallimenti += 1

        # Write aggregate sources/targets JSON
        summary_path = output_dir / "mapping_sources_targets.json"
        with open(summary_path, "w", encoding="utf-8") as f:
            json.dump(all_summaries, f, indent=2, ensure_ascii=False)
        print(f"📄 Riepilogo sources/targets salvato in: {summary_path.name}")

        print("\n" + "=" * 50)
        print(f"✅ Batch completato! Successi: {successi} | Fallimenti: {fallimenti}")
        print(f"📂 I documenti sono stati salvati in: {output_dir.resolve()}")
        print("=" * 50)

    # Single file mode
    elif input_path.is_file():
        ok, summary = process_single_xml(input_path, output_dir, format_type)
        if ok and summary:
            summary_path = output_dir / "mapping_sources_targets.json"
            with open(summary_path, "w", encoding="utf-8") as f:
                json.dump(summary, f, indent=2, ensure_ascii=False)
            print(f"📄 Riepilogo sources/targets salvato in: {summary_path.name}")

    else:
        print(
            f"[Errore] Il percorso '{input_path}' non esiste "
            f"o non è né un file né una cartella."
        )
        sys.exit(1)


if __name__ == "__main__":
    main()