# data: 2026-09-17 · categoria: unit · sorgente: multirepo/{collect,crosslink,report}.py
# T3.5 guardia: il valore del segreto fixture non deve MAI finire negli output.
"""Unit guardia: nessun segreto in chiaro negli output generati."""
from __future__ import annotations

import os
from conftest import run
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
OUTDIR = os.path.join(ROOT, "dossier-clienti", "clientone")
SECRET = "SuperSegreta123"


def test_segreto_mai_negli_output():
    for cmd in (
        [sys.executable, "multirepo/collect.py", "--client", "clientone",
         "--folders", "fixtures/repo-a", "fixtures/repo-b", "fixtures/repo-c"],
        [sys.executable, "multirepo/crosslink.py", "--client", "clientone", "--ignore-git",
         "fixtures/repo-a", "fixtures/repo-b", "fixtures/repo-c"],
        [sys.executable, "multirepo/report.py", "--client", "clientone"],
    ):
        r = run(cmd, capture_output=True, text=True, cwd=ROOT, timeout=60)
        assert r.returncode == 0, r.stderr
    for root, _dirs, files in os.walk(OUTDIR):
        for n in files:
            fp = os.path.join(root, n)
            with open(fp, encoding="utf-8-sig", errors="replace") as fh:
                assert SECRET not in fh.read(), f"segreto in chiaro in {fp}"
