#!/usr/bin/env python3
"""progetti-origine/tool_documentazione_BPMN/soa-reverse-engineer/cli/main.py
CLI per scansione e analisi artefatti SOA Oracle (WSDL, XSD, BPEL, BPMN, JCA, Composite).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import xml.etree.ElementTree as ET


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if isinstance(tag, str) else ""


def scan_dir(folder: str) -> dict:
    counts = {"wsdl": 0, "xsd": 0, "bpel": 0, "bpmn": 0, "jca": 0, "composite": 0, "sql": 0}
    total = 0
    for root, _dirs, files in os.walk(folder):
        for f in files:
            ext = os.path.splitext(f)[1].lower()
            name = f.lower()
            if ext == ".wsdl":
                counts["wsdl"] += 1
                total += 1
            elif ext == ".xsd":
                counts["xsd"] += 1
                total += 1
            elif ext == ".bpel":
                counts["bpel"] += 1
                total += 1
            elif ext == ".bpmn":
                counts["bpmn"] += 1
                total += 1
            elif ext == ".jca":
                counts["jca"] += 1
                total += 1
            elif name == "composite.xml" or name.endswith(".componenttype"):
                counts["composite"] += 1
                total += 1
            elif ext == ".sql":
                counts["sql"] += 1
                total += 1
            elif ext == ".xml":
                counts["xml"] = counts.get("xml", 0) + 1
                total += 1
    return {"total": total, "by_type": counts}


def analyze_dir(folder: str) -> dict:
    res = {
        "wsdls": [],
        "xsds": [],
        "composites": [],
        "bpels": [],
        "bpmns": [],
    }
    for root, _dirs, files in os.walk(folder):
        for f in files:
            fp = os.path.join(root, f)
            rel = os.path.relpath(fp, folder).replace("\\", "/")
            ext = os.path.splitext(f)[1].lower()
            name = f.lower()

            if ext == ".wsdl":
                ops, pts = [], []
                try:
                    tree = ET.parse(fp).getroot()
                    for el in tree.iter():
                        tag = _local(el.tag)
                        if tag == "operation":
                            nm = el.get("name")
                            if nm and nm not in ops:
                                ops.append(nm)
                        elif tag == "portType":
                            nm = el.get("name")
                            if nm and nm not in pts:
                                pts.append(nm)
                except Exception:
                    pass
                res["wsdls"].append({
                    "relativePath": rel,
                    "fileName": f,
                    "operations": ops,
                    "portTypes": pts,
                })

            elif ext == ".xsd":
                elems = []
                try:
                    tree = ET.parse(fp).getroot()
                    for el in tree.iter():
                        if _local(el.tag) in ("element", "complexType", "simpleType"):
                            nm = el.get("name")
                            if nm and nm not in elems:
                                elems.append(nm)
                except Exception:
                    pass
                res["xsds"].append({
                    "relativePath": rel,
                    "fileName": f,
                    "elements": elems[:20],
                })

            elif name == "composite.xml":
                comps = []
                try:
                    tree = ET.parse(fp).getroot()
                    for el in tree.iter():
                        if _local(el.tag) in ("component", "reference", "service"):
                            nm = el.get("name")
                            if nm and nm not in comps:
                                comps.append(nm)
                except Exception:
                    pass
                res["composites"].append({
                    "relativePath": rel,
                    "fileName": f,
                    "components": comps,
                })

            elif ext == ".bpel":
                proc = os.path.splitext(f)[0]
                pls = []
                try:
                    tree = ET.parse(fp).getroot()
                    proc = tree.get("name") or proc
                    for el in tree.iter():
                        if _local(el.tag) == "partnerLink":
                            nm = el.get("name")
                            if nm and nm not in pls:
                                pls.append(nm)
                except Exception:
                    pass
                res["bpels"].append({
                    "relativePath": rel,
                    "fileName": f,
                    "process": proc,
                    "partnerLinks": pls,
                })

            elif ext == ".bpmn":
                res["bpmns"].append({
                    "relativePath": rel,
                    "fileName": f,
                    "process": os.path.splitext(f)[0],
                })

    return res


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="SOA Reverse Engineer CLI")
    subparsers = parser.add_subparsers(dest="cmd", required=True)

    scan_p = subparsers.add_parser("scan")
    scan_p.add_argument("folder", help="Cartella da scansionare")
    scan_p.add_argument("--output", required=True, help="File JSON di output")

    an_p = subparsers.add_parser("analyze")
    an_p.add_argument("folder", help="Cartella da analizzare")
    an_p.add_argument("--output", required=True, help="File JSON di output")

    args = parser.parse_args(argv)

    if args.cmd == "scan":
        data = scan_dir(args.folder)
        os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        print(f"ok: scan salvato in {args.output}")

    elif args.cmd == "analyze":
        data = analyze_dir(args.folder)
        os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        print(f"ok: canonical salvato in {args.output}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
