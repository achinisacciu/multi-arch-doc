"""
Unified Platform Web Server — UNICO entrypoint backend
=====================================================
Single entry:  npm run dev            → Vite :3000 (proxy /api) + questo server :8000
               npm run serve          → build + serve dist su :8000 (prod single-port)

Serve:
  - dist/ (Vite build) come SPA su /
  - API unified: /api/health, /api/scan, /api/analyze (dual mode files[]|project_path),
                 /api/registry, /api/graph, /api/lineage, /api/trace, /api/impact, /api/canonical, /api/download

Nota: bpmn-reverse-engineer/web/server.py è LEGACY — non usare direttamente.
      Usa sempre soa-reverse-engineer/web/server.py via `npm run dev:backend` o `python soa-reverse-engineer/cli/main.py serve`.
"""
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import sys
import tempfile
import uuid
import zipfile
from urllib.parse import urlparse, parse_qs, unquote

# Dist frontend — ROOT = tool_documentazione_BPMN (parents[2] from web/server.py)
ROOT = Path(__file__).resolve().parents[2]
DIST = ROOT / "dist"

# Import per BPMN (riusa bpmn-reverse-engineer)
BPMN_SRC = ROOT / "bpmn-reverse-engineer" / "src"
if str(BPMN_SRC) not in sys.path:
    sys.path.insert(0, str(BPMN_SRC))

# JOBS store unificato: job_id -> {work_dir, canonical, graph, zip_path, etc.}
JOBS: dict[str, dict] = {}
# Preload per serve con project_path
PRELOAD: dict | None = None

