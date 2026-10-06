"""
CLI Platform — entry point per Project Scanner + Registry (V0.3)
Uso:
  python -m soa_reverse_engineer.cli.main scan /path/to/project --output registry.json
  python -m soa_reverse_engineer.cli.main scan /path/to/project --recursive
"""
import sys
from pathlib import Path
import json
import click
from rich.console import Console
from rich.table import Table

# allow running as script without install
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ingestion.scanner import scan_project
from ingestion.registry import build_registry
from parsers.wsdl.parser import _parse_wsdl
from parsers.xsd.parser import _parse_xsd
from parsers.sca.parser import _parse_composite
from parsers.bpel.parser import _parse_bpel
from parsers.xslt.parser import _parse_xslt
from graph.lineage import build_global_lineage
from graph.graph_builder import build_global_graph, graph_to_dict
from resolution.dependency_resolver import build_wsdl_xsd_graph
from evidence.evidence_store import EvidenceStore, RelationshipEvidence
from documentation.technical import generate_technical_doc
from documentation.functional import generate_functional_doc
from documentation.explain import explain_process

console = Console()

@click.group()
def cli():
    pass

@cli.command("scan")
@click.argument("project_path", type=click.Path(exists=True, path_type=Path))
@click.option("--output", "-o", type=click.Path(path_type=Path), default=None, help="File JSON di output (registry)")
@click.option("--recursive/--no-recursive", default=True, help="Ricorsivo")
def scan(project_path: Path, output: Path | None, recursive: bool):
    console.print(f"[bold cyan]SOA Platform — Project Scanner V0.3[/]")
    console.print(f"Root: {project_path.resolve()}  recursive={recursive}")
    files = scan_project(project_path, recursive=recursive)
    console.print(f"Trovati [bold]{len(files)}[/] file")
    registry = build_registry(files, project_path)
    # table by_type
    table = Table(title="Artifacts by type")
    table.add_column("Type")
    table.add_column("Count", justify="right")
    for t, c in sorted(registry["by_type"].items(), key=lambda x: -x[1]):
        table.add_row(t, str(c))
    console.print(table)
    console.print(f"Totale: {registry['total']}  | Root: {registry['root']}")
    if output:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(registry, indent=2, ensure_ascii=False), encoding="utf-8")
        console.print(f"[green]Registry salvato:[/] {output.resolve()}")
    else:
        # preview first 10
        console.print("\n[dim]Preview (primi 10):[/]")
        for a in registry["artifacts"][:10]:
            console.print(f"  {a['id']}  {a['type']:15}  {a['relativePath']}  ({a['detected_by']})")

@cli.command("detect")
@click.argument("file_path", type=click.Path(exists=True, path_type=Path))
def detect(file_path: Path):
    from ingestion.artifact_detector import detect_artifact_type, detect_with_details
    atype, by = detect_artifact_type(file_path)
    details = detect_with_details(file_path)
    console.print(f"File: {file_path}")
    console.print(f"Type: [bold]{atype.value}[/]  detected_by: {by}")
    console.print(f"Details: {details}")

