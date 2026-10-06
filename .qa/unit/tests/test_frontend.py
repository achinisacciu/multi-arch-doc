# data: 2026-09-17 · categoria: unit · sorgente: frontend/ (Vite studio)
# Smoke statico: il front riprogettato ha dropzone cartelle, explorer, analisi, risultati.
"""Smoke: frontend Studio con drag&drop cartelle e moduli (statico)."""
from __future__ import annotations

import json
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
FE = os.path.join(ROOT, "frontend")
HTML = os.path.join(FE, "index.html")
SRC = os.path.join(FE, "src")
PKG = os.path.join(FE, "package.json")
CFG = os.path.join(FE, "vite.config.js")


def _read(p):
    with open(p, encoding="utf-8") as fh:
        return fh.read()


def test_frontend_studio_layout():
    t = _read(HTML)
    for hook in ("dropzone-folders", "folder-cards",
                 "manual-path", "btn-add-path", "btn-browse-server",
                 "btn-pick-native", "native-dir-input",
                 "stepbtn-sources", "stepbtn-run", "stepbtn-results",
                 "step-sources", "step-run", "step-results",
                 "btn-run", "run-status", "runlog",
                 "btn-copy-log", "btn-clear-log", "cmd-panel",
                  "dropzone-crosslink", "result-summary", "matrix",
                  "edge-search", "edge-filter", "edges",
                  "btn-download-zip",
                 "explorer", "explorer-crumbs", "explorer-search",
                 "explorer-list", "explorer-pick", "explorer-close",
                 "backend-status", "toasts",
                 "/src/main.js"):
        assert hook in t, hook


def test_frontend_moduli():
    for mod in ("api.js", "store.js", "dnd.js", "explorer.js", "matrix.js", "main.js", "util.js"):
        assert os.path.isfile(os.path.join(SRC, mod)), mod
    api = _read(os.path.join(SRC, "api.js"))
    for hook in ("/api/browse", "/api/run", "/api/run-upload", "/api/health",
                 "/api/upload-start", "/api/upload-chunk", "/api/download-zip"):
        assert hook in api, hook
    assert "apiDownloadZipUrl" in api
    assert "STALE_BACKEND" in api and "API_WANT" in api
    assert "apiResolve" not in api, "niente più collega-path: solo upload"
    dnd = _read(os.path.join(SRC, "dnd.js"))
    assert "webkitGetAsEntry" in dnd and "getAsFileSystemHandle" in dnd
    assert "collectFolderPayload" in dnd and "inspectHandle" in dnd
    assert "SKIP_DIRS" not in dnd and "MAX_FILES" not in dnd, "nessuna esclusione/tetto"
    matrix = _read(os.path.join(SRC, "matrix.js"))
    assert "gradeClass" in matrix and "renderMatrix" in matrix
    main = _read(os.path.join(SRC, "main.js"))
    assert "dropzone-folders" in main and "dropzone-crosslink" in main
    assert "apiRunUpload" in main and "candidates" not in main
    assert "prepareUpload" in main and "apiUploadChunk" in main
    assert "CHUNK_BYTES" in main and "splitChunks" in main, "chunk limitati in byte (no 413/ECONNABORTED)"
    assert "btn-download-zip" in main and "apiDownloadZipUrl" in main
    assert "backend offline" in main, "pre-check backend con messaggio utile"
    assert "backend da riavviare" in main and "showDirectoryPicker" in main


def test_frontend_vite_config():
    assert os.path.isfile(PKG) and os.path.isfile(CFG)
    with open(PKG, encoding="utf-8") as fh:
        pkg = json.load(fh)
    assert "vite" in pkg.get("devDependencies", {}), "vite in devDependencies"
    assert pkg["scripts"]["build"] == "vite build"
    cfg = _read(CFG)
    assert "/api" in cfg and "8091" in cfg, "proxy /api -> backend 8091"
    assert "backendPlugin" in cfg, "npm run dev auto-avvia server.py"
    plugin = _read(os.path.join(FE, "vite-plugin-backend.js"))
    assert "server.py" in plugin and "api/health" in plugin
    assert "apiWant" in plugin, "plugin rifiuta backend vecchi"