class Handler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        sys.stderr.write(f"{self.client_address[0]} - - [{self.log_date_time_string()}] {format%args}\n")

    def _set_headers(self, status=200, content_type="application/json", extra=None):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        if extra:
            for k, v in extra.items():
                self.send_header(k, v)
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(204)
        self.wfile.write(b"")

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)
        job_id = qs.get("job", [None])[0] or qs.get("job_id", [None])[0]

        # Health
        if path in ("/api/health", "/api/version"):
            self._set_headers(200)
            self.wfile.write(json.dumps({"status": "ok", "platform": "soa-reverse-engineer", "version": "1.0", "single_port": True, "mode": "local"}).encode())
            return

        # Registry
        if path == "/api/registry":
            jid = job_id or (list(JOBS.keys())[-1] if JOBS else None)
            if jid and jid in JOBS and "canonical" in JOBS[jid]:
                self._set_headers(200)
                self.wfile.write(json.dumps(JOBS[jid]["canonical"].get("registry", {})).encode())
                return
            if PRELOAD and "registry" in PRELOAD:
                self._set_headers(200)
                self.wfile.write(json.dumps(PRELOAD["registry"]).encode())
                return
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "no job, esegui POST /api/scan o /api/analyze prima"}).encode())
            return

        # Graph
        if path == "/api/graph":
            jid = job_id or (list(JOBS.keys())[-1] if JOBS else None)
            data = None
            if jid and jid in JOBS:
                # prefer global_graph, fallback graph
                canon = JOBS[jid].get("canonical", {})
                data = canon.get("global_graph") or canon.get("graph")
            elif PRELOAD and "global_graph" in PRELOAD:
                data = PRELOAD["global_graph"]
            if data:
                self._set_headers(200)
                self.wfile.write(json.dumps(data).encode())
                return
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "no graph"}).encode())
            return

        # Lineage
        if path == "/api/lineage":
            jid = job_id or (list(JOBS.keys())[-1] if JOBS else None)
            data = None
            if jid and jid in JOBS:
                data = JOBS[jid].get("canonical", {}).get("lineage")
            elif PRELOAD and "lineage" in PRELOAD:
                data = PRELOAD["lineage"]
            if data:
                self._set_headers(200)
                self.wfile.write(json.dumps(data).encode())
                return
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "no lineage"}).encode())
            return

        # Trace
        if path == "/api/trace":
            from_node = qs.get("from", [None])[0] or qs.get("source", [None])[0]
            to_node = qs.get("to", [None])[0]
            max_depth = int(qs.get("maxDepth", [qs.get("max_depth", ["10"])[0]])[0])
            if not from_node:
                self._set_headers(400)
                self.wfile.write(json.dumps({"error": "missing ?from="}).encode())
                return
            jid = job_id or (list(JOBS.keys())[-1] if JOBS else None)
            G = None
            if jid and jid in JOBS and "graph_obj" in JOBS[jid]:
                G = JOBS[jid]["graph_obj"]
            elif PRELOAD and "graph_obj" in PRELOAD:
                G = PRELOAD["graph_obj"]
            if G is None:
                self._set_headers(404)
                self.wfile.write(json.dumps({"error": "no graph loaded, run analyze first"}).encode())
                return
            from graph.traversal import trace_from, trace_between
            paths = trace_between(G, from_node, to_node, cutoff=max_depth) if to_node else trace_from(G, from_node, max_depth=max_depth)
            self._set_headers(200)
            self.wfile.write(json.dumps({"from": from_node, "to": to_node, "paths": paths[:20], "total": len(paths)}).encode())
            return

        # Impact
        if path == "/api/impact":
            artifact = qs.get("artifact", [None])[0] or qs.get("id", [None])[0]
            if not artifact:
                self._set_headers(400)
                self.wfile.write(json.dumps({"error": "missing ?artifact="}).encode())
                return
            jid = job_id or (list(JOBS.keys())[-1] if JOBS else None)
            G = None
            if jid and jid in JOBS and "graph_obj" in JOBS[jid]:
                G = JOBS[jid]["graph_obj"]
            elif PRELOAD and "graph_obj" in PRELOAD:
                G = PRELOAD["graph_obj"]
            if G is None:
                self._set_headers(404)
                self.wfile.write(json.dumps({"error": "no graph"}).encode())
                return
            from graph.impact import impact_analysis
            impacted = impact_analysis(G, artifact)
            self._set_headers(200)
            self.wfile.write(json.dumps({"artifact": artifact, "impacted": impacted[:50], "total": len(impacted)}).encode())
            return

        # Evidence
        if path == "/api/evidence":
            jid = job_id or (list(JOBS.keys())[-1] if JOBS else None)
            data = None
            if jid and jid in JOBS:
                data = JOBS[jid].get("canonical", {}).get("evidence")
            elif PRELOAD and "evidence" in PRELOAD:
                data = PRELOAD["evidence"]
            if data is not None:
                self._set_headers(200)
                self.wfile.write(json.dumps(data if isinstance(data, list) else data).encode())
                return
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "no evidence"}).encode())
            return

        # Canonical
        if path == "/api/canonical":
            jid = job_id or (list(JOBS.keys())[-1] if JOBS else None)
            if jid and jid in JOBS:
                self._set_headers(200)
                self.wfile.write(json.dumps(JOBS[jid].get("canonical", {})).encode())
                return
            if PRELOAD:
                self._set_headers(200)
                self.wfile.write(json.dumps(PRELOAD).encode())
                return
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "no canonical"}).encode())
            return

        # Docs
        if path == "/api/docs/technical":
            jid = job_id or (list(JOBS.keys())[-1] if JOBS else None)
            txt = ""
            if jid and jid in JOBS:
                txt = JOBS[jid].get("canonical", {}).get("_technical_md", "")
            if not txt and PRELOAD:
                txt = PRELOAD.get("_technical_md", "")
            self._set_headers(200, "text/markdown; charset=utf-8")
            self.wfile.write(txt.encode())
            return
        if path == "/api/docs/functional":
            jid = job_id or (list(JOBS.keys())[-1] if JOBS else None)
            txt = ""
            if jid and jid in JOBS:
                txt = JOBS[jid].get("canonical", {}).get("_functional_md", "")
            if not txt and PRELOAD:
                txt = PRELOAD.get("_functional_md", "")
            self._set_headers(200, "text/markdown; charset=utf-8")
            self.wfile.write(txt.encode())
            return

        # Download
        if path.startswith("/api/download/"):
            jid = unquote(path.split("/api/download/")[-1].split("?")[0].split("/")[0])
            job = JOBS.get(jid)
            if not job or "zip_path" not in job:
                self._set_headers(404)
                self.wfile.write(json.dumps({"error": "job not found"}).encode())
                return
            zpath = Path(job["zip_path"])
            if not zpath.exists():
                self._set_headers(404)
                self.wfile.write(json.dumps({"error": "zip not found"}).encode())
                return
            data = zpath.read_bytes()
            self._set_headers(200, "application/zip", extra={"Content-Disposition": f'attachment; filename="soa_results_{jid[:8]}.zip"', "Content-Length": str(len(data))})
            self.wfile.write(data)
            return

        # Frontend dist
        if DIST.exists():
            target = DIST / path.lstrip("/")
            if path in ("/", "", "/index.html"):
                target = DIST / "index.html"
            if target.is_file():
                self.path = f"/{target.relative_to(DIST).as_posix()}"
                return super().do_GET()
            if not target.exists():
                # SPA fallback
                self.path = "/index.html"
                return super().do_GET()
        # fallback semplice
        if path in ("/", "/index.html"):
            self._set_headers(200, "text/html; charset=utf-8")
            self.wfile.write(b"<html><body><h1>SOA Platform</h1><p>Run <code>python soa-reverse-engineer/cli/main.py serve C:\\path</code> e apri http://127.0.0.1:8000</p></body></html>")
            return
        return super().do_GET()

    def do_POST(self):
        # CORS preflight handled in do_OPTIONS
        if self.path == "/api/scan":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length) if length else b"{}"
            try:
                data = json.loads(body.decode() or "{}")
            except Exception:
                data = {}
            project_path = data.get("project_path") or data.get("path") or data.get("root")
            if not project_path:
                self._set_headers(400)
                self.wfile.write(json.dumps({"error": "missing project_path"}).encode())
                return
            from ingestion.scanner import scan_project
            from ingestion.registry import build_registry
            p = Path(project_path)
            files = scan_project(p)
            registry = build_registry(files, p)
            # salva come job temporaneo per successive GET
            jid = str(uuid.uuid4())
            JOBS[jid] = {"registry": registry, "canonical": {"registry": registry}}
            self._set_headers(200)
            self.wfile.write(json.dumps({"job_id": jid, "registry": registry}).encode())
            return

        if self.path == "/api/analyze":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length) if length else b"{}"
            try:
                data = json.loads(body.decode() or "{}")
            except Exception as e:
                self._set_headers(400)
                self.wfile.write(json.dumps({"error": f"invalid json {e}"}).encode())
                return

            # Distingue payload BPMN (files[]) vs Platform (project_path)
            if "files" in data and isinstance(data["files"], list):
                # --- BPMN mode: files=[{name,content}] ---
                return self._handle_bpmn_analyze(data)
            elif "project_path" in data or "path" in data:
                # --- Platform mode: project_path ---
                ppath = data.get("project_path") or data.get("path")
                return self._handle_platform_analyze(ppath, data.get("options", {}))
            else:
                # tenta entrambi: se ha project_path implicito
                self._set_headers(400)
                self.wfile.write(json.dumps({"error": "missing files[] or project_path"}).encode())
                return

        self.send_error(404, "Not found")

    def _handle_bpmn_analyze(self, data):
        """Unified ingest: riceve files[] dal frontend (drag&drop) e costruisce Registry+Graph+Canonical.
        Supporta sia BPMN puro che full SOA (wsdl,xsd,composite,jca,etc) — genera sia bundle BPMN che canonical platform."""
        options = data.get("options", {})
        files = data.get("files", [])
        if not files:
            self._set_headers(400)
            self.wfile.write(json.dumps({"error": "nessun file inviato"}).encode())
            return
        # Se è un full SOA ingest (contiene non-bpmn), costruisci anche registry platform
        # altrimenti fallback a solo BPMN
        import tempfile
        from pathlib import Path as P
        # lazy import per evitare ciclo — ROOT già definito sopra
        sys.path.insert(0, str(ROOT / "bpmn-reverse-engineer" / "src"))
        try:
            from bpmn_reverse_engineer.parser import parse_bpmn
            from bpmn_reverse_engineer.analyzers.enrich_flows import enrich_flows
            from bpmn_reverse_engineer.analyzers.extension_semantics import enrich_extensions
            from bpmn_reverse_engineer.graph import build_graph
            from bpmn_reverse_engineer.analyzers import compute_metrics, compute_paths, compute_warnings
            from bpmn_reverse_engineer.exporters import export_json, export_markdown, export_graph_json, export_graphml
        except Exception as e:
            self._set_headers(500)
            self.wfile.write(json.dumps({"error": f"import bpmn failed {e}"}).encode())
            return

        do_json = options.get("do_json", True)
        do_md = options.get("do_md", True)
        do_graph = options.get("do_graph", True)
        path_limit = int(options.get("path_limit", 100))

        jid = str(uuid.uuid4())
        work_dir = P(tempfile.mkdtemp(prefix=f"bpmn_web_{jid[:8]}_"))
        input_dir = work_dir / "input"
        output_dir = work_dir / "output"
        input_dir.mkdir(parents=True, exist_ok=True)
        output_dir.mkdir(parents=True, exist_ok=True)

        for f in files:
            name = f.get("name", f"file_{uuid.uuid4().hex[:6]}.bpmn")
            safe_parts = [p for p in P(name).parts if p not in ("/", "\\", "..")]
            rel = P(*safe_parts) if safe_parts else P(f"file_{uuid.uuid4().hex[:6]}.bpmn")
            dest = input_dir / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(f.get("content",""), encoding="utf-8")

        all_files = sorted(input_dir.rglob("*"))
        bpmn_candidates = [p for p in all_files if p.is_file() and p.suffix.lower() == ".bpmn"]
        output_analisi = output_dir / "analisi"
        output_anonimi = output_dir / "analisi anonimi"
        output_analisi.mkdir(parents=True, exist_ok=True)
        output_anonimi.mkdir(parents=True, exist_ok=True)
        results = []
        success = failed = 0
        for bpmn_path in bpmn_candidates:
            rel_name = str(bpmn_path.relative_to(input_dir))
            try:
                rel_no_suffix = bpmn_path.relative_to(input_dir).with_suffix("")
            except Exception:
                rel_no_suffix = P(bpmn_path.stem)
            cur_out_normal = output_analisi / rel_no_suffix
            cur_out_anon = output_anonimi / rel_no_suffix
            cur_out_normal.mkdir(parents=True, exist_ok=True)
            cur_out_anon.mkdir(parents=True, exist_ok=True)
            try:
                doc = parse_bpmn(bpmn_path)
                doc = enrich_flows(doc)
                doc = enrich_extensions(doc)
                graph = build_graph(doc)
                doc.metrics = compute_metrics(doc)
                doc.structural_warnings = compute_warnings(doc, graph)
                doc.paths = compute_paths(graph, limit=path_limit)
                outs = []
                if do_json:
                    p = cur_out_normal / "bpmn_analysis.json"
                    export_json(doc, p, anonymize=False)
                    outs.append(str(p.relative_to(output_dir)))
                    p = cur_out_anon / "bpmn_analysis.json"
                    export_json(doc, p, anonymize=True)
                    outs.append(str(p.relative_to(output_dir)))
                if do_md:
                    p = cur_out_normal / "bpmn_analysis.md"
                    export_markdown(doc, p, anonymize=False)
                    outs.append(str(p.relative_to(output_dir)))
                    p = cur_out_anon / "bpmn_analysis.md"
                    export_markdown(doc, p, anonymize=True)
                    outs.append(str(p.relative_to(output_dir)))
                if do_graph:
                    p1 = cur_out_normal / "bpmn_graph.json"
                    export_graph_json(graph, p1, anonymize=False)
                    outs.append(str(p1.relative_to(output_dir)))
                    p1a = cur_out_anon / "bpmn_graph.json"
                    export_graph_json(graph, p1a, anonymize=True)
                    outs.append(str(p1a.relative_to(output_dir)))
                    try:
                        p2 = cur_out_normal / "bpmn_graph.graphml"
                        export_graphml(graph, p2, anonymize=False)
                        outs.append(str(p2.relative_to(output_dir)))
                        p2a = cur_out_anon / "bpmn_graph.graphml"
                        export_graphml(graph, p2a, anonymize=True)
                        outs.append(str(p2a.relative_to(output_dir)))
                    except Exception:
                        pass
                results.append({"filename": rel_name, "status": "ok", "metrics": doc.metrics.model_dump(), "warnings": [w.model_dump() for w in doc.structural_warnings], "paths_count": len(doc.paths), "outputs": outs})
                success += 1
            except Exception as e:
                import traceback
                results.append({"filename": rel_name, "status": "error", "error": str(e), "trace": traceback.format_exc()})
                failed += 1

        # --- Also build Platform canonical from same input_dir (supports full SOA drag&drop) ---
        platform_canonical = None
        platform_graph_obj = None
        try:
            from ingestion.scanner import scan_project as _scan
            from ingestion.registry import build_registry as _build_reg
            from parsers.wsdl.parser import _parse_wsdl
            from parsers.xsd.parser import _parse_xsd
            from parsers.sca.parser import _parse_composite
            from parsers.bpel.parser import _parse_bpel
            from parsers.xslt.parser import _parse_xslt
            from graph.lineage import build_global_lineage
            from graph.graph_builder import build_global_graph, graph_to_dict
            from resolution.dependency_resolver import build_wsdl_xsd_graph
            from documentation.technical import generate_technical_doc
            from documentation.functional import generate_functional_doc
            files_scanned = _scan(input_dir)
            registry = _build_reg(files_scanned, input_dir)
            wsdls, xsds, composites, bpels, xslts, bpmns_plat = [], [], [], [], [], []
            for art in registry["artifacts"]:
                pp = P(art["path"])
                rel = art["relativePath"]
                atype = art["type"]
                try:
                    c = pp.read_text(encoding="utf-8", errors="ignore")
                    if atype == "wsdl": wsdls.append(_parse_wsdl(c, pp.name, rel))
                    elif atype == "xsd": xsds.append(_parse_xsd(c, pp.name, rel))
                    elif atype == "sca_composite": composites.append(_parse_composite(c, pp.name, rel))
                    elif atype == "bpel": bpels.append(_parse_bpel(c, pp.name, rel))
                    elif atype == "xslt": xslts.append(_parse_xslt(c, pp.name, rel))
                    elif atype == "bpmn":
                        try:
                            # reuse already parsed bpmn results if available
                            docs = [r for r in results if r.get("status")=="ok"]
                            bpmns_plat.append({"id": pp.stem, "name": pp.stem, "fileName": pp.name, "relativePath": rel})
                        except Exception: pass
                except Exception: pass
            graph = build_wsdl_xsd_graph(wsdls, xsds, input_dir, registry)
            for _c in composites:
                for w in _c.get("wires", []):
                    graph["edges"].append({"source": w["source"], "target": w["target"], "type": "wires", "status": "explicit", "confidence": 1.0, "evidence": {"artifact": _c["relativePath"]}})
            for _b in bpels:
                for inv in _b.get("invokes", []):
                    graph["edges"].append({"source": _b["id"], "target": inv.get("partnerLink",""), "type": "invokes", "status": "explicit", "confidence": 1.0, "evidence": {"artifact": _b["relativePath"]}})
            lineage = build_global_lineage(wsdls, xsds, xslts)
            for e in lineage["edges"]:
                graph["edges"].append({"source": e["source"], "target": e["target"], "type": e["type"], "status": "inferred", "confidence": e["confidence"], "evidence": e["evidence"]})
            graph["stats"]["total_edges"] = len(graph["edges"])
            G = build_global_graph(bpmn_docs=bpmns_plat, bpel_infos=bpels, wsdl_infos=wsdls, xsd_infos=xsds, xslt_infos=xslts, composites=composites, lineage=lineage, wsdl_xsd_graph=graph)
            global_graph_dict = graph_to_dict(G)
            platform_canonical = {
                "root": str(input_dir.resolve()),
                "registry": registry,
                "wsdls": wsdls, "xsds": xsds, "composites": composites, "bpels": bpels, "bpmns": bpmns_plat, "xslts": xslts,
                "lineage": lineage, "graph": graph, "global_graph": global_graph_dict,
                "version": "1.0", "bpmn_results": results,
            }
            try:
                platform_canonical["_technical_md"] = generate_technical_doc(platform_canonical, graph)
                platform_canonical["_functional_md"] = generate_functional_doc(platform_canonical, graph)
            except Exception: pass
            platform_graph_obj = G
            # add canonical to zip
            with zipfile.ZipFile(zip_path, "a", zipfile.ZIP_DEFLATED) as z:
                z.writestr("canonical.json", json.dumps(platform_canonical, indent=2, ensure_ascii=False))
                z.writestr("registry.json", json.dumps(registry, indent=2, ensure_ascii=False))
        except Exception as e:
            # platform canonical optional — keep bpmn-only result
            print(f"[ingest] platform canonical failed: {e}")

        zip_path = work_dir / f"bpmn_results_{jid[:8]}.zip"
        # (zip already created, a mode added canonical)
        canonical_for_job = platform_canonical or {"bpmn_results": results}
        # expose also as registry/graph for uniform API
        JOBS[jid] = {"zip_path": zip_path, "work_dir": work_dir, "canonical": canonical_for_job, "graph_obj": platform_graph_obj, "registry": canonical_for_job.get("registry")}
        # make also globally available without job param
        global PRELOAD
        if platform_canonical:
            PRELOAD = platform_canonical
            PRELOAD["graph_obj"] = platform_graph_obj
        self._set_headers(200)
        self.wfile.write(json.dumps({
            "job_id": jid, "total": len(bpmn_candidates), "success": success, "failed": failed,
            "results": results, "download_url": f"/api/download/{jid}",
            "registry": canonical_for_job.get("registry"),
            "global_graph": canonical_for_job.get("global_graph"),
            "canonical_url": f"/api/canonical?job={jid}"
        }).encode())

    def _handle_platform_analyze(self, project_path_str, options):
        p = Path(project_path_str)
        if not p.exists():
            self._set_headers(400)
            self.wfile.write(json.dumps({"error": f"path not found {project_path_str}"}).encode())
            return
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
        import tempfile

        files = scan_project(p)
        registry = build_registry(files, p)
        wsdls, xsds, composites, bpels, xslts, bpmns = [], [], [], [], [], []
        for art in registry["artifacts"]:
            pp = Path(art["path"])
            rel = art["relativePath"]
            atype = art["type"]
            try:
                content = pp.read_text(encoding="utf-8", errors="ignore")
                if atype == "wsdl":
                    wsdls.append(_parse_wsdl(content, pp.name, rel))
                elif atype == "xsd":
                    xsds.append(_parse_xsd(content, pp.name, rel))
                elif atype == "sca_composite":
                    composites.append(_parse_composite(content, pp.name, rel))
                elif atype == "bpel":
                    bpels.append(_parse_bpel(content, pp.name, rel))
                elif atype == "xslt":
                    xslts.append(_parse_xslt(content, pp.name, rel))
                elif atype == "bpmn":
                    try:
                        sys.path.insert(0, str(ROOT / "bpmn-reverse-engineer" / "src"))
                        from bpmn_reverse_engineer.parser import parse_bpmn
                        from bpmn_reverse_engineer.analyzers.enrich_flows import enrich_flows
                        from bpmn_reverse_engineer.analyzers.extension_semantics import enrich_extensions
                        doc = parse_bpmn(pp)
                        doc = enrich_flows(doc)
                        doc = enrich_extensions(doc)
                        bpmns.append({"id": doc.processes[0].id if doc.processes else pp.stem, "name": doc.processes[0].name if doc.processes else pp.stem, "fileName": pp.name, "relativePath": rel, "elements": len(doc.elements)})
                    except Exception as e:
                        bpmns.append({"fileName": pp.name, "relativePath": rel, "error": str(e)})
            except Exception as e:
                pass

        graph = build_wsdl_xsd_graph(wsdls, xsds, p, registry)
        for c in composites:
            for w in c.get("wires", []):
                graph["edges"].append({"source": w["source"], "target": w["target"], "type": "wires", "status": "explicit", "confidence": 1.0, "evidence": {"artifact": c["relativePath"]}})
        for b in bpels:
            for inv in b.get("invokes", []):
                graph["edges"].append({"source": b["id"], "target": inv.get("partnerLink",""), "type": "invokes", "status": "explicit", "confidence": 1.0, "evidence": {"artifact": b["relativePath"]}})
        lineage = build_global_lineage(wsdls, xsds, xslts)
        for e in lineage["edges"]:
            graph["edges"].append({"source": e["source"], "target": e["target"], "type": e["type"], "status": "inferred", "confidence": e["confidence"], "evidence": e["evidence"]})
        graph["stats"]["total_edges"] = len(graph["edges"])

        G = build_global_graph(bpmn_docs=bpmns, bpel_infos=bpels, wsdl_infos=wsdls, xsd_infos=xsds, xslt_infos=xslts, composites=composites, lineage=lineage, wsdl_xsd_graph=graph)
        global_graph_dict = graph_to_dict(G)

        # docs
        from documentation.technical import generate_technical_doc
        from documentation.functional import generate_functional_doc
        canonical = {
            "root": str(p.resolve()),
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
            "version": "1.0",
        }
        tech = generate_technical_doc(canonical, graph)
        func = generate_functional_doc(canonical, graph)
        canonical["_technical_md"] = tech
        canonical["_functional_md"] = func

        # also evidence store
        store = EvidenceStore()
        for e in graph["edges"]:
            store.add(RelationshipEvidence(source=e.get("source",""), relationship=e.get("type","unknown"), target=e.get("target",""), evidence=[e.get("evidence", {})] if e.get("evidence") else [], confidence=e.get("confidence",1.0), resolution=e.get("status","explicit")))

        jid = str(uuid.uuid4())
        work_dir = Path(tempfile.mkdtemp(prefix=f"soa_{jid[:8]}_"))
        # salva canonical + docs + zip per download
        (work_dir / "canonical.json").write_text(json.dumps(canonical, indent=2, ensure_ascii=False), encoding="utf-8")
        (work_dir / "technical.md").write_text(tech, encoding="utf-8")
        (work_dir / "functional.md").write_text(func, encoding="utf-8")
        zip_path = work_dir / f"soa_results_{jid[:8]}.zip"
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("canonical.json", json.dumps(canonical, indent=2, ensure_ascii=False))
            z.writestr("technical.md", tech)
            z.writestr("functional.md", func)
            # aggiungi anche registry
            z.writestr("registry.json", json.dumps(registry, indent=2, ensure_ascii=False))

        JOBS[jid] = {"canonical": canonical, "graph_obj": G, "zip_path": zip_path, "work_dir": work_dir, "registry": registry}
        # preload globale per GET senza job
        global PRELOAD
        PRELOAD = canonical
        PRELOAD["graph_obj"] = G

        self._set_headers(200)
        self.wfile.write(json.dumps({"job_id": jid, "registry": registry, "stats": graph["stats"], "global_graph": {"nodes": len(global_graph_dict["nodes"]), "edges": len(global_graph_dict["edges"])}, "download_url": f"/api/download/{jid}", "canonical_url": f"/api/canonical?job={jid}"}).encode())

def run_server(host="127.0.0.1", port=8000, preload=None):
    global PRELOAD
    if preload is not None:
        PRELOAD = preload
    import os
    if DIST.exists():
        os.chdir(str(DIST))
        print(f"[Unified] dist found at {DIST} — serving SPA + API on http://{host}:{port}")
    else:
        print(f"[Unified] dist NOT found at {DIST} — API only on http://{host}:{port}")
        print(f"           Run 'npm run build' for prod single-port, or 'npm run dev' for Vite :3000 proxy")
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"Unified Platform serving at http://{host}:{port} (single port, locale) — preload={'yes' if PRELOAD else 'no'}")
    print(f"  Frontend dev:  http://127.0.0.1:3000  (Vite, proxy /api -> :{port})")
    print(f"  Backend API:   http://{host}:{port}/api/health")
    print(f"  SPA fallback:  http://{host}:{port}/  (after npm run build)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