@cli.command("analyze")
@click.argument("project_path", type=click.Path(exists=True, path_type=Path))
@click.option("--output", "-o", type=click.Path(path_type=Path), default=None, help="File JSON di output (canonical + graph)")
@click.option("--recursive/--no-recursive", default=True)
def analyze(project_path: Path, output: Path | None, recursive: bool):
    console.print(f"[bold cyan]SOA Platform — Analyzer V0.7 (WSDL+XSD+SCA+BPEL+XSLT+Lineage)[/]")
    console.print(f"Root: {project_path.resolve()}")
    files = scan_project(project_path, recursive=recursive)
    registry = build_registry(files, project_path)
    console.print(f"Registry: {registry['total']} artifact(s) — {registry['by_type']}")

    # Parse all artifact types
    wsdls = []
    xsds = []
    composites = []
    bpels = []
    bpmns = []
    xslts = []
    for art in registry["artifacts"]:
        p = Path(art["path"])
        rel = art["relativePath"]
        atype = art["type"]
        try:
            content = p.read_text(encoding="utf-8", errors="ignore")
            if atype == "wsdl":
                wsdls.append(_parse_wsdl(content, p.name, rel))
            elif atype == "xsd":
                xsds.append(_parse_xsd(content, p.name, rel))
            elif atype == "sca_composite":
                composites.append(_parse_composite(content, p.name, rel))
            elif atype == "bpel":
                bpels.append(_parse_bpel(content, p.name, rel))
            elif atype == "xslt":
                xslts.append(_parse_xslt(content, p.name, rel))
            elif atype == "bpmn":
                # reuse bpmn parser from bpmn-reverse-engineer if available — ROOT = tool_documentazione_BPMN
                try:
                    import sys
                    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "bpmn-reverse-engineer" / "src"))
                    from bpmn_reverse_engineer.parser import parse_bpmn
                    from bpmn_reverse_engineer.analyzers.enrich_flows import enrich_flows
                    from bpmn_reverse_engineer.analyzers.extension_semantics import enrich_extensions
                    doc = parse_bpmn(p)
                    doc = enrich_flows(doc)
                    doc = enrich_extensions(doc)
                    bpmns.append({"id": doc.processes[0].id if doc.processes else p.stem, "name": doc.processes[0].name if doc.processes else p.stem, "fileName": p.name, "relativePath": rel, "elements": len(doc.elements), "service_implementations": len(getattr(doc, "service_implementations", []))})
                except Exception as e:
                    bpmns.append({"fileName": p.name, "relativePath": rel, "error": str(e)})
        except Exception as e:
            console.print(f"[yellow]Parse failed {rel}: {e}[/]")

    console.print(f"Parsed: [bold]{len(wsdls)}[/] WSDL, [bold]{len(xsds)}[/] XSD, [bold]{len(composites)}[/] SCA, [bold]{len(bpels)}[/] BPEL, [bold]{len(bpmns)}[/] BPMN, [bold]{len(xslts)}[/] XSLT")
    for w in wsdls:
        console.print(f"  WSDL {w['name']} — {len(w['portTypes'])} portTypes, {sum(len(pt['operations']) for pt in w['portTypes'])} ops, imports={w['imports']}")
    for x in xsds:
        console.print(f"  XSD {x['name']} — {len(x['elements'])} elements, {len(x['complexTypes'])} complexTypes, imports={x['imports']}")
    for c in composites:
        console.print(f"  SCA {c['name']} — {len(c['services'])} services, {len(c['components'])} components, {len(c['references'])} references, {len(c['wires'])} wires")
    for b in bpels:
        console.print(f"  BPEL {b['name']} — {len(b['partnerLinks'])} partnerLinks, {len(b['invokes'])} invokes, {len(b['variables'])} vars")
    for xslt in xslts:
        console.print(f"  XSLT {xslt['name']} — {len(xslt['templateMatches'])} templates, {len(xslt['forEachSelects'])} for-each, vars={len(xslt['variables'])}")

    graph = build_wsdl_xsd_graph(wsdls, xsds, project_path, registry)
    # Enrich graph with SCA wires, BPEL invokes and XSLT lineage
    for c in composites:
        for w in c.get("wires", []):
            graph["edges"].append({"source": w["source"], "target": w["target"], "type": "wires", "status": "explicit", "confidence": 1.0, "evidence": {"artifact": c["relativePath"]}})
    for b in bpels:
        for inv in b.get("invokes", []):
            graph["edges"].append({"source": b["id"], "target": inv.get("partnerLink", ""), "type": "invokes", "operation": inv.get("operation"), "status": "explicit", "confidence": 1.0, "evidence": {"artifact": b["relativePath"]}})
    # Data lineage from XSLT
    lineage = build_global_lineage(wsdls, xsds, xslts)
    for e in lineage["edges"]:
        graph["edges"].append({"source": e["source"], "target": e["target"], "type": e["type"], "via": e["via"], "status": "inferred", "confidence": e["confidence"], "evidence": e["evidence"]})

    graph["stats"]["total_edges"] = len(graph["edges"])
    graph["stats"]["lineage_edges"] = len(lineage["edges"])
    console.print(f"\n[bold]Dependency Graph:[/] {len(graph['edges'])} edges — {graph['stats']['resolved']} resolved, {graph['stats']['unresolved']} unresolved")
    if graph["unresolved"]:
        console.print("[yellow]Unresolved:[/]")
        for u in graph["unresolved"][:10]:
            console.print(f"  {u['source']} -> {u['location']} ({u['reason']})")

    # V0.8 Global Graph (eterogeneo)
    # Convert bpmns dicts to minimal docs for graph builder
    bpmn_docs_for_graph = []
    for b in bpmns:
        # b is already a dict with fileName etc, wrap as needed
        bpmn_docs_for_graph.append(b)

    G = build_global_graph(
        bpmn_docs=bpmn_docs_for_graph,
        bpel_infos=bpels,
        wsdl_infos=wsdls,
        xsd_infos=xsds,
        xslt_infos=xslts,
        composites=composites,
        lineage=lineage,
        wsdl_xsd_graph=graph,
    )
    global_graph_dict = graph_to_dict(G)
    console.print(f"[bold]Global Graph:[/] {global_graph_dict['stats']['nodes']} nodes, {global_graph_dict['stats']['edges']} edges, density {global_graph_dict['stats']['density']:.3f}")

    # V0.9 Evidence Store (esempio: tutte le edges come evidence)
    store = EvidenceStore()
    for e in graph["edges"]:
        store.add(RelationshipEvidence(
            source=e.get("source",""),
            relationship=e.get("type","unknown"),
            target=e.get("target",""),
            evidence=[e.get("evidence", {})] if e.get("evidence") else [],
            confidence=e.get("confidence", 1.0),
            resolution=e.get("status", "explicit")
        ))
    console.print(f"Evidence: {len(store.to_list())} relazioni, unresolved: {len(store.unresolved())}")

    result = {
        "root": str(project_path.resolve()),
        "registry": registry,
        "wsdls": wsdls,
        "xsds": xsds,
        "composites": composites,
        "bpels": bpels,
        "bpmns": bpmns,
        "xslts": xslts,
        "lineage": lineage,
        "graph": graph,
        "global_graph": global_graph_dict,
        "evidence": store.to_list()[:100],  # preview
        "generated_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "version": "1.0",
    }
    if output:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
        console.print(f"[green]Analisi salvata:[/] {output.resolve()}")
        # V1.1 docs preview
        tech = generate_technical_doc(result, graph)
        func = generate_functional_doc(result, graph)
        (output.parent / "technical.md").write_text(tech, encoding="utf-8")
        (output.parent / "functional.md").write_text(func, encoding="utf-8")
        console.print(f"[green]Docs:[/] {output.parent / 'technical.md'} , {output.parent / 'functional.md'}")
    else:
        console.print(f"\n[dim]Esegui con -o per salvare JSON completo[/]")

