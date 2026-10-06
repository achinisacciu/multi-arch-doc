"""Anonymization helpers — wrap extracted XML values in `` for external anonymizer.

Principle:
- Every string that originates from the BPMN XML (ids, names, namespaces, docs,
  raw_attributes, refs, extension content, etc.) is wrapped as `value` when
  anonymize=True.
- Derived / computed data (metrics counts, tool_version, sha256, sizes, paths
  counts, warning codes) are NOT wrapped.
- Wrapping is idempotent: already-wrapped values are not double-wrapped.
"""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from .models.process import BpmnDocument


def _wrap(s: str | None) -> str | None:
    if s is None:
        return None
    if s == "" or s == "—":
        return s
    # idempotent
    if s.startswith("`") and s.endswith("`") and len(s) >= 2:
        return s
    return f"`{s}`"


def _wrap_list(lst: list[str] | None) -> list[str] | None:
    if lst is None:
        return None
    return [_wrap(x) if isinstance(x, str) else x for x in lst]  # type: ignore


def _wrap_dict_values(d: dict[str, Any] | None) -> dict[str, Any] | None:
    if d is None:
        return None
    out: dict[str, Any] = {}
    for k, v in d.items():
        # key is not wrapped (it's schema), value is if string
        if isinstance(v, str):
            out[k] = _wrap(v)  # type: ignore
        elif isinstance(v, dict):
            out[k] = _wrap_dict_values(v)  # type: ignore
        elif isinstance(v, list):
            # lists of strings or dicts
            wrapped_list: list[Any] = []
            for item in v:
                if isinstance(item, str):
                    wrapped_list.append(_wrap(item))
                elif isinstance(item, dict):
                    wrapped_list.append(_wrap_dict_values(item))
                else:
                    wrapped_list.append(item)
            out[k] = wrapped_list
        else:
            out[k] = v
    return out


def _wrap_extension_structure(node: dict[str, Any] | None) -> dict[str, Any] | None:
    if node is None:
        return None
    # node shape: tag, full_tag, namespace, attributes, text, children, etc.
    out = dict(node)
    # wrap text/tail if present
    if "text" in out and isinstance(out["text"], str) and out["text"]:
        out["text"] = _wrap(out["text"])
    if "tail" in out and isinstance(out["tail"], str) and out["tail"]:
        out["tail"] = _wrap(out["tail"])
    # attributes values
    if "attributes" in out and isinstance(out["attributes"], dict):
        out["attributes"] = _wrap_dict_values(out["attributes"])
    # namespace, tag? tag is structural, but its value originates from XML tag. Should wrap? We keep tag not wrapped to preserve schema, but attributes already.
    # children
    if "children" in out and isinstance(out["children"], list):
        out["children"] = [_wrap_extension_structure(c) for c in out["children"]]
    return out


