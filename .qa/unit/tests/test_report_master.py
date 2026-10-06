# data: 2026-09-17 · categoria: unit · sorgente: multirepo/report.py
# TDD T3.6+T3.7: master CSV + verifica da per-cartella.json (logica master-csv/).
"""Unit: report genera master_csv_input_output.csv + verifica_mapping.txt."""
from __future__ import annotations

import csv
import os
from conftest import run
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
OUTDIR = os.path.join(ROOT, "dossier-clienti", "clientone")


def _run_all():
    for cmd in (
        [sys.executable, "multirepo/collect.py", "--client", "clientone",
         "--folders", "fixtures/repo-a", "fixtures/repo-b", "fixtures/repo-c"],
        [sys.executable, "multirepo/crosslink.py", "--client", "clientone", "--ignore-git",
         "fixtures/repo-a", "fixtures/repo-b", "fixtures/repo-c"],
        [sys.executable, "multirepo/report.py", "--client", "clientone"],
    ):
        r = run(cmd, capture_output=True, text=True, cwd=ROOT, timeout=60)
        assert r.returncode == 0, r.stderr


def test_report_master_csv():
    _run_all()
    dest = os.path.join(OUTDIR, "master_csv_input_output.csv")
    assert os.path.exists(dest)
    with open(dest, encoding="utf-8-sig") as fh:
        rows = list(csv.DictReader(fh))
    assert rows and rows[0].keys() == {"progetto", "mapping", "schema", "table", "tipo"}
    assert any(r["progetto"] == "repo-a" and r["mapping"] == "MAP_Orders"
               and r["schema"] == "SALES" and r["table"] == "ORDERS"
               and r["tipo"] == "input" for r in rows)
    assert any(r["tipo"] == "output" and r["table"] == "FACT_ORDERS" for r in rows)


def test_report_verifica():
    _run_all()
    dest = os.path.join(OUTDIR, "verifica_mapping.txt")
    assert os.path.exists(dest)
    with open(dest, encoding="utf-8") as fh:
        text = fh.read()
    assert "repo-a" in text and "MAP_Orders" in text
