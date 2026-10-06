"""
V0.6 — BPEL Parser (port da ecosystemParser.ts:286-373)
"""
from pathlib import Path
from typing import List, Dict, Any
from lxml import etree
import hashlib

def _local_name(tag: str) -> str:
    if "}" in tag:
        return tag.split("}", 1)[1]
    return tag.split(":")[-1]

def _parse_bpel(content: str, file_name: str, relative_path: str) -> Dict[str, Any]:
    name = Path(file_name).stem
    partner_links: List[Dict[str, Any]] = []
    variables: List[Dict[str, Any]] = []
    invokes: List[Dict[str, Any]] = []
    receives: List[Dict[str, Any]] = []
    fault_handlers: List[str] = []
    scopes: List[str] = []
    assigns: List[Dict[str, Any]] = []

    try:
        parser = etree.XMLParser(recover=True, remove_blank_text=True)
        root = etree.fromstring(content.encode("utf-8"), parser=parser)
        if isinstance(root, etree._ElementTree):
            root = root.getroot()

        # process name
        if _local_name(root.tag) == "process":
            name = root.get("name") or name

        # partnerLinks
        for el in root.iter():
            if not isinstance(el.tag, str):
                continue
            if _local_name(el.tag) == "partnerLink":
                pl_name = el.get("name") or ""
                if pl_name:
                    partner_links.append({
                        "name": pl_name,
                        "partnerLinkType": el.get("partnerLinkType") or "",
                        "myRole": el.get("myRole"),
                        "partnerRole": el.get("partnerRole"),
                    })

        # variables
        for el in root.iter():
            if not isinstance(el.tag, str):
                continue
            if _local_name(el.tag) == "variable":
                vname = el.get("name") or ""
                if vname:
                    variables.append({
                        "name": vname,
                        "messageType": el.get("messageType"),
                        "element": el.get("element"),
                        "type": el.get("type"),
                    })

        # invokes
        for el in root.iter():
            if not isinstance(el.tag, str):
                continue
            if _local_name(el.tag) == "invoke":
                invokes.append({
                    "name": el.get("name"),
                    "partnerLink": el.get("partnerLink") or "",
                    "portType": el.get("portType"),
                    "operation": el.get("operation") or "",
                    "inputVariable": el.get("inputVariable"),
                    "outputVariable": el.get("outputVariable"),
                })

        # receives
        for el in root.iter():
            if not isinstance(el.tag, str):
                continue
            if _local_name(el.tag) == "receive":
                receives.append({
                    "name": el.get("name"),
                    "partnerLink": el.get("partnerLink") or "",
                    "portType": el.get("portType"),
                    "operation": el.get("operation") or "",
                    "variable": el.get("variable"),
                    "createInstance": el.get("createInstance") in ("yes", "true"),
                })

        # scopes
        for el in root.iter():
            if isinstance(el.tag, str) and _local_name(el.tag) == "scope":
                sname = el.get("name")
                if sname:
                    scopes.append(sname)

        # assigns
        for el in root.iter():
            if isinstance(el.tag, str) and _local_name(el.tag) == "assign":
                aname = el.get("name") or "assign"
                # count copies
                copies = 0
                for sub in el.iter():
                    if isinstance(sub.tag, str) and _local_name(sub.tag) == "copy":
                        copies += 1
                assigns.append({"name": aname, "copies": copies})

        # fault handlers
        for el in root.iter():
            if isinstance(el.tag, str) and _local_name(el.tag) in ("catch", "catchAll"):
                fname = el.get("faultName") or _local_name(el.tag)
                fault_handlers.append(fname)

    except Exception:
        pass

    h = hashlib.sha256(f"{relative_path}::{file_name}".encode()).hexdigest()[:12]
    base = relative_path.replace("/", "-").replace("\\", "-").replace(".", "-")[:48]
    bid = f"bpel-{base}-{h}"

    return {
        "id": bid,
        "name": name,
        "partnerLinks": partner_links,
        "variables": variables,
        "invokes": invokes,
        "receives": receives,
        "scopes": scopes,
        "assigns": assigns,
        "faultHandlers": fault_handlers,
        "fileName": file_name,
        "relativePath": relative_path,
        "rawXml": content,
    }

def parse_bpel(path: Path, relative_path: str | None = None) -> Dict[str, Any]:
    content = path.read_text(encoding="utf-8", errors="ignore")
    return _parse_bpel(content, path.name, relative_path or str(path))

def can_parse(path: Path, root_local: str | None, namespace: str | None) -> bool:
    if path.suffix.lower() == ".bpel":
        return True
    if root_local == "process" and namespace and "bpel" in namespace.lower():
        return True
    return False
