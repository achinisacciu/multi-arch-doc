# data: 2026-09-17 · categoria: unit · sorgente: multirepo/crosslink.py
# RETROFIT: blocca il comportamento F0 verificato (4 archi, repo-c isolata).
"""Unit retrofit: matrice crosslink attesa su fixture (comportamento reale, niente mock)."""
from __future__ import annotations

import json
import os
from conftest import run
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
OUTBASE = os.path.join(ROOT, "dossier-clienti")
CLIENT = "clientone"
XLINK = os.path.join(OUTBASE, CLIENT, "crosslink.json")


def test_crosslink_fixture_matrix_attesa():
    r = run(
        [sys.executable, "multirepo/crosslink.py", "--client", CLIENT, "--ignore-git",
         "fixtures/repo-a", "fixtures/repo-b", "fixtures/repo-c"],
        capture_output=True, text=True, cwd=ROOT, timeout=60,
    )
    assert r.returncode == 0, r.stderr
    with open(XLINK, encoding="utf-8") as fh:
        data = json.load(fh)
    assert data["names"] == ["repo-a", "repo-b", "repo-c"]
    kinds = {(e["da"], e["a"], e["tipo"]) for e in data["edges"]}
    assert ("repo-a", "repo-b", "import-cross-cartella") in kinds
    assert ("repo-a", "repo-b", "db-condiviso") in kinds
    assert ("repo-a", "repo-b", "file-identico") in kinds
    assert ("repo-b", "repo-a", "compose-multi-servizio") in kinds
    assert not [e for e in data["edges"] if "repo-c" in (e["da"], e["a"])]
