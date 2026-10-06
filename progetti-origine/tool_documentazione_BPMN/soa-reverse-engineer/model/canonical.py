"""
§6 — Canonical Intermediate Representation
Project
 ├── Artifacts
 ├── Processes
 ├── Components
 ├── Services
 ├── Operations
 ├── Messages
 ├── Schemas
 ├── Transformations
 ├── Endpoints
 ├── Resources
 └── Dependencies

Ogni oggetto: id,type,name,source_artifact,source_location,metadata,references,relationships,confidence
"""
from pydantic import BaseModel, Field
from typing import Any, Literal

class CanonicalEntity(BaseModel):
    id: str
    type: str                      # canonical type, non BPMN-specifico
    name: str | None = None
    source_artifact: str | None = None
    source_location: dict[str, Any] | None = None  # {xpath, line, column}
    metadata: dict[str, Any] = Field(default_factory=dict)
    references: list[str] = Field(default_factory=list)
    relationships: list[str] = Field(default_factory=list)
    confidence: float = 1.0
    provenance: Any | None = None

class CanonicalModel(BaseModel):
    artifacts: list[Any] = Field(default_factory=list)
    processes: list[CanonicalEntity] = Field(default_factory=list)
    components: list[CanonicalEntity] = Field(default_factory=list)
    services: list[CanonicalEntity] = Field(default_factory=list)
    operations: list[CanonicalEntity] = Field(default_factory=list)
    messages: list[CanonicalEntity] = Field(default_factory=list)
    schemas: list[CanonicalEntity] = Field(default_factory=list)
    transformations: list[CanonicalEntity] = Field(default_factory=list)
    endpoints: list[CanonicalEntity] = Field(default_factory=list)
    resources: list[CanonicalEntity] = Field(default_factory=list)
    dependencies: list[Any] = Field(default_factory=list)
