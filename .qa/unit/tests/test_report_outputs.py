# data: 2026-09-17 · categoria: unit · sorgente: multirepo/report.py
# RETROFIT: blocca output report F0 (CLIENT-REPORT.md + CSV con matrice).
"""Unit retrofit: report genera markdown + CSV dal crosslink (reale, niente mock)."""
from __future__ import annotations

import os
from conftest import run
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
OUTDIR = os.path.join(ROOT, "dossier-clienti", "clientone")


def test_report_genera_markdown_e_csv():
    run(
        [sys.executable, "multirepo/crosslink.py", "--client", "clientone", "--ignore-git",
         "fixtures/repo-a", "fixtures/repo-b", "fixtures/repo-c"],
        capture_output=True, text=True, cwd=ROOT, timeout=60, check=True,
    )
    r = run(
        [sys.executable, "multirepo/report.py", "--client", "clientone"],
        capture_output=True, text=True, cwd=ROOT, timeout=60,
    )
    assert r.returncode == 0, r.stderr
    md = os.path.join(OUTDIR, "CLIENT-REPORT.md")
    csv = os.path.join(OUTDIR, "crosslink_rules.csv")
    assert os.path.exists(md) and os.path.exists(csv)
    with open(md, encoding="utf-8") as fh:
        text = fh.read()
    assert "# CLIENT-REPORT — clientone" in text
    assert "Matrice connessioni" in text
    with open(csv, encoding="utf-8-sig") as fh:
        header = fh.readline()
    assert header.strip() == "da,a,tipo,grado,prove"
