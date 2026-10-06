"""
Model Schemas — XSD
"""
from pydantic import BaseModel, Field
from typing import List, Optional

class XsdElementInfo(BaseModel):
    name: str
    type: Optional[str] = None

class XsdComplexTypeInfo(BaseModel):
    name: str
    elementCount: int = 0

class XsdSchemaInfo(BaseModel):
    id: str
    name: str
    targetNamespace: str = ""
    elements: List[XsdElementInfo] = Field(default_factory=list)
    complexTypes: List[XsdComplexTypeInfo] = Field(default_factory=list)
    simpleTypes: List[str] = Field(default_factory=list)
    imports: List[str] = Field(default_factory=list)
    includes: List[str] = Field(default_factory=list)
    fileName: str
    relativePath: str
    rawXml: str = ""
