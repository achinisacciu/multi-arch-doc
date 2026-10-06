#!/usr/bin/env python3
"""
Entry point per la documentazione di ODI Load Plan + Scenari.
Usage:
    python run.py <LP_file.xml> [--scenarios scenari1.xml scenari2.xml ...]
    python run.py <cartella>
      (in modalità cartella, rileva automaticamente LP e scenari)
"""
import sys
from pathlib import Path
from lxml import etree as ET

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))

from lp_parser import OdiLoadPlanParser
from doc_builder import generate_markdown


def _classify_xml(path: Path) -> str:
    """Quick peek at an XML file to classify it."""
    try:
        tree = ET.parse(str(path), ET.XMLParser(recover=True, huge_tree=True))
        for obj in tree.getroot().findall("Object"):
            cls = obj.get("class", "").split(".")[-1]
            if cls == "SnpLoadPlan":
                return "lp"
            if cls == "SnpScen":
                return "scenario"
        return "other"
    except Exception:
        return "other"


def process_file(lp_xml: Path, output_dir: Path, scenario_files: list[Path]):
    print(f"\nLP file: {lp_xml.name}")
    for sf in scenario_files:
        print(f"  + Scenarios: {sf.name}")

    try:
        parser = OdiLoadPlanParser(
            str(lp_xml),
            scenario_paths=[str(sf) for sf in scenario_files],
        )
    except Exception as e:
        print(f"  [ERRORE] {e}")
        return

    data = parser.to_dict()
    lp = data.get("load_plan", {})
    name = lp.get("load_plan_name") or lp_xml.stem
    safe = "".join(c if c.isalnum() or c in " _-" else "_" for c in name).strip()

    out_file = output_dir / f"{safe}_LOADPLAN.md"
    generate_markdown(data, out_file)
    n_scen = len(data.get("scenarios", []))
    n_tasks = sum(
        1 for t in data.get("_scen_tasks", {}).values()
        if t.get("def_txt") or t.get("col_txt")
    )
    n_vars = len(data.get("lp_vars", []))
    n_step_vars = len(data.get("lp_step_vars", []))
    print(f"  OK -> {out_file.name}")
    print(f"       ({n_scen} scenari, {n_tasks} task SQL, "
          f"{n_vars} variabili LP, {n_step_vars} variabili step)")


def process_folder(folder: Path, output_dir: Path):
    xml_files = sorted(folder.rglob("*.xml"))
    if not xml_files:
        print(f"Nessun file XML trovato in {folder}")
        return

    # Classify
    lp_files = []
    scen_files = []
    for f in xml_files:
        kind = _classify_xml(f)
        if kind == "lp":
            lp_files.append(f)
        elif kind == "scenario":
            scen_files.append(f)

    if not lp_files:
        print(f"Nessun Load Plan trovato in {folder}")
        return

    print(f"Trovati {len(lp_files)} load plan, {len(scen_files)} file scenario\n")

    for lp_f in lp_files:
        process_file(lp_f, output_dir, scen_files)


def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python run.py <file.xml> [--scenarios scen1.xml ...]")
        print("  python run.py <cartella>    (rilevamento automatico)")
        sys.exit(1)

    # Parse --scenarios flag if present
    scenario_files: list[Path] = []
    input_args: list[str] = []
    i = 1
    while i < len(sys.argv):
        if sys.argv[i] == "--scenarios":
            i += 1
            while i < len(sys.argv) and not sys.argv[i].startswith("--"):
                scenario_files.append(Path(sys.argv[i]))
                i += 1
        else:
            input_args.append(sys.argv[i])
            i += 1

    if not input_args:
        print("[ERRORE] Nessun file/cartella indicato.")
        sys.exit(1)

    input_path = Path(input_args[0])
    output_dir = ROOT / "output"
    output_dir.mkdir(exist_ok=True)

    # Validate explicit scenario files
    scenario_files = [sf for sf in scenario_files if sf.exists()]

    if input_path.is_file():
        process_file(input_path, output_dir, scenario_files)
    elif input_path.is_dir():
        process_folder(input_path, output_dir)
    else:
        print(f"Percorso non valido: {input_path}")
        sys.exit(1)


if __name__ == "__main__":
    main()
