"""
§5 + §11 — Confidence & Resolution level
Livello 1: exact (QName/ID/URI) → confidence 1.0, explicit
Livello 2: namespace → 0.9
Livello 3: artifact relationship (wire) → 0.85
Livello 4: structural matching → 0.7
Livello 5: heuristic → 0.5
"""
from typing import Literal

Resolution = Literal["explicit","resolved","inferred","heuristic","unknown","ambiguous"]

def confidence_for_level(level: int) -> tuple[Resolution, float]:
    mapping = {
        1: ("explicit", 1.0),
        2: ("resolved", 0.9),
        3: ("resolved", 0.85),
        4: ("inferred", 0.7),
        5: ("heuristic", 0.5),
    }
    return mapping.get(level, ("unknown", 0.0))
