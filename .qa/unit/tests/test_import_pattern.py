# data: 2026-09-17 · categoria: unit · sorgente: multirepo/crosslink.py import_pattern
# A3.1 regression: hyphen/underscore equivalenti (package python: repo-b -> repo_b).
"""Unit: import_pattern copre varianti reali, ignora menzioni (reale, niente mock)."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "multirepo"))
from crosslink import import_pattern


def test_import_underscore_equivale_hyphen():
    assert import_pattern("repo-b").search("from repo_b import x")


def test_import_con_alias():
    assert import_pattern("repo-b").search("import repo_b as rb")


def test_relative_senza_sorella_ignorato():
    assert not import_pattern("repo-b").search("from . import x")


def test_require_con_nome():
    assert import_pattern("repo-b").search('require("./repo-b")')


def test_menzione_in_docstring_ignorata():
    assert not import_pattern("repo-b").search("docstring: usa repo-b per il flusso")
