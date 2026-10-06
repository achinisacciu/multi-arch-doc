"""CLI with Rich output — supports single file & folder batch, plus web frontend."""

from __future__ import annotations

import sys
import json
import webbrowser
from pathlib import Path

import click
from rich.console import Console
from rich.table import Table

from . import __version__
from .analyzers import compute_metrics, compute_paths, compute_warnings
from .analyzers.enrich_flows import enrich_flows
from .analyzers.extension_semantics import enrich_extensions
from .exporters import export_graph_json, export_graphml, export_json, export_markdown
from .graph import build_graph
from .parser import parse_bpmn

console = Console()


@click.group()
def cli():
    pass


def _collect_input_files(input_path: Path, recursive: bool, pattern: str) -> list[Path]:
    """Return list of BPMN files for a given input_path (file or directory)."""
    if input_path.is_file():
        return [input_path]
    if input_path.is_dir():
        if recursive:
            files = sorted(input_path.rglob(pattern))
        else:
            files = sorted(input_path.glob(pattern))
        files = [p for p in files if p.is_file()]
        return sorted(files)
    return []


def _process_single_file(
    bpmn_path: Path,
    out_dir: Path,
    do_json: bool,
    do_md: bool,
    do_graph: bool,
    path_limit: int,
    anonymize: bool,
    both_mode: bool,
    verbose: bool,
) -> dict:
    """Process one BPMN file. Returns dict with doc, graph, outputs. (legacy flat, kept for tests)"""
    doc = parse_bpmn(bpmn_path)
    doc = enrich_flows(doc)
    doc = enrich_extensions(doc)
    graph = build_graph(doc)
    doc.metrics = compute_metrics(doc)
    doc.structural_warnings = compute_warnings(doc, graph)
    doc.paths = compute_paths(graph, limit=path_limit)

    modes: list[tuple[str, bool]] = []
    if both_mode:
        modes.append(("normal", False))
        modes.append(("anonymized", True))
    elif anonymize:
        modes.append(("anonymized", True))
    else:
        modes.append(("normal", False))

    out_dir.mkdir(parents=True, exist_ok=True)
    outputs: list[str] = []

    for mode_name, do_anonymize in modes:
        suffix = "_anonymized" if do_anonymize else ""
        if do_json:
            p = out_dir / f"bpmn_analysis{suffix}.json"
            export_json(doc, p, anonymize=do_anonymize)
            outputs.append(str(p))
        if do_md:
            p = out_dir / f"bpmn_analysis{suffix}.md"
            export_markdown(doc, p, anonymize=do_anonymize)
            outputs.append(str(p))
        if do_graph:
            p1 = out_dir / f"bpmn_graph{suffix}.json"
            export_graph_json(graph, p1, anonymize=do_anonymize)
            outputs.append(str(p1))
            p2 = out_dir / f"bpmn_graph{suffix}.graphml"
            try:
                export_graphml(graph, p2, anonymize=do_anonymize)
                outputs.append(str(p2))
            except Exception as e:
                console.print(f"[yellow]GraphML export skipped for {bpmn_path.name}: {e}[/]")

    return {"doc": doc, "graph": graph, "outputs": outputs}


