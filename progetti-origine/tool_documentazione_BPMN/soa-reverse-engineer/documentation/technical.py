"""
§13 — Technical Documentation (per sviluppatori/architetti)
Genera markdown tecnico con xpath, namespace, evidence.
"""
from typing import Dict, Any, List

def generate_technical_doc(canonical: Dict[str, Any], graph: Dict[str, Any]) -> str:
    lines = ["# Technical Documentation", ""]
    lines.append(f"Artifacts: {len(canonical.get('registry', {}).get('artifacts', []))}")
    lines.append("")
    lines.append("## Namespaces & References")
    for art in canonical.get("registry", {}).get("artifacts", [])[:20]:
        lines.append(f"- `{art['relativePath']}` — {art['type']} ({art['detected_by']}) ns=`{art.get('namespace','')}`")
    lines.append("")
    lines.append("## Dependency Edges (with Evidence)")
    for e in graph.get("edges", [])[:50]:
        lines.append(f"- `{e.get('source')}` --{e.get('type')}--> `{e.get('target')}`  confidence={e.get('confidence')} evidence={e.get('evidence')}")
    return "\n".join(lines)
