"""
§22 — Trace: reverse-engineer trace --from ActivityA
"""
import networkx as nx
from typing import List

def trace_from(G: nx.MultiDiGraph, source: str, max_depth: int = 10) -> List[List[str]]:
    """Ritorna tutti i percorsi da source seguendo edges (BFS)."""
    if source not in G:
        return []
    paths = []
    # usa DFS limitato
    def dfs(node, path, depth):
        if depth > max_depth:
            return
        succs = list(G.successors(node))
        if not succs:
            paths.append(list(path))
            return
        for nxt in succs:
            if nxt in path:  # evita cicli
                paths.append(list(path) + [nxt + " (cycle)"])
                continue
            path.append(nxt)
            dfs(nxt, path, depth+1)
            path.pop()
        if not succs:
            paths.append(list(path))
    dfs(source, [source], 0)
    return paths

def trace_between(G: nx.MultiDiGraph, source: str, target: str, cutoff: int = 10) -> List[List[str]]:
    """Percorsi da source a target."""
    if source not in G or target not in G:
        return []
    try:
        return list(nx.all_simple_paths(G, source, target, cutoff=cutoff))
    except nx.NetworkXNoPath:
        return []
