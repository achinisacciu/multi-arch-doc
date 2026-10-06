# data: 2026-09-22 · categoria: unit · sorgente: multirepo/file_docs.py
"""Unit: router per-file XML + BPEL invoke graph + fallback generico (reale, niente mock)."""
from __future__ import annotations

import os

from multirepo.file_docs import (
    bpel_markdown,
    bpel_mermaid,
    classify_xml,
    contract_markdown,
    contract_summary,
    generic_xml_markdown,
    generic_xml_summary,
    parse_bpel,
    scenario_markdown,
)

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
REPO_E = os.path.join(ROOT, "fixtures", "repo-e")


def _rel(name: str) -> str:
    return os.path.join(REPO_E, name)


def test_router_odi_mapping():
    r = classify_xml(_rel("MAP_E_A.xml"), "MAP_E_A.xml")
    assert r["kind"] == "odi-mapping"
    r = classify_xml(_rel("MAP_E_B.xml"), "MAP_E_B.xml")
    assert r["kind"] == "odi-mapping"


def test_router_lp_e_scenari():
    assert classify_xml(_rel("LP_E_Main.xml"), "LP_E_Main.xml")["kind"] == "odi-lp"
    assert classify_xml(_rel("SCEN_Used.xml"), "SCEN_Used.xml")["kind"] == "odi-scen"
    assert classify_xml(_rel("SCEN_Orphan.xml"), "SCEN_Orphan.xml")["kind"] == "odi-scen"


def test_router_bpmn_bpel_generico():
    assert classify_xml(_rel("flows/ship_nested.bpmn"), "flows/ship_nested.bpmn")["kind"] == "bpmn"
    assert classify_xml(_rel("Ship.bpel"), "Ship.bpel")["kind"] == "bpel"
    r = classify_xml(_rel("mystery.xml"), "mystery.xml")
    assert r["kind"] == "other-xml"


def test_bpel_invoke_graph():
    info = parse_bpel(_rel("Ship.bpel"))
    assert info["process"] == "ShipBPEL"
    assert any(i["operation"] == "doShip" for i in info["invokes"])
    assert any(i["partnerLink"] == "ShipPL" for i in info["invokes"])
    mmd = bpel_mermaid(info)
    assert "doShip" in mmd and "ShipPL" in mmd
    md = bpel_markdown(info, "Ship.bpel")
    assert "ShipBPEL" in md and "```mermaid" in md


def test_fallback_generico_leggero():
    info = generic_xml_summary(_rel("mystery.xml"))
    assert info["root"] == "customApp"
    assert info["tags"].get("item") == 2
    md = generic_xml_markdown(info, "mystery.xml")
    assert "XML generico" in md and "customApp" in md


def test_scenario_orfano_esplicitato():
    md = scenario_markdown("SCEN_ORPHAN", "SCEN_Orphan.xml", [], True)
    assert "ORFANO" in md
    md2 = scenario_markdown("SCEN_USED", "SCEN_Used.xml", ["LP_E_MAIN:STEP_RUN_USED"], False)
    assert "ORFANO" not in md2 and "LP_E_MAIN" in md2


def test_contratti_classificati_e_inventariati(tmp_path):
    wsdl = tmp_path / "svc.wsdl"
    wsdl.write_text(
        '<?xml version="1.0"?><definitions xmlns="http://schemas.xmlsoap.org/wsdl/" '
        'name="S"><portType name="PT"><operation name="doIt"/></portType></definitions>',
        encoding="utf-8")
    r = classify_xml(str(wsdl), "svc.wsdl")
    assert r["kind"] == "wsdl"
    info = contract_summary(str(wsdl))
    assert "doIt" in info["items"].get("operation", [])
    md = contract_markdown(info, "svc.wsdl", "wsdl")
    assert "doIt" in md
    sca = tmp_path / "composite.xml"
    sca.write_text('<?xml version="1.0"?><composite name="C"/>', encoding="utf-8")
    assert classify_xml(str(sca), "composite.xml")["kind"] == "sca"
