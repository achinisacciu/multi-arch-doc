# data: 2026-09-17 · categoria: unit · sorgente: multirepo/collect.py
# TDD I1.4: ledger esecuzione tool reali (ok onesti + skipped motivati, mai crash).
"""Unit: collect esegue SOA scan + ODI csv, salta JCA (niente CLI)."""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", ".qa", "unit", "tests"))
from conftest import run

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
COLL = os.path.join(ROOT, "dossier-clienti", "clientone", "collect.json")


def test_collect_ledger_tool_reali():
    r = run([sys.executable, "multirepo/collect.py", "--client", "clientone",
             "--folders", "fixtures/repo-a", "fixtures/repo-b", "fixtures/repo-c"])
    assert r.returncode == 0, r.stderr
    with open(COLL, encoding="utf-8") as fh:
        data = json.load(fh)
    runs = {(t["folder"], t["tool"]): t for t in data.get("tool_runs", [])}
    soa = runs.get(("repo-a", "soa_scan"))
    assert soa and soa["status"] == "ok" and soa["counts"]["total"] > 0
    # Per-ogni-file: un run odi_doc per export (mai solo [0]), con output salvati.
    odi_runs = [t for t in data["tool_runs"]
                if t["tool"] == "odi_doc" and t["folder"] == "repo-a"]
    assert odi_runs, "nessun run odi_doc per repo-a"
    assert all(t["status"] == "ok" for t in odi_runs)
    assert any(t.get("generated") for t in odi_runs)
    jca = [t for t in data["tool_runs"] if t["tool"] == "jca"]
    assert jca and all(t["status"] == "skipped" for t in jca)
