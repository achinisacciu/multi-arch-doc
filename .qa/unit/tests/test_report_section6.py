# data: 2026-09-17 · categoria: unit · sorgente: multirepo/report.py
# TDD T4.2: sezione 6 popolata dalle tabelle del master (non placeholder).
"""Unit: CLIENT-REPORT §6 con tabella tabelle (reale, niente mock)."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", ".qa", "unit", "tests"))
from conftest import run

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
OUTDIR = os.path.join(ROOT, "dossier-clienti", "clientone")


def test_report_sezione6_tabelle():
    for cmd in (
        [sys.executable, "multirepo/collect.py", "--client", "clientone",
         "--folders", "fixtures/repo-a", "fixtures/repo-b", "fixtures/repo-c"],
        [sys.executable, "multirepo/report.py", "--client", "clientone"],
    ):
        r = run(cmd)
        assert r.returncode == 0, r.stderr
    with open(os.path.join(OUTDIR, "CLIENT-REPORT.md"), encoding="utf-8") as fh:
        text = fh.read()
    sec6 = text.split("## 7.")[0].split("## 6.")[-1]
    assert "DWH.FACT_ORDERS" in sec6 and "SALES.ORDERS" in sec6
