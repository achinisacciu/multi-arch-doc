"""collect.py — wrapper per-cartella sui 4 tool esistenti (F0 scaffold, stdlib-only).

Non riscansiona da zero: invoca i tool esistenti come sottoprocessi e
normalizza gli output. Il nome cliente e' sempre parametrico (--client),
default "clientone", output in dossier-clienti/<client>/.

Uso:
  python multirepo/collect.py --client clientone --folders fixtures/repo-a fixtures/repo-b --dry-run
  python multirepo/collect.py --client altro-cliente --folders <cartella1> <cartella2>
"""
from __future__ import annotations

import argparse
import datetime
import hashlib
import json
import os
import re
import sys

DEFAULT_CLIENT = "clientone"
DEFAULT_OUTBASE = "dossier-clienti"
MAX_HASH_BYTES = 5_000_000  # ponytail: hash troncato oltre soglia, upgrade: streaming sempre se serve
# Anti-timeout 10.000 XML: tetto morbido per repo (oltre si campiona con flag
# onesto `truncated`), progress ogni N file, UN solo parse XML per file.
MAX_FILES_PER_REPO = 25_000
PROGRESS_EVERY = 2000

# Tool riusati: copie vendored in progetti-origine/ (nessun path assoluto:
# il progetto gira senza cartelle esterne e non espone percorsi locali in rete).
_HUB = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def _pick(*cands: str) -> str:
    for c in cands:
        if os.path.exists(c):
            return c
    return cands[0]


TOOLS = {
    "jca_studio": _pick(
        os.path.join(_HUB, "progetti-origine", "jca-technical-doc-generator",
                     "src", "services", "jcaParser.ts")),
    "odi_documenter": _pick(
        os.path.join(_HUB, "progetti-origine", "odi-mapping-documenter", "run.py")),
    "soa_cli": _pick(
        os.path.join(_HUB, "progetti-origine", "tool_documentazione_BPMN",
                     "soa-reverse-engineer", "cli", "main.py")),
    "bpmn_visualizer": _pick(
        os.path.join(_HUB, "progetti-origine", "bpmn", "bpmn-visualizer", "package.json")),
    "lp_documenter": _pick(
        os.path.join(_HUB, "progetti-origine", "odi-mapping-documenter",
                     "lp_doc_test", "run.py")),
    "bpmn_cli": _pick(
        os.path.join(_HUB, "progetti-origine", "tool_documentazione_BPMN",
                     "bpmn-reverse-engineer", "src", "bpmn_reverse_engineer", "cli.py")),
}

try:
    from multirepo.db_inventory import (
        detect_sql_type,
        extract_sql_params,
        extract_sql_tables,
        inventory_folder_db,
    )
except ImportError:  # esecuzione come script: sys.path[0] e' multirepo/
    from db_inventory import (
        detect_sql_type,
        extract_sql_params,
        extract_sql_tables,
        inventory_folder_db,
    )

try:
    from multirepo.file_docs import (
        CONTRACT_KINDS,
        bpel_markdown,
        bpel_mermaid,
        classify_xml,
        contract_markdown,
        contract_summary,
        generic_xml_markdown,
        generic_xml_summary,
        odi_inventory_markdown,
        parse_bpel,
        safe_name,
        scenario_markdown,
    )
except ImportError:
    from file_docs import (
        CONTRACT_KINDS,
        bpel_markdown,
        bpel_mermaid,
        classify_xml,
        contract_markdown,
        contract_summary,
        generic_xml_markdown,
        generic_xml_summary,
        odi_inventory_markdown,
        parse_bpel,
        safe_name,
        scenario_markdown,
    )


def check_tools() -> dict:
    status = {}
    for name, path in TOOLS.items():
        ok = os.path.exists(path)
        status[name] = {"path": path, "status": "ok" if ok else "skipped",
                        "detail": "presente" if ok else "assente: riuso non disponibile"}
    return status


EXT_TECH = {
    # ponytail: hint naive per estensione, upgrade: sniff contenuto/magic bytes se serve
    ".py": "python", ".properties": "properties", ".yml": "yaml", ".yaml": "yaml",
    ".xml": "xml", ".jca": "jca", ".bpel": "bpel", ".bpmn": "bpmn",
    ".wsdl": "wsdl", ".xsd": "xsd", ".xslt": "xslt", ".xsl": "xslt",
    ".sql": "sql", ".json": "json", ".md": "markdown",
}
DB_RE = re.compile(r"(?i)\b(db[\w.-]*host|db[\w.-]*name|database|dbname)\s*[:=]\s*(\S+)")


def normalize_ts_entry(d: dict) -> dict:
    # I1.5: TS usa path+extension, SOA registry relativePath+fileName, noi rel_path+ext.
    rel = d.get("rel_path") or d.get("relativePath") or d.get("path") or d.get("fileName") or ""
    ext = d.get("ext") or d.get("extension") or ""
    if not ext and rel:
        ext = os.path.splitext(rel)[1].lower() or "none"
    return {"rel_path": rel, "ext": ext or "none"}


def _try_parse_root(path: str):
    """UN solo ET.parse per file (size-guarded). Ritorna root o None.

    Anti-timeout 10k XML: il loop inventario parsifica una volta sola e
    riusa la root per ODI/LP/scen (niente 3-4 parse per file)."""
    import xml.etree.ElementTree as ET

    try:
        if os.path.getsize(path) > MAX_HASH_BYTES:
            return None
        return ET.parse(path).getroot()
    except Exception:
        return None


def _odi_from_root(root) -> dict | None:
    """Estrae Object/Field Snp* da una root gia parsata (come sniff_odi_xml)."""
    found: dict[str, list[dict]] = {}
    for obj in root.iter():
        if not isinstance(obj.tag, str) or obj.tag.rsplit("}", 1)[-1] != "Object":
            continue
        cls = (obj.get("class") or "").rsplit(".", 1)[-1]
        if not cls:
            continue
        fields: dict[str, list[str]] = {}
        for f in obj:
            if not isinstance(f.tag, str) or f.tag.rsplit("}", 1)[-1] != "Field":
                continue
            fn = f.get("name")
            if fn and f.text and f.text.strip():
                fields.setdefault(fn, []).append(f.text.strip())
        found.setdefault(cls, []).append(fields)
    return found or None


def sniff_odi_xml(path: str) -> dict | None:
    # ponytail: sniff naive Object/Field via stdlib etree; convenzione fixture:
    # SnpMapping(Name, SourceTable/TargetTable SCHEMA.TABELLA), SnpLoadPlan
    # (LoadPlanName), SnpScen (ScenName). Upgrade: OdiMappingParser/lp_parser se serve.
    root = _try_parse_root(path)
    if root is None:
        return None
    return _odi_from_root(root)


