# data: 2026-09-17 · categoria: unit · sorgente: multirepo/crosslink.py
# TDD I2.4: S4 chiamate rete (URL con porta di A = porta dichiarata da B).
"""Unit: S4 repo-a -> repo-b sulla porta 8080 (reale, niente mock)."""
from __future__ import annotations

import json
import os
from conftest import run
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
XLINK = os.path.join(ROOT, "dossier-clienti", "clientone", "crosslink.json")


def test_crosslink_s4_chiamata_rete():
    r = run(
        [sys.executable, "multirepo/crosslink.py", "--client", "clientone", "--ignore-git",
         "fixtures/repo-a", "fixtures/repo-b", "fixtures/repo-c"],
        capture_output=True, text=True, cwd=ROOT, timeout=60,
    )
    assert r.returncode == 0, r.stderr
    with open(XLINK, encoding="utf-8") as fh:
        data = json.load(fh)
    kinds = {(e["da"], e["a"], e["tipo"]) for e in data["edges"]}
    assert ("repo-a", "repo-b", "chiamate-rete") in kinds
    s4 = next(e for e in data["edges"] if e["tipo"] == "chiamate-rete")
    assert s4["grado"] == "🔶 probabile"
    prove = " ".join(s4["prove"])
    assert "8080" in prove and "service.properties" in prove and "server.properties" in prove
