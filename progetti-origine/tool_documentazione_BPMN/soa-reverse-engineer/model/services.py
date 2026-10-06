"""
Model Services — WSDL
"""
from pydantic import BaseModel, Field
from typing import List, Optional

class WsdlOperationInfo(BaseModel):
    name: str
    inputMessage: Optional[str] = None
    outputMessage: Optional[str] = None
    faultMessages: List[str] = Field(default_factory=list)

class WsdlPortTypeInfo(BaseModel):
    name: str
    operations: List[WsdlOperationInfo] = Field(default_factory=list)

class WsdlContractInfo(BaseModel):
    id: str
    name: str
    targetNamespace: str = ""
    portTypes: List[WsdlPortTypeInfo] = Field(default_factory=list)
    imports: List[str] = Field(default_factory=list)
    serviceName: Optional[str] = None
    soapAddress: Optional[str] = None
    fileName: str
    relativePath: str
    rawXml: str = ""
