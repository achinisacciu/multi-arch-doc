# data: 2026-09-17 · categoria: integration-guard · sorgente: pipeline collect→crosslink→report
# T4 characterization: pipeline e2e, isolamento clienti, idempotenza, dry-run pulito.
"""Integration guard: pipeline completa su fixture (reale, niente mock)."""
from __future__ import annotations

import json
import os
from conftest import run
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
BASE = os.path.join(ROOT, "dossier-clienti")
FX = ["fixtures/repo-a", "fixtures/repo-b", "fixtures/repo-c"]


def _run(client, *args):
    r = run([sys.executable, *args], capture_output=True, text=True, cwd=ROOT, timeout=60)
    assert r.returncode == 0, r.stderr
    return r


def _edges(client):
    with open(os.path.join(BASE, client, "crosslink.json"), encoding="utf-8") as fh:
        return json.load(fh)["edges"]


def _sig(edges):
    return sorted((e["da"], e["a"], e["tipo"]) for e in edges)


def test_pipeline_e2e_e_isolamento_clienti():
    _run("x", "multirepo/collect.py", "--client", "clientone", "--folders", *FX)
    _run("x", "multirepo/crosslink.py", "--client", "clientone", "--ignore-git", *FX)
    _run("x", "multirepo/report.py", "--client", "clientone")
    _run("x", "multirepo/collect.py", "--client", "pippo", "--folders", "fixtures/repo-a", "fixtures/repo-c")
    _run("x", "multirepo/crosslink.py", "--client", "pippo", "--ignore-git",
         "fixtures/repo-a", "fixtures/repo-c")
    _run("x", "multirepo/report.py", "--client", "pippo")
    for f in ("CLIENT-REPORT.md", "crosslink.json", "per-cartella.json",
              "crosslink_rules.csv", "master_csv_input_output.csv", "verifica_mapping.txt"):
        assert os.path.exists(os.path.join(BASE, "clientone", f)), f
        assert os.path.exists(os.path.join(BASE, "pippo", f)), f
    assert _edges("pippo") == [], "repo-a vs repo-c devono restare senza evidenze"
    assert any(e[2] == "orchestrazione-condivisa" for e in _sig(_edges("clientone")))


def test_pipeline_idempotente():
    _run("x", "multirepo/crosslink.py", "--client", "clientone", "--ignore-git", *FX)
    first = _sig(_edges("clientone"))
    _run("x", "multirepo/crosslink.py", "--client", "clientone", "--ignore-git", *FX)
    assert _sig(_edges("clientone")) == first


def test_dry_run_non_scrive():
    before = set(os.listdir(os.path.join(BASE, "clientone")))
    _run("x", "multirepo/collect.py", "--client", "clientone", "--folders", *FX, "--dry-run")
    assert set(os.listdir(os.path.join(BASE, "clientone"))) == before
