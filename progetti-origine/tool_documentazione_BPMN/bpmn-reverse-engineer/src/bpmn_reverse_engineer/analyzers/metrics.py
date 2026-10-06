"""Metrics + structural warnings."""

from __future__ import annotations

import networkx as nx

from ..models.process import BpmnDocument, Metrics
from ..models.references import StructuralWarning
from ..parser.namespaces import ACTIVITY_TYPES, EVENT_TYPES, GATEWAY_TYPES


def compute_metrics(doc: BpmnDocument) -> Metrics:
    m = Metrics()
    m.num_processes = len(doc.processes)
    m.num_collaborations = len(doc.collaborations)
    m.num_participants = len(doc.participants)
    m.num_lanes = len(doc.lanes)
    m.num_sequence_flows = len(doc.sequence_flows)
    m.num_message_flows = len(doc.message_flows)
    m.num_extension_elements = len(doc.extensions)
    m.num_explicit_references = len(doc.references)

    for e in doc.elements:
        t = e.type
        # events
        if t in EVENT_TYPES:
            m.num_events += 1
            if t == "startEvent":
                m.num_start_events += 1
            elif t == "endEvent":
                m.num_end_events += 1
            elif t == "boundaryEvent":
                m.num_boundary_events += 1
            else:
                # intermediateCatch/Throw counted as intermediate
                m.num_intermediate_events += 1
        # gateways
        if t in GATEWAY_TYPES:
            m.num_gateways += 1
            if t == "exclusiveGateway":
                m.num_exclusive_gateways += 1
            elif t == "inclusiveGateway":
                m.num_inclusive_gateways += 1
            elif t == "parallelGateway":
                m.num_parallel_gateways += 1
            elif t == "eventBasedGateway":
                m.num_event_based_gateways += 1
            elif t == "complexGateway":
                m.num_complex_gateways += 1
        # activities
        if t in ACTIVITY_TYPES or t in {"task"}:
            m.num_activities += 1
            if t == "task":
                m.num_tasks += 1
            elif t == "serviceTask":
                m.num_service_tasks += 1
            elif t == "userTask":
                m.num_user_tasks += 1
            elif t == "manualTask":
                m.num_manual_tasks += 1
            elif t == "scriptTask":
                m.num_script_tasks += 1
            elif t == "sendTask":
                m.num_send_tasks += 1
            elif t == "receiveTask":
                m.num_receive_tasks += 1
            elif t == "businessRuleTask":
                m.num_business_rule_tasks += 1
            elif t == "callActivity":
                m.num_call_activities += 1
            elif t == "subProcess":
                m.num_subprocesses += 1
            elif t in {"adHocSubProcess", "transaction"}:
                m.num_subprocesses += 1
        # also subprocess counted separately if type is subprocess but already above
        if t == "callActivity":
            m.num_call_activities = max(m.num_call_activities, 1)  # ensure at least
        if e.is_unknown:
            m.num_unknown_elements += 1

    # Reconcile activity counts vs unknown: if unknown contains task-like, not counted

    return m