def anonymize_document(doc: BpmnDocument) -> BpmnDocument:
    """Return a deep-copied document with all extracted strings wrapped in ``."""
    # Use model_copy with deep to avoid mutating original
    cloned = doc.model_copy(deep=True)

    # Source — filename is extracted from filesystem, considered sensitive
    if cloned.source:
        cloned.source.filename = _wrap(cloned.source.filename)  # type: ignore
        # sha256 / size_bytes are derived, not wrapped

    # Processes
    for p in cloned.processes:
        p.id = _wrap(p.id)  # type: ignore
        p.name = _wrap(p.name)  # type: ignore
        p.namespace = _wrap(p.namespace)  # type: ignore
        p.documentation = _wrap(p.documentation)  # type: ignore
        p.raw_attributes = _wrap_dict_values(p.raw_attributes)  # type: ignore

    # Collaborations
    for c in cloned.collaborations:
        c.id = _wrap(c.id)  # type: ignore
        c.name = _wrap(c.name)  # type: ignore
        c.raw_attributes = _wrap_dict_values(c.raw_attributes)  # type: ignore

    # Participants
    for part in cloned.participants:
        part.id = _wrap(part.id)  # type: ignore
        part.name = _wrap(part.name)  # type: ignore
        part.process_ref = _wrap(part.process_ref)  # type: ignore
        part.raw_attributes = _wrap_dict_values(part.raw_attributes)  # type: ignore

    # Lanes
    for lane in cloned.lanes:
        lane.id = _wrap(lane.id)  # type: ignore
        lane.name = _wrap(lane.name)  # type: ignore
        lane.flow_node_refs = _wrap_list(lane.flow_node_refs)  # type: ignore
        lane.raw_attributes = _wrap_dict_values(lane.raw_attributes)  # type: ignore

    # Elements
    for e in cloned.elements:
        e.id = _wrap(e.id)  # type: ignore
        e.name = _wrap(e.name)  # type: ignore
        # type is classification, not wrapping? But spec says "type" is from XML tag, however it's structural not sensitive. We keep unwrapped to not break metrics, but wrap variant still produces correct. Choose to wrap type as well? Keep unwrapped for stability, but anonymizer may not need. We'll wrap original_tag instead.
        if e.namespace:
            e.namespace = _wrap(e.namespace)  # type: ignore
        e.documentation = _wrap(e.documentation)  # type: ignore
        e.incoming = _wrap_list(e.incoming)  # type: ignore
        e.outgoing = _wrap_list(e.outgoing)  # type: ignore
        e.raw_attributes = _wrap_dict_values(e.raw_attributes)  # type: ignore
        # extensions list items are dicts already serialized
        if e.extensions:
            new_ext = []
            for ext in e.extensions:
                # ext dict has keys tag, full_tag, namespace, attributes, text, children
                nw = dict(ext)
                if isinstance(nw.get("text"), str) and nw["text"]:
                    nw["text"] = _wrap(nw["text"])
                if isinstance(nw.get("attributes"), dict):
                    nw["attributes"] = _wrap_dict_values(nw["attributes"])
                if isinstance(nw.get("namespace"), str) and nw["namespace"]:
                    nw["namespace"] = _wrap(nw["namespace"])
                # children recursive?
                if isinstance(nw.get("children"), list):
                    nw["children"] = [_wrap_extension_structure(c) for c in nw["children"]]
                new_ext.append(nw)
            e.extensions = new_ext  # type: ignore
        # event_definitions are structural tokens, not sensitive, keep unwrapped
        if e.default_flow:
            e.default_flow = _wrap(e.default_flow)  # type: ignore
        if e.lane_id:
            e.lane_id = _wrap(e.lane_id)  # type: ignore
        if e.lane_name:
            e.lane_name = _wrap(e.lane_name)  # type: ignore
        if e.process_id:
            e.process_id = _wrap(e.process_id)  # type: ignore
        if e.process_name:
            e.process_name = _wrap(e.process_name)  # type: ignore
        if e.original_tag:
            e.original_tag = _wrap(e.original_tag)  # type: ignore
        # Tool 1.5 enriched fields
        if getattr(e, "enriched_incoming", None):
            e.enriched_incoming = _wrap_list(e.enriched_incoming)  # type: ignore
        if getattr(e, "enriched_outgoing", None):
            e.enriched_outgoing = _wrap_list(e.enriched_outgoing)  # type: ignore
        if getattr(e, "implementation", None):
            e.implementation = _wrap(e.implementation)  # type: ignore
        if getattr(e, "operation_ref", None):
            e.operation_ref = _wrap(e.operation_ref)  # type: ignore
        if getattr(e, "interface_ref", None):
            e.interface_ref = _wrap(e.interface_ref)  # type: ignore
        if getattr(e, "message_ref", None):
            e.message_ref = _wrap(e.message_ref)  # type: ignore

    # Sequence flows
    for sf in cloned.sequence_flows:
        sf.id = _wrap(sf.id)  # type: ignore
        sf.name = _wrap(sf.name)  # type: ignore
        sf.source_ref = _wrap(sf.source_ref)  # type: ignore
        sf.target_ref = _wrap(sf.target_ref)  # type: ignore
        sf.condition = _wrap(sf.condition)  # type: ignore
        sf.condition_language = _wrap(sf.condition_language)  # type: ignore
        sf.raw_attributes = _wrap_dict_values(sf.raw_attributes)  # type: ignore
        sf.documentation = _wrap(sf.documentation)  # type: ignore

    # Message flows
    for mf in cloned.message_flows:
        mf.id = _wrap(mf.id)  # type: ignore
        mf.name = _wrap(mf.name)  # type: ignore
        mf.source_ref = _wrap(mf.source_ref)  # type: ignore
        mf.target_ref = _wrap(mf.target_ref)  # type: ignore
        mf.raw_attributes = _wrap_dict_values(mf.raw_attributes)  # type: ignore
        mf.documentation = _wrap(mf.documentation)  # type: ignore

    # References
    for r in cloned.references:
        r.source_element = _wrap(r.source_element)  # type: ignore
        if r.source_type:
            r.source_type = _wrap(r.source_type)  # type: ignore
        # attribute name is schema, not wrap (e.g., "calledElement"), keep unwrapped
        r.value = _wrap(r.value)  # type: ignore
        if r.namespace:
            r.namespace = _wrap(r.namespace)  # type: ignore

    # Extensions
    for ext in cloned.extensions:
        if ext.parent_id:
            ext.parent_id = _wrap(ext.parent_id)  # type: ignore
        if ext.parent_type:
            ext.parent_type = _wrap(ext.parent_type)  # type: ignore
        if ext.namespace:
            ext.namespace = _wrap(ext.namespace)  # type: ignore
        ext.tag = _wrap(ext.tag)  # type: ignore
        ext.full_tag = _wrap(ext.full_tag)  # type: ignore
        ext.attributes = _wrap_dict_values(ext.attributes)  # type: ignore
        if ext.text:
            ext.text = _wrap(ext.text)  # type: ignore
        if ext.structure:
            ext.structure = _wrap_extension_structure(ext.structure)  # type: ignore
        if ext.raw_xml:
            # raw_xml contains full XML snippet; wrapping the whole string helps anonymizer but keep structure.
            # We wrap the inner text values already; for raw_xml we wrap the whole as anonymizable block.
            # To avoid breaking XML structure for external parser, we wrap the whole raw_xml string.
            ext.raw_xml = _wrap(ext.raw_xml)  # type: ignore

    # Paths
    for p in cloned.paths:
        p.path_id = _wrap(p.path_id)  # type: ignore — but path_id is derived, maybe not needed. Keep wrapped for consistency? Derived IDs not sensitive, but we wrap to be safe if needed.
        # Actually path_id is generated P1,P2 — not sensitive, don't wrap to avoid noise. Revert:
        # undo wrap for path_id if it was like `P1` -> keep as is without backticks? Spec says derived not wrapped. So unwrap path_id.
        # We'll keep path_id unwrapped: strip backticks if added.
        if p.path_id.startswith("`") and p.path_id.endswith("`"):
            p.path_id = p.path_id[1:-1]
        p.nodes = _wrap_list(p.nodes)  # type: ignore
        p.conditions = _wrap_list(p.conditions)  # type: ignore
        p.flows = _wrap_list(p.flows)  # type: ignore

    # Structural warnings
    for w in cloned.structural_warnings:
        # code/severity are derived, not wrapped. message contains extracted ids -> wrap message whole?
        # We wrap message as anonymizable (contains ids)
        w.message = _wrap(w.message)  # type: ignore
        if w.element_id:
            w.element_id = _wrap(w.element_id)  # type: ignore
        if w.details:
            w.details = _wrap_dict_values(w.details)  # type: ignore

    # Unknown elements (already part of elements, but cloned also has list)
    for e in cloned.unknown_elements:
        e.id = _wrap(e.id)  # type: ignore
        if e.name:
            e.name = _wrap(e.name)  # type: ignore
        if e.namespace:
            e.namespace = _wrap(e.namespace)  # type: ignore
        if e.original_tag:
            e.original_tag = _wrap(e.original_tag)  # type: ignore
        e.raw_attributes = _wrap_dict_values(e.raw_attributes)  # type: ignore
        # Tool 1.5 for unknown as well
        if getattr(e, "enriched_incoming", None):
            e.enriched_incoming = _wrap_list(e.enriched_incoming)  # type: ignore
        if getattr(e, "enriched_outgoing", None):
            e.enriched_outgoing = _wrap_list(e.enriched_outgoing)  # type: ignore
        if getattr(e, "implementation", None):
            e.implementation = _wrap(e.implementation)  # type: ignore
        if getattr(e, "operation_ref", None):
            e.operation_ref = _wrap(e.operation_ref)  # type: ignore
        if getattr(e, "interface_ref", None):
            e.interface_ref = _wrap(e.interface_ref)  # type: ignore
        if getattr(e, "message_ref", None):
            e.message_ref = _wrap(e.message_ref)  # type: ignore

    # Tool 1.5: service_implementations (list of dicts)
    if getattr(cloned, "service_implementations", None):
        wrapped = []
        for impl in cloned.service_implementations:
            if isinstance(impl, dict):
                wrapped.append(_wrap_dict_values(impl))
            else:
                # ServiceImplementation object — wrap manually
                d = impl.model_dump() if hasattr(impl, "model_dump") else dict(impl)
                wrapped.append(_wrap_dict_values(d))
        cloned.service_implementations = wrapped  # type: ignore

    if getattr(cloned, "unresolved_references", None):
        wrapped = []
        for ur in cloned.unresolved_references:
            if isinstance(ur, dict):
                wrapped.append(_wrap_dict_values(ur))
            else:
                wrapped.append(ur)
        cloned.unresolved_references = wrapped  # type: ignore

    # messages/interfaces/operations if present as dicts
    for attr in ("messages", "interfaces", "operations"):
        lst = getattr(cloned, attr, None)
        if lst:
            wrapped = []
            for item in lst:
                if isinstance(item, dict):
                    wrapped.append(_wrap_dict_values(item))
                else:
                    wrapped.append(item)
            setattr(cloned, attr, wrapped)

    return cloned
