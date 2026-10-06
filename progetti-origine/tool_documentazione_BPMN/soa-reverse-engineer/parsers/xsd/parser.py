"""
V0.4 — XSD Parser (port da ecosystemParser.ts:642-733)
Fix overcount dataset grande: solo figli diretti di <schema>.
"""
from pathlib import Path
from typing import List, Dict, Any
from lxml import etree
import hashlib

def _local_name(tag: str) -> str:
    if "}" in tag:
        return tag.split("}", 1)[1]
    return tag.split(":")[-1]

def _parse_xsd(content: str, file_name: str, relative_path: str) -> Dict[str, Any]:
    name = Path(file_name).stem
    target_ns = ""
    elements: List[Dict[str, Any]] = []
    complex_types: List[Dict[str, Any]] = []
    simple_types: List[str] = []
    imports: List[str] = []
    includes: List[str] = []

    try:
        parser = etree.XMLParser(recover=True, remove_blank_text=True)
        root = etree.fromstring(content.encode("utf-8"), parser=parser)
        if isinstance(root, etree._ElementTree):
            root = root.getroot()

        # schema
        if _local_name(root.tag) == "schema":
            target_ns = root.get("targetNamespace") or ""

        # imports / includes
        for el in root.iter():
            if not isinstance(el.tag, str):
                continue
            ln = _local_name(el.tag)
            if ln == "import":
                loc = el.get("schemaLocation")
                if loc:
                    imports.append(loc)
            elif ln == "include":
                loc = el.get("schemaLocation")
                if loc:
                    includes.append(loc)

        # Elementi root: solo figli diretti di <schema>
        schema_el = root if _local_name(root.tag) == "schema" else None
        if schema_el is not None:
            for child in schema_el:
                if not isinstance(child.tag, str):
                    continue
                if _local_name(child.tag) == "element":
                    ename = child.get("name")
                    if ename:
                        elements.append({"name": ename, "type": child.get("type")})

        # ComplexTypes: solo figli diretti, altrimenti fallback globale
        cts: List[Any] = []
        if schema_el is not None:
            for child in schema_el:
                if isinstance(child.tag, str) and _local_name(child.tag) == "complexType":
                    cts.append(child)
        if not cts:
            for el in root.iter():
                if isinstance(el.tag, str) and _local_name(el.tag) == "complexType":
                    # check parent is schema if possible
                    parent = el.getparent()
                    if parent is not None and _local_name(parent.tag) == "schema":
                        cts.append(el)
                    elif parent is None:
                        cts.append(el)
        # fallback globale se ancora vuoto (XSD nested)
        if not cts:
            for el in root.iter():
                if isinstance(el.tag, str) and _local_name(el.tag) == "complexType":
                    cts.append(el)

        for ct in cts:
            cname = ct.get("name") or "Anonymous"
            # count nested elements
            cnt = 0
            for sub in ct.iter():
                if isinstance(sub.tag, str) and _local_name(sub.tag) == "element":
                    cnt += 1
            complex_types.append({"name": cname, "elementCount": cnt})

        # Deduplica solo non-Anonymous
        seen = set()
        deduped = []
        for ct in complex_types:
            if ct["name"] == "Anonymous":
                deduped.append(ct)
            elif ct["name"] not in seen:
                seen.add(ct["name"])
                deduped.append(ct)
        complex_types = deduped

        # SimpleTypes
        sts = []
        for el in root.iter():
            if isinstance(el.tag, str) and _local_name(el.tag) == "simpleType":
                sname = el.get("name")
                if sname and sname not in sts:
                    sts.append(sname)
        simple_types = sts

    except Exception:
        pass

    h = hashlib.sha256(f"{relative_path}::{file_name}".encode()).hexdigest()[:12]
    base = relative_path.replace("/", "-").replace("\\", "-").replace(".", "-")[:48]
    xid = f"xsd-{base}-{h}"

    return {
        "id": xid,
        "name": name,
        "targetNamespace": target_ns,
        "elements": elements,
        "complexTypes": complex_types,
        "simpleTypes": simple_types,
        "imports": imports,
        "includes": includes,
        "fileName": file_name,
        "relativePath": relative_path,
        "rawXml": content,
    }

def parse_xsd(path: Path, relative_path: str | None = None) -> Dict[str, Any]:
    content = path.read_text(encoding="utf-8", errors="ignore")
    return _parse_xsd(content, path.name, relative_path or str(path))

def can_parse(path: Path, root_local: str | None, namespace: str | None) -> bool:
    if path.suffix.lower() == ".xsd":
        return True
    if namespace and "XMLSchema" in namespace:
        return True
    if root_local == "schema":
        return True
    return False
