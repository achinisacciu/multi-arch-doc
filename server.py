"""server.py — backend locale minimale (stdlib-only) per frontend Vite.

Serve la UI + API JSON su 127.0.0.1 (default porta 8091):
  GET  /                    -> frontend/dist/index.html (build) o frontend/index.html (dev)
  GET  /assets/...          -> file statici da frontend/dist (prod)
  GET  /api/health          -> {ok} (pill stato nel frontend)
  GET  /api/browse?path=... -> {path, parent, dirs[]} (solo cartelle, max 200)
  POST /api/run {client, folders[]} -> {ok, log, crosslink} (pipeline su
      path già presenti sul PC, via sottoprocessi a lista args mai shell)
  POST /api/run-upload {client, uploads[], paths[]} -> {ok, log, crosslink}
      (le cartelle trascinate nel browser arrivano come CONTENUTO — il browser
      non espone mai i path assoluti — e vengono materializzate in una
      workspace temporanea; `paths` opzionali per repo enormi già sul PC.
      uploads[] accetta {name, files[]} inline oppure {uploadId} da sessione)
  POST /api/upload-start {client, name} -> {uploadId, name}
  POST /api/upload-chunk {uploadId, files[]} -> {ok, received}
      (cartelle grandi: invio a chunk senza tetti di numero/dimensione —
      ricorsione totale, nessuna cartella esclusa)

Uso:
  python server.py [--port 8091]
  apri http://127.0.0.1:8091            # prod (dopo `npm run build` in frontend/)
  # oppure in dev: `npm run dev` in frontend/ -> http://127.0.0.1:5173 (proxy /api)
"""
from __future__ import annotations

import argparse
import json
import mimetypes
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.abspath(os.path.dirname(__file__))
API_VERSION = 6  # il frontend lo controlla: backend vecchio = risposte HTML/404
FRONTEND_DIR = os.path.join(ROOT, "frontend")
FRONTEND_DEV = os.path.join(FRONTEND_DIR, "index.html")
DIST_DIR = os.path.join(FRONTEND_DIR, "dist")
DIST_INDEX = os.path.join(DIST_DIR, "index.html")
MAX_DIRS = 200
# Workspace per cartelle trascinate (contenuto via browser, mai path assoluti).
# Nessun tetto sul contenuto: ricorsione totale, nessuna cartella esclusa.
# L'unico tetto resta UPLOAD_MAX_BODY per singola richiesta HTTP (trasporto):
# le cartelle grandi viaggiano a chunk (upload-start / upload-chunk).
UPLOAD_BASE = os.path.join(tempfile.gettempdir(), "opencode", "dossier-uploads")
UPLOAD_MAX_BODY = 64 * 1024 * 1024
UPLOAD_SESSIONS: dict[str, dict] = {}  # uploadId -> {client, dir, name, seen[]}
STALE_AFTER_S = 24 * 3600  # i run dimenticati si eliminano dopo 24h
SAFE_CLIENT_RE = re.compile(r"[A-Za-z0-9_-]{1,64}\Z")
# Nomi che Windows rifiuta: la repo reale può contenerli (arrivano via browser
# da cartelle ovunque) — si sanificano, mai 500/connessione caduta per questo.
ILLEGAL_SEG_RE = re.compile(r'[<>:"|?*\x00-\x1f]')
WINDOWS_RESERVED = frozenset(
    {"con", "prn", "aux", "nul",
     *(f"com{i}" for i in range(1, 10)), *(f"lpt{i}" for i in range(1, 10))}
)


def list_dirs(path: str | None) -> dict:
    if not path:
        roots = [f"{c}:\\" for c in "CDEFGH" if os.path.isdir(f"{c}:\\")]
        for p in [ROOT, os.path.expanduser("~")]:
            if p and p not in roots and os.path.isdir(p):
                roots.append(p)
        return {"path": "", "parent": "", "dirs": sorted(roots)}
    if not os.path.isabs(path):
        path = os.path.join(ROOT, path)
    path = os.path.abspath(path)
    try:
        entries = sorted(
            d for d in os.listdir(path)
            if os.path.isdir(os.path.join(path, d)))[:MAX_DIRS]
    except OSError as e:
        return {"path": path, "parent": "", "dirs": [], "error": str(e)}
    return {"path": path, "parent": os.path.dirname(path), "dirs": entries}


