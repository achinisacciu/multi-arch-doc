"""Model Processes — canonical process abstraction."""
from pydantic import BaseModel, Field
from typing import List, Optional, Any

class CanonicalProcess(BaseModel):
    id: str
    name: Optional[str] = None
    type: str = "process"  # bpmn, bpel, etc. canonical
    source_artifact: Optional[str] = None
    source_location: Optional[dict] = None
    activities: List[str] = Field(default_factory=list)
    gateways: List[str] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)
