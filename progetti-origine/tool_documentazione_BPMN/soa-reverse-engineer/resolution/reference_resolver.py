"""
§4-§5 — Reference Resolver (Liv.1 exact + Liv.3 artifact relationship)
Risolve operationRef, messageRef, calledElement, wsdlLocation, etc. verso artifact concreti.
"""
from typing import Dict, Any, List, Tuple
from pathlib import Path

def resolve_references(registry: Dict[str, Any], wsdls: List[Dict], bpels: List[Dict]) -> List[Dict[str, Any]]:
    """
    Per ogni reference in registry/artifacts, tenta di risolvere il target.
    Ritorna lista di {source, attribute, value, resolved_id, status, confidence}
    """
    # index by name and by file
    by_name = {}
    for art in registry.get("artifacts", []):
        by_name[art["fileName"]] = art
        by_name[Path(art["relativePath"]).name] = art
    # WSDL operations index
    wsdl_ops = {}
    for w in wsdls:
        for pt in w.get("portTypes", []):
            for op in pt.get("operations", []):
                wsdl_ops[op["name"]] = w["id"]

    results = []
    # Scansiona tutti gli artifact che hanno references (da BPMN/BPEL)
    # Per V0.9, usa solo BPMN references già in registry? Semplificato
    for art in registry["artifacts"]:
        # prova a leggere operationRef dal file se è BPMN/BPEL
        p = Path(art["path"])
        if not p.exists():
            continue
        try:
            txt = p.read_text(encoding="utf-8", errors="ignore")
            # cerca operationRef="..."
            import re
            for m in re.finditer(r'operationRef\s*=\s*"([^"]+)"', txt):
                val = m.group(1)
                resolved = wsdl_ops.get(val)
                status = "resolved" if resolved else "unresolved"
                results.append({
                    "source": art["relativePath"],
                    "attribute": "operationRef",
                    "value": val,
                    "resolved_id": resolved,
                    "status": status,
                    "confidence": 1.0 if resolved else 0.0,
                })
        except Exception:
            continue
    return results
