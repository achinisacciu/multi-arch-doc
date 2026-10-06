# data: 2026-09-18 · categoria: unit · sorgente: multirepo/db_inventory.py
# TDD: inventario risorse DB da tutte le tecnologie (DDL, viste, trigger,
# routine, JCA, ODI) con colonne e file:riga, mai inventato.
"""Unit: db_inventory — DDL kinds, colonne, JCA/ODI refs, aggregazione."""
from __future__ import annotations

import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
sys.path.insert(0, ROOT)

from multirepo.db_inventory import (  # noqa: E402
    aggregate_by_schema,
    detect_sql_type,
    extract_sql_params,
    extract_sql_tables,
    inventory_folder_db,
    parse_ddl,
)

FIX_D = os.path.join(ROOT, "fixtures", "repo-d")


def test_ddl_table_columns_view_trigger_routines():
    with open(os.path.join(FIX_D, "schema.sql"), encoding="utf-8") as fh:
        text = fh.read()
    res = parse_ddl(text, "schema.sql", "repo-d")
    by_kind = {}
    for r in res:
        by_kind.setdefault(r["kind"], []).append(r)
    emp = next(r for r in by_kind["table"] if r["name"] == "EMPLOYEES")
    assert emp["schema"] == "HR" and emp["line"] == 2
    cols = dict(c.split(None, 1) for c in emp["columns"])
    assert cols["EMP_ID"].startswith("NUMBER") and cols["SALARY"].startswith("NUMBER")
    assert "PK_EMP" not in emp["columns"]
    assert len(emp["columns"]) == 6
    view = next(r for r in by_kind["view"] if r["name"] == "EMP_ACTIVE")
    assert view["schema"] == "HR"
    assert "EMP_ID" in view["columns"]
    trg = next(r for r in by_kind["trigger"] if r["name"] == "TRG_EMP_AUDIT")
    assert "HR.EMPLOYEES" in trg["detail"] and "INSERT" in trg["detail"]
    assert any(r["name"] == "P_SYNC_EMP" for r in by_kind["procedure"])
    assert any(r["name"] == "IDX_EMP_DEPT" for r in by_kind["index"])
    assert any(r["name"] == "SEQ_EMP_ID" for r in by_kind["sequence"])


def test_jca_sql_tables_type_params():
    sql = ("SELECT e.EMP_ID, e.LAST_NAME FROM HR.EMPLOYEES e "
           "JOIN HR.DEPARTMENTS d ON d.DEPT_ID = e.DEPT_ID WHERE e.EMP_ID = #empId")
    tables = extract_sql_tables(sql)
    assert "HR.EMPLOYEES" in tables and "HR.DEPARTMENTS" in tables
    assert detect_sql_type(sql) == "SELECT"
    assert "empId" in extract_sql_params(sql)
    assert detect_sql_type("  /* c */ WITH x AS (SELECT 1) SELECT * FROM t") == "SELECT"
    assert detect_sql_type("BEGIN NULL; END;") == "CALL"


def test_inventory_folder_db_all_sources_and_aggregate():
    cart = {"name": "repo-d"}
    res = inventory_folder_db(FIX_D, "repo-d",
                              [{"file": "EmpDbAdapter.jca", "adapter": "Database Adapter",
                                "operations": ["selectEmployees"],
                                "sqls": ["SELECT * FROM HR.EMPLOYEES"]}],
                              [{"file": "MAP_X.xml", "mappings": [
                                  {"name": "M1", "sources": ["HR.EMPLOYEES"],
                                   "targets": ["HR.DW_EMP"]}]}])
    kinds = {r["kind"] for r in res}
    assert {"table", "view", "trigger", "procedure", "table_ref"} <= kinds
    refs = [r for r in res if r["kind"] == "table_ref"]
    assert any(r["source"] == "jca" and r["name"] == "EMPLOYEES" for r in refs)
    assert any(r["source"] == "odi" and r["name"] == "DW_EMP" for r in refs)
    assert all(r["file"] for r in res), "ogni risorsa cita il file"
    agg = aggregate_by_schema(res)
    assert "HR" in agg
    assert any(t["name"] == "EMPLOYEES" and len(t["columns"]) == 6
               for t in agg["HR"]["tables"])
    assert agg["HR"]["views"] and agg["HR"]["triggers"] and agg["HR"]["routines"]
    assert cart["name"] == "repo-d"