def _safe_rel(path: str | None) -> str:
    """Valida un path relativo dentro la workspace (niente traversal/assoluti)."""
    if not isinstance(path, str) or not path or len(path) > 500:
        raise ValueError(f"path non valido: {path!r}")
    norm = os.path.normpath(path.replace("\\", "/"))
    if norm.startswith(("/", "../")) or norm in (".", "..") or "/../" in norm:
        raise ValueError(f"path non consentito: {path!r}")
    return norm


def _sanitize_seg(seg: str) -> str:
    """Rende un segmento scrivibile su Windows (repo reali: ? : CON punti finali…)."""
    seg = ILLEGAL_SEG_RE.sub("_", seg).strip().rstrip(".")
    if not seg or len(seg) > 200:
        raise ValueError(f"nome file non valido: {seg!r}")
    if seg.split(".")[0].lower() in WINDOWS_RESERVED:
        seg = "_" + seg
    return seg


def _check_name(name: str | None) -> str:
    name = str(name or "").strip()
    if not name or len(name) > 80 or re.search(r'[\\/:\x00-\x1f]', name) or name in (".", ".."):
        raise ValueError(f"nome cartella non valido: {name!r}")
    return name


def _alloc_dir(base: str, name: str, used: set) -> str:
    """Dir univoca nel run (dedupe _2, _3…); riuso pulito tra run diversi."""
    cand, n = name, 2
    while cand in used:
        cand = f"{name}_{n}"
        n += 1
    used.add(cand)
    dest = os.path.join(base, cand)
    shutil.rmtree(dest, ignore_errors=True)
    os.makedirs(dest, exist_ok=True)
    return dest


def _fresh_run_dir(client: str) -> str:
    """Workspace usa-e-getta per UN run: gli upload si dimenticano tra un
    run e l'altro (mai suffissi _2/_3 per la stessa cartella ricaricata).
    Elimina run/staging precedenti piu vecchi di STALE_AFTER_S."""
    if not SAFE_CLIENT_RE.fullmatch(client or ""):
        raise ValueError("nome cliente non valido (solo lettere/numeri/_/-)")
    base = os.path.join(UPLOAD_BASE, client)
    os.makedirs(base, exist_ok=True)
    now = time.time()
    for n in os.listdir(base):
        if not (n.startswith("run_") or n.startswith(".stage_")):
            continue
        p = os.path.join(base, n)
        try:
            if now - os.path.getmtime(p) > STALE_AFTER_S:
                shutil.rmtree(p, ignore_errors=True)
        except OSError:
            pass
    for uid in [u for u, s in UPLOAD_SESSIONS.items()
                if not os.path.isdir(s.get("dir", ""))]:
        UPLOAD_SESSIONS.pop(uid, None)
    run = os.path.join(base, "run_" + uuid.uuid4().hex[:8])
    os.makedirs(run, exist_ok=True)
    return run


def _materialize_into(run: str, uploads: list, used: set) -> list:
    """Scrive gli upload inline dentro una run dir (nomi sempre originali)."""
    dirs: list[str] = []
    for u in uploads:
        dest = _alloc_dir(run, _check_name((u or {}).get("name")), used)
        _write_upload_files(dest, (u or {}).get("files") or [], set())
        dirs.append(dest)
    return dirs
    """Dir univoca nel run (dedupe _2, _3…); riuso pulito tra run diversi."""
    cand, n = name, 2
    while cand in used:
        cand = f"{name}_{n}"
        n += 1
    used.add(cand)
    dest = os.path.join(base, cand)
    shutil.rmtree(dest, ignore_errors=True)
    os.makedirs(dest, exist_ok=True)
    return dest


def _write_upload_files(dest: str, files: list, seen: set) -> int:
    """Scrive files[{path (relativo), content (testo)}] in dest. Senza tetti
    di numero/dimensione: solo validazione traversal + sanitizzazione Windows.
    Ritorna gli scritti. Lancia ValueError se input non valido."""
    n = 0
    for f in files or []:
        rel = _safe_rel((f or {}).get("path"))
        rel = "/".join(_sanitize_seg(s) for s in rel.split("/"))
        content = (f or {}).get("content")
        if not isinstance(content, str):
            raise ValueError(f"«{rel}»: contenuto non testuale")
        full = os.path.normpath(os.path.join(dest, rel))
        if full != dest and not full.startswith(dest + os.sep):
            raise ValueError(f"path fuori workspace: {rel!r}")
        if full in seen:  # collisioni da sanitizzazione (a?b vs a:b)
            stem, dot, ext = full.rpartition(".")
            if not stem or os.sep in ext:
                stem, dot, ext = full, "", ""
            i = 2
            while f"{stem}_{i}{dot}{ext}" in seen:
                i += 1
            full = f"{stem}_{i}{dot}{ext}"
        seen.add(full)
        try:
            os.makedirs(os.path.dirname(full) or dest, exist_ok=True)
            with open(full, "w", encoding="utf-8") as fh:
                fh.write(content)
        except OSError as e:
            raise ValueError(f"«{rel}»: non scrivibile ({e})")
        n += 1
    return n