@cli.command("trace")
@click.argument("project_path", type=click.Path(exists=True, path_type=Path))
@click.option("--from", "from_node", required=True, help="Nodo sorgente (es. ActivityA)")
@click.option("--to", "to_node", default=None, help="Nodo destinazione opzionale")
@click.option("--max-depth", default=10, help="Max depth")
def trace(project_path: Path, from_node: str, to_node: str | None, max_depth: int):
    """V1.2 — reverse-engineer trace --from ActivityA [--to Database]"""
    from graph.traversal import trace_from, trace_between
    from graph.graph_builder import build_global_graph

    files = scan_project(project_path)
    registry = build_registry(files, project_path)
    # build minimal graph quickly (reuse analyze logic simplified)
    # For brevity, build from registry + parsed wsdls/xsds if needed — qui solo registry nodes + wires mock
    # In real, carichiamo analisi salvata se esiste
    console.print(f"[bold cyan]Trace da {from_node} -> {to_node or 'all'}[/]")
    # Attempt to load previous analysis if exists
    # Fallback: build simple graph from registry
    import networkx as nx
    G = nx.MultiDiGraph()
    for art in registry["artifacts"]:
        G.add_node(art["relativePath"], type=art["type"])
    # try to add some edges from registry if composite
    paths = trace_from(G, from_node, max_depth=max_depth) if not to_node else trace_between(G, from_node, to_node, cutoff=max_depth)
    if not paths:
        console.print(f"[yellow]Nessun percorso trovato da {from_node}[/]")
        # prova fuzzy
        console.print(f"Nodi disponibili (primi 20): {[n for n in list(G.nodes)[:20]]}")
    else:
        for i, p in enumerate(paths[:10], 1):
            console.print(f"Path {i}: {' -> '.join(p)}")
        console.print(f"[green]Trovati {len(paths)} percorsi[/]")

