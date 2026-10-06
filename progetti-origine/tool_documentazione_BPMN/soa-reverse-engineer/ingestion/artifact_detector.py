"""
V0.3 — Artifact Detector (4 livelli §3)
  1. extension
  2. XML namespace
  3. root element localName
  4. content fingerprint
"""
from pathlib import Path
from enum import Enum
from typing import Tuple, Optional
import xml.etree.ElementTree as ET

class ArtifactType(str, Enum):
    BPMN = "bpmn"
    BPEL = "bpel"
    SCA_COMPOSITE = "sca_composite"
    SCA_COMPONENT_TYPE = "component_type"
    WSDL = "wsdl"
    XSD = "xsd"
    XSLT = "xslt"
    JCA = "jca"
    MEDIATOR = "mediator"
    HUMAN_TASK = "human_task"
    DVM = "dvm"
    CONFIG = "config"
    BPMN_DIAGRAM = "bpmn_diagram"
    UNKNOWN = "unknown"
    OTHER_XML = "other_xml"
    OTHER = "other"

# Map extension → candidate types (livello 1)
EXT_MAP = {
    ".bpmn": [ArtifactType.BPMN],
    ".bpel": [ArtifactType.BPEL],
    ".wsdl": [ArtifactType.WSDL],
    ".xsd": [ArtifactType.XSD],
    ".xsl": [ArtifactType.XSLT],
    ".xslt": [ArtifactType.XSLT],
    ".jca": [ArtifactType.JCA],
    ".mplan": [ArtifactType.MEDIATOR],
    ".task": [ArtifactType.HUMAN_TASK],
    ".dvm": [ArtifactType.DVM],
    ".componentType": [ArtifactType.SCA_COMPONENT_TYPE],
}

# Namespace hints → type (livello 2)
NS_HINTS = {
    "http://schemas.xmlsoap.org/wsdl/": ArtifactType.WSDL,
    "http://www.w3.org/2001/XMLSchema": ArtifactType.XSD,
    "http://www.w3.org/1999/XSL/Transform": ArtifactType.XSLT,
    "http://docs.oasis-open.org/wsbpel/2.0/process/executable": ArtifactType.BPEL,
    "http://xmlns.oracle.com/sca/1.0": ArtifactType.SCA_COMPOSITE,
    "http://xmlns.oracle.com/sca/1.0/mediator": ArtifactType.MEDIATOR,
    "http://xmlns.oracle.com/bpel/workflow/taskDefinition": ArtifactType.HUMAN_TASK,
    "http://platform.integration.oracle/blocks/adapter/fw/metadata": ArtifactType.JCA,
    "http://www.omg.org/spec/BPMN/20100524/MODEL": ArtifactType.BPMN,
    "http://www.omg.org/spec/BPMN/20100524/DI": ArtifactType.BPMN_DIAGRAM,
}

# Root localName → type (livello 3)
ROOT_MAP = {
    "definitions": None,  # ambiguo BPMN vs WSDL — serve namespace
    "process": ArtifactType.BPEL,  # bpel:process
    "composite": ArtifactType.SCA_COMPOSITE,
    "Mediator": ArtifactType.MEDIATOR,
    "taskDefinition": ArtifactType.HUMAN_TASK,
    "schema": ArtifactType.XSD,
    "stylesheet": ArtifactType.XSLT,
    "transform": ArtifactType.XSLT,
    "adapter-config": ArtifactType.JCA,
}

def _local_name(tag: str) -> str:
    if "}" in tag:
        return tag.split("}", 1)[1]
    if ":" in tag:
        return tag.split(":", 1)[1]
    return tag

def _namespace(tag: str) -> str:
    if tag.startswith("{"):
        return tag[1:].split("}", 1)[0]
    return ""