def sniff_jca(path: str) -> dict | None:
    # T3.1: nome adapter + operations da adapter-config + connection-factory e SQL.
    import xml.etree.ElementTree as ET

    try:
        if os.path.getsize(path) > MAX_HASH_BYTES:
            return None
        root = ET.parse(path).getroot()
    except Exception:
        return None
    if not isinstance(root.tag, str) or root.tag.rsplit("}", 1)[-1] != "adapter-config":
        return None
    ops = []
    sqls = []
    cf = ""
    activations = []
    for el in root.iter():
        tag = el.tag.rsplit("}", 1)[-1] if isinstance(el.tag, str) else ""
        if tag == "endpoint-interaction":
            op = el.get("operation")
            if op:
                ops.append(op)
        elif tag == "endpoint-activation":
            act = {"endpoint": el.get("portType") or el.get("operation") or "",
                   "operation": el.get("operation") or "",
                   "spec": "", "properties": {}}
            for child in el.iter():
                ctag = (child.tag.rsplit("}", 1)[-1]
                        if isinstance(child.tag, str) else "")
                if ctag == "activation-spec" and not act["spec"]:
                    act["spec"] = child.get("className") or ""
                elif ctag == "property" and len(act["properties"]) < 20:
                    pname = child.get("name") or ""
                    pval = (child.get("value") or (child.text or "").strip())[:120]
                    if pname:
                        act["properties"][pname] = pval
            activations.append(act)
        elif tag == "connection-factory":
            cf = el.get("location") or cf
        elif tag == "property":
            pname = (el.get("name") or "").lower()
            pval = el.get("value") or (el.text or "").strip()
            if "sql" in pname and pval:
                sqls.append(pval)
    return {
        "name": root.get("name", ""),
        "adapter": root.get("adapter", ""),
        "operations": ops,
        "connection_factory": cf,
        "sqls": sqls,
        "activations": activations,
        # Port di jcaParser.ts: tabelle referenziate, tipo statement, parametri.
        "sql_tables": sorted({t for s in sqls for t in extract_sql_tables(s)}),
        "sql_types": sorted({detect_sql_type(s) for s in sqls}),
        "sql_params": sorted({p for s in sqls for p in extract_sql_params(s)}),
    }


def _lp_fields(obj) -> dict:
    fields: dict[str, str] = {}
    for f in obj:
        if not isinstance(f.tag, str) or f.tag.rsplit("}", 1)[-1] != "Field":
            continue
        fn = f.get("name")
        if fn and f.text and f.text.strip() and f.text.strip() != "null":
            fields.setdefault(fn, []).append(f.text.strip())
    return {k: v[0] for k, v in fields.items()}


def _text_line(text: str, needle: str) -> int:
    try:
        return text.count("\n", 0, text.index(needle)) + 1
    except ValueError:
        return 0


def sniff_lp_initiators(path: str, rel: str) -> list[dict]:
    """Chi avvia i processi ODI: agenti/schedulazioni (SnpPlanAgent) e
    step che avviano scenari (SnpLpStep con ScenName). Best-effort stdlib."""
    import xml.etree.ElementTree as ET

    try:
        if os.path.getsize(path) > MAX_HASH_BYTES:
            return []
        with open(path, encoding="utf-8", errors="strict") as fh:
            text = fh.read()
        root = ET.fromstring(text)
    except Exception:
        return []
    return _lp_initiators_from_root(root, text, rel)


def _lp_initiators_from_root(root, text: str, rel: str) -> list[dict]:
    """Variante senza I/O: riusa root+testo gia letti (UN solo parse per file)."""
    out: list[dict] = []
    lp_name = ""
    agents: list[dict] = []
    for obj in root.iter():
        if not isinstance(obj.tag, str) or obj.tag.rsplit("}", 1)[-1] != "Object":
            continue
        cls = (obj.get("class") or "").rsplit(".", 1)[-1]
        if cls == "SnpLoadPlan":
            f = _lp_fields(obj)
            lp_name = f.get("LoadPlanName", "")
        elif cls == "SnpPlanAgent":
            f = _lp_fields(obj)
            sched = " ".join(
                f"{k}={f[k]}" for k in
                ("SType", "SHour", "SMinute", "SSecond", "SWeekDay",
                 "SMonthDay", "RCycleUnit", "RDurCycle", "RDurInterval",
                 "SBeginDate", "SEndDate") if f.get(k))
            anchor = f.get("LagentName") or f.get("ScenName") or "agent"
            parts = []
            if f.get("LagentName"):
                parts.append(f"agente {f['LagentName']}")
            if f.get("ContextCode"):
                parts.append(f"context {f['ContextCode']}")
            if f.get("UserName"):
                parts.append(f"user {f['UserName']}")
            if sched:
                parts.append(f"sched [{sched}]")
            agents.append({"kind": "loadplan-agent",
                           "name": f.get("ScenName") or anchor,
                           "file": rel, "line": _text_line(text, anchor),
                           "detail": " ".join(parts),
                           "lp": ""})
        elif cls == "SnpLpStep":
            f = _lp_fields(obj)
            if f.get("ScenName"):
                step = f.get("LpStepName") or f.get("ILpStep") or "step"
                out.append({"kind": "loadplan-step", "name": step,
                            "file": rel, "line": _text_line(text, step),
                            "detail": f"avvia scenario {f['ScenName']}"
                                      f" ({f.get('LpStepType', '')})",
                            "lp": ""})
    for a in agents:
        a["lp"] = lp_name
        if not a["detail"]:
            a["detail"] = "agente/schedulazione da verificare nel file"
        out.append(a)
    for e in out:
        if not e["lp"]:
            e["lp"] = lp_name
    return out


def sniff_bpmn_starts(path: str, rel: str) -> list[dict]:
    """Chi avvia i processi BPMN: startEvent per processo (timer/messaggi)."""
    root = _try_parse_root(path)
    if root is None:
        return []
    return _bpmn_starts_from_root(root, rel)


