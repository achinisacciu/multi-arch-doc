# data: 2026-09-17 · categoria: unit · sorgente: server.py
# Backend locale: browse cartelle + pipeline run (reale, niente mock).
"""Test server stdlib: browse HTTP + pipeline su repo-c (reale)."""
from __future__ import annotations

import json
import os
import shutil
import sys
import threading
import urllib.request

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))
from server import Handler, list_dirs, run_pipeline  # noqa: E402
from http.server import ThreadingHTTPServer  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
CLIENT = "__test_fe"


def test_browse_elenca_fixtures():
    d = list_dirs(os.path.join(ROOT, "fixtures"))
    assert {"repo-a", "repo-b", "repo-c"} <= set(d["dirs"])
    assert d["parent"] == ROOT


def test_http_browse():
    srv = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    try:
        url = f"http://127.0.0.1:{srv.server_port}/api/browse?path=" + os.path.join(ROOT, "fixtures")
        with urllib.request.urlopen(url, timeout=15) as r:
            assert r.status == 200
            d = json.loads(r.read().decode("utf-8"))
        assert "repo-a" in d["dirs"]
    finally:
        srv.shutdown()


def test_run_pipeline_repo_c():
    out = os.path.join(ROOT, "dossier-clienti", CLIENT)
    shutil.rmtree(out, ignore_errors=True)
    try:
        res = run_pipeline(CLIENT, [os.path.join(ROOT, "fixtures", "repo-c")])
        assert res["ok"], res["log"][-1000:]
        assert res["crosslink"]["names"] == ["repo-c"]
        assert os.path.exists(os.path.join(out, "CLIENT-REPORT.md"))
    finally:
        shutil.rmtree(out, ignore_errors=True)