@cli.command("analyze")
@click.argument("input_path", type=click.Path(exists=True, dir_okay=True, file_okay=True, path_type=Path))
@click.option("--output", "-o", default="./analysis", help="Output directory")
@click.option("--json/--no-json", "do_json", default=True, help="Export JSON")
@click.option("--markdown/--no-markdown", "do_md", default=True, help="Export Markdown")
@click.option("--graph/--no-graph", "do_graph", default=True, help="Export graph (JSON+GraphML)")
@click.option("--verbose", "-v", is_flag=True, help="Verbose output")
@click.option("--path-limit", default=100, help="Max paths to enumerate")
@click.option("--anonymize", is_flag=True, help="Wrap all extracted XML values in `` for external anonymizer (produces anonymizable files)")
@click.option("--both", "both_mode", is_flag=True, help="Generate both normal and anonymized files (anonymized with suffix _anonymized)")
@click.option("--recursive", "-r", is_flag=True, help="Search recursively when input is a folder")
@click.option("--pattern", default="*.bpmn", help="Glob pattern for folder input (es. *.bpmn)")
def analyze(input_path: Path, output, do_json, do_md, do_graph, verbose, path_limit, anonymize, both_mode, recursive, pattern):
    input_path = Path(input_path)
    out_dir_base = Path(output)

    bpmn_files = _collect_input_files(input_path, recursive, pattern)

    if not bpmn_files:
        console.print(f"[bold red]Nessun file trovato:[/] {input_path} (pattern: {pattern}, recursive: {recursive})")
        sys.exit(1)

    # Single file compatibility: keep original flat output
    is_single_file = input_path.is_file() and len(bpmn_files) == 1

    if not is_single_file:
        console.print(f"[bold cyan]BPMN Reverse Engineer — Batch mode[/]")
        console.print(f"Trovati [bold]{len(bpmn_files)}[/] file in: {input_path}  (pattern: {pattern}, recursive: {recursive})")
        console.print(f"Output base: {out_dir_base.resolve()}")
        console.print("-" * 50)
    else:
        console.print("[bold cyan]BPMN Reverse Engineer[/]")
        console.print("-" * 36)
        console.print(f"[dim]File:[/] {input_path}")

    if verbose and not is_single_file:
        for f in bpmn_files:
            console.print(f"  - {f}")

    success = 0
    failed = 0
    batch_results: list[dict] = []

    # Sempre due cartelle: analisi e analisi anonimi (anche per singolo file, come confermato)
    base_normal = out_dir_base / "analisi"
    base_anon = out_dir_base / "analisi anonimi"
    base_normal.mkdir(parents=True, exist_ok=True)
    base_anon.mkdir(parents=True, exist_ok=True)
    console.print(f"[dim]Output analisi:[/] {base_normal.resolve()}")
    console.print(f"[dim]Output anonimi:[/] {base_anon.resolve()}")

    for bpmn_path in bpmn_files:
        # Determina cartelle di output: singolo file -> base diretta, batch -> sotto-cartella per file preservando path relativo
        if is_single_file:
            cur_out_normal = base_normal
            cur_out_anon = base_anon
            console.print(f"\n[dim]Elaborazione:[/] {bpmn_path.name} -> {cur_out_normal} | {cur_out_anon}")
        else:
            console.print(f"\n[dim]Elaborazione:[/] {bpmn_path.name}")
            try:
                rel_no_suffix = bpmn_path.relative_to(input_path).with_suffix("") if input_path.is_dir() else Path(bpmn_path.stem)
            except Exception:
                rel_no_suffix = Path(bpmn_path.stem)
            cur_out_normal = base_normal / rel_no_suffix
            cur_out_anon = base_anon / rel_no_suffix
            console.print(f"  -> {cur_out_normal} | {cur_out_anon}")
        # Determina quali cartelle generare: default = entrambe (confermato anche per singolo file)
        # --both => entrambe, --anonymize => solo anonimi, altrimenti entrambe
        if both_mode:
            gen_normal, gen_anon = True, True
        elif anonymize:
            gen_normal, gen_anon = False, True
        else:
            gen_normal, gen_anon = True, True

        if gen_normal:
            cur_out_normal.mkdir(parents=True, exist_ok=True)
        if gen_anon:
            cur_out_anon.mkdir(parents=True, exist_ok=True)

        try:
            doc = parse_bpmn(bpmn_path)
            doc = enrich_flows(doc)
            doc = enrich_extensions(doc)
            graph = build_graph(doc)
            doc.metrics = compute_metrics(doc)
            doc.structural_warnings = compute_warnings(doc, graph)
            doc.paths = compute_paths(graph, limit=path_limit)

            outputs: list[str] = []
            # Normali in "analisi"
            if gen_normal:
                if do_json:
                    p = cur_out_normal / "bpmn_analysis.json"
                    export_json(doc, p, anonymize=False)
                    outputs.append(str(p))
                if do_md:
                    p = cur_out_normal / "bpmn_analysis.md"
                    export_markdown(doc, p, anonymize=False)
                    outputs.append(str(p))
                if do_graph:
                    p1 = cur_out_normal / "bpmn_graph.json"
                    export_graph_json(graph, p1, anonymize=False)
                    outputs.append(str(p1))
                    p2 = cur_out_normal / "bpmn_graph.graphml"
                    try:
                        export_graphml(graph, p2, anonymize=False)
                        outputs.append(str(p2))
                    except Exception as e:
                        console.print(f"[yellow]GraphML export skipped for {bpmn_path.name}: {e}[/]")
            # Anonimi in "analisi anonimi"
            if gen_anon:
                if do_json:
                    p = cur_out_anon / "bpmn_analysis.json"
                    export_json(doc, p, anonymize=True)
                    outputs.append(str(p))
                if do_md:
                    p = cur_out_anon / "bpmn_analysis.md"
                    export_markdown(doc, p, anonymize=True)
                    outputs.append(str(p))
                if do_graph:
                    p1 = cur_out_anon / "bpmn_graph.json"
                    export_graph_json(graph, p1, anonymize=True)
                    outputs.append(str(p1))
                    p2 = cur_out_anon / "bpmn_graph.graphml"
                    try:
                        export_graphml(graph, p2, anonymize=True)
                        outputs.append(str(p2))
                    except Exception:
                        pass

            success += 1
            batch_results.append({"file": str(bpmn_path), "status": "ok", "outputs": outputs, "doc": doc})

            if is_single_file or verbose:
                m = doc.metrics
                table = Table(show_header=False, box=None, padding=(0, 2))
                table.add_row("Processes:", str(m.num_processes))
                table.add_row("Activities:", str(m.num_activities))
                table.add_row("Service Tasks:", str(m.num_service_tasks))
                table.add_row("User Tasks:", str(m.num_user_tasks))
                table.add_row("Gateways:", str(m.num_gateways))
                table.add_row("Events:", str(m.num_events))
                table.add_row("Sequence Flows:", str(m.num_sequence_flows))
                table.add_row("Message Flows:", str(m.num_message_flows))
                table.add_row("Lanes:", str(m.num_lanes))
                table.add_row("References:", str(m.num_explicit_references))
                table.add_row("Extensions:", str(m.num_extension_elements))
                if hasattr(m, "num_service_implementations") and m.num_service_implementations:
                    table.add_row("Service Impl.:", str(m.num_service_implementations))
                console.print(table)
                console.print(f"\n[dim]Execution paths:[/] {len(doc.paths)}")
                unreachable = sum(1 for w in doc.structural_warnings if w.code == "unreachable_node")
                broken = sum(1 for w in doc.structural_warnings if w.code in {"broken_flow_target", "broken_flow_source"})
                console.print("\n[bold]Warnings:[/]")
                console.print(f"  [yellow]![/] {unreachable} unreachable node(s)")
                console.print(f"  [yellow]![/] {broken} broken reference(s)")
                console.print(f"  [yellow]![/] {len([w for w in doc.structural_warnings if 'orphan' in w.code or 'without_' in w.code])} orphan flow(s)")
                if verbose and doc.structural_warnings:
                    console.print("\n[dim]Details:[/]")
                    for w in doc.structural_warnings:
                        console.print(f"  - {w.code}: {w.message}")
                console.print("\n[bold]Output:[/]")
                for o in outputs:
                    console.print(f"  [green]{o}[/]")
            else:
                m = doc.metrics
                console.print(f"  [green]OK[/] P:{m.num_processes} A:{m.num_activities} G:{m.num_gateways} Paths:{len(doc.paths)} Warn:{len(doc.structural_warnings)}")

        except Exception as e:
            failed += 1
            batch_results.append({"file": str(bpmn_path), "status": "error", "error": str(e)})
            console.print(f"[bold red]Errore su {bpmn_path.name}: {e}[/]")
            if verbose:
                import traceback
                console.print(traceback.format_exc())
            continue

    # Riepilogo
    if is_single_file:
        console.print("\n" + "=" * 50)
        console.print(f"[bold]Completato:[/] {success} OK, {failed} errori")
        console.print(f"[dim]Output:[/] {base_normal.resolve()} | {base_anon.resolve()}")
        if failed > 0:
            sys.exit(1)
    else:
        console.print("\n" + "=" * 50)
        console.print(f"[bold]Batch completato:[/] {success} OK, {failed} errori su {len(bpmn_files)} file")
        console.print(f"[dim]Output base:[/] {out_dir_base.resolve()}")
        # Write index summary for batch
        try:
            out_dir_base.mkdir(parents=True, exist_ok=True)
            summary = {
                "tool_version": __version__,
                "input": str(input_path),
                "pattern": pattern,
                "recursive": recursive,
                "total_files": len(bpmn_files),
                "success": success,
                "failed": failed,
                "files": [],
            }
            for r in batch_results:
                entry = {"file": r["file"], "status": r["status"]}
                if r["status"] == "ok":
                    doc = r["doc"]
                    m = doc.metrics
                    entry.update({
                        "outputs": r["outputs"],
                        "metrics": m.model_dump(),
                        "warnings": [w.model_dump() for w in doc.structural_warnings],
                        "paths_count": len(doc.paths),
                    })
                else:
                    entry["error"] = r.get("error")
                summary["files"].append(entry)
            # Write index.json
            with open(out_dir_base / "batch_index.json", "w", encoding="utf-8") as f:
                json.dump(summary, f, indent=2, ensure_ascii=False)
            # Write batch_summary.md
            md_lines = [f"# Batch Summary — BPMN Reverse Engineer", "", f"Input: `{input_path}`  | Pattern: `{pattern}` | Recursive: {recursive}", "", f"**Totale:** {len(bpmn_files)} | **OK:** {success} | **Errori:** {failed}", "", "| File | Status | Processes | Activities | Gateways | Paths | Warnings | Output |", "|---|---|---:|---:|---:|---:|---:|---|"]
            for entry in summary["files"]:
                fname = Path(entry["file"]).name
                status = entry["status"]
                if status == "ok":
                    m = entry["metrics"]
                    md_lines.append(f"| {fname} | {status} | {m['num_processes']} | {m['num_activities']} | {m['num_gateways']} | {entry['paths_count']} | {len(entry['warnings'])} | `{Path(entry['outputs'][0]).parent.name if entry['outputs'] else ''}` |")
                else:
                    md_lines.append(f"| {fname} | {status} | — | — | — | — | — | {entry.get('error','')} |")
            md_lines.append("")
            Path(out_dir_base / "batch_summary.md").write_text("\n".join(md_lines), encoding="utf-8")
            console.print(f"[dim]Riepilogo batch:[/] {out_dir_base / 'batch_index.json'}")
            console.print(f"[dim]Riepilogo Markdown:[/] {out_dir_base / 'batch_summary.md'}")
        except Exception as e:
            console.print(f"[yellow]Impossibile scrivere riepilogo batch: {e}[/]")

        if failed > 0:
            sys.exit(1 if success == 0 else 0)


