# data: 2026-09-18 · categoria: unit · sorgente: multirepo/doc_packager.py
# P3/P4: config generica redatta, dipendenze da manifests, contratti da
# canonical SOA, § inventario DB, segnale S10 risorse condivise (reale, no mock).
"""Unit: arricchimenti packager (config/deps/canonical/inventario/S10)."""
from __future__ import annotations

import json
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
sys.path.insert(0, ROOT)

from multirepo.doc_packager import (  # noqa: E402
    build_consumers,
    build_db_inventory_section,
    build_initiators_section,
    collect_config_rows,
    load_canonical_contracts,
    parse_manifest_deps,
)
from multirepo.collect import (  # noqa: E402
    sniff_bpmn_starts,
    sniff_jca,
    sniff_lp_initiators,
)
from multirepo.db_inventory import parse_ddl  # noqa: E402
from multirepo.crosslink import detect  # noqa: E402

FIX_D = os.path.join(ROOT, "fixtures", "repo-d")


def _cart_d() -> dict:
    files = []
    for dirpath, dirs, names in os.walk(FIX_D):
        dirs[:] = [d for d in dirs if d != ".git"]
        for n in names:
            rel = os.path.relpath(os.path.join(dirpath, n), FIX_D).replace(os.sep, "/")
            files.append({"rel_path": rel,
                          "ext": os.path.splitext(n)[1].lower() or "none"})
    return {"name": "repo-d", "root": FIX_D, "files": files,
            "manifests": {"package.json": ["package.json"]}}


def test_config_rows_values_and_redaction():
    rows = collect_config_rows(_cart_d())
    by_key = {r["key"]: r for r in rows}
    assert by_key["server.port"]["value"] == "8092"
    assert "Porta" in by_key["server.port"]["context"]
    assert "URL" in by_key["orders.api.url"]["context"]
    assert "Database" in by_key["db.name"]["context"]
    assert all("SuperSegreta" not in r["value"] for r in rows)


def test_config_redacts_sensitive_by_key(tmp_path):
    cfg = tmp_path / "app.properties"
    cfg.write_text("db.password=TopSecretXYZ\nok.key=1\n", encoding="utf-8")
    cart = {"name": "x", "root": str(tmp_path),
            "files": [{"rel_path": "app.properties", "ext": ".properties"}]}
    rows = collect_config_rows(cart)
    vals = {r["key"]: r["value"] for r in rows}
    assert vals["db.password"] == "***redatto***"
    assert "TopSecretXYZ" not in json.dumps(rows)


def test_manifest_deps_versions():
    deps = parse_manifest_deps(_cart_d())
    lut = {(d["eco"], d["package"]): d["version"] for d in deps}
    assert lut[("npm", "express")] == "^4.18.0"
    assert any(d["eco"] == "npm" and d["package"] == "vite" for d in deps)


def test_canonical_contracts_from_tmp():
    import tempfile
    with tempfile.TemporaryDirectory() as tmp:
        dest = os.path.join(tmp, "c1", "tools_output", "repo-d")
        os.makedirs(dest)
        canon = {"wsdls": [{"relativePath": "OrderService.wsdl",
                            "operations": ["getOrder", "createOrder"]}],
                 "xsds": ["types.xsd"]}
        with open(os.path.join(dest, "canonical.json"), "w",
                  encoding="utf-8") as fh:
            json.dump(canon, fh)
        contracts = load_canonical_contracts(tmp, "c1", "repo-d")
    assert any(c["kind"] == "WSDL" and "getOrder" in c["detail"]
               for c in contracts)
    assert any(c["kind"] == "XSD" for c in contracts)
    assert load_canonical_contracts(tmp, "c1", "assente") == []


def test_inventory_section_tables_columns_trigger():
    sec = build_db_inventory_section([{
        "name": "repo-d",
        "db_inventory": [
            {"repo": "repo-d", "file": "schema.sql", "line": 2,
             "schema": "HR", "name": "EMPLOYEES", "kind": "table",
             "columns": ["EMP_ID NUMBER", "SALARY NUMBER(12,2)"],
             "detail": "", "source": "ddl"},
            {"repo": "repo-d", "file": "schema.sql", "line": 20,
             "schema": "HR", "name": "TRG_EMP_AUDIT", "kind": "trigger",
             "columns": [], "detail": "AFTER INSERT ON HR.EMPLOYEES",
             "source": "ddl"},
        ]}])
    assert "Schema `HR`" in sec
    assert "EMP_ID NUMBER" in sec and "schema.sql:2" in sec
    assert "TRG_EMP_AUDIT" in sec and "HR.EMPLOYEES" in sec
    assert "Nessuna risorsa" in build_db_inventory_section(
        [{"name": "z", "db_inventory": []}])


