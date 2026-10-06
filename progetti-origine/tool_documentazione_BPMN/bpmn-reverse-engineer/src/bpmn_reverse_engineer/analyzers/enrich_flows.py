"""Tool 1.5 — flow enrichment (incoming/outgoing backfill)."""

from __future__ import annotations

from collections import defaultdict

from ..models.process import BpmnDocument


def enrich_flows(doc: BpmnDocument) -> BpmnDocument:
    """Backfill Incoming/Outgoing from sequenceFlow if XML tags were omitted.

    Keeps verbatim values when present, otherwise infers from flows.
    Populates enriched_* fields and flags.
    Also extracts typed implementation refs for activities.
    """
    incoming_map: dict[str, list[str]] = defaultdict(list)
    outgoing_map: dict[str, list[str]] = defaultdict(list)

    for sf in doc.sequence_flows:
        if sf.target_ref:
            incoming_map[sf.target_ref].append(sf.id)
        if sf.source_ref:
            outgoing_map[sf.source_ref].append(sf.id)

    # also consider messageFlow for completeness? No, only sequenceFlow for lane activities
    ref_map: dict[str, dict[str, str]] = {}
    for r in doc.references:
        # map source_element -> attribute -> value for quick lookup
        ref_map.setdefault(r.source_element, {})[r.attribute] = r.value

    for e in doc.elements:
        # enriched fields always contain inferred or verbatim
        inferred_in = incoming_map.get(e.id, [])
        inferred_out = outgoing_map.get(e.id, [])

        # verbatim
        has_in = bool(e.incoming)
        has_out = bool(e.outgoing)

        e.enriched_incoming = e.incoming if has_in else inferred_in
        e.enriched_outgoing = e.outgoing if has_out else inferred_out
        e.was_incoming_enriched = not has_in and bool(inferred_in)
        e.was_outgoing_enriched = not has_out and bool(inferred_out)

        # Backfill for markdown auto-descriptive: if verbatim empty, fill with inferred
        # This satisfies requirement "Incoming e Outgoing vuoti" -> ora popolati
        if not has_in and inferred_in:
            e.incoming = list(inferred_in)
        if not has_out and inferred_out:
            e.outgoing = list(inferred_out)

        # Tipizza campi attività da raw_attributes e references
        # implementation, operationRef, interfaceRef, messageRef
        raw = e.raw_attributes or {}
        # raw keys may be Clark notation or local; normalize to local lower
        def get_attr(key: str) -> str | None:
            for k, v in raw.items():
                # strip namespace: {uri}local or prefix:local
                local = k.split("}")[-1].split(":")[-1] if "}" in k or ":" in k else k
                if local == key:
                    return v
            return None

        impl = get_attr("implementation")
        if impl:
            e.implementation = impl
        # references override / complement
        refs = ref_map.get(e.id, {})
        for attr in ("operationRef", "interfaceRef", "messageRef", "calledElement"):
            if attr in refs:
                if attr == "operationRef":
                    e.operation_ref = refs[attr]
                elif attr == "interfaceRef":
                    e.interface_ref = refs[attr]
                elif attr == "messageRef":
                    e.message_ref = refs[attr]
        # also check raw_attributes for those if not in references
        if not e.operation_ref:
            op = get_attr("operationRef")
            if op:
                e.operation_ref = op
        if not e.interface_ref:
            ir = get_attr("interfaceRef")
            if ir:
                e.interface_ref = ir
        if not e.message_ref:
            mr = get_attr("messageRef")
            if mr:
                e.message_ref = mr

    return doc
