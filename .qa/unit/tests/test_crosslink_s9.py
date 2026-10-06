# data: 2026-09-17 · categoria: unit · sorgente: multirepo/crosslink.py
# TDD T3.4: segnale S9 orchestrazione condivisa (stesso scenario in >=2 cartelle).
"""Unit: S9 scenario condiviso tra repo-a e repo-b (reale, niente mock)."""
from __future__ import annotations

import json
import os
from conftest import run
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
XLINK = os.path.join(ROOT, "dossier-clienti", "clientone", "crosslink.json")


def test_crosslink_s9_scenario_condiviso():
    r = run(
        [sys.executable, "multirepo/crosslink.py", "--client", "clientone", "--ignore-git",
         "fixtures/repo-a", "fixtures/repo-b", "fixtures/repo-c"],
        capture_output=True, text=True, cwd=ROOT, timeout=60,
    )
    assert r.returncode == 0, r.stderr
    with open(XLINK, encoding="utf-8") as fh:
        data = json.load(fh)
    kinds = {(e["da"], e["a"], e["tipo"]) for e in data["edges"]}
    assert ("repo-a", "repo-b", "orchestrazione-condivisa") in kinds
    s9 = next(e for e in data["edges"] if e["tipo"] == "orchestrazione-condivisa")
    assert s9["grado"] == "🔶 probabile"
    assert any("SCEN_SHARED" in p for p in s9["prove"])
