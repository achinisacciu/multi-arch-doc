# data: 2026-09-17 · categoria: unit · sorgente: crosslink/report/collect (funzioni pure)
# A2.1: copre matrix_md, redact, git_info fallimenti (import diretto, niente subprocess).
"""Unit dirette su funzioni importabili (veloci, niente mock)."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "multirepo"))
from collect import normalize_ts_entry  # noqa: E402
from crosslink import git_info, matrix_md  # noqa: E402
from report import redact  # noqa: E402


def test_matrix_md_multi_arco_e_vuoti():
    names = ["a", "b"]
    edges = [
        {"da": "a", "a": "b", "tipo": "t1", "grado": "✅", "prove": []},
        {"da": "a", "a": "b", "tipo": "t2", "grado": "🔶", "prove": []},
    ]
    md = matrix_md(names, edges)
    assert "t1" in md and "t2" in md and "<br/>" in md
    assert "(nessuna evidenza)" in md


def test_redact():
    assert redact("db.password=SuperSegreta123") == "***redatto***"
    assert redact("repo-a/app.py:2") == "repo-a/app.py:2"


def test_git_info_cartella_inesistente():
    assert git_info(r"C:\nonexistent-xyz-123") == {"top": "", "remote": ""}


def test_normalize_mantiene_chiavi_nostre():
    assert normalize_ts_entry({"rel_path": "x/y.py", "ext": ".py"}) == {
        "rel_path": "x/y.py", "ext": ".py"}
