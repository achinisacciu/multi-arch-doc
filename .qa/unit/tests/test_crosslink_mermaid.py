# data: 2026-09-17 · categoria: unit · sorgente: multirepo/crosslink.py + report.py
# TDD I2.7: grafo Mermaid inter-cartella in crosslink.json e CLIENT-REPORT §3.
"""Unit: mermaid con nodi, archi e sanitize (reale, niente mock)."""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", ".qa", "unit", "tests"))
from conftest import run

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "multirepo"))
from crosslink import sanitize_mermaid

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
XLINK = os.path.join(ROOT, "dossier-clienti", "clientone", "crosslink.json")
MD = os.path.join(ROOT, "dossier-clienti", "clientone", "CLIENT-REPORT.md")


def test_sanitize_mermaid():
    assert sanitize_mermaid('a"b[c]d|e#f<g>') == "a_b_c_d_e_f_g_"
    assert sanitize_mermaid("ok- name_1.2") == "ok- name_1.2"


def test_crosslink_mermaid_e_report():
    for cmd in (
        [sys.executable, "multirepo/crosslink.py", "--client", "clientone", "--ignore-git",
         "fixtures/repo-a", "fixtures/repo-b", "fixtures/repo-c"],
        [sys.executable, "multirepo/report.py", "--client", "clientone"],
    ):
        r = run(cmd)
        assert r.returncode == 0, r.stderr
    with open(XLINK, encoding="utf-8") as fh:
        data = json.load(fh)
    mm = data.get("mermaid", "")
    assert "flowchart" in mm and "repo-a" in mm and "import-cross-cartella" in mm
    with open(MD, encoding="utf-8") as fh:
        text = fh.read()
    assert "```mermaid" in text and "flowchart" in text.split("```mermaid")[1]