@cli.command("serve")
@click.option("--host", default="127.0.0.1", help="Host to bind")
@click.option("--port", default=8000, help="Port to bind")
@click.option("--open-browser", "open_browser_flag", is_flag=True, help="Apri automaticamente il browser")
def serve(host, port, open_browser_flag):
    """Avvia il mini frontend web locale (usa http.server stdlib, nessuna dipendenza extra)."""
    try:
        from .web.server import run_server
    except ImportError as e:
        console.print(f"[bold red]Errore caricamento web server: {e}[/]")
        sys.exit(1)

    url = f"http://{host}:{port}"
    console.print(f"[bold cyan]BPMN Reverse Engineer — Web Frontend[/]")
    console.print(f"In ascolto su [bold green]{url}[/]")
    console.print(f"Apri il browser e trascina i file .bpmn (o una cartella con più file).")
    console.print("Premi Ctrl+C per terminare.")
    if open_browser_flag:
        try:
            webbrowser.open(url)
        except Exception:
            pass
    try:
        run_server(host=host, port=port)
    except KeyboardInterrupt:
        console.print("\n[dim]Server fermato.[/]")
    except OSError as e:
        console.print(f"[bold red]Impossibile avviare il server su {host}:{port}: {e}[/]")
        sys.exit(1)


def main():
    cli()


if __name__ == "__main__":
    main()
