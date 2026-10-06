"""Build NetworkX directed graph from BpmnDocument."""

from __future__ import annotations

import networkx as nx

from ..models.process import BpmnDocument


def build_graph(doc: BpmnDocument) -> nx.DiGraph:
    g = nx.DiGraph()

    # Add nodes
    for elem in doc.elements:
        g.add_node(
            elem.id,
            name=elem.name,
            type=elem.type,
            documentation=elem.documentation,
            lane=elem.lane_id,
            lane_name=elem.lane_name,
            process_id=elem.process_id,
            incoming=elem.incoming,
            outgoing=elem.outgoing,
        )

    # Also add nodes for participants? Not necessary but could help messageFlow.
    # MessageFlow edges handled separately.

    # Map sequenceFlow id -> flow for edge attributes
    # Build id -> element existence for validation
    node_ids = set(g.nodes)

    for sf in doc.sequence_flows:
        src = sf.source_ref
        tgt = sf.target_ref
        # Ensure nodes exist even if missing — add placeholder to preserve graph but flag warnings elsewhere
        if src and src not in g:
            g.add_node(src, name=None, type="unknown", documentation=None, lane=None, is_placeholder=True)
        if tgt and tgt not in g:
            g.add_node(tgt, name=None, type="unknown", documentation=None, lane=None, is_placeholder=True)
        if src and tgt:
            g.add_edge(
                src,
                tgt,
                flow_id=sf.id,
                flow_type="sequenceFlow",
                condition=sf.condition,
                is_default=sf.is_default,
                name=sf.name,
            )

    # Message flows are separate layer; add as edges with different type
    for mf in doc.message_flows:
        src = mf.source_ref
        tgt = mf.target_ref
        if src and src not in g:
            g.add_node(src, name=None, type="participant", documentation=None, lane=None, is_placeholder=True)
        if tgt and tgt not in g:
            g.add_node(tgt, name=None, type="participant", documentation=None, lane=None, is_placeholder=True)
        if src and tgt:
            # Avoid duplicating if same edge exists as sequence
            if g.has_edge(src, tgt):
                # add parallel edge info? For DiGraph we can't have multi-edge, so keep sequence edge and add attribute
                # Instead add messageFlow as separate edge with suffix?
                # We'll store as additional attribute on existing edge if not present
                # But better to just add if not exists, otherwise create separate edge key via adding attribute list
                # For simplicity, if edge exists, we keep it but document messageFlow elsewhere (graph exporter handles separately)
                # To preserve, we add a second node edge via intermediate? Instead add edge with flow_type messageFlow if not exists
                continue
            g.add_edge(
                src,
                tgt,
                flow_id=mf.id,
                flow_type="messageFlow",
                condition=None,
                is_default=False,
                name=mf.name,
            )

    return g