def _bpmn_starts_from_root(root, rel: str) -> list[dict]:
    """Variante senza I/O: riusa root gia parsata (UN solo parse per file)."""

    def local(tag: str) -> str:
        return tag.rsplit("}", 1)[-1] if isinstance(tag, str) else ""
    out: list[dict] = []
    for proc in root.iter():
        if local(proc.tag) != "process":
            continue
        pname = proc.get("name") or proc.get("id") or "process"
        for ev in proc.iter():
            if local(ev.tag) != "startEvent":
                continue
            ename = ev.get("name") or ev.get("id") or "start"
            trig = "manuale / non specificato"
            for child in ev:
                c = local(child.tag)
                if c == "timerEventDefinition":
                    spec = " ".join((grand.text or "").strip()
                                    for grand in child.iter()
                                    if (grand.text or "").strip())[:120]
                    trig = f"timer ({spec})" if spec else "timer"
                elif c == "messageEventDefinition":
                    trig = f"messaggio ({child.get('messageRef', '')})"
                elif c == "signalEventDefinition":
                    trig = f"segnale ({child.get('signalRef', '')})"
                elif c == "conditionalEventDefinition":
                    trig = "condizione"
            out.append({"kind": "bpmn-start", "name": ename, "file": rel,
                        "line": 0, "detail": f"processo {pname}: {trig}",
                        "lp": ""})
    return out


def infer_archetype(name: str, tech: set, files: list, jca_adapters: list, odi_exports: list, lp_files: list) -> tuple[str, str]:
    rels = {f["rel_path"].lower() for f in files}
    if odi_exports or lp_files:
        return "ETL / Data Integration (ODI)", f"Pipeline di trasformazione dati e caricamento ETL (rilevati {len(odi_exports)} export mapping e {len(lp_files)} LoadPlan)."
    if any("composite.xml" in r for r in rels) or jca_adapters or "bpel" in tech or "wsdl" in tech:
        return "Integrazione SOA / Service Bus", f"Modulo di integrazione SOA Oracle (rilevati adapter JCA / processi BPEL / contratti WSDL)."
    if "bpmn" in tech:
        return "Orchestrazione Processi BPMN", "Servizio di orchestrazione e workflow di processi aziendali (file BPMN)."
    if any(r == "pom.xml" or r.endswith("/pom.xml") for r in rels):
        return "Applicazione Java / Enterprise", "Servizio o componente backend sviluppato su stack Java / Maven."
    if any(r == "package.json" or r.endswith("/package.json") for r in rels):
        return "Servizio Node.js / Web Frontend", "Modulo applicativo Node.js / TypeScript / Web."
    if "python" in tech:
        return "Servizio Python / Scripting", "Componente applicativo o microservizio sviluppato in Python."
    if "sql" in tech:
        return "Modulo Dati / Schemi Database", "Script SQL e definizioni di schema dati."
    return "Componente Software", "Modulo applicativo generale del cliente."


def inventory_folder(root: str, max_files: int = MAX_FILES_PER_REPO) -> dict:
    name = os.path.basename(os.path.abspath(root))
    files, tech, db_refs = [], set(), []
    odi_exports, lp_files, scen_files, jca_adapters, bpmn_files = [], [], [], [], []
    bpel_files, file_docs = [], []
    initiators = []
    truncated = False
    manifests, entrypoints = {}, []
    for dirpath, dirs, names in os.walk(root):
        dirs[:] = [d for d in dirs if d not in {".git", ".svn", ".hg", "__pycache__", ".pytest_cache", ".ruff_cache", "node_modules", ".idea", ".vscode"}]
        for n in names:
            if len(files) >= max_files:
                truncated = True
                break
            fp = os.path.join(dirpath, n)
            rel = os.path.relpath(fp, root).replace(os.sep, "/")
            _base, ext = os.path.splitext(n)
            ext = ext.lower()
            if ext in EXT_TECH:
                tech.add(EXT_TECH[ext])
            sha = None
            try:
                if os.path.getsize(fp) <= MAX_HASH_BYTES:
                    h = hashlib.sha256()
                    with open(fp, "rb") as fh:
                        for chunk in iter(lambda: fh.read(65536), b""):
                            h.update(chunk)
                    sha = h.hexdigest()
            except Exception:
                sha = None
            files.append({"rel_path": rel, "ext": ext or "none", "sha256": sha})
            if len(files) % PROGRESS_EVERY == 0:
                print(f"[{name}] inventario: {len(files)} file…", flush=True)
            if ext == ".jca":
                jsniff = sniff_jca(fp)
                if jsniff:
                    jca_adapters.append({"file": rel, **jsniff})
                    for act in jsniff.get("activations", []):
                        props = " ".join(
                            f"{k}={v}"
                            for k, v in list(act["properties"].items())[:6])
                        initiators.append({
                            "kind": "jca-inbound",
                            "name": act["endpoint"] or jsniff.get("name", ""),
                            "file": rel, "line": 0,
                            "detail": f"adapter {jsniff.get('adapter', '')} "
                                      f"spec {act['spec']} {props}".strip(),
                            "lp": ""})
            if ext == ".bpmn":
                bpmn_files.append(rel)
                initiators.extend(sniff_bpmn_starts(fp, rel))
            if ext == ".bpel":
                bpel_files.append(rel)
            # Router per-file: ogni XML/SOA ha il suo record kind+detected_by.
            if (ext in (".xml", ".bpel", ".bpmn", ".wsdl", ".xsd", ".xsl",
                        ".xslt", ".jca", ".mplan", ".task", ".dvm")
                    or n.endswith(".componentType") or n == "composite.xml"):
                try:
                    file_docs.append(classify_xml(fp, rel))
                except Exception:
                    file_docs.append({"file": rel, "kind": "unknown",
                                      "detected_by": "error",
                                      "detail": "classificazione fallita"})
            if n in ("package.json", "pom.xml", "requirements.txt", "docker-compose.yml", "Dockerfile"):
                manifests.setdefault(n, []).append(rel)
            if n in ("app.py", "main.py", "server.py", "run.py", "index.js", "index.ts", "main.ts"):
                entrypoints.append(rel)
            if ext == ".xml":
                # UN solo parse per file: root riusata per ODI + LP initiators
                # (classify_xml sotto fa il suo parse: 2 totali, non 4).
                sniffed = None
                xml_root = _try_parse_root(fp)
                if xml_root is not None:
                    sniffed = _odi_from_root(xml_root)
                if sniffed:
                    if "SnpLoadPlan" in sniffed:
                        try:
                            with open(fp, encoding="utf-8", errors="strict") as _fh:
                                _text = _fh.read()
                            initiators.extend(
                                _lp_initiators_from_root(xml_root, _text, rel))
                        except Exception:
                            pass
                    if "SnpMapping" in sniffed:
                        maps = []
                        for fields in sniffed["SnpMapping"]:
                            maps.append({
                                "name": fields.get("Name", [os.path.splitext(n)[0]])[0],
                                "sources": fields.get("SourceTable", []),
                                "targets": fields.get("TargetTable", []),
                            })
                        odi_exports.append({"file": rel, "mappings": maps})
                    if "SnpLoadPlan" in sniffed:
                        lp_files.append({
                            "file": rel,
                            "loadplan_names": sorted({v for f in sniffed["SnpLoadPlan"] for v in f.get("LoadPlanName", [])}),
                        })
                    if "SnpScen" in sniffed:
                        scen_files.append({
                            "file": rel,
                            "scen_names": sorted({v for f in sniffed["SnpScen"] for v in f.get("ScenName", [])}),
                        })
            if ext in (".properties", ".env", ".py", ".xml", ".json", ".yaml", ".yml"):
                try:
                    # File enormi (>1MB): skip scan DB (basta lo sniff XML sopra).
                    if os.path.getsize(fp) > 1_000_000:
                        raise OSError("skip db scan: file enorme")
                    with open(fp, "r", encoding="utf-8", errors="strict") as fh:
                        for i, line in enumerate(fh, 1):
                            m = DB_RE.search(line)
                            if m:
                                db_refs.append({"file": rel, "line": i, "key": m.group(1)})
                            if len(db_refs) > 200:
                                break
                except Exception:
                    pass
        if truncated:
            print(f"[{name}] ATTENZIONE: oltre {max_files} file, inventario troncato "
                  f"(i primi {max_files} in ordine walk).", flush=True)
    archetype, role_desc = infer_archetype(name, tech, files, jca_adapters, odi_exports, lp_files)
    try:
        db_res = inventory_folder_db(root, name, jca_adapters, odi_exports)
    except Exception:
        db_res = []
    return {"name": name, "root": os.path.abspath(root),
            "archetype": archetype, "role_description": role_desc,
            "truncated": truncated,
            "entrypoints": entrypoints, "manifests": manifests,
            "files": sorted(files, key=lambda f: f["rel_path"]),
            "tech": sorted(tech), "db_refs": db_refs,
            "db_inventory": db_res,
            "odi_exports": odi_exports,
            "lp_files": sorted(lp_files, key=lambda s: s["file"]),
            "scen_files": sorted(scen_files, key=lambda s: s["file"]),
            "bpmn_files": sorted(bpmn_files),
            "bpel_files": sorted(bpel_files),
            "file_docs": sorted(file_docs, key=lambda s: s["file"]),
            "initiators": sorted(initiators, key=lambda e: (e["kind"], e["name"])),
            "jca_adapters": sorted(jca_adapters, key=lambda s: s["file"])}


