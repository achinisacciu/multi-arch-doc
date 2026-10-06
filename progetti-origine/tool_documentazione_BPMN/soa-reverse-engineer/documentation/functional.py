"""
§13 — Functional Documentation (per analisti/business)
Costruita solo da evidenze tecniche, mai inventata.
"""
from typing import Dict, Any

def generate_functional_doc(canonical: Dict[str, Any], graph: Dict[str, Any]) -> str:
    lines = ["# Functional Documentation", ""]
    # Process summary da BPMN/BPEL
    bpmns = canonical.get("bpmns", [])
    if bpmns:
        lines.append("## Scopo dei processi")
        for b in bpmns:
            lines.append(f"- **{b.get('name')}** ({b.get('relativePath')}): {b.get('elements',0)} elementi, {b.get('service_implementations',0)} service impl.")
    else:
        lines.append("_Nessun processo BPMN rilevato._")
    lines.append("")
    lines.append("## Sistemi coinvolti")
    # da SCA references e JCA
    comps = canonical.get("composites", [])
    for c in comps:
        lines.append(f"- Composite `{c.get('name')}`: {len(c.get('references',[]))} references, {len(c.get('wires',[]))} wires")
    lines.append("")
    lines.append("> Ogni affermazione è tracciata via Evidence Store (provenance). Vedi Technical Doc per xpath.")
    return "\n".join(lines)