def test_s10_shared_db_resource_edge():
    res = detect(
        [os.path.join(ROOT, "fixtures", "repo-a"),
         os.path.join(ROOT, "fixtures", "repo-b")],
        ignore_git=True,
        db_resources=[
            {"repo": "repo-a", "file": "a.sql", "line": 1, "schema": "HR",
             "name": "EMPLOYEES", "kind": "table", "columns": [],
             "detail": "", "source": "ddl"},
            {"repo": "repo-b", "file": "b.sql", "line": 5, "schema": "hr",
             "name": "employees", "kind": "table", "columns": [],
             "detail": "", "source": "ddl"},
        ])
    s10 = [e for e in res["edges"] if e["tipo"] == "risorsa-db-condivisa"]
    assert len(s10) == 1 and s10[0]["grado"] == "🔶 probabile"
    assert any("a.sql:1" in p for p in s10[0]["prove"])


LP_AGENT_XML = """<?xml version="1.0" encoding="UTF-8"?>
<SunopsisExport>
<Object class="oracle.odi.domain.runtime.loadplan.SnpLoadPlan">
<Field name="LoadPlanName">LP_NIGHTLY</Field>
</Object>
<Object class="oracle.odi.domain.runtime.loadplan.SnpPlanAgent">
<Field name="LagentName">AGENTE_NOTTE</Field>
<Field name="ContextCode">PROD</Field>
<Field name="ScenName">SCEN_NIGHTLY</Field>
<Field name="SType">Repeated</Field>
<Field name="SHour">2</Field>
<Field name="SMinute">30</Field>
<Field name="RCycleUnit">DAY</Field>
</Object>
<Object class="oracle.odi.domain.runtime.loadplan.SnpLpStep">
<Field name="LpStepName">STEP_LOAD</Field>
<Field name="LpStepType">SC</Field>
<Field name="ScenName">SCEN_NIGHTLY</Field>
</Object>
</SunopsisExport>
"""


def test_lp_initiators_agent_schedule_and_step(tmp_path):
    lp = tmp_path / "LP.xml"
    lp.write_text(LP_AGENT_XML, encoding="utf-8")
    got = sniff_lp_initiators(str(lp), "LP.xml")
    agent = next(e for e in got if e["kind"] == "loadplan-agent")
    assert agent["name"] == "SCEN_NIGHTLY" and agent["lp"] == "LP_NIGHTLY"
    assert "AGENTE_NOTTE" in agent["detail"] and "PROD" in agent["detail"]
    assert "SHour=2" in agent["detail"] and "RCycleUnit=DAY" in agent["detail"]
    step = next(e for e in got if e["kind"] == "loadplan-step")
    assert step["detail"].startswith("avvia scenario SCEN_NIGHTLY")


def test_bpmn_start_and_jca_inbound_fixture():
    from multirepo.collect import sniff_jca as sj
    starts = sniff_bpmn_starts(os.path.join(FIX_D, "order.bpmn"), "order.bpmn")
    assert any(s["kind"] == "bpmn-start" and s["name"] == "Ordine ricevuto"
               and "Gestione Ordini" in s["detail"] for s in starts)
    got = sj(os.path.join(FIX_D, "AqInboundAdapter.jca"))
    assert len(got["activations"]) == 1
    act = got["activations"][0]
    assert "AQActivationSpec" in act["spec"]
    assert act["properties"]["DestinationName"] == "HR.ORDER_QUEUE"


def test_view_depends_on_and_consumers():
    with open(os.path.join(FIX_D, "schema.sql"), encoding="utf-8") as fh:
        res = parse_ddl(fh.read(), "schema.sql", "repo-d")
    view = next(r for r in res if r["kind"] == "view")
    assert "HR.DEPARTMENTS" in view["depends_on"]
    cons = build_consumers(res + [
        {"repo": "repo-d", "file": "MAP_X.xml", "line": 0, "schema": "HR",
         "name": "EMPLOYEES", "kind": "table_ref", "columns": [],
         "detail": "output di MAP_SYNC", "source": "odi"},
        {"repo": "repo-d", "file": "EmpDbAdapter.jca", "line": 0,
         "schema": "HR", "name": "EMPLOYEES", "kind": "table_ref",
         "columns": [], "detail": "SELECT via Database Adapter",
         "source": "jca"},
    ])
    emp = cons["HR.EMPLOYEES"]
    assert any("DDL table" in d for d in emp["defined_in"])
    assert any("MAP_SYNC" in w for w in emp["written_by"])
    assert any("SELECT" in r for r in emp["read_by"])
    assert any("EMP_ACTIVE" in r for r in cons["HR.DEPARTMENTS"]["read_by"])
    assert any("TRG_EMP_AUDIT" in r for r in emp["read_by"])


def test_initiators_section_labels():
    sec = build_initiators_section([{"name": "repo-d", "initiators": [
        {"kind": "bpmn-start", "name": "Ordine ricevuto", "file": "order.bpmn",
         "line": 0, "detail": "processo Gestione Ordini: manuale", "lp": ""},
        {"kind": "jca-inbound", "name": "AqInboundPort", "file": "a.jca",
         "line": 0, "detail": "adapter AQ Adapter spec X", "lp": ""}]}])
    assert "Start event BPMN" in sec and "Adapter inbound" in sec
    assert "order.bpmn" in sec
    assert "NON confermato" in build_initiators_section(
        [{"name": "z", "initiators": []}])