def compute_warnings(doc: BpmnDocument, graph: nx.DiGraph) -> list[StructuralWarning]:
    warnings: list[StructuralWarning] = []

    node_ids = set(graph.nodes)
    # Build maps for sequence flows
    flow_targets = {sf.target_ref for sf in doc.sequence_flows if sf.target_ref}
    flow_sources = {sf.source_ref for sf in doc.sequence_flows if sf.source_ref}

    # Elements by id
    elem_by_id = {e.id: e for e in doc.elements}

    # 1. Nodes without incoming
    for e in doc.elements:
        # startEvents are allowed without incoming; others are warnings
        indeg = graph.in_degree(e.id) if e.id in graph else 0
        if indeg == 0:
            # If element has no incoming attribute and indeg 0, warn unless startEvent
            if e.type != "startEvent":
                warnings.append(
                    StructuralWarning(
                        code="node_without_incoming",
                        message=f"Node '{e.id}' ({e.type}) has no incoming flows",
                        element_id=e.id,
                        details={"type": e.type, "name": e.name},
                    )
                )

    # 2. Nodes without outgoing
    for e in doc.elements:
        outdeg = graph.out_degree(e.id) if e.id in graph else 0
        if outdeg == 0:
            if e.type != "endEvent":
                warnings.append(
                    StructuralWarning(
                        code="node_without_outgoing",
                        message=f"Node '{e.id}' ({e.type}) has no outgoing flows",
                        element_id=e.id,
                        details={"type": e.type, "name": e.name},
                    )
                )

    # 3. Unreachable nodes (from any startEvent)
    start_ids = [e.id for e in doc.elements if e.type == "startEvent"]
    if start_ids:
        reachable: set[str] = set()
        for s in start_ids:
            if s in graph:
                reachable.update(nx.descendants(graph, s))
                reachable.add(s)
        for e in doc.elements:
            if e.id not in reachable:
                warnings.append(
                    StructuralWarning(
                        code="unreachable_node",
                        message=f"Node '{e.id}' is unreachable from any startEvent",
                        element_id=e.id,
                        details={"type": e.type},
                    )
                )

    # 4. Gateway branching
    for e in doc.elements:
        if e.type in GATEWAY_TYPES:
            outs = list(graph.successors(e.id)) if e.id in graph else []
            if len(outs) > 1:
                warnings.append(
                    StructuralWarning(
                        code="gateway_branch",
                        message=f"Gateway '{e.id}' has {len(outs)} outgoing flows",
                        element_id=e.id,
                        details={"outgoing_count": len(outs), "type": e.type},
                    )
                )
            # gateway with conditions vs without
            outgoing_flows = [sf for sf in doc.sequence_flows if sf.source_ref == e.id]
            with_cond = [sf for sf in outgoing_flows if sf.condition]
            without_cond = [sf for sf in outgoing_flows if not sf.condition and not sf.is_default]
            if e.type in {"exclusiveGateway", "inclusiveGateway"} and with_cond and without_cond:
                warnings.append(
                    StructuralWarning(
                        code="gateway_mixed_conditions",
                        message=f"Gateway '{e.id}' has both conditional and unconditional flows",
                        element_id=e.id,
                        details={"with": len(with_cond), "without": len(without_cond)},
                    )
                )
            if e.type in {"exclusiveGateway"} and len(outgoing_flows) > 1 and not with_cond:
                warnings.append(
                    StructuralWarning(
                        code="gateway_without_conditions",
                        message=f"Exclusive gateway '{e.id}' has no conditions",
                        element_id=e.id,
                    )
                )

    # 5. Broken sequence flows (target/source missing)
    all_ids = (
        {e.id for e in doc.elements}
        | {p.id for p in doc.participants}
        | {sf.id for sf in doc.sequence_flows}
        | {mf.id for mf in doc.message_flows}
        | {proc.id for proc in doc.processes}
        | {c.id for c in doc.collaborations}
    )
    # Actually participants are not nodes but could be messageFlow refs; for sequence flows only element ids matter
    element_ids = {e.id for e in doc.elements}
    for sf in doc.sequence_flows:
        if sf.source_ref and sf.source_ref not in element_ids:
            warnings.append(
                StructuralWarning(
                    code="broken_flow_source",
                    message=f"SequenceFlow '{sf.id}' source '{sf.source_ref}' not found",
                    element_id=sf.id,
                    details={"source_ref": sf.source_ref, "target_ref": sf.target_ref},
                )
            )
        if sf.target_ref and sf.target_ref not in element_ids:
            warnings.append(
                StructuralWarning(
                    code="broken_flow_target",
                    message=f"SequenceFlow '{sf.id}' target '{sf.target_ref}' not found",
                    element_id=sf.id,
                    details={"source_ref": sf.source_ref, "target_ref": sf.target_ref},
                )
            )

    # 6. Elements referenced but not found: from lane flowNodeRefs, processRefs etc.
    lane_refs = set()
    for lane in doc.lanes:
        for ref in lane.flow_node_refs:
            lane_refs.add(ref)
    for ref in lane_refs:
        if ref not in element_ids:
            warnings.append(
                StructuralWarning(
                    code="missing_lane_ref",
                    message=f"Lane references unknown element '{ref}'",
                    element_id=ref,
                )
            )

    # 7. Explicit references to missing elements? Only flag if value looks like an id and not found
    for r in doc.references:
        # If reference value is QName with no namespace, check if it matches any element/process id
        # We only warn if it looks like an id reference (e.g., processRef) and target not found
        if r.attribute in {"processRef", "calledElement"} and r.value not in all_ids:
            # Check if value contains colon (QName) — then local part may be id
            local = r.value.split(":")[-1]
            if local not in all_ids:
                warnings.append(
                    StructuralWarning(
                        code="missing_reference_target",
                        message=f"Reference '{r.attribute}'='{r.value}' from '{r.source_element}' not found",
                        element_id=r.source_element,
                        details={"attribute": r.attribute, "value": r.value},
                    )
                )

    return warnings
