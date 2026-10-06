"""
V0.4 — WSDL ↔ XSD Dependency Resolver
Costruisce closure import/include e verifica se i path sono risolvibili su filesystem.

Come da §4-5: Livello 1 exact (location), Livello 2 namespace, Livello 3 artifact relationship.
Per V0.4 solo Liv.1 exact su filesystem (relativePath).
"""
from pathlib import Path
from typing import Dict, List, Any, Tuple

def _resolve_location(base_file: Path, location: str, root: Path, all_files_by_name: Dict[str, Path]) -> Tuple[str, str, float]:
    """
    Tenta di risolvere location (es. "Schemas/OrderSchema.xsd" o "../WSDLs/OrderService.wsdl")
    Ritorna (status, resolved_path, confidence)
    status: explicit|resolved|unresolved|ambiguous
    """
    # Prova relativo al file base
    base_dir = base_file.parent
    candidates = [
        (base_dir / location).resolve(),
        (root / location).resolve(),
        Path(location).resolve(),
    ]
    # anche solo filename
    fname = Path(location).name
    if fname in all_files_by_name:
        candidates.append(all_files_by_name[fname].resolve())

    for c in candidates:
        if c.exists() and c.is_file():
            try:
                rel = str(c.relative_to(root)).replace("\\", "/")
            except ValueError:
                rel = str(c)
            return "resolved", rel, 1.0

    # ambiguous se più file con stesso nome
    matches = [p for n, p in all_files_by_name.items() if n == fname]
    if len(matches) > 1:
        return "ambiguous", location, 0.5
    return "unresolved", location, 0.0

def build_wsdl_xsd_graph(wsdls: List[Dict[str, Any]], xsds: List[Dict[str, Any]], root: Path, registry: Dict[str, Any]) -> Dict[str, Any]:
    """
    Costruisce grafo dipendenze WSDL->XSD e XSD->XSD.
    Ritorna {"nodes": [...], "edges": [...], "unresolved": [...], "stats": {...}}
    """
    # index by filename
    all_files = {}
    for art in registry.get("artifacts", []):
        p = Path(art["path"])
        all_files[p.name] = p
        # anche relativePath basename
        all_files[Path(art["relativePath"]).name] = p

    nodes = []
    edges = []
    unresolved = []

    # Nodi
    for w in wsdls:
        nodes.append({"id": w["id"], "type": "wsdl", "name": w["name"], "path": w["relativePath"]})
    for x in xsds:
        nodes.append({"id": x["id"], "type": "xsd", "name": x["name"], "path": x["relativePath"]})

    # Map path -> id
    path_to_id = {n["path"]: n["id"] for n in nodes}

    # WSDL imports -> XSD/WSDL
    for w in wsdls:
        base = Path(registry["root"]) / w["relativePath"]
        # WSDL può importare sia WSDL che XSD via <import> e via <types><schema>
        for loc in w.get("imports", []):
            status, resolved, conf = _resolve_location(base, loc, Path(registry["root"]), all_files)
            target_id = path_to_id.get(resolved) or path_to_id.get(Path(loc).name) or resolved
            # cerca id se resolved è relativo
            if isinstance(target_id, str) and "/" in target_id:
                # try find by relative
                for n in nodes:
                    if n["path"] == resolved or n["path"].endswith("/" + Path(resolved).name):
                        target_id = n["id"]
                        break
            edges.append({
                "source": w["id"],
                "target": target_id,
                "type": "imports",
                "location": loc,
                "resolved": resolved,
                "status": status,
                "confidence": conf,
                "evidence": {"artifact": w["relativePath"], "location": loc}
            })
            if status == "unresolved":
                unresolved.append({"source": w["id"], "location": loc, "reason": "WSDL import not found on filesystem"})

    # XSD imports/includes -> XSD
    for x in xsds:
        base = Path(registry["root"]) / x["relativePath"]
        for loc in x.get("imports", []) + x.get("includes", []):
            status, resolved, conf = _resolve_location(base, loc, Path(registry["root"]), all_files)
            target_id = path_to_id.get(resolved) or resolved
            if isinstance(target_id, str) and "/" in target_id:
                for n in nodes:
                    if n["path"] == resolved or n["path"].endswith("/" + Path(resolved).name):
                        target_id = n["id"]
                        break
            edge_type = "imports" if loc in x.get("imports", []) else "includes"
            edges.append({
                "source": x["id"],
                "target": target_id,
                "type": edge_type,
                "location": loc,
                "resolved": resolved,
                "status": status,
                "confidence": conf,
                "evidence": {"artifact": x["relativePath"], "location": loc}
            })
            if status == "unresolved":
                unresolved.append({"source": x["id"], "location": loc, "reason": f"XSD {edge_type} not found"})

    stats = {
        "wsdl_count": len(wsdls),
        "xsd_count": len(xsds),
        "edges": len(edges),
        "resolved": sum(1 for e in edges if e["status"] == "resolved"),
        "unresolved": len(unresolved),
        "ambiguous": sum(1 for e in edges if e["status"] == "ambiguous"),
    }

    return {"nodes": nodes, "edges": edges, "unresolved": unresolved, "stats": stats}
