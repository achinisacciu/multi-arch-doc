"""
V0.7 — XSLT Parser (port da ecosystemParser.ts:735-775) + §18
Estrae source/target namespaces, template, for-each, choose, when, etc. per data lineage.
"""
from pathlib import Path
from typing import List, Dict, Any
from lxml import etree
import hashlib
import re

def _local_name(tag: str) -> str:
    if "}" in tag:
        return tag.split("}", 1)[1]
    return tag.split(":")[-1]

def _parse_xslt(content: str, file_name: str, relative_path: str) -> Dict[str, Any]:
    name = Path(file_name).stem
    source_ns: Dict[str, str] = {}
    target_ns: Dict[str, str] = {}
    templates: List[str] = []
    for_eachs: List[str] = []
    chooses: List[Dict[str, Any]] = []
    variables: List[str] = []
    params: List[str] = []

    try:
        parser = etree.XMLParser(recover=True, remove_blank_text=True)
        root = etree.fromstring(content.encode("utf-8"), parser=parser)
        if isinstance(root, etree._ElementTree):
            root = root.getroot()

        # stylesheet
        if _local_name(root.tag) in ("stylesheet", "transform"):
            for k, v in root.attrib.items():
                if k.startswith("xmlns:"):
                    prefix = k.split(":", 1)[1]
                    source_ns[prefix] = v
                elif k == "xmlns":
                    source_ns["#default"] = v

        # templates
        for el in root.iter():
            if not isinstance(el.tag, str):
                continue
            ln = _local_name(el.tag)
            if ln == "template":
                m = el.get("match") or el.get("name") or "/"
                templates.append(m)
            elif ln == "for-each":
                sel = el.get("select")
                if sel:
                    for_eachs.append(sel)
            elif ln == "choose":
                whens = []
                for child in el:
                    if isinstance(child.tag, str) and _local_name(child.tag) == "when":
                        whens.append(child.get("test") or "")
                chooses.append({"whens": whens, "count": len(whens)})
            elif ln == "variable":
                vname = el.get("name")
                if vname:
                    variables.append(vname)
            elif ln == "param":
                pname = el.get("name")
                if pname:
                    params.append(pname)
            elif ln == "value-of":
                # track target mappings: value-of select -> implies source field
                pass

        # Also extract target namespaces from result elements (e.g., tns:ProcessOrderRequest)
        # Look for elements with prefix that is not xsl
        for el in root.iter():
            if not isinstance(el.tag, str):
                continue
            if "}" in el.tag:
                ns = el.tag.split("}")[0][1:]
                if ns not in source_ns.values() and ns not in target_ns.values():
                    # try to find prefix
                    for attr in el.attrib:
                        if ":" in el.tag:
                            prefix = el.tag.split(":")[0]
                            if prefix != "xsl":
                                target_ns[prefix] = ns
                                break

        if not templates:
            templates = ["/"]

    except Exception:
        pass

    h = hashlib.sha256(f"{relative_path}::{file_name}".encode()).hexdigest()[:12]
    base = relative_path.replace("/", "-").replace("\\", "-").replace(".", "-")[:48]
    xid = f"xslt-{base}-{h}"

    return {
        "id": xid,
        "name": name,
        "sourceNamespaces": source_ns,
        "targetNamespaces": target_ns,
        "templateMatches": templates,
        "forEachSelects": for_eachs,
        "chooses": chooses,
        "variables": variables,
        "params": params,
        "fileName": file_name,
        "relativePath": relative_path,
        "rawContent": content,
    }

def parse_xslt(path: Path, relative_path: str | None = None) -> Dict[str, Any]:
    content = path.read_text(encoding="utf-8", errors="ignore")
    return _parse_xslt(content, path.name, relative_path or str(path))

def can_parse(path: Path, root_local: str | None, namespace: str | None) -> bool:
    if path.suffix.lower() in (".xsl", ".xslt"):
        return True
    if root_local in ("stylesheet", "transform"):
        return True
    if namespace and "XSL/Transform" in namespace:
        return True
    return False
