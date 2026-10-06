"""Reference and supporting models."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ExplicitReference(BaseModel):
    source_element: str  # element id
    source_type: str | None = None
    attribute: str  # attribute name
    value: str
    namespace: str | None = None
    kind: str = "explicit_xml_reference"
    # Tool 1.5: risoluzione
    resolved: bool | None = None
    target_hint: str | None = None


class ServiceImplementation(BaseModel):
    task_id: str
    task_name: str | None = None
    task_type: str | None = None
    implementation: str | None = None
    operation_ref: str | None = None
    interface_ref: str | None = None
    message_ref: str | None = None
    endpoint: str | None = None
    binding_type: str | None = None  # jca, ws, rest, etc.
    adapter: str | None = None
    wsdl: str | None = None
    namespace: str | None = None
    source: str | None = None  # raw_attributes | extensionElements | reference
    status: str = "unresolved"  # resolved | unresolved | ambiguous
    extension_tag: str | None = None
    raw_attributes: dict[str, Any] = Field(default_factory=dict)


class BpmnMessage(BaseModel):
    id: str
    name: str | None = None
    item_ref: str | None = None
    structure_ref: str | None = None


class UnresolvedReference(BaseModel):
    source_element: str
    attribute: str
    value: str
    reason: str | None = None


class ExtensionElement(BaseModel):
    parent_id: str | None = None  # id of BPMN element that owns this extension
    parent_type: str | None = None
    namespace: str | None = None
    tag: str  # local name
    full_tag: str  # original Clark tag
    attributes: dict[str, Any] = Field(default_factory=dict)
    text: str | None = None
    # Full serializable structure
    structure: dict[str, Any] = Field(default_factory=dict)
    raw_xml: str | None = None


class StructuralWarning(BaseModel):
    code: str
    severity: str = "warning"
    message: str
    element_id: str | None = None
    details: dict[str, Any] = Field(default_factory=dict)


class PathInfo(BaseModel):
    path_id: str
    nodes: list[str]
    conditions: list[str] = Field(default_factory=list)
    flows: list[str] = Field(default_factory=list)