def _odi_doc_one(job: tuple) -> dict:
    """Doc full di UN export ODI (thread-safe: ogni export ha la sua odi_out).

    Ritorna la entry ledger (senza _record_doc: quello lo fa il main thread
    in ordine deterministico, niente race sull'indice file_docs).
    job = (tool, exp_file, exp_abs, odi_out, tmo).
    """
    tool, exp_file, exp_abs, odi_out, tmo = job
    os.makedirs(odi_out, exist_ok=True)
    res = run_tool([sys.executable, tool, exp_abs,
                    "--format", "all", "--output-dir", odi_out], tmo)
    entry = {"file": exp_file, **res}
    if res["status"] == "ok":
        gen = _list_generated(odi_out)
        entry["generated"] = gen
        if not gen:
            entry["status"] = "failed"
            entry["detail"] = (
                "tool ok ma nessun output generato in "
                f"{odi_out}")
    return entry


def _run_odi_parallel(cart_name: str, jobs: list, workers: int) -> list:
    """Esegue i job ODI full in parallelo (stdlib ThreadPoolExecutor).

    Anti-10k-completa: 10.000 export seriali = ore; in parallelo scala coi
    core. Progress nel log, ordine ledger deterministico (per file)."""
    from concurrent.futures import ThreadPoolExecutor, as_completed

    total = len(jobs)
    done = 0
    step = max(1, total // 20)
    entries: list = []
    with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
        futs = {pool.submit(_odi_doc_one, j): j for j in jobs}
        for fut in as_completed(futs):
            try:
                entries.append(fut.result())
            except Exception as e:  # mai un thread a terra ferma la run
                entries.append({"file": futs[fut][1], "status": "failed",
                                "detail": f"{type(e).__name__}: {e}"[:300],
                                "duration_s": 0})
            done += 1
            if done % step == 0 or done == total:
                print(f"[{cart_name}] odi_doc: {done}/{total} export…",
                      flush=True)
    entries.sort(key=lambda e: e.get("file", ""))
    return entries


def run_tool(cmd: list, timeout_s: int, cwd: str | None = None) -> dict:
    # I1.4: sottoprocesso a lista args (mai shell), esito onesto, mai eccezioni.
    import subprocess
    import time

    t0 = time.monotonic()
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout_s,
                            encoding="utf-8", errors="replace", cwd=cwd)
        dt = round(time.monotonic() - t0, 1)
        if r.returncode == 0:
            return {"status": "ok", "detail": (r.stdout or "")[-500:], "duration_s": dt}
        return {"status": "failed",
                "detail": (r.stderr or r.stdout or "")[-500:], "duration_s": dt}
    except Exception as e:
        return {"status": "failed", "detail": f"{type(e).__name__}: {e}"[:500],
                "duration_s": round(time.monotonic() - t0, 1)}


def snapshot_mtimes(d: str) -> dict:
    try:
        return {n: os.path.getmtime(os.path.join(d, n))
                for n in os.listdir(d)
                if os.path.isfile(os.path.join(d, n))}
    except OSError:
        return {}


def copy_fresh_outputs(src_dir: str, dest_dir: str, before: dict,
                       pattern: str = ".md") -> list[str]:
    """Copia in dest i file pattern nuovi/modificati dopo l'esecuzione tool."""
    import shutil

    copied = []
    try:
        names = os.listdir(src_dir)
    except OSError:
        return copied
    os.makedirs(dest_dir, exist_ok=True)
    for n in sorted(names):
        if pattern not in n:
            continue
        src = os.path.join(src_dir, n)
        if not os.path.isfile(src):
            continue
        try:
            fresh = (n not in before or
                     os.path.getmtime(src) > before.get(n, 0) + 1e-6)
        except OSError:
            continue
        if fresh:
            try:
                shutil.copyfile(src, os.path.join(dest_dir, n))
                copied.append(n)
            except OSError:
                pass
    return copied


def _file_size(root: str, rel: str) -> int:
    try:
        return os.path.getsize(os.path.join(root, rel))
    except OSError:
        return 0


