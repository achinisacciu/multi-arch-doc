"""
§23 — Impact Analysis: reverse-engineer impact --artifact customer.xsd
Se modifico XSD, quali processi si rompono? Reverse traversal del graph.
"""
import networkx as nx
from typing import List, Set

def impact_analysis(G: nx.MultiDiGraph, artifact_id: str) -> List[str]:
    """Ritorna tutti i nodi che dipendono da artifact_id (reverse reachable)."""
    if artifact_id not in G:
        # prova match per nome file
        for n in G.nodes:
            if artifact_id in str(n) or str(n).endswith(artifact_id):
                artifact_id = n
                break
        else:
            return []
    # reverse graph: chi dipende da me = chi mi raggiunge al contrario
    # In MultiDiGraph, i predecessori sono chi punta a me; ma per impact
    # vogliamo chi dipende transitivamente: tutti i nodi che hanno path verso artifact? No, impact = forward da artifact
    # Se artifact è XSD, chi lo usa? Chi ha edge verso XSD? No, XSD è target di WSDL import, quindi chi dipende da XSD è chi lo importa + chi importa chi lo importa.
    # Quindi serve reverse: trova tutti i nodi che raggiungono XSD al contrario = predecessors transitivi? 
    # Semplificazione: impact = tutti i nodi da cui si può raggiungere artifact nel grafo invertito = ancestors
    RG = G.reverse(copy=False)
    impacted: Set[str] = set()
    stack = [artifact_id]
    visited = set()
    while stack:
        cur = stack.pop()
        if cur in visited:
            continue
        visited.add(cur)
        for pred in G.predecessors(cur):  # chi punta a cur
            if pred not in impacted:
                impacted.add(pred)
                stack.append(pred)
        # anche via reverse edges
        for succ in RG.successors(cur):
            if succ not in visited:
                stack.append(succ)
    # in realtà per impact forward: se XSD cambia, WSDL che lo importa è impattato, e a sua volta chi usa WSDL
    # Quindi cerchiamo forward da XSD nel grafo normale: chi è raggiungibile da XSD? No, XSD è sorgente, non destinazione.
    # Corretto: impact = tutti i nodi raggiungibili da artifact seguendo archi inversi (chi dipende)
    # Usiamo ancestors
    try:
        ancestors = nx.ancestors(G, artifact_id)
        impacted.update(ancestors)
    except Exception:
        pass
    return sorted(impacted)

def impacted_processes(G: nx.MultiDiGraph, xsd_id: str) -> List[str]:
    impacted = impact_analysis(G, xsd_id)
    # filtra solo processi BPMN/BPEL
    return [n for n in impacted if G.nodes[n].get("type") in ("bpmn_process","bpel","sca_composite")]