@cli.command("impact")
@click.argument("project_path", type=click.Path(exists=True, path_type=Path))
@click.argument("artifact", type=str)
def impact(project_path: Path, artifact: str):
    """V1.2 — reverse-engineer impact --artifact customer.xsd"""
    from graph.impact import impact_analysis
    import networkx as nx
    files = scan_project(project_path)
    registry = build_registry(files, project_path)
    G = nx.MultiDiGraph()
    for art in registry["artifacts"]:
        G.add_node(art["relativePath"], type=art["type"])
        G.add_node(art["id"], type=art["type"])
    # mock edges: se non abbiamo graph salvato, mostra solo registry
    impacted = impact_analysis(G, artifact)
    if not impacted:
        console.print(f"[yellow]Nessun impatto trovato per {artifact}[/]")
        console.print(f"Artifacts: {[a['relativePath'] for a in registry['artifacts'][:10]]}")
    else:
        console.print(f"[bold]Impatto di {artifact}:[/] {len(impacted)} nodi")
        for n in impacted[:20]:
            console.print(f"  -> {n}")

@cli.command("explain")
@click.argument("project_path", type=click.Path(exists=True, path_type=Path))
@click.option("--process", "process_name", default=None, help="Nome processo da spiegare")
def explain(project_path: Path, process_name: str | None):
    """V1.3 — reverse-engineer explain process.bpmn"""
    files = scan_project(project_path)
    registry = build_registry(files, project_path)
    # trova primo bpmn
    bpmn_art = next((a for a in registry["artifacts"] if a["type"] == "bpmn"), None)
    if not bpmn_art:
        console.print("[yellow]Nessun BPMN trovato[/]")
        return
    p = Path(bpmn_art["path"])
    try:
        import sys
        sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "bpmn-reverse-engineer" / "src"))
        from bpmn_reverse_engineer.parser import parse_bpmn
        doc = parse_bpmn(p)
        txt = explain_process({"name": doc.processes[0].name if doc.processes else p.stem, "fileName": p.name, "elements": [{"name": e.name, "type": e.type} for e in doc.elements[:5]]})
        console.print(f"[bold cyan]Explain {bpmn_art['relativePath']}[/]")
        console.print(txt)
        console.print("\n[dim]LLM layer non abilitato — output deterministico. Vedi documentation/explain.py per integrazione LLM.[/]")
    except Exception as e:
        console.print(f"[red]Errore explain: {e}[/]")

