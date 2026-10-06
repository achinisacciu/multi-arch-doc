"""
§6 — Canonical Artifact Model
Ogni artifact ha provenienza e identità stabile.
"""
from pydantic import BaseModel, Field
from typing import Any

class Provenance(BaseModel):
    artifact: str  # path relativo
    sha256: str | None = None
    xpath: str | None = None       # §8
    line: int | None = None
    column: int | None = None
    namespace: str | None = None
    local_name: str | None = None

class Artifact(BaseModel):
    id: str                        # stable hash
    type: str                      # ArtifactType
    path: str
    detected_by: str               # extension|namespace|root|fingerprint
    provenance: Provenance | None = None
    raw_xml: str | None = None     # per evidence, opzionale
    metadata: dict[str, Any] = Field(default_factory=dict)
