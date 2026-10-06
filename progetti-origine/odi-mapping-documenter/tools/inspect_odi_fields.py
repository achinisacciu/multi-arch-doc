#!/usr/bin/env python3
"""
Ispettore campi SunopsisExport / SmartExport.

Stampa solo:
- nome classe Object;
- numero di oggetti trovati;
- nomi dei campi Field presenti per ogni classe.

NON stampa i valori dei Field, quindi può essere usato
anche su file riservati.
"""

import sys
from collections import defaultdict
from pathlib import Path

from lxml import etree as ET


def local_tag(tag):
    if not isinstance(tag, str):
        return ""
    return tag.split("}", 1)[-1]


def main():
    if len(sys.argv) < 2:
        print("Uso:")
        print("  python tools/inspect_odi_fields.py <file_xml>")
        sys.exit(1)

    xml_path = Path(sys.argv[1])

    if not xml_path.exists():
        print(f"[Errore] File non trovato: {xml_path}")
        sys.exit(1)

    class_field_names = defaultdict(set)
    class_counts = defaultdict(int)

    print(f"Lettura file: {xml_path}")
    print("ATTENZIONE: per file molto grandi questa operazione può richiedere qualche secondo...")

    parser = ET.XMLParser(recover=True, huge_tree=True)
    tree = ET.parse(str(xml_path), parser=parser)
    root = tree.getroot()

    print("Analisi oggetti Object/Field in corso...")

    for obj in root.iter():
        if local_tag(obj.tag) != "Object":
            continue

        class_name = obj.get("class", "Unknown")
        short_class = class_name.split(".")[-1] if "." in class_name else class_name

        class_counts[short_class] += 1

        for field in obj:
            if local_tag(field.tag) != "Field":
                continue

            field_name = field.get("name")
            if field_name:
                class_field_names[short_class].add(field_name)

    print("")
    print("# Report campi SunopsisExport")
    print("")
    print("| Classe | Occorrenze | Nomi Field |")
    print("|---|---:|---|")

    for class_name in sorted(class_field_names.keys()):
        count = class_counts[class_name]
        fields = ", ".join(sorted(class_field_names[class_name]))
        print(f"| {class_name} | {count} | {fields} |")

    print("")
    print("# Dettaglio per classi principali")
    print("")

    interesting = [
        "SnpMapping",
        "SnpMapComp",
        "SnpMapCp",
        "SnpMapAttr",
        "SnpMapProp",
        "SnpMapConn",
        "SnpMapExpr",
        "SnpMapExprRef",
        "SnpMapRef",
        "SnpScen",
        "SnpScenStep",
        "SnpScenTask",
        "SnpExecUnit",
        "SnpExecUnitGrp",
        "SnpDeploySpec",
        "SnpPhyNode",
        "SnpProject",
        "SnpFolder",
        "SnpFKXRef",
    ]

    for class_name in interesting:
        if class_name in class_field_names:
            fields = sorted(class_field_names[class_name])
            print(f"## {class_name}")
            print("")
            for field in fields:
                print(f"- {field}")
            print("")


if __name__ == "__main__":
    main()