@cli.command("serve")
@click.argument("project_path", type=click.Path(exists=True, path_type=Path), required=False)
@click.option("--host", default="127.0.0.1")
@click.option("--port", default=8000, help="Porta API/backend (default 8000). Frontend dev usa 3000 con proxy.")
@click.option("--open-browser", is_flag=True, help="Apri browser")
def serve(project_path: Path | None, host: str, port: int, open_browser: bool):
    """Unified backend — entrypoint per npm run dev:backend / npm run serve
    Frontend:  Vite :3000 (npm run dev:frontend) fa proxy /api -> :8000
    Prod:      npm run serve → build + serve dist su :8000 (SPA + API single-port)
    Se project_path è fornito, pre-carica registry/canonical per navigazione immediata.
    Altrimenti usa drag&drop o POST /api/analyze.
    """
    import webbrowser
    preload = None
    if project_path:
        # pre-carica come fa analyze ma senza scrivere su disco
        from ingestion.scanner import scan_project
        from ingestion.registry import build_registry
        console.print(f"[dim]Pre-caricamento progetto:[/] {project_path.resolve()}")
        files = scan_project(project_path)
        registry = build_registry(files, project_path)
        console.print(f"[green]Pre-caricato {registry['total']} artifact(s)[/]")
        # costruisci anche graph leggero per trace/impact immediati
        try:
            from parsers.wsdl.parser import _parse_wsdl
            from parsers.xsd.parser import _parse_xsd
            from parsers.sca.parser import _parse_composite
            from parsers.bpel.parser import _parse_bpel
            from parsers.xslt.parser import _parse_xslt
            from graph.lineage import build_global_lineage
            from graph.graph_builder import build_global_graph, graph_to_dict
            from resolution.dependency_resolver import build_wsdl_xsd_graph
            wsdls, xsds, composites, bpels, xslts = [], [], [], [], []
            for art in registry["artifacts"]:
                p = Path(art["path"])
                rel = art["relativePath"]
                try:
                    c = p.read_text(encoding="utf-8", errors="ignore")
                    if art["type"] == "wsdl":
                        wsdls.append(_parse_wsdl(c, p.name, rel))
                    elif art["type"] == "xsd":
                        xsds.append(_parse_xsd(c, p.name, rel))
                    elif art["type"] == "sca_composite":
                        composites.append(_parse_composite(c, p.name, rel))
                    elif art["type"] == "bpel":
                        bpels.append(_parse_bpel(c, p.name, rel))
                    elif art["type"] == "xslt":
                        xslts.append(_parse_xslt(c, p.name, rel))
                except Exception:
                    pass
            graph = build_wsdl_xsd_graph(wsdls, xsds, project_path, registry)
            lineage = build_global_lineage(wsdls, xsds, xslts)
            G = build_global_graph(wsdl_infos=wsdls, xsd_infos=xsds, composites=composites, bpel_infos=bpels, xslt_infos=xslts, lineage=lineage, wsdl_xsd_graph=graph)
            # docs
            from documentation.technical import generate_technical_doc
            from documentation.functional import generate_functional_doc
            canonical = {"registry": registry, "wsdls": wsdls, "xsds": xsds, "composites": composites, "bpels": bpels, "xslts": xslts, "lineage": lineage, "graph": graph, "global_graph": graph_to_dict(G)}
            canonical["_technical_md"] = generate_technical_doc(canonical, graph)
            canonical["_functional_md"] = generate_functional_doc(canonical, graph)
            preload = canonical
            preload["graph_obj"] = G
            preload["registry"] = registry
        except Exception as e:
            console.print(f"[yellow]Pre-caricamento parziale: {e}[/]")

    # unified server
    try:
        from web.server import run_server
    except ImportError:
        from soa_reverse_engineer.web.server import run_server  # type: ignore

    url = f"http://{host}:{port}"
    console.print(f"[bold cyan]SOA Platform — singola porta locale[/] [green]{url}[/]  project={project_path or 'drag&drop'}")
    if open_browser:
        try:
            webbrowser.open(url)
        except Exception:
            pass
    run_server(host, port, preload=preload)

def main():
    cli()

if __name__ == "__main__":
    main()
