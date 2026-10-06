# data: 2026-09-17 · categoria: unit · sorgente: multirepo/collect.py
# TDD T3.2+T3.3: rilevamento ODI export + LoadPlan/Scenari in per-cartella.json.
"""Unit: collect classifica export ODI e LoadPlan/Scenari (reale, niente mock)."""
from __future__ import annotations

import json
import os
from conftest import run
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
PER = os.path.join(ROOT, "dossier-clienti", "clientone", "per-cartella.json")


def _collect():
    r = run(
        [sys.executable, "multirepo/collect.py", "--client", "clientone",
         "--folders", "fixtures/repo-a", "fixtures/repo-b", "fixtures/repo-c"],
        capture_output=True, text=True, cwd=ROOT, timeout=60,
    )
    assert r.returncode == 0, r.stderr
    with open(PER, encoding="utf-8") as fh:
        return json.load(fh)


def test_collect_rileva_mapping_odi():
    data = _collect()
    repo_a = next(c for c in data["cartelle"] if c["name"] == "repo-a")
    exports = repo_a.get("odi_exports", [])
    names = [m["name"] for e in exports for m in e.get("mappings", [])]
    assert "MAP_Orders" in names


def test_collect_classifica_loadplan_e_scenari():
    data = _collect()
    by_name = {c["name"]: c for c in data["cartelle"]}
    lp_b = by_name["repo-b"].get("lp_files", [])
    assert any(e.get("file") == "LoadPlan_Main.xml" and "LP_MAIN" in e.get("loadplan_names", [])
               for e in lp_b)
    scen_a = by_name["repo-a"].get("scen_files", [])
    scen_b = by_name["repo-b"].get("scen_files", [])
    assert any("SCEN_SHARED" in s.get("scen_names", []) for s in scen_a)
    assert any("SCEN_SHARED" in s.get("scen_names", []) for s in scen_b)
    assert by_name["repo-c"].get("lp_files", []) == []
    assert by_name["repo-c"].get("scen_files", []) == []