def materialize_uploads(client: str, uploads: list, used: set | None = None) -> list:
    """Scrive il contenuto trascinato inline in workspace temporanea usa-e-getta.

    Ogni run ha una dir propria: ricaricare la stessa cartella non produce
    mai suffissi _2/_3 (il dedupe resta solo dentro lo stesso run).
    Ogni upload: {name, files[{path, content}]}. Lancia ValueError se non valido.
    """
    if not SAFE_CLIENT_RE.fullmatch(client or ""):
        raise ValueError("nome cliente non valido (solo lettere/numeri/_/-)")
    if not uploads:
        raise ValueError("nessuna cartella caricata")
    return _materialize_into(_fresh_run_dir(client), uploads,
                             set() if used is None else used)


def run_pipeline(client: str, folders: list, fast: bool = False,
                 timeout_s: int = 1800, max_odi_docs: int | None = None) -> dict:
    """Pipeline collect -> crosslink -> report, anti-timeout fino a 10.000 XML.

    timeout_s e' PER STEP (default 30min): con 10k XML lo step collect resta
    il piu lungo ma non viene ucciso; il frontend scala il timeout coi file.
    """
    log: list[str] = []
    env = dict(os.environ, PYTHONUTF8="1", PYTHONIOENCODING="utf-8")
    collect_cmd = [sys.executable, "multirepo/collect.py", "--client", client,
                   "--folders", *folders]
    if fast:
        collect_cmd.append("--fast")
    if max_odi_docs is not None:
        collect_cmd += ["--max-odi-docs", str(max_odi_docs)]
    steps = [
        collect_cmd,
        [sys.executable, "multirepo/crosslink.py", "--client", client, *folders],
        [sys.executable, "multirepo/report.py", "--client", client],
    ]
    for cmd in steps:
        log.append("$ " + " ".join(cmd))
        t0 = time.monotonic()
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, cwd=ROOT,
                               timeout=timeout_s, encoding="utf-8", errors="replace", env=env)
        except Exception as e:
            return {"ok": False, "log": "\n".join(log + [f"ERRORE: {e}"])}
        log.append(r.stdout[-4000:] + r.stderr[-4000:])
        log.append(f"(exit {r.returncode}, {time.monotonic() - t0:.1f}s)")
        if r.returncode != 0:
            return {"ok": False, "log": "\n".join(log)}
    xlink = os.path.join(ROOT, "dossier-clienti", client, "crosslink.json")
    try:
        with open(xlink, encoding="utf-8") as fh:
            crosslink = json.load(fh)
    except Exception as e:
        return {"ok": False, "log": "\n".join(log + [f"crosslink.json illeggibile: {e}"])}
    return {"ok": True, "log": "\n".join(log), "crosslink": crosslink}


def _run_opts(data: dict) -> dict:
    """Opzioni run dal body JSON: fast, timeout_s (60..43200), max_odi_docs.

    Default 1800s per step; tetto 12h: la completa su 10.000 XML gira
    senza limite di tempo (l'utente aspetta quanto serve).
    """
    try:
        timeout_s = int(data.get("timeout_s") or data.get("timeout") or 1800)
    except (TypeError, ValueError):
        timeout_s = 1800
    timeout_s = max(60, min(43200, timeout_s))
    try:
        max_odi = data.get("max_odi_docs")
        max_odi = None if max_odi is None else max(0, int(max_odi))
    except (TypeError, ValueError):
        max_odi = None
    return {"fast": bool(data.get("fast", True)),
            "timeout_s": timeout_s, "max_odi_docs": max_odi}


