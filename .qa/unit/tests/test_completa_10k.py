# data: 2026-09-25 · categoria: unit · sorgente: multirepo/collect.py + doc_packager.py
"""Unit: completa a 10k — ODI full parallelo deterministico + indice DB (MD+CSV)."""
from __future__ import annotations

import csv
import io
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from multirepo.collect import (  # noqa: E402
    _odi_doc_one,
    _run_odi_parallel,
    build_parser,
)
from multirepo.doc_packager import build_db_csv, build_db_index_md  # noqa: E402

CARTELLE = [
    {"name": "repo-a", "db_inventory": [
        {"repo": "repo-a", "file": "ddl/crea.sql", "line": 3,
         "schema": "MAG", "name": "ORDINI", "kind": "table",
         "columns": ["ID NUMBER", "DATA DATE"], "detail": "", "source": "ddl"},
        {"repo": "repo-a", "file": "map.xml", "line": 0,
         "schema": "MAG", "name": "ORDINI", "kind": "table_ref",
         "columns": [], "detail": "output di CARICA_ORDINI", "source": "odi"},
    ]},
    {"name": "repo-b", "db_inventory": [
        {"repo": "repo-b", "file": "adapter.jca", "line": 0,
         "schema": "MAG", "name": "ORDINI", "kind": "table_ref",
         "columns": ["ID"], "detail": "SELECT via DBAdapter", "source": "jca"},
        {"repo": "repo-b", "file": "v.sql", "line": 1,
         "schema": "ANA", "name": "V_REPORT", "kind": "view",
         "columns": ["ID"], "detail": "", "source": "ddl"},
    ]},
]


def test_odi_parallel_ledger_deterministico_e_isolato():
    # Tool inesistente -> ogni job fallisce onesto, nessuno ferma gli altri,
    # ordine ledger per file (deterministico) con 1 o N worker.
    with tempfile.TemporaryDirectory(prefix="odi_par_") as tmp:
        jobs = [(os.path.join(tmp, "nope.py"), f"exp_{i}.xml",
                 os.path.join(tmp, f"exp_{i}.xml"),
                 os.path.join(tmp, "out", f"exp_{i}"), 30)
                for i in range(6)]
        for w in (1, 4):
            entries = _run_odi_parallel("repo-x", jobs, w)
            assert [e["file"] for e in entries] == sorted(f"exp_{i}.xml" for i in range(6))
            assert all(e["status"] == "failed" for e in entries)
            assert all("duration_s" in e for e in entries)


def test_odi_doc_one_mai_eccezioni():
    with tempfile.TemporaryDirectory(prefix="odi_one_") as tmp:
        out = os.path.join(tmp, "out")
        e = _odi_doc_one((os.path.join(tmp, "nope.py"), "a.xml",
                          os.path.join(tmp, "a.xml"), out, 30))
        assert e["file"] == "a.xml" and e["status"] == "failed"


def test_cli_workers_e_max_files():
    args = build_parser().parse_args(["--client", "x"])
    assert args.workers == 4 and args.max_files == 25_000
    args2 = build_parser().parse_args(["--workers", "8", "--max-odi-docs", "10"])
    assert args2.workers == 8 and args2.max_odi_docs == 10


def test_db_index_md_dove_risiede_cosa():
    md = build_db_index_md(CARTELLE, "demo")
    assert "MAG" in md and "ANA" in md
    assert "ORDINI" in md and "ID NUMBER" in md
    assert "repo-a" in md and "`ddl/crea.sql:3`" in md
    assert "CARICA_ORDINI" in md  # chi scrive
    assert "DBAdapter" in md  # chi legge
    assert "09_INVENTARIO_DB.csv" in md


def test_db_csv_completo_una_riga_per_risorsa():
    rows = list(csv.DictReader(io.StringIO(build_db_csv(CARTELLE))))
    assert len(rows) == 4
    assert rows[0].keys() >= {"schema", "name", "kind", "columns", "repo",
                              "file", "line", "detail", "source"}
    ordini = [r for r in rows if r["name"] == "ORDINI"]
    assert {r["source"] for r in ordini} == {"ddl", "odi", "jca"}
    ddl = next(r for r in ordini if r["source"] == "ddl")
    assert ddl["schema"] == "MAG" and "ID NUMBER" in ddl["columns"]
    assert ddl["file"] == "ddl/crea.sql" and ddl["line"] == "3"


def test_db_index_vuoto_onesto():
    md = build_db_index_md([{"name": "vuota", "db_inventory": []}])
    assert "Nessuna risorsa DB" in md
    assert list(csv.DictReader(io.StringIO(build_db_csv([])))) == []
