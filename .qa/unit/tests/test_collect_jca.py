# data: 2026-09-17 · categoria: unit · sorgente: multirepo/collect.py
# TDD T3.1: sniff contenuto .jca (nome adapter + operation), non solo estensione.
"""Unit: collect estrae OrderDb/selectEmployees dal .jca (reale, niente mock)."""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", ".qa", "unit", "tests"))
from conftest import run

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
PER = os.path.join(ROOT, "dossier-clienti", "clientone", "per-cartella.json")


def test_collect_sniff_jca():
    r = run([sys.executable, "multirepo/collect.py", "--client", "clientone",
             "--folders", "fixtures/repo-a", "fixtures/repo-b", "fixtures/repo-c"])
    assert r.returncode == 0, r.stderr
    with open(PER, encoding="utf-8") as fh:
        data = json.load(fh)
    repo_c = next(c for c in data["cartelle"] if c["name"] == "repo-c")
    assert "jca" in repo_c["tech"]
    adapters = repo_c.get("jca_adapters", [])
    assert any(a.get("name") == "OrderDb" and "selectEmployees" in a.get("operations", [])
               for a in adapters)
