"""
V0.8 — Global Dependency Graph (eterogeneo §9, tassonomia §10)
Nodi tipizzati: bpmn, bpel, sca_composite, wsdl, xsd, xslt, jca, mediator, human_task, composite, service, operation, message, schema, field
Edges tipizzati: flows_to, implements, invokes, wired_to, transforms, imports, includes, uses_message, etc.
Usa networkx.MultiDiGraph per permettere multi-edges tra stessa coppia (es. WSDL→XSD + SCA wire).
"""
from typing import List, Dict, Any
import networkx as nx

# Tassonomia §10
EDGE_TAXONOMY = {
    # Control flow
    "flows_to", "branches_to", "joins_from", "triggers",
    # Implementation
    "implements", "implemented_by", "invokes", "called_by",
    # Service
    "exposes", "references", "wired_to", "wires",
    # Data
    "uses_message", "uses_schema", "produces_message", "consumes_message", "transforms", "maps_to", "imports", "includes",
    # Infra
    "connects_to", "reads_from", "writes_to",
    # Config
    "configured_by",
    # Error
    "handles_error",
}

def build_global_graph(
    bpmn_docs: List[Dict] | None = None,
    bpel_infos: List[Dict] | None = None,
    wsdl_infos: List[Dict] | None = None,
    xsd_infos: List[Dict] | None = None,
    xslt_infos: List[Dict] | None = None,
    composites: List[Dict] | None = None,
    lineage: Dict[str, Any] | None = None,
    wsdl_xsd_graph: Dict[str, Any] | None = None,
) -> nx.MultiDiGraph:
    """
    Costruisce grafo globale eterogeneo.
    Ogni artifact è un nodo; ogni relazione è un edge tipizzato con evidence.
    """
    G = nx.MultiDiGraph()

    # Helper per aggiungere nodi
    def add_node(nid: str, ntype: str, **attrs):
        if not G.has_node(nid):
            G.add_node(nid, type=ntype, **attrs)

    # BPMN processes -> activities -> flows
    for doc in bpmn_docs or []:
        pid = doc.get("id") or doc.get("name") or "bpmn_process"
        add_node(pid, "bpmn_process", label=doc.get("name"))
        # se doc ha elements, aggiungi
        for el in doc.get("elements", []) if isinstance(doc.get("elements"), list) else []:
            eid = el.get("id") if isinstance(el, dict) else getattr(el, "id", str(el))
            add_node(eid, el.get("type", "activity") if isinstance(el, dict) else "activity")
            G.add_edge(pid, eid, type="contains", confidence=1.0)
        # service implementations -> operation
        for si in doc.get("service_implementations", []) if isinstance(doc.get("service_implementations"), list) else []:
            if isinstance(si, dict):
                tid = si.get("task_id")
                op = si.get("operation_ref")
                if tid and op:
                    add_node(op, "operation", label=op)
                    G.add_edge(tid, op, type="invokes", confidence=0.8, evidence=si)

    # WSDL -> portType -> operation
    for w in wsdl_infos or []:
        wid = w.get("id")
        add_node(wid, "wsdl", label=w.get("name"), file=w.get("relativePath"))
        for pt in w.get("portTypes", []):
            pt_id = f"{wid}#{pt.get('name')}"
            add_node(pt_id, "portType", label=pt.get("name"))
            G.add_edge(wid, pt_id, type="exposes", confidence=1.0)
            for op in pt.get("operations", []):
                op_id = f"{pt_id}#{op.get('name')}"
                add_node(op_id, "operation", label=op.get("name"))
                G.add_edge(pt_id, op_id, type="exposes", confidence=1.0)
                # message refs
                if op.get("inputMessage"):
                    add_node(op["inputMessage"], "message", label=op["inputMessage"])
                    G.add_edge(op_id, op["inputMessage"], type="uses_message", confidence=0.9)

    # XSD -> elements/complexTypes
    for x in xsd_infos or []:
        xid = x.get("id")
        add_node(xid, "xsd", label=x.get("name"), file=x.get("relativePath"))
        for el in x.get("elements", []):
            eid = f"{xid}#{el.get('name')}"
            add_node(eid, "xsd_element", label=el.get("name"))
            G.add_edge(xid, eid, type="contains", confidence=1.0)

    # SCA composite wires
    for c in composites or []:
        cid = c.get("id")
        add_node(cid, "sca_composite", label=c.get("name"))
        for comp in c.get("components", []):
            comp_id = f"{cid}#{comp.get('name')}"
            add_node(comp_id, "sca_component", label=comp.get("name"), impl=comp.get("implementationSource"))
            G.add_edge(cid, comp_id, type="contains", confidence=1.0)
            # component -> service/reference
            for svc in comp.get("services", []):
                G.add_edge(comp_id, svc, type="exposes", confidence=0.9)
            for ref in comp.get("references", []):
                G.add_edge(comp_id, ref, type="references", confidence=0.9)
        for w in c.get("wires", []):
            src = w.get("source")
            tgt = w.get("target")
            if src and tgt:
                add_node(src, "sca_endpoint", label=src)
                add_node(tgt, "sca_endpoint", label=tgt)
                G.add_edge(src, tgt, type="wired_to", confidence=1.0, evidence=w)

    # BPEL invokes
    for b in bpel_infos or []:
        bid = b.get("id")
        add_node(bid, "bpel", label=b.get("name"))
        for inv in b.get("invokes", []):
            pl = inv.get("partnerLink")
            if pl:
                # crea nodo partnerLink
                pl_id = f"{bid}#{pl}"
                add_node(pl_id, "partnerLink", label=pl)
                G.add_edge(bid, pl_id, type="invokes", operation=inv.get("operation"), confidence=0.85)

    # XSLT lineage
    if lineage:
        for e in lineage.get("edges", []):
            src = e.get("source")
            tgt = e.get("target")
            add_node(src, "field", label=src)
            add_node(tgt, "field", label=tgt)
            G.add_edge(src, tgt, type="transforms", via=e.get("via"), confidence=e.get("confidence", 0.9))

    # WSDL-XSD imports (da resolver V0.4)
    if wsdl_xsd_graph:
        for e in wsdl_xsd_graph.get("edges", []):
            src = e.get("source")
            tgt = e.get("target")
            # ensure nodes exist
            if not G.has_node(src):
                add_node(src, "unknown", label=src)
            if not G.has_node(tgt):
                add_node(tgt, "unknown", label=tgt)
            G.add_edge(src, tgt, type=e.get("type", "imports"), status=e.get("status"), confidence=e.get("confidence", 1.0))

    return G

def graph_to_dict(G: nx.MultiDiGraph) -> Dict[str, Any]:
    nodes = [{"id": n, **G.nodes[n]} for n in G.nodes]
    edges = []
    for u, v, k, data in G.edges(keys=True, data=True):
        edges.append({"source": u, "target": v, "key": k, **data})
    return {
        "nodes": nodes,
        "edges": edges,
        "stats": {
            "nodes": G.number_of_nodes(),
            "edges": G.number_of_edges(),
            "density": nx.density(G) if G.number_of_nodes() > 1 else 0,
        }
    }