class Handler(BaseHTTPRequestHandler):
    server_version = "ClientDossier/0.1"
    # Keep-alive: con N chunk di fila evita il churn di socket (e i RST
    # del proxy quando il client sta ancora inviando e noi abbiamo risposto).
    protocol_version = "HTTP/1.1"

    def _drain(self):
        """Consuma il body non letto: rispondere con body pendente + close
        genera RST e il proxy Vite logga `write ECONNABORTED`."""
        try:
            ln = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            return
        left = ln
        try:
            while left > 0:
                blob = self.rfile.read(min(left, 1024 * 1024))
                if not blob:
                    break
                left -= len(blob)
        except Exception:
            pass

    def _json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_file(self, abs_path: str):
        try:
            with open(abs_path, "rb") as fh:
                body = fh.read()
        except OSError as e:
            self.send_error(404, str(e))
            return
        ctype, _ = mimetypes.guess_type(abs_path)
        if abs_path.endswith(".js"):
            ctype = "text/javascript; charset=utf-8"
        elif ctype is None:
            ctype = "application/octet-stream"
        elif ctype.startswith("text/") and "charset" not in ctype:
            ctype += "; charset=utf-8"
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _index_file(self) -> str:
        # Prod (build Vite) se presente, altrimenti sorgente dev.
        if os.path.isfile(DIST_INDEX):
            return DIST_INDEX
        return FRONTEND_DEV

    def do_GET(self):
        from urllib.parse import urlparse, parse_qs, unquote
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            self._json({"ok": True, "api": API_VERSION})
            return
        if parsed.path.startswith("/api/browse"):
            q = parse_qs(parsed.query)
            self._json(list_dirs((q.get("path") or [""])[0]))
            return
        if parsed.path == "/api/download-zip":
            q = parse_qs(parsed.query)
            client = (q.get("client") or ["clientone"])[0].strip() or "clientone"
            if not SAFE_CLIENT_RE.fullmatch(client):
                self._json({"ok": False, "log": "nome cliente non valido"}, 400)
                return
            zip_cand = os.path.join(ROOT, "dossier-clienti", client, f"{client}_documentazione.zip")
            if not os.path.isfile(zip_cand):
                try:
                    from multirepo.doc_packager import package_documentation
                    zip_cand = package_documentation(client, os.path.join(ROOT, "dossier-clienti"))
                except Exception as e:
                    self._json({"ok": False, "log": f"zip non disponibile: {e}"}, 404)
                    return
            if not os.path.isfile(zip_cand):
                self._json({"ok": False, "log": "file zip non trovato"}, 404)
                return
            try:
                with open(zip_cand, "rb") as fh:
                    body = fh.read()
                self.send_response(200)
                self.send_header("Content-Type", "application/zip")
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Content-Disposition", f'attachment; filename="{os.path.basename(zip_cand)}"')
                self.end_headers()
                self.wfile.write(body)
            except Exception as e:
                self._json({"ok": False, "log": f"errore download zip: {e}"}, 500)
            return
        if parsed.path.startswith("/api/"):
            self.send_error(404)
            return
        if parsed.path in ("/", ""):
            self._send_file(self._index_file())
            return
        # Statico da frontend/dist (solo prod); niente traversal.
        rel = unquote(parsed.path.lstrip("/"))
        cand = os.path.normpath(os.path.join(DIST_DIR, rel))
        if cand == DIST_DIR or not cand.startswith(DIST_DIR + os.sep):
            self.send_error(404)
            return
        if os.path.isfile(cand):
            self._send_file(cand)
            return
        # Fallback SPA: route senza estensione -> index.
        if "." not in os.path.basename(rel):
            self._send_file(self._index_file())
            return
        self.send_error(404)

    def do_POST(self):
        from urllib.parse import urlparse
        route = urlparse(self.path).path
        if route not in ("/api/run", "/api/run-upload",
                         "/api/upload-start", "/api/upload-chunk"):
            self._drain()
            self.send_error(404)
            return
        try:
            ln = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            ln = 0
        if ln > UPLOAD_MAX_BODY:
            # Prima consuma il body, altrimenti il client (via proxy Vite)
            # prende RST -> `http proxy error: ECONNABORTED` e fetch fallita.
            self._drain()
            self._json({"ok": False, "log": "richiesta troppo grande (max 64 MB per invio: le cartelle grandi viaggiano a chunk)"}, 413)
            return
        try:
            data = json.loads(self.rfile.read(ln).decode("utf-8") or "{}")
        except Exception as e:
            self._json({"ok": False, "log": f"richiesta non valida: {e}"}, 400)
            return
        client = str(data.get("client") or "clientone").strip() or "clientone"
        if route == "/api/upload-start":
            # Apre una sessione di upload a chunk (cartelle grandi, senza tetti).
            # Staging anonimo per uid: il nome originale si assegna solo al run.
            try:
                if not SAFE_CLIENT_RE.fullmatch(client):
                    raise ValueError("nome cliente non valido")
                name = _check_name(data.get("name"))
                base = os.path.join(UPLOAD_BASE, client)
                os.makedirs(base, exist_ok=True)
                uid = uuid.uuid4().hex[:16]
                stage = os.path.join(base, ".stage_" + uid)
                shutil.rmtree(stage, ignore_errors=True)
                os.makedirs(stage, exist_ok=True)
                UPLOAD_SESSIONS[uid] = {"client": client, "dir": stage,
                                        "name": name, "seen": set()}
                self._json({"uploadId": uid, "name": name})
            except ValueError as e:
                self._json({"ok": False, "log": f"upload non valido: {e}"}, 400)
            except Exception as e:  # mai connessione caduta: sempre JSON
                import traceback
                traceback.print_exc()  # causa visibile nel terminale server
                try:
                    self._json({"ok": False, "log": f"errore interno: {e}"}, 500)
                except Exception:
                    pass
            return
        if route == "/api/upload-chunk":
            # Un chunk di file per una sessione aperta.
            try:
                sess = UPLOAD_SESSIONS.get(str(data.get("uploadId") or ""))
                if sess is None:
                    raise ValueError("sessione scaduta: ritrascina la cartella")
                n = _write_upload_files(sess["dir"], data.get("files") or [], sess["seen"])
                self._json({"ok": True, "received": n})
            except ValueError as e:
                self._json({"ok": False, "log": f"upload non valido: {e}"}, 400)
            except Exception as e:  # mai connessione caduta: sempre JSON
                import traceback
                traceback.print_exc()  # causa visibile nel terminale server
                try:
                    self._json({"ok": False, "log": f"errore interno: {e}"}, 500)
                except Exception:
                    pass
            return
        if route == "/api/run-upload":
            # Cartelle da ovunque: contenuto via browser (inline o sessioni
            # a chunk) + path server opzionali.
            uploads = data.get("uploads") or []
            paths = [f for f in (data.get("paths") or [])
                     if isinstance(f, str) and f.strip()]
            if not uploads and not paths:
                self._json({"ok": False, "log": "trascina almeno una cartella"}, 400)
                return
            if any(not os.path.isdir(f) for f in paths):
                self._json({"ok": False, "log": "un path server non esiste o non è leggibile"}, 400)
                return
            try:
                run = _fresh_run_dir(client)
                used: set = set()
                folders: list[str] = []
                inline = []
                for u in uploads:
                    if isinstance(u, dict) and u.get("uploadId"):
                        sess = UPLOAD_SESSIONS.pop(str(u["uploadId"]), None)
                        if sess is None:
                            raise ValueError("sessione scaduta: ritrascina la cartella")
                        # Dallo staging anonimo alla run dir col nome originale.
                        dest = _alloc_dir(run, _check_name(sess.get("name")), used)
                        try:
                            for n in os.listdir(sess["dir"]):
                                shutil.move(os.path.join(sess["dir"], n),
                                            os.path.join(dest, n))
                        except OSError as e:
                            raise ValueError(f"staging illeggibile: {e}")
                        shutil.rmtree(sess["dir"], ignore_errors=True)
                        folders.append(dest)
                    else:
                        inline.append(u)
                if inline:
                    folders = _materialize_into(run, inline, used) + folders
                folders += paths
                self._json(run_pipeline(client, folders, **_run_opts(data)))
            except ValueError as e:
                self._json({"ok": False, "log": f"upload non valido: {e}"}, 400)
            except Exception as e:  # mai connessione caduta: sempre JSON
                import traceback
                traceback.print_exc()  # causa visibile nel terminale server
                try:
                    self._json({"ok": False, "log": f"errore interno: {e}"}, 500)
                except Exception:
                    pass
            return
        folders = [f for f in (data.get("folders") or []) if isinstance(f, str) and f.strip()]
        if len(folders) < 1:
            self._json({"ok": False, "log": "seleziona almeno una cartella"}, 400)
            return
        if any(not os.path.isdir(f) for f in folders):
            self._json({"ok": False, "log": "una cartella non esiste o non è leggibile"}, 400)
            return
        try:
            self._json(run_pipeline(client, folders, **_run_opts(data)))
        except Exception as e:  # mai connessione caduta: sempre JSON
            self._json({"ok": False, "log": f"errore interno: {e}"}, 500)

    def log_message(self, *a):
        pass  # silenzioso; il log vero torna nel JSON di /api/run


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="Backend locale Client Dossier (stdlib).")
    p.add_argument("--host", default="127.0.0.1", help="Host da ascoltare (default 127.0.0.1)")
    p.add_argument("--port", type=int, default=8091)
    args = p.parse_args(argv)
    srv = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"Client Dossier su http://{args.host}:{args.port} (Ctrl+C per fermare)")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
