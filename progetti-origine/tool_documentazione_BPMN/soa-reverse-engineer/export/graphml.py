"""
Export GraphML — global heterogeneous graph
"""
from pathlib import Path
import networkx as nx

def export_graphml_global(graph_dict: dict, output: Path):
    G = nx.MultiDiGraph()
    for n in graph_dict.get("nodes", []):
        nid = n.get("id")
        G.add_node(nid, **{k: str(v) for k, v in n.items() if k != "id"})
    for e in graph_dict.get("edges", []):
        src = e.get("source")
        tgt = e.get("target")
        G.add_edge(src, tgt, **{k: str(v) for k, v in e.items() if k not in ("source","target")})
    # Use lxml-like write
    output.parent.mkdir(parents=True, exist_ok=True)
    nx.write_graphml(G, str(output))
    return output
