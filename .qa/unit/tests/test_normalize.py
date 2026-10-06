# data: 2026-09-17 · categoria: unit · sorgente: multirepo/collect.py
# TDD I1.5: normalizzazione chiavi TS (path+extension) e SOA (relativePath+fileName).
"""Unit: normalize_ts_entry unifica le chiavi esterne (reale, niente mock)."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "multirepo"))
from collect import normalize_ts_entry


def test_normalizza_voce_soa_registry():
    out = normalize_ts_entry({"relativePath": "app.py", "fileName": "app.py", "type": "other"})
    assert out == {"rel_path": "app.py", "ext": ".py"}


def test_normalizza_voce_ts_ecosystem():
    out = normalize_ts_entry({"path": "src/x.ts", "extension": ".ts"})
    assert out == {"rel_path": "src/x.ts", "ext": ".ts"}


def test_normalizza_senza_estensione():
    out = normalize_ts_entry({"relativePath": "README", "fileName": "README"})
    assert out["rel_path"] == "README" and out["ext"] == "none"
