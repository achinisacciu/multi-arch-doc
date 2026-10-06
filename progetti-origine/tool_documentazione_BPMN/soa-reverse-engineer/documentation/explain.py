"""
§24 — Explain: human-readable process explanation con evidence
§25 — LLM solo layer finale (documentation), mai source of truth.
Per ora deterministico, template-based. LLM opzionale futuro.
"""
from typing import Dict, Any

def explain_process(bpmn_doc: Dict[str, Any], evidence: list | None = None) -> str:
    name = bpmn_doc.get("name") or bpmn_doc.get("id") or "Process"
    lines = [f"## What this process does — {name}", ""]
    lines.append(f"The process starts when {bpmn_doc.get('fileName','an event occurs')}.")
    lines.append("")
    # usa elements per descrivere
    elems = bpmn_doc.get("elements", []) if isinstance(bpmn_doc.get("elements"), list) else []
    if elems:
        lines.append("Steps:")
        for i, el in enumerate(elems[:10], 1):
            ename = el.get("name") or el.get("id") or f"step {i}"
            etype = el.get("type", "activity")
            lines.append(f"{i}. {ename} ({etype})")
    else:
        lines.append(f"Process {name} has {bpmn_doc.get('elements',0)} elements.")
    lines.append("")
    lines.append("External systems, data and error handling are documented in Technical Doc with evidence.")
    if evidence:
        lines.append(f"\nEvidence: {len(evidence)} relations tracked.")
    return "\n".join(lines)

# Placeholder per futuro LLM wrapper
def llm_explain(canonical: Dict[str, Any], deterministic_explain: str) -> str:
    """
    LLM è opzionale e riceve solo deterministic_explain + evidence.
    Non deve mai inferire oltre evidence.
    """
    # TODO: integrare LLM esterno con prompt che include evidence e canonical
    return deterministic_explain + "\n\n> LLM explanation layer not enabled (deterministic mode)."
