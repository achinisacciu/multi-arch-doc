"""
V0.5 — SCA Composite Parser (port da ecosystemParser.ts:95-283)
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

def _extract_port_type(interface_attr: str | None) -> str | None:
    if not interface_attr:
        return None
    trimmed = interface_attr.strip()
    if not trimmed:
        return None
    hash_part = trimmed.split("#")[-1] if "#" in trimmed else trimmed
    m = re.search(r"(?:wsdl\.)?(?:portType|interface)\s*\(\s*([^)]+?)\s*\)", hash_part, re.I)
    if m and m.group(1):
        raw = m.group(1).strip()
        if ":" in raw:
            return raw.split(":")[-1].strip()
        return raw
    cleaned = re.sub(r"wsdl\.", "", hash_part, flags=re.I).replace("(", "").replace(")", "").strip()
    if ":" in cleaned:
        return cleaned.split(":")[-1].strip() or cleaned
    m2 = re.search(r"interface\s*\(\s*(.+)", cleaned, re.I)
    if m2 and m2.group(1):
        return m2.group(1).replace("(", "").replace(")", "").strip().split(":")[-1].strip()
    return cleaned or None

def _parse_composite(content: str, file_name: str, relative_path: str) -> Dict[str, Any]:
    name = Path(file_name).stem
    revision = "1.0"
    mode = "active"
    state = "on"
    target_ns = ""
    services: List[Dict[str, Any]] = []
    components: List[Dict[str, Any]] = []
    references: List[Dict[str, Any]] = []
    wires: List[Dict[str, Any]] = []
    imports: List[Dict[str, Any]] = []

    try:
        parser = etree.XMLParser(recover=True, remove_blank_text=True)
        root = etree.fromstring(content.encode("utf-8"), parser=parser)
        if isinstance(root, etree._ElementTree):
            root = root.getroot()

        # Find composite element (may be root or descendant)
        composite_el = None
        if _local_name(root.tag) == "composite":
            composite_el = root
        else:
            for el in root.iter():
                if isinstance(el.tag, str) and _local_name(el.tag) == "composite":
                    composite_el = el
                    break
            if composite_el is None:
                composite_el = root

        if composite_el is not None:
            name = composite_el.get("name") or name
            revision = composite_el.get("revision") or revision
            mode = composite_el.get("mode") or mode
            state = composite_el.get("state") or state
            target_ns = composite_el.get("targetNamespace") or ""

            # Imports
            for el in composite_el:
                if isinstance(el.tag, str) and _local_name(el.tag) == "import":
                    ns = el.get("namespace") or ""
                    loc = el.get("location") or ""
                    itype = el.get("importType") or ""
                    if loc:
                        imports.append({"namespace": ns, "location": loc, "importType": itype})

            # Services (direct children only)
            for child in composite_el:
                if not isinstance(child.tag, str) or _local_name(child.tag) != "service":
                    continue
                s_name = child.get("name") or "UnnamedService"
                ui_loc = child.get("ui:wsdlLocation") or child.get("wsdlLocation")
                # find interface.wsdl
                iface_wsdl = None
                iface_pt = None
                for sub in child.iter():
                    if isinstance(sub.tag, str) and _local_name(sub.tag) == "interface.wsdl":
                        iface_wsdl = sub.get("interface")
                        iface_pt = _extract_port_type(iface_wsdl)
                        break
                if iface_wsdl is None:
                    for sub in child.iter():
                        if isinstance(sub.tag, str) and sub.tag.endswith("interface"):
                            iface_wsdl = sub.get("interface")
                            iface_pt = _extract_port_type(iface_wsdl)
                            break

                # bindings
                btype = "other"
                bconfig = None
                jca_loc = None
                for sub in child:
                    if not isinstance(sub.tag, str):
                        continue
                    ln = _local_name(sub.tag)
                    if ln == "binding.ws":
                        btype = "ws"
                        bconfig = sub.get("port") or sub.get("location")
                    elif ln == "binding.jca":
                        btype = "jca"
                        jca_loc = sub.get("config")
                        bconfig = jca_loc
                    elif ln == "binding.rest":
                        btype = "rest"
                        bconfig = sub.get("uri")
                    elif ln == "binding.direct":
                        btype = "direct"

                services.append({
                    "name": s_name,
                    "uiWsdlLocation": ui_loc,
                    "interfaceWsdl": iface_wsdl,
                    "interfacePortType": iface_pt,
                    "bindingType": btype,
                    "bindingConfig": bconfig,
                    "jcaLocation": jca_loc,
                })

            # Components
            for child in composite_el:
                if not isinstance(child.tag, str) or _local_name(child.tag) != "component":
                    continue
                c_name = child.get("name") or "UnnamedComponent"
                ctype = "unknown"
                impl_src = None
                for sub in child:
                    if not isinstance(sub.tag, str):
                        continue
                    ln = _local_name(sub.tag)
                    if ln == "implementation.bpel":
                        ctype = "bpel"
                        impl_src = sub.get("src")
                    elif ln == "implementation.bpmn":
                        ctype = "bpmn"
                        impl_src = sub.get("src")
                    elif ln == "implementation.mediator":
                        ctype = "mediator"
                        impl_src = sub.get("src")
                    elif ln in ("implementation.workflow", "implementation.humanTask"):
                        ctype = "human-task"
                        impl_src = sub.get("src")
                    elif ln == "implementation.decision":
                        ctype = "decision"
                        impl_src = sub.get("src")
                    elif ln == "implementation.spring":
                        ctype = "spring"
                        impl_src = sub.get("src")

                comp_services = []
                comp_refs = []
                for sub in child.iter():
                    if isinstance(sub.tag, str) and _local_name(sub.tag) == "service":
                        # avoid double counting composite-level services (already handled)
                        # but for component, collect service names
                        parent = sub.getparent()
                        if parent is not None and _local_name(parent.tag) == "component":
                            comp_services.append(sub.get("name") or "")
                    if isinstance(sub.tag, str) and _local_name(sub.tag) == "reference":
                        parent = sub.getparent()
                        if parent is not None and _local_name(parent.tag) == "component":
                            comp_refs.append(sub.get("name") or "")

                # filter empty
                comp_services = [s for s in comp_services if s]
                comp_refs = [r for r in comp_refs if r]

                components.append({
                    "name": c_name,
                    "type": ctype,
                    "implementationSource": impl_src,
                    "services": comp_services,
                    "references": comp_refs,
                })

            # References (direct children)
            for child in composite_el:
                if not isinstance(child.tag, str) or _local_name(child.tag) != "reference":
                    continue
                r_name = child.get("name") or "UnnamedReference"
                ui_loc = child.get("ui:wsdlLocation") or child.get("wsdlLocation")
                iface_wsdl = None
                iface_pt = None
                for sub in child.iter():
                    if isinstance(sub.tag, str) and _local_name(sub.tag) == "interface.wsdl":
                        iface_wsdl = sub.get("interface")
                        iface_pt = _extract_port_type(iface_wsdl)
                        break
                btype = "other"
                bconfig = None
                jca_loc = None
                for sub in child:
                    if not isinstance(sub.tag, str):
                        continue
                    ln = _local_name(sub.tag)
                    if ln == "binding.ws":
                        btype = "ws"
                        bconfig = sub.get("location") or sub.get("port")
                    elif ln == "binding.jca":
                        btype = "jca"
                        jca_loc = sub.get("config")
                        bconfig = jca_loc
                    elif ln == "binding.rest":
                        btype = "rest"
                        bconfig = sub.get("uri")
                    elif ln == "binding.direct":
                        btype = "direct"
                references.append({
                    "name": r_name,
                    "uiWsdlLocation": ui_loc,
                    "interfaceWsdl": iface_wsdl,
                    "interfacePortType": iface_pt,
                    "bindingType": btype,
                    "bindingConfig": bconfig,
                    "jcaLocation": jca_loc,
                })

            # Wires
            for child in composite_el:
                if not isinstance(child.tag, str) or _local_name(child.tag) != "wire":
                    continue
                src = None
                tgt = None
                for sub in child:
                    if not isinstance(sub.tag, str):
                        continue
                    ln = _local_name(sub.tag)
                    if ln == "source.uri":
                        src = sub.text.strip() if sub.text else ""
                    elif ln == "target.uri":
                        tgt = sub.text.strip() if sub.text else ""
                if not src:
                    src = child.get("source") or ""
                if not tgt:
                    tgt = child.get("target") or ""
                if src and tgt:
                    wires.append({"source": src, "target": tgt})

            # Also handle wires as any descendant (for robustness)
            if not wires:
                for el in composite_el.iter():
                    if isinstance(el.tag, str) and _local_name(el.tag) == "wire":
                        src = None
                        tgt = None
                        for sub in el:
                            if isinstance(sub.tag, str) and _local_name(sub.tag) == "source.uri":
                                src = sub.text.strip() if sub.text else ""
                            if isinstance(sub.tag, str) and _local_name(sub.tag) == "target.uri":
                                tgt = sub.text.strip() if sub.text else ""
                        if src and tgt:
                            wires.append({"source": src, "target": tgt})

    except Exception:
        pass

    h = hashlib.sha256(f"{relative_path}::{file_name}".encode()).hexdigest()[:12]
    base = relative_path.replace("/", "-").replace("\\", "-").replace(".", "-")[:48]
    cid = f"composite-{base}-{h}"

    return {
        "id": cid,
        "name": name,
        "revision": revision,
        "mode": mode,
        "state": state,
        "targetNamespace": target_ns,
        "services": services,
        "components": components,
        "references": references,
        "wires": wires,
        "imports": imports,
        "fileName": file_name,
        "relativePath": relative_path,
        "rawXml": content,
    }

def parse_sca(path: Path, relative_path: str | None = None) -> dict:
    content = path.read_text(encoding="utf-8", errors="ignore")
    return _parse_composite(content, path.name, relative_path or str(path))

def can_parse(path: Path, root_local: str | None, namespace: str | None) -> bool:
    if path.name == "composite.xml":
        return True
    if root_local == "composite":
        return True
    if namespace and "sca" in namespace.lower():
        return True
    return False
