# data: 2026-09-17 · categoria: unit · sorgente: multirepo/collect.py
# F1 (TDD RED): collect deve scrivere per-cartella.json con inventario reale
# (files rel_path+ext, tech hints, sha256, db refs). Oggi scrive solo collect.json -> RED.
"""Unit: collect inventory per-cartella (comportamento reale su fixtures, niente mock)."""
from __future__ import annotations

import json
import os
from conftest import run
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
OUTBASE = os.path.join(ROOT, "dossier-clienti")
CLIENT = "clientone"
PER_CARTELLA = os.path.join(OUTBASE, CLIENT, "per-cartella.json")


def test_collect_writes_per_cartella_inventory():
    r = run(
        [sys.executable, "multirepo/collect.py", "--client", CLIENT,
         "--folders", "fixtures/repo-a", "fixtures/repo-b"],
        capture_output=True, text=True, cwd=ROOT, timeout=60,
    )
    assert r.returncode == 0, r.stderr
    assert os.path.exists(PER_CARTELLA), "manca per-cartella.json (F1 non implementato)"
    with open(PER_CARTELLA, encoding="utf-8") as fh:
        data = json.load(fh)
    assert data["client"] == CLIENT
    by_name = {c["name"]: c for c in data["cartelle"]}
    assert set(by_name) == {"repo-a", "repo-b"}
    repo_a = by_name["repo-a"]
    rels = {f["rel_path"] for f in repo_a["files"]}
    assert "app.py" in rels
    assert "config.properties" in rels
    exts = {f["ext"] for f in repo_a["files"]}
    assert ".py" in exts
    assert any(f.get("sha256") for f in repo_a["files"]), "serve sha256 per S8"
    assert "python" in repo_a["tech"], "tech hint python atteso in repo-a"
