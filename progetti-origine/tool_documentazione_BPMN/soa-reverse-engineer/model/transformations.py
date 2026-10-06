"""Model Transformations — XSLT field mappings (§18)."""
from pydantic import BaseModel, Field
from typing import List, Optional

class FieldMapping(BaseModel):
    source: str
    target: str
    transform: str = "value-of"
    via: Optional[str] = None

class TransformationInfo(BaseModel):
    id: str
    file: str
    mappings: List[FieldMapping] = Field(default_factory=list)
    template_count: int = 0
