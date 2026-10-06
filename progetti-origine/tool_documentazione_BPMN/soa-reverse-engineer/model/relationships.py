"""
Model Relationships — taxonomy §10
Control flow: flows_to, branches_to, joins_from, triggers
Implementation: implements, invokes, etc.
"""
from pydantic import BaseModel
from typing import Literal

RelationshipType = Literal[
    "flows_to","branches_to","joins_from","triggers",
    "implements","implemented_by","invokes","called_by",
    "exposes","references","wired_to","wires",
    "uses_message","uses_schema","transforms","imports","includes",
    "connects_to","configured_by","handles_error"
]

class Relationship(BaseModel):
    source: str
    target: str
    type: RelationshipType
    confidence: float = 1.0
    evidence: dict | None = None
