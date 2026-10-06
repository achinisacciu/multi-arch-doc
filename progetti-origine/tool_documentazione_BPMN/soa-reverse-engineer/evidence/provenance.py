"""
§7-§8 — Provenance: file, line, xpath, namespace, raw_xml
Ogni informazione traccia da dove proviene.
"""
from pydantic import BaseModel

class Provenance(BaseModel):
    artifact: str  # relativePath
    xpath: str | None = None
    attribute: str | None = None
    line: int | None = None
    column: int | None = None
    namespace: str | None = None
    raw_xml: str | None = None

    def to_dict(self):
        return self.model_dump(exclude_none=True)
