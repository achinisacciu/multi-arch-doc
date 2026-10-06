# data: 2026-09-17 · categoria: unit · sorgente: multirepo/report.py
# TDD I3.6: glossario §9 derivato dalle evidenze (tabelle, mapping, scenari, LP).
"""Unit: CLIENT-REPORT §9 con voci + stato onesto (reale, niente mock)."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", ".qa", "unit", "tests"))
from conftest import run

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
OUTDIR = os.path.join(ROOT, "dossier-clienti", "clientone")


def test_report_glossario():
    for cmd in (
        [sys.executable, "multirepo/collect.py", "--client", "clientone",
         "--folders", "fixtures/repo-a", "fixtures/repo-b", "fixtures/repo-c"],
        [sys.executable, "multirepo/report.py", "--client", "clientone"],
    ):
        r = run(cmd)
        assert r.returncode == 0, r.stderr
    with open(os.path.join(OUTDIR, "CLIENT-REPORT.md"), encoding="utf-8") as fh:
        text = fh.read()
    sec9 = text.split("## 10.")[0].split("## 9.")[-1]
    assert "DWH.FACT_ORDERS" in sec9 and "MAP_Orders" in sec9 and "SCEN_SHARED" in sec9
    assert "da confermare" in sec9
