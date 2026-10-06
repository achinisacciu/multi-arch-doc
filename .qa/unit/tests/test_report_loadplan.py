# data: 2026-09-17 · categoria: unit · sorgente: multirepo/report.py
# TDD I3.4: sezione 7 con LoadPlan e scenari da per-cartella.json.
"""Unit: CLIENT-REPORT §7 elenca LP_MAIN e SCEN_SHARED (reale, niente mock)."""
from __future__ import annotations

import os
import sys

from conftest import run

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
OUTDIR = os.path.join(ROOT, "dossier-clienti", "clientone")


def test_report_sezione7_loadplan():
    for cmd in (
        [sys.executable, "multirepo/collect.py", "--client", "clientone",
         "--folders", "fixtures/repo-a", "fixtures/repo-b", "fixtures/repo-c"],
        [sys.executable, "multirepo/crosslink.py", "--client", "clientone", "--ignore-git",
         "fixtures/repo-a", "fixtures/repo-b", "fixtures/repo-c"],
        [sys.executable, "multirepo/report.py", "--client", "clientone"],
    ):
        r = run(cmd, capture_output=True, text=True, cwd=ROOT, timeout=60)
        assert r.returncode == 0, r.stderr
    with open(os.path.join(OUTDIR, "CLIENT-REPORT.md"), encoding="utf-8") as fh:
        text = fh.read()
    assert "## 7." in text and "LP_MAIN" in text and "SCEN_SHARED" in text
