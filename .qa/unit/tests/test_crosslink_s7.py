# data: 2026-09-17 · categoria: unit · sorgente: multirepo/crosslink.py
# TDD I2.5: S7 entita condivise (stessa tabella SCHEMA.TABELLA in >=2 cartelle).
"""Unit: S7 DWH.FACT_ORDERS tra MAP_Orders e MAP_Ship (reale, niente mock)."""
from __future__ import annotations

import json
import os
from conftest import run
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
XLINK = os.path.join(ROOT, "dossier-clienti", "clientone", "crosslink.json")


def test_crosslink_s7_entita_condivisa():
    r = run(
        [sys.executable, "multirepo/crosslink.py", "--client", "clientone", "--ignore-git",
         "fixtures/repo-a", "fixtures/repo-b", "fixtures/repo-c"],
        capture_output=True, text=True, cwd=ROOT, timeout=60,
    )
    assert r.returncode == 0, r.stderr
    with open(XLINK, encoding="utf-8") as fh:
        data = json.load(fh)
    kinds = {(e["da"], e["a"], e["tipo"]) for e in data["edges"]}
    assert ("repo-a", "repo-b", "entita-condivise") in kinds
    s7 = next(e for e in data["edges"] if e["tipo"] == "entita-condivise")
    assert s7["grado"] == "🔍 indizio"
    assert any("DWH.FACT_ORDERS" in p for p in s7["prove"])
