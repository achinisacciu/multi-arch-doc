"""Model Messages — canonical message abstraction."""
from pydantic import BaseModel, Field
from typing import List, Optional

class CanonicalMessage(BaseModel):
    id: str
    name: str
    parts: List[str] = Field(default_factory=list)
    schema_ref: Optional[str] = None
    source_artifact: Optional[str] = None
