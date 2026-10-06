"""Path enumeration start → end, with limits."""

from __future__ import annotations

import itertools

import networkx as nx

from ..models.references import PathInfo


def compute_paths(
    graph: nx.DiGraph,
    limit: int = 100,
    max_depth: int = 50,
) -> list[PathInfo]:
    # Identify start and end nodes by type attribute
    starts = [n for n, d in graph.nodes(data=True) if d.get("type") == "startEvent"]
    ends = [n for n, d in graph.nodes(data=True) if d.get("type") == "endEvent"]

    # Fallback: nodes without incoming / outgoing if no explicit events
    if not starts:
        starts = [n for n, deg in graph.in_degree() if deg == 0]
    if not ends:
        ends = [n for n, deg in graph.out_degree() if deg == 0]

    if not starts or not ends:
        return []

    paths: list[PathInfo] = []
    counter = 0

    # For each start->end pair, enumerate simple paths with cutoff
    for s, t in itertools.product(starts, ends):
        if s not in graph or t not in graph:
            continue
        try:
            # Use all_simple_paths with cutoff to avoid explosion
            for p in nx.all_simple_paths(graph, source=s, target=t, cutoff=max_depth):
                counter += 1
                if counter > limit:
                    break
                # Collect conditions along path
                conditions: list[str] = []
                flows: list[str] = []
                for u, v in zip(p, p[1:]):
                    ed = graph.get_edge_data(u, v) or {}
                    # graph may have multiple attributes; handle condition
                    cond = ed.get("condition")
                    fid = ed.get("flow_id")
                    if fid:
                        flows.append(fid)
                    if cond:
                        # preserve original truncated? keep raw
                        conditions.append(f"{fid or ''}={cond}" if fid else cond)
                    elif ed.get("is_default"):
                        conditions.append(f"{fid or ''}:default")
                paths.append(
                    PathInfo(
                        path_id=f"P{len(paths)+1}",
                        nodes=p,
                        conditions=conditions,
                        flows=flows,
                    )
                )
                if len(paths) >= limit:
                    break
        except nx.NetworkXNoPath:
            continue
        if len(paths) >= limit:
            break

    return paths