def _parse_root_info(path: Path) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """Ritorna (localName, namespace, rawTag) o (None,None,None) se non XML / errore."""
    try:
        # usa iterparse leggero per solo root
        # fallback a ET.parse con recover-like
        text = path.read_text(encoding="utf-8", errors="ignore")[:5000]
        if not text.lstrip().startswith("<"):
            return None, None, None
        # try quick parse
        try:
            tree = ET.parse(str(path))
            root = tree.getroot()
            return _local_name(root.tag), _namespace(root.tag), root.tag
        except Exception:
            # try lxml-like recover via manual sniff
            import re
            m = re.search(r"<\s*([a-zA-Z0-9:_\-\.]+)", text)
            if m:
                raw = m.group(1)
                local = raw.split(":")[-1]
                # namespace sniff
                ns_match = re.search(r'xmlns(?::\w+)?="([^"]+)"', text)
                ns = ns_match.group(1) if ns_match else ""
                return local, ns, raw
            return None, None, None
    except Exception:
        return None, None, None

def detect_artifact_type(path: Path) -> Tuple[ArtifactType, str]:
    """
    Ritorna (ArtifactType, detected_by) con 4 livelli.
    detected_by è stringa esplicita tipo "extension+namespace" per evidence.
    """
    ext = path.suffix
    # .componentType has double suffix? Path.suffix gives .componentType? test
    if path.name.endswith(".componentType"):
        ext = ".componentType"
    if path.name == "composite.xml":
        # special composite
        local, ns, _ = _parse_root_info(path)
        if local == "composite" or (ns and "sca" in ns):
            return ArtifactType.SCA_COMPOSITE, "extension+root+namespace"
        return ArtifactType.SCA_COMPOSITE, "extension+filename"

    candidates = EXT_MAP.get(ext, [])
    local, ns, rawTag = _parse_root_info(path)

    # Livello 2: namespace
    ns_type = None
    if ns:
        for hint, atype in NS_HINTS.items():
            if hint in ns or ns == hint:
                ns_type = atype
                break
        # also check content for sca/bpel hints if ns empty
        if not ns_type and local:
            # composite without ns?
            pass

    # Livello 3: root
    root_type = ROOT_MAP.get(local) if local else None
    # disambiguate definitions
    if local == "definitions":
        if ns and "BPMN" in ns:
            root_type = ArtifactType.BPMN
        elif ns and "wsdl" in ns.lower():
            root_type = ArtifactType.WSDL
        else:
            # fingerprint: check for bpmn:process vs wsdl:portType inside
            try:
                txt = path.read_text(encoding="utf-8", errors="ignore")[:8000].lower()
                if "bpmn:" in txt or 'targetnamespace' in txt and "wsdl" in txt:
                    # heuristic
                    if "porttype" in txt:
                        root_type = ArtifactType.WSDL
                    elif "process" in txt:
                        root_type = ArtifactType.BPMN
            except Exception:
                pass

    # Decisione a cascata
    if candidates and ns_type and candidates[0] == ns_type:
        return candidates[0], "extension+namespace"
    if ns_type and ns_type != ArtifactType.UNKNOWN:
        # namespace prevale su estensione ambigua (.xml)
        if ext == ".xml":
            return ns_type, "namespace+root"
        if candidates:
            # es. .xml con root composite
            return ns_type, "namespace"
        return ns_type, "namespace"
    if root_type:
        if ext == ".xml":
            return root_type, "root"
        if candidates and candidates[0] == root_type:
            return root_type, "extension+root"
        return root_type, "root"
    if candidates:
        return candidates[0], "extension"
    if ext == ".xml":
        # other xml
        if local:
            return ArtifactType.OTHER_XML, "extension+root-fallback"
        return ArtifactType.UNKNOWN, "extension"
    # fallback by content
    if local:
        return ArtifactType.UNKNOWN, "root-fallback"
    return ArtifactType.OTHER, "extension"

def detect_with_details(path: Path) -> dict:
    """Helper per registry: ritorna dict con type, detected_by, root, ns."""
    atype, by = detect_artifact_type(path)
    local, ns, raw = _parse_root_info(path)
    return {"type": atype.value, "detected_by": by, "root_local": local, "namespace": ns, "raw_tag": raw}