def _doc_index(cart: dict) -> dict:
    """Indice file -> record file_docs (O(1) invece di scansione O(N) per doc).

    Anti-10k: _record_doc chiamato migliaia di volte; la scansione lineare
    sarebbe O(N^2). L'indice vive in cart["_doc_index"] e si ricostruisce se
    la lista cambia misura."""
    idx = cart.get("_doc_index")
    fds = cart.get("file_docs", [])
    if not isinstance(idx, dict) or len(idx) != len(fds):
        idx = {}
        for fd in fds:
            f = fd.get("file")
            if f and f not in idx:
                idx[f] = fd
        cart["_doc_index"] = idx
    return idx


def _record_doc(cart: dict, rel_file: str, docs: list[str], kind: str) -> None:
    """Aggancia i doc generati al record file_docs del file sorgente."""
    if isinstance(docs, str):
        docs = [docs]
    fd = _doc_index(cart).get(rel_file)
    if fd is not None:
        seen = list(fd.get("doc") or [])
        for d in docs:
            if d and d not in seen:
                seen.append(d)
        fd["doc"] = seen
        return
    rec = {"file": rel_file, "kind": kind, "detected_by": "inventory",
           "detail": "", "doc": list(docs)}
    cart.setdefault("file_docs", []).append(rec)
    _doc_index(cart)[rel_file] = rec


def _list_generated(base: str, cap: int = 60) -> list[str]:
    """Elenca file generati sotto base (relativi a tools_output/<repo>/)."""
    out: list[str] = []
    # base = <outdir>/tools_output/<repo>[/sottocartella...]
    try:
        parts = base.replace("\\", "/").split("tools_output/")
        prefix = parts[1].split("/", 1)[0] if len(parts) > 1 else ""
    except Exception:
        prefix = ""
    for dirpath, _dirs, names in os.walk(base):
        for n in sorted(names):
            fp = os.path.join(dirpath, n)
            rel = os.path.relpath(fp, base).replace(os.sep, "/")
            # il tool ODI crea output_dir/timestamp/...: mantieni il percorso
            # relativo alla repo (odi/<stem>/... o <file> se in root repo).
            if prefix:
                sub = base.replace("\\", "/").split(f"tools_output/{prefix}/", 1)
                tail = sub[1] if len(sub) > 1 else ""
                out.append(f"{tail}/{rel}".strip("/"))
            else:
                out.append(rel)
            if len(out) >= cap:
                return out
    return out


def _write_orphan_scenarios(cart: dict, cart_tool_out: str, tool_runs: list) -> None:
    """SCENARIO_<nome>.md per scenari mai richiamati (orfani esplicitati)."""
    referenced: set[str] = set()
    callers: dict[str, list[str]] = {}
    for e in cart.get("initiators", []):
        if e.get("kind") == "loadplan-step":
            det = e.get("detail", "")
            m = re.search(r"avvia scenario (\S+)", det)
            if m:
                scen = m.group(1).strip("()`'\".,;")
                referenced.add(scen)
                callers.setdefault(scen, []).append(
                    f"{e.get('lp', '')}:{e.get('name', '')} ({e.get('file', '')})")
    scen_dir = os.path.join(cart_tool_out, "odi", "scenari")
    for sf in cart.get("scen_files", []):
        for sn in sf.get("scen_names", []):
            is_orphan = sn not in referenced
            md_name = f"SCENARIO_{safe_name(sn)}.md"
            try:
                os.makedirs(scen_dir, exist_ok=True)
                with open(os.path.join(scen_dir, md_name), "w",
                          encoding="utf-8") as fh:
                    fh.write(scenario_markdown(
                        sn, sf["file"], callers.get(sn, []), is_orphan))
                _record_doc(cart, sf["file"], [f"odi/scenari/{md_name}"],
                            "odi-scen")
            except Exception as ex:
                tool_runs.append({"folder": cart["name"], "tool": "scen_doc",
                                  "file": sf["file"], "status": "failed",
                                  "detail": f"{type(ex).__name__}: {ex}"[:300]})


def _write_odi_inventory_docs(cart: dict, cart_tool_out: str) -> None:
    """Scheda inventario istantanea per OGNI file ODI (mapping/LP/scenari).

    Garantisce la doc per-file anche in fast mode / fuori budget full-parser.
    """
    by_file: dict[str, dict] = {}
    for exp in cart.get("odi_exports", []):
        by_file.setdefault(exp["file"], {"file": exp["file"], "mappings": [],
                                         "loadplan_names": [], "scen_names": []})
        by_file[exp["file"]]["mappings"].extend(exp.get("mappings", []))
    for lp in cart.get("lp_files", []):
        by_file.setdefault(lp["file"], {"file": lp["file"], "mappings": [],
                                        "loadplan_names": [], "scen_names": []})
        by_file[lp["file"]]["loadplan_names"].extend(lp.get("loadplan_names", []))
    for sf in cart.get("scen_files", []):
        by_file.setdefault(sf["file"], {"file": sf["file"], "mappings": [],
                                        "loadplan_names": [], "scen_names": []})
        by_file[sf["file"]]["scen_names"].extend(sf.get("scen_names", []))
    for rel, exp in by_file.items():
        try:
            stem = safe_name(os.path.splitext(rel)[0].replace("/", "_"))
            d = os.path.join(cart_tool_out, "odi", stem)
            os.makedirs(d, exist_ok=True)
            with open(os.path.join(d, f"MAPPA_{stem}.md"), "w",
                      encoding="utf-8") as fh:
                fh.write(odi_inventory_markdown(exp))
            _record_doc(cart, rel, [f"odi/{stem}/MAPPA_{stem}.md"], "odi-inventario")
        except Exception:
            pass


def _write_bpmn_inventory_docs(cart: dict, cart_tool_out: str) -> None:
    """Scheda inventario istantanea per OGNI BPMN (start event sniffati)."""
    starts: dict[str, list[dict]] = {}
    for e in cart.get("initiators", []):
        if e.get("kind") == "bpmn-start":
            starts.setdefault(e.get("file", ""), []).append(e)
    for bf in cart.get("bpmn_files", []):
        try:
            stem = safe_name(os.path.splitext(bf)[0].replace("/", "_"))
            d = os.path.join(cart_tool_out, "bpmn", stem)
            os.makedirs(d, exist_ok=True)
            lines = [f"# BPMN (inventario) — `{bf}`", ""]
            evs = starts.get(bf, [])
            if evs:
                lines += ["## Start event", ""]
                lines += [f"- `{e.get('name', '?')}` — {e.get('detail', '—')}"
                          for e in evs]
                lines += [""]
            else:
                lines += ["_Nessuno start event rilevato — NON confermato_", ""]
            lines += ["_Scheda inventario da sniff. Per metriche/path/grafo "
                      "vedi `bpmn_analysis/`, se generata._", ""]
            with open(os.path.join(d, f"SCHEDA_{stem}.md"), "w",
                      encoding="utf-8") as fh:
                fh.write("\n".join(lines))
            _record_doc(cart, bf, [f"bpmn/{stem}/SCHEDA_{stem}.md"],
                        "bpmn-inventario")
        except Exception:
            pass


