# data: 2026-09-17 · categoria: unit · sorgente: multirepo/crosslink.py
# TDD I2.3: S2 dipendenze condivise (stesso package, versioni divergenti = rischio).
"""Unit: S2 requests condiviso tra repo-a e repo-b (reale, niente mock)."""
from __future__ import annotations

import json
import os
import sys

from conftest import run

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
XLINK = os.path.join(ROOT, "dossier-clienti", "clientone", "crosslink.json")


def test_crosslink_s2_dipendenza_condivisa():
    r = run(
        [sys.executable, "multirepo/crosslink.py", "--client", "clientone", "--ignore-git",
         "fixtures/repo-a", "fixtures/repo-b", "fixtures/repo-c"],
        capture_output=True, text=True, cwd=ROOT, timeout=60,
    )
    assert r.returncode == 0, r.stderr
    with open(XLINK, encoding="utf-8") as fh:
        data = json.load(fh)
    kinds = {(e["da"], e["a"], e["tipo"]) for e in data["edges"]}
    assert ("repo-a", "repo-b", "dipendenza-condivisa") in kinds
    s2 = next(e for e in data["edges"] if e["tipo"] == "dipendenza-condivisa")
    assert s2["grado"] == "🔶 probabile"
    prove = " ".join(s2["prove"])
    assert "requests" in prove and "2.31.0" in prove and "2.28.0" in prove
    assert "divergenti" in prove
