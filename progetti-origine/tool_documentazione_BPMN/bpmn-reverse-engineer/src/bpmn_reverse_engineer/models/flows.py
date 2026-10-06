"""Flow models."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class SequenceFlow(BaseModel):
    id: str
    name: str | None = None
    source_ref: str | None = None
    target_ref: str | None = None
    condition: str | None = None  # raw text of conditionExpression
    condition_language: str | None = None
    is_default: bool = False
    raw_attributes: dict[str, Any] = Field(default_factory=dict)
    documentation: str | None = None


class MessageFlow(BaseModel):
    id: str
    name: str | None = None
    source_ref: str | None = None
    target_ref: str | None = None
    raw_attributes: dict[str, Any] = Field(default_factory=dict)
    documentation: str | None = None
