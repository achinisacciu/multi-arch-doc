"""
§11 — Evidence Store
Ogni relazione ha evidence + confidence + resolution
resolution: explicit|resolved|inferred|heuristic|unknown|ambiguous
"""
from typing import Literal
from pydantic import BaseModel, Field

Resolution = Literal["explicit","resolved","inferred","heuristic","unknown","ambiguous","unresolved"]

class Evidence(BaseModel):
    artifact: str
    xpath: str | None = None
    attribute: str | None = None
    value: str | None = None

class RelationshipEvidence(BaseModel):
    source: str
    relationship: str  # §10 taxonomy
    target: str
    evidence: list[Evidence] = Field(default_factory=list)
    confidence: float = 1.0
    resolution: Resolution = "explicit"

    def is_verified(self) -> bool:
        return self.resolution in ("explicit","resolved") and self.confidence >= 0.9

class EvidenceStore:
    """Collezione di evidence per tutte le relazioni."""
    def __init__(self):
        self._store: list[RelationshipEvidence] = []

    def add(self, ev: RelationshipEvidence):
        self._store.append(ev)

    def by_source(self, source: str) -> list[RelationshipEvidence]:
        return [e for e in self._store if e.source == source]

    def unresolved(self) -> list[RelationshipEvidence]:
        return [e for e in self._store if e.resolution in ("unknown","ambiguous","unresolved")]

    def to_list(self):
        return [e.model_dump() for e in self._store]
