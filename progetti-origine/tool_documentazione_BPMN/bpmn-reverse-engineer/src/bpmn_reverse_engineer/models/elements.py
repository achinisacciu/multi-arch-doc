"""Element models."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class BpmnElement(BaseModel):
    id: str
    name: str | None = None
    type: str  # localName exactly as in BPMN
    namespace: str | None = None
    documentation: str | None = None
    incoming: list[str] = Field(default_factory=list)
    outgoing: list[str] = Field(default_factory=list)
    # Tool 1.5: enriched (backfill da sequenceFlow se vuoti)
    enriched_incoming: list[str] = Field(default_factory=list)
    enriched_outgoing: list[str] = Field(default_factory=list)
    was_incoming_enriched: bool = False
    was_outgoing_enriched: bool = False
    raw_attributes: dict[str, Any] = Field(default_factory=dict)
    # extensionElements attached directly to this element (serialized)
    extensions: list[dict[str, Any]] = Field(default_factory=list)
    # event definitions nested inside events (e.g. timerEventDefinition)
    event_definitions: list[str] = Field(default_factory=list)
    # for gateways: default flow id
    default_flow: str | None = None
    # lane membership
    lane_id: str | None = None
    lane_name: str | None = None
    # process membership
    process_id: str | None = None
    process_name: str | None = None
    # Tool 1.5: campi tipizzati per attività
    implementation: str | None = None
    operation_ref: str | None = None
    interface_ref: str | None = None
    message_ref: str | None = None
    # if this element was classified as unknown
    is_unknown: bool = False
    original_tag: str | None = None
