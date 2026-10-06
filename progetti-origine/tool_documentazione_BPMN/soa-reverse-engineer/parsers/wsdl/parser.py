"""
V0.4 — WSDL Parser (port da ecosystemParser.ts:568-639)
Usa lxml con namespace-agnostic (local_name).
"""
from pathlib import Path
from typing import List, Dict, Any
from lxml import etree
import hashlib

def _local_name(tag: str) -> str:
    if "}" in tag:
        return tag.split("}", 1)[1]
    return tag.split(":")[-1]

def _parse_wsdl(content: str, file_name: str, relative_path: str) -> Dict[str, Any]:
    name = Path(file_name).stem
    target_ns = ""
    port_types: List[Dict[str, Any]] = []
    imports: List[str] = []
    service_name = None
    soap_address = None

    try:
        # lxml recover per XML malformati
        parser = etree.XMLParser(recover=True, remove_blank_text=True)
        root = etree.fromstring(content.encode("utf-8"), parser=parser)
        if isinstance(root, etree._ElementTree):
            root = root.getroot()

        # definitions
        if _local_name(root.tag) == "definitions":
            name = root.get("name") or name
            target_ns = root.get("targetNamespace") or ""

        # Imports: <import> + <wsdl:import>
        for el in root.iter():
            if not isinstance(el.tag, str):
                continue
            if _local_name(el.tag) == "import":
                loc = el.get("location") or el.get("schemaLocation")
                if loc:
                    imports.append(loc)

        # PortTypes: cerca figli diretti e globali
        for el in root.iter():
            if not isinstance(el.tag, str):
                continue
            if _local_name(el.tag) == "portType":
                pt_name = el.get("name") or "UnnamedPort"
                ops: List[Dict[str, Any]] = []
                for child in el:
                    if not isinstance(child.tag, str):
                        continue
                    if _local_name(child.tag) == "operation":
                        op_name = child.get("name") or "UnnamedOperation"
                        inp = None
                        out = None
                        faults: List[str] = []
                        for c2 in child:
                            if not isinstance(c2.tag, str):
                                continue
                            ln = _local_name(c2.tag)
                            if ln == "input":
                                inp = c2.get("message")
                            elif ln == "output":
                                out = c2.get("message")
                            elif ln == "fault":
                                fmsg = c2.get("message") or c2.get("name") or ""
                                if fmsg:
                                    faults.append(fmsg)
                        ops.append({
                            "name": op_name,
                            "inputMessage": inp,
                            "outputMessage": out,
                            "faultMessages": faults,
                        })
                port_types.append({"name": pt_name, "operations": ops})

        # Service + SOAP address
        for el in root.iter():
            if not isinstance(el.tag, str):
                continue
            if _local_name(el.tag) == "service":
                service_name = el.get("name") or service_name
                # cerca address dentro service
                for sub in el.iter():
                    if _local_name(sub.tag) == "address":
                        loc = sub.get("location")
                        if loc:
                            soap_address = loc
                            break
                break

    except Exception:
        pass

    # ID deterministico
    h = hashlib.sha256(f"{relative_path}::{file_name}".encode()).hexdigest()[:12]
    base = relative_path.replace("/", "-").replace("\\", "-").replace(".", "-")[:48]
    wid = f"wsdl-{base}-{h}"

    return {
        "id": wid,
        "name": name,
        "targetNamespace": target_ns,
        "portTypes": port_types,
        "imports": imports,
        "serviceName": service_name,
        "soapAddress": soap_address,
        "fileName": file_name,
        "relativePath": relative_path,
        "rawXml": content,
    }

def parse_wsdl(path: Path, relative_path: str | None = None) -> Dict[str, Any]:
    content = path.read_text(encoding="utf-8", errors="ignore")
    return _parse_wsdl(content, path.name, relative_path or str(path))

# Protocol adapter
def can_parse(path: Path, root_local: str | None, namespace: str | None) -> bool:
    if path.suffix.lower() == ".wsdl":
        return True
    if namespace and "wsdl" in namespace.lower():
        return True
    if root_local == "definitions" and namespace and "schemas.xmlsoap.org/wsdl" in namespace:
        return True
    return False
