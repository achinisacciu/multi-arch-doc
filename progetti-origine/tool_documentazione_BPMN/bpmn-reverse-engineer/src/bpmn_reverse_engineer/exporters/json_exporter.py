"""JSON exporter."""

from __future__ import annotations

import json
from pathlib import Path

from ..models.process import BpmnDocument


def export_json(doc: BpmnDocument, output_path: str | Path, *, anonymize: bool = False) -> Path:
    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    if anonymize:
        from ..anonymize import anonymize_document

        doc = anonymize_document(doc)
    # Use model_dump with mode=json
    data = doc.model_dump(mode="json")
    # Ensure deterministic ordering
    with out.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    return out
