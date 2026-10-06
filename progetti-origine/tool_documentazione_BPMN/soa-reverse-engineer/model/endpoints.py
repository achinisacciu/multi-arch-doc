"""Model Endpoints — logical vs physical endpoint (§15)."""
from pydantic import BaseModel, Field
from typing import Dict, Optional

class EndpointInfo(BaseModel):
    id: str
    logical: str
    physical: Dict[str, str] = Field(default_factory=dict)  # DEV, TEST, PROD -> url
    config_source: Optional[str] = None
    service_ref: Optional[str] = None
