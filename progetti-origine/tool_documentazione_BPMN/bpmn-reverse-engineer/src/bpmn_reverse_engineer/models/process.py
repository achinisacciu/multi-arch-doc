"""Process-level and document models."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from .elements import BpmnElement
from .flows import MessageFlow, SequenceFlow
from .references import ExplicitReference, ExtensionElement, PathInfo, StructuralWarning


class BpmnProcess(BaseModel):
    id: str
    name: str | None = None
    namespace: str | None = None
    is_executable: bool | None = None
    raw_attributes: dict[str, Any] = Field(default_factory=dict)
    documentation: str | None = None


class Participant(BaseModel):
    id: str
    name: str | None = None
    process_ref: str | None = None
    raw_attributes: dict[str, Any] = Field(default_factory=dict)


class Lane(BaseModel):
    id: str
    name: str | None = None
    flow_node_refs: list[str] = Field(default_factory=list)
    raw_attributes: dict[str, Any] = Field(default_factory=dict)
    parent_lane_set: str | None = None


class Collaboration(BaseModel):
    id: str
    name: str | None = None
    raw_attributes: dict[str, Any] = Field(default_factory=dict)


class SourceInfo(BaseModel):
    filename: str
    sha256: str
    size_bytes: int


class Metrics(BaseModel):
    num_processes: int = 0
    num_events: int = 0
    num_start_events: int = 0
    num_end_events: int = 0
    num_intermediate_events: int = 0
    num_boundary_events: int = 0
    num_activities: int = 0
    num_tasks: int = 0
    num_service_tasks: int = 0
    num_user_tasks: int = 0
    num_manual_tasks: int = 0
    num_script_tasks: int = 0
    num_send_tasks: int = 0
    num_receive_tasks: int = 0
    num_business_rule_tasks: int = 0
    num_call_activities: int = 0
    num_subprocesses: int = 0
    num_gateways: int = 0
    num_exclusive_gateways: int = 0
    num_inclusive_gateways: int = 0
    num_parallel_gateways: int = 0
    num_event_based_gateways: int = 0
    num_complex_gateways: int = 0
    num_sequence_flows: int = 0
    num_message_flows: int = 0
    num_lanes: int = 0
    num_participants: int = 0
    num_collaborations: int = 0
    num_extension_elements: int = 0
    num_explicit_references: int = 0
    num_unknown_elements: int = 0
    # Tool 1.5 additions
    num_messages: int = 0
    num_interfaces: int = 0
    num_operations: int = 0
    num_service_implementations: int = 0
    num_unresolved_refs: int = 0


class BpmnDocument(BaseModel):
    tool_version: str = "0.1.0"
    schema_version: str = "1.5"
    source: SourceInfo
    processes: list[BpmnProcess] = Field(default_factory=list)
    collaborations: list[Collaboration] = Field(default_factory=list)
    participants: list[Participant] = Field(default_factory=list)
    lanes: list[Lane] = Field(default_factory=list)
    elements: list[BpmnElement] = Field(default_factory=list)
    sequence_flows: list[SequenceFlow] = Field(default_factory=list)
    message_flows: list[MessageFlow] = Field(default_factory=list)
    references: list[ExplicitReference] = Field(default_factory=list)
    extensions: list[ExtensionElement] = Field(default_factory=list)
    metrics: Metrics = Field(default_factory=Metrics)
    paths: list[PathInfo] = Field(default_factory=list)
    structural_warnings: list[StructuralWarning] = Field(default_factory=list)
    # unknown_bpmn_element already in elements with is_unknown; also keep separate for convenience
    unknown_elements: list[BpmnElement] = Field(default_factory=list)
    # Tool 1.5 additions (additive, backward-compatible)
    messages: list[Any] = Field(default_factory=list)  # placeholder BpmnMessage
    interfaces: list[Any] = Field(default_factory=list)
    operations: list[Any] = Field(default_factory=list)
    service_implementations: list[Any] = Field(default_factory=list)  # ServiceImplementation
    unresolved_references: list[Any] = Field(default_factory=list)
    cross_artifact: Any | None = None