def _unique_md(outdir: str, base: str) -> str:
    """Nome .md senza collisioni tra omonimi in dir diverse."""
    cand = f"{base}.md"
    if not os.path.exists(os.path.join(outdir, cand)):
        return cand
    i = 2
    while os.path.exists(os.path.join(outdir, f"{base}_{i}.md")):
        i += 1
    return f"{base}_{i}.md"


def _write_contract_inventory_docs(cart: dict, fabs: str,
                                     cart_tool_out: str) -> None:
    """Scheda inventario istantanea per contratti/adapter (WSDL/XSD/XSLT/SCA...)."""
    jca_by_file = {j.get("file", ""): j for j in cart.get("jca_adapters", [])}
    for fd in cart.get("file_docs", []):
        if fd.get("doc"):
            continue
        if fd.get("kind") == "jca" and fd.get("file") in jca_by_file:
            try:
                j = jca_by_file[fd["file"]]
                stem = safe_name(os.path.splitext(fd["file"])[0].replace("/", "_"))
                d = os.path.join(cart_tool_out, "contratti", stem)
                os.makedirs(d, exist_ok=True)
                ops = ", ".join(f"`{o}`" for o in j.get("operations", [])) or "—"
                tbls = ", ".join(f"`{t}`" for t in j.get("sql_tables", [])) or "—"
                md = (f"# JCA (inventario) — `{fd['file']}`\n\n"
                      f"- **Adapter:** `{j.get('adapter', '—')}` · "
                      f"**nome:** `{j.get('name', '—')}`\n"
                      f"- **Connection factory:** `{j.get('connection_factory') or '—'}`\n"
                      f"- **Operazioni:** {ops}\n"
                      f"- **Tabelle SQL:** {tbls}\n"
                      f"- **Tipi statement:** "
                      f"{', '.join(f'`{t}`' for t in j.get('sql_types', [])) or '—'}\n\n"
                      f"_Scheda inventario da sniff (SQL redatti dove sensibili)._ \n")
                md_name = f"SCHEDA_{stem}.md"
                md_name = _unique_md(d, md_name[:-3])
                with open(os.path.join(d, md_name), "w",
                          encoding="utf-8") as fh:
                    fh.write(md)
                _record_doc(cart, fd["file"], [f"contratti/{stem}/{md_name}"],
                            "jca")
            except Exception:
                pass
            continue
        if fd.get("kind") not in CONTRACT_KINDS:
            continue
        try:
            info = contract_summary(os.path.join(fabs, fd["file"]))
            stem = safe_name(os.path.splitext(fd["file"])[0].replace("/", "_"))
            d = os.path.join(cart_tool_out, "contratti", stem)
            os.makedirs(d, exist_ok=True)
            md_name = f"SCHEDA_{stem}.md"
            with open(os.path.join(d, md_name), "w",
                      encoding="utf-8") as fh:
                fh.write(contract_markdown(info, fd["file"], fd["kind"]))
            _record_doc(cart, fd["file"], [f"contratti/{stem}/{md_name}"],
                        fd["kind"])
        except Exception:
            pass


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Collect per-cartella (F0): dry-run + normalizzazione output.")
    p.add_argument("--client", default=DEFAULT_CLIENT,
                   help=f"Nome cliente (default: {DEFAULT_CLIENT}). Cambialo per riusare il progetto su altri clienti.")
    p.add_argument("--folders", nargs="*", default=[],
                   help="Cartelle da analizzare (N repo dello stesso cliente).")
    p.add_argument("--out", default=DEFAULT_OUTBASE,
                   help=f"Base output (default: {DEFAULT_OUTBASE}). Il report finisce in <out>/<client>/")
    p.add_argument("--dry-run", action="store_true",
                   help="Non esegue i tool, elenca solo stato tool + cartelle + destinazione.")
    p.add_argument("--list-tools", action="store_true", help="Elenca i 4 tool riusati e esci.")
    p.add_argument("--fast", action="store_true",
                   help="Solo inventario + doc stdlib istantanee (salta i parser pesanti: "
                        "ODI full, SOA analyze, BPMN, LP). Ogni file ha comunque la sua doc.")
    p.add_argument("--max-odi-docs", type=int, default=None, metavar="N",
                   help="Budget doc ODI full per repo (i piu' piccoli prima, default: tutti; "
                        "--fast default: 0). Gli altri export hanno la scheda inventario.")
    p.add_argument("--tool-timeout", type=int, default=300, metavar="S",
                   help="Timeout secondi per singolo run pesante (default: 300).")
    p.add_argument("--max-files", type=int, default=MAX_FILES_PER_REPO, metavar="N",
                   help=f"Tetto morbido file per repo (default: {MAX_FILES_PER_REPO}). "
                        "Oltre si tronca con flag onesto `truncated`: 10.000 XML passano.")
    p.add_argument("--workers", type=int, default=4, metavar="N",
                   help="Worker paralleli per doc ODI full (default: 4, max 16). "
                        "La completa a 10k scala coi core: senza limite di tempo.")
    return p


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    client = args.client.strip() or DEFAULT_CLIENT
    outdir = os.path.join(args.out, client)
    tools = check_tools()

    if args.list_tools:
        print(json.dumps(tools, indent=2, ensure_ascii=False))
        return 0

    if args.dry_run:
        print(f"client: {client}")
        print(f"out: {outdir}")
        print(f"folders: {args.folders if args.folders else '(nessuna, usa --folders)'}")
        for name, info in tools.items():
            print(f"  [{info['status']}] {name}: {info['path']}")
        return 0

    os.makedirs(outdir, exist_ok=True)
    heavy = not args.fast
    tmo = max(10, args.tool_timeout)
    if args.max_odi_docs is not None:
        odi_budget: int | None = max(0, args.max_odi_docs)
    else:
        odi_budget = None if heavy else 0
    mode = "full" if heavy else f"fast (budget odi_doc: {odi_budget})"
    print(f"client: {client} · mode: {mode} · cartelle: {len(args.folders)}", flush=True)
    max_files = max(100, args.max_files)
    workers = max(1, min(16, args.workers))
    per = {"client": client,
           "created": datetime.datetime.now().isoformat(timespec="seconds"),
           "cartelle": [inventory_folder(f, max_files=max_files) for f in args.folders]}
    tool_runs = []
    if args.folders:
        import tempfile
        # Scenari di TUTTE le repo del client: i LoadPlan richiamano scenari
        # condivisi cross-repo (S9), vanno passati tutti a ogni esecuzione LP.
        scen_all: list[str] = []
        for f, cart in zip(args.folders, per["cartelle"]):
            fabs = os.path.abspath(f)
            for sf in cart.get("scen_files", []):
                p = os.path.join(fabs, sf["file"])
                if os.path.isfile(p) and p not in scen_all:
                    scen_all.append(p)
        for f, cart in zip(args.folders, per["cartelle"]):
            fabs = os.path.abspath(f)
            cart_tool_out = os.path.join(outdir, "tools_output", cart["name"])
            os.makedirs(cart_tool_out, exist_ok=True)
            print(f"[{cart['name']}] {len(cart.get('files', []))} file, "
                  f"{len(cart.get('odi_exports', []))} export ODI, "
                  f"{len(cart.get('file_docs', []))} xml classificati", flush=True)
            # Scheda inventario istantanea per OGNI file ODI (anche in fast).
            _write_odi_inventory_docs(cart, cart_tool_out)
            _write_bpmn_inventory_docs(cart, cart_tool_out)
            _write_contract_inventory_docs(cart, fabs, cart_tool_out)
            if os.path.exists(TOOLS["soa_cli"]):
                with tempfile.TemporaryDirectory(prefix="soa_") as tmp:
                    reg = os.path.join(tmp, "registry.json")
                    res = run_tool([sys.executable, TOOLS["soa_cli"], "scan", fabs,
                                    "--output", reg], 120)
                    entry = {"folder": cart["name"], "tool": "soa_scan", **res}
                    if res["status"] == "ok":
                        try:
                            with open(reg, encoding="utf-8") as fh:
                                regd = json.load(fh)
                            entry["counts"] = {"total": regd.get("total", 0),
                                               "by_type": regd.get("by_type", {})}
                        except Exception:
                            pass
                    tool_runs.append(entry)
            else:
                tool_runs.append({"folder": cart["name"], "tool": "soa_scan",
                                  "status": "skipped", "detail": "soa_cli assente"})
            # ODI full-parser: UN run per export entro budget (i piu' piccoli
            # prima); gli altri hanno la scheda inventario (mai buchi).
            # Completa a 10k: run in PARALLELO (workers), progress nel log,
            # ledger deterministico; un export fallito non ferma gli altri.
            if cart.get("odi_exports"):
                if os.path.exists(TOOLS["odi_documenter"]) and (odi_budget is None or odi_budget > 0):
                    ordered = sorted(cart["odi_exports"],
                                     key=lambda e: _file_size(fabs, e["file"]))
                    todo = ordered if odi_budget is None else ordered[:odi_budget]
                    skipped = ordered[len(todo):]
                    jobs = []
                    for exp in todo:
                        stem = safe_name(os.path.splitext(
                            os.path.basename(exp["file"]))[0])
                        odi_out = os.path.join(cart_tool_out, "odi", stem)
                        jobs.append((TOOLS["odi_documenter"], exp["file"],
                                     os.path.join(fabs, exp["file"]),
                                     odi_out, tmo))
                    print(f"[{cart['name']}] odi_doc full: {len(jobs)} export, "
                          f"{workers} workers…", flush=True)
                    for got in _run_odi_parallel(cart["name"], jobs, workers):
                        entry = {"folder": cart["name"], "tool": "odi_doc",
                                 **got}
                        if got["status"] == "ok" and got.get("generated"):
                            _record_doc(cart, got["file"],
                                        got["generated"], "odi")
                        tool_runs.append(entry)
                    for exp in skipped:
                        tool_runs.append({"folder": cart["name"], "tool": "odi_doc",
                                          "file": exp["file"], "status": "skipped",
                                          "detail": "fuori budget --max-odi-docs: solo scheda inventario"})
                else:
                    if not os.path.exists(TOOLS["odi_documenter"]):
                        reason = "odi documenter assente"
                    elif odi_budget == 0:
                        reason = "fast mode: solo scheda inventario"
                    else:
                        reason = "budget --max-odi-docs esaurito: solo scheda inventario"
                    tool_runs.append({"folder": cart["name"], "tool": "odi_doc",
                                      "status": "skipped", "detail": reason})
            tool_runs.append({"folder": cart["name"], "tool": "jca", "status": "skipped",
                              "detail": "JCA Studio solo web, niente CLI (AGENT.md §3.6)"})

            cart_tool_out = os.path.join(outdir, "tools_output", cart["name"])
            if heavy and os.path.exists(TOOLS["soa_cli"]):
                has_soa = any(t in cart["tech"] for t in ("wsdl", "xsd", "bpel", "bpmn", "composite", "jca"))
                if has_soa:
                    canon_path = os.path.join(cart_tool_out, "canonical.json")
                    res_an = run_tool([sys.executable, TOOLS["soa_cli"], "analyze", fabs,
                                       "--output", canon_path], tmo)
                    tool_runs.append({"folder": cart["name"], "tool": "soa_analyze", **res_an})
            elif os.path.exists(TOOLS["soa_cli"]) and any(
                    t in cart["tech"] for t in ("wsdl", "xsd", "bpel", "bpmn", "composite", "jca")):
                tool_runs.append({"folder": cart["name"], "tool": "soa_analyze",
                                  "status": "skipped",
                                  "detail": "fast mode: registry da soa_scan, niente analyze"})
            # (ODI gia' eseguito sopra per-ogni-file: niente singolo [0].)
            if heavy and cart.get("lp_files") and os.path.exists(TOOLS["lp_documenter"]):
                # lp_doc_test/run.py NON ha --output-dir: scrive in output/
                # interna al tool. Esegui in modo singolo per LP (cosi
                # --scenarios collega gli scenari di tutte le repo) e copia
                # i .md freschi in tools_output/<repo>/.
                lp_out = os.path.join(os.path.dirname(TOOLS["lp_documenter"]),
                                      "output")
                for lp in cart.get("lp_files", []):
                    lp_abs = os.path.join(fabs, lp["file"])
                    cmd = [sys.executable, TOOLS["lp_documenter"], lp_abs]
                    if scen_all:
                        cmd += ["--scenarios", *scen_all]
                    before = snapshot_mtimes(lp_out)
                    res_lp = run_tool(cmd, tmo)
                    entry_lp = {"folder": cart["name"], "tool": "lp_doc",
                                **res_lp}
                    if res_lp["status"] == "ok":
                        copied = copy_fresh_outputs(lp_out, cart_tool_out,
                                                    before)
                        entry_lp["copied"] = copied
                        _record_doc(cart, lp["file"], copied, "odi-lp")
                        if not copied:
                            entry_lp["status"] = "failed"
                            entry_lp["detail"] = (
                                "tool ok ma nessun *_LOADPLAN.md copiato "
                                f"da {lp_out}")
                    tool_runs.append(entry_lp)
                # Scenari orfani: MAI richiamati da nessuno step di nessun LP
                # del cliente -> SCENARIO_<nome>.md in odi/scenari/, esplicito.
                _write_orphan_scenarios(cart, cart_tool_out, tool_runs)
            elif cart.get("lp_files") or cart.get("scen_files"):
                if not heavy and (cart.get("lp_files") or cart.get("scen_files")) \
                        and os.path.exists(TOOLS["lp_documenter"]):
                    tool_runs.append({"folder": cart["name"], "tool": "lp_doc",
                                      "status": "skipped",
                                      "detail": "fast mode: scenari in SCENARIO_*.md, niente LOADPLAN"})
                else:
                    tool_runs.append({"folder": cart["name"], "tool": "lp_doc",
                                      "status": "skipped",
                                      "detail": "lp documenter assente"})
                # Anche senza tool: scheda orfani minimale da per-cartella.
                _write_orphan_scenarios(cart, cart_tool_out, tool_runs)
            if heavy and cart.get("bpmn_files") and os.path.exists(TOOLS["bpmn_cli"]):
                # Path ASSOLUTO: il tool gira con cwd nella sua src/ (import
                # relativi), un path relativo finirebbe dentro al tool.
                # --recursive + pattern largo: prende anche sottocartelle.
                bpmn_out = os.path.abspath(
                    os.path.join(cart_tool_out, "bpmn_analysis"))
                os.makedirs(bpmn_out, exist_ok=True)
                bpmn_src = os.path.dirname(os.path.dirname(TOOLS["bpmn_cli"]))
                res_bpmn = run_tool(
                    [sys.executable, "-m", "bpmn_reverse_engineer.cli",
                     "analyze", fabs, "--output", bpmn_out,
                     "--recursive", "--pattern", "*.bpmn*"], tmo,
                    cwd=bpmn_src)
                entry_bpmn = {"folder": cart["name"], "tool": "bpmn_doc",
                              **res_bpmn}
                if res_bpmn["status"] == "ok":
                    gen = _list_generated(bpmn_out)
                    entry_bpmn["generated"] = gen
                    for bf in cart.get("bpmn_files", []):
                        _record_doc(cart, bf, gen, "bpmn")
                tool_runs.append(entry_bpmn)
            elif cart.get("bpmn_files"):
                tool_runs.append({"folder": cart["name"], "tool": "bpmn_doc",
                                  "status": "skipped",
                                  "detail": "fast mode: BPMN in per-cartella (start event), niente analyze"
                                  if not heavy else "bpmn reverse-engineer assente"})
            # BPEL per-file: parser + grafo invoke (stdlib, niente dipendenze).
            # Itera il router (kind bpel), non solo l'estensione .bpel
            # (es. SCA-INF/bpel/*/Model.xml).
            bpel_targets = [fd["file"] for fd in cart.get("file_docs", [])
                            if fd.get("kind") == "bpel" and not fd.get("doc")]
            if bpel_targets:
                bpel_out = os.path.join(cart_tool_out, "bpel")
                os.makedirs(bpel_out, exist_ok=True)
                for bf in bpel_targets:
                    try:
                        info = parse_bpel(os.path.join(fabs, bf))
                        stem = safe_name(info.get("process") or
                                         os.path.splitext(os.path.basename(bf))[0])
                        md_name = f"BPEL_{stem}.md"
                        # Evita collisioni tra omonimi in dir diverse.
                        if os.path.exists(os.path.join(bpel_out, md_name)):
                            stem2 = safe_name(bf.replace("/", "_"))
                            md_name = f"BPEL_{stem2}.md"
                        with open(os.path.join(bpel_out, md_name), "w",
                                  encoding="utf-8") as fh:
                            fh.write(bpel_markdown(info, bf))
                        _record_doc(cart, bf, [f"bpel/{md_name}"], "bpel")
                        tool_runs.append({"folder": cart["name"], "tool": "bpel_doc",
                                          "file": bf, "status": "ok",
                                          "detail": f"{len(info.get('invokes', []))} invoke, "
                                                    f"{len(info.get('partner_links', []))} partnerLink"})
                    except Exception as e:
                        tool_runs.append({"folder": cart["name"], "tool": "bpel_doc",
                                          "file": bf, "status": "failed",
                                          "detail": f"{type(e).__name__}: {e}"[:300]})
            # XML non riconosciuti: doc generica leggera .md (mai buco).
            for fd in cart.get("file_docs", []):
                if fd.get("kind") in ("other-xml", "unknown") and not fd.get("doc"):
                    try:
                        info = generic_xml_summary(os.path.join(fabs, fd["file"]))
                        stem = safe_name(os.path.splitext(fd["file"])[0].replace("/", "_"))
                        xml_out = os.path.join(cart_tool_out, "xml")
                        os.makedirs(xml_out, exist_ok=True)
                        md_name = f"XML_{stem}.md"
                        with open(os.path.join(xml_out, md_name), "w",
                                  encoding="utf-8") as fh:
                            fh.write(generic_xml_markdown(info, fd["file"]))
                        _record_doc(cart, fd["file"], [f"xml/{md_name}"],
                                    fd.get("kind", "other-xml"))
                    except Exception:
                        pass
    payload = {
        "client": client,
        "created": per["created"],
        "outdir": os.path.abspath(outdir),
        "folders": [os.path.abspath(f) for f in args.folders],
        "tools": tools,
        "tool_runs": tool_runs,
        "note": "F1: inventario + ledger tool reali (ok/failed/skipped onesti); JCA senza CLI (arricchito via port TS), LP con scenari cross-repo.",
    }
    dest = os.path.join(outdir, "collect.json")
    with open(dest, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, ensure_ascii=False)
    dest_per = os.path.join(outdir, "per-cartella.json")
    for cart in per.get("cartelle", []):
        cart.pop("_doc_index", None)  # indice runtime O(1), mai nel JSON
    with open(dest_per, "w", encoding="utf-8") as fh:
        json.dump(per, fh, indent=2, ensure_ascii=False)
    print(f"ok: client '{client}' -> {dest} + {dest_per}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
