# data: 2026-09-17 · categoria: unit · sorgente: multirepo/crosslink.py
# TDD I2.6: S1 scatta solo se il top git E' una delle cartelle (no contenitore).
"""Unit: senza --ignore-git, fixture nello stesso repo contenitore = niente S1."""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", ".qa", "unit", "tests"))
from conftest import run

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
XLINK = os.path.join(ROOT, "dossier-clienti", "clientone", "crosslink.json")


def test_s1_ignora_repo_contenitore():
    r = run([sys.executable, "multirepo/crosslink.py", "--client", "clientone",
             "fixtures/repo-a", "fixtures/repo-b", "fixtures/repo-c"])
    assert r.returncode == 0, r.stderr
    with open(XLINK, encoding="utf-8") as fh:
        data = json.load(fh)
    tipi = {(e["da"], e["a"], e["tipo"]) for e in data["edges"]}
    assert not [t for t in tipi if t[2] in ("stesso-repo-git", "stesso-remote-git")]
    assert ("repo-a", "repo-b", "import-cross-cartella") in tipi
