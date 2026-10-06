"""
§5 Liv.2 — Namespace Resolver
Normalizza namespace e prefix tra artifact diversi.
"""
from typing import Dict, Optional

# Cache di namespace noti per Oracle/SOA
KNOWN_NS = {
    "http://schemas.xmlsoap.org/wsdl/": "wsdl",
    "http://www.w3.org/2001/XMLSchema": "xsd",
    "http://www.w3.org/1999/XSL/Transform": "xslt",
    "http://docs.oasis-open.org/wsbpel/2.0/process/executable": "bpel",
    "http://xmlns.oracle.com/sca/1.0": "sca",
    "http://www.omg.org/spec/BPMN/20100524/MODEL": "bpmn",
}

def normalize_namespace(ns: str) -> str:
    ns = ns.strip().rstrip("/")
    return ns

def detect_artifact_family(ns: str) -> str:
    for hint, family in KNOWN_NS.items():
        if hint in ns:
            return family
    if "bpm" in ns.lower():
        return "bpmn"
    if "bpel" in ns.lower():
        return "bpel"
    return "unknown"

def resolve_prefix(nsmap: Dict[str, str], prefix: str) -> Optional[str]:
    return nsmap.get(prefix)
