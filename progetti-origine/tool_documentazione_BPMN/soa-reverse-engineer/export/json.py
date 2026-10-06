"""
Export JSON — canonical model + graph
"""
import json
from pathlib import Path
from typing import Dict, Any

def export_canonical_json(canonical: Dict[str, Any], graph: Dict[str, Any], output: Path):
    payload = {
        "canonical": canonical,
        "graph": graph,
        "exported_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    return output
