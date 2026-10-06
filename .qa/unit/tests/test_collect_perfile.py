# data: 2026-09-24 · categoria: unit · sorgente: multirepo/collect.py
"""Unit: per-ogni-file — 2 mapping ODI, LP+scenari (1 orfano), BPMN nested,
BPEL invoke graph, fallback generico (reale, niente mock)."""
from __future__ import annotations

import json
import os
import sys

from conftest import run

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
CLIENT = "perfile"
PER = os.path.join(ROOT, "dossier-clienti", CLIENT, "per-cartella.json")
TOUT = os.path.join(ROOT, "dossier-clienti", CLIENT, "tools_output", "repo-e")


def _collect_args(client, *extra):
    r = run(
        [sys.executable, "multirepo/collect.py", "--client", client,
         "--folders", "fixtures/repo-e", *extra],
        capture_output=True, text=True, cwd=ROOT, timeout=300,
    )
    assert r.returncode == 0, r.stderr[-3000:]
    with open(os.path.join(ROOT, "dossier-clienti", client, "per-cartella.json"),
              encoding="utf-8") as fh:
        per = json.load(fh)
    with open(os.path.join(ROOT, "dossier-clienti", client, "collect.json"),
              encoding="utf-8") as fh:
        coll = json.load(fh)
    return per, coll


def _collect():
    per, _ = _collect_args(CLIENT)
    return per


def test_perfile_router_copre_tutti():
    data = _collect()
    cart = next(c for c in data["cartelle"] if c["name"] == "repo-e")
    kinds = {fd["file"]: fd["kind"] for fd in cart.get("file_docs", [])}
    assert kinds.get("MAP_E_A.xml") == "odi-mapping"
    assert kinds.get("MAP_E_B.xml") == "odi-mapping"
    assert kinds.get("LP_E_Main.xml") == "odi-lp"
    assert kinds.get("SCEN_Used.xml") == "odi-scen"
    assert kinds.get("SCEN_Orphan.xml") == "odi-scen"
    assert kinds.get("flows/ship_nested.bpmn") == "bpmn"
    assert kinds.get("Ship.bpel") == "bpel"
    assert kinds.get("mystery.xml") == "other-xml"


def test_perfile_due_mapping_odi_documentati():
    _collect()
    for stem in ("MAP_E_A", "MAP_E_B"):
        d = os.path.join(TOUT, "odi", stem)
        assert os.path.isdir(d), f"manca {d}"
        found = []
        for dp, _dn, fn in os.walk(d):
            found += fn
        assert any(f.endswith(".md") for f in found), f"nessun .md in {d}"


def test_perfile_scenario_orfano_esplicitato():
    _collect()
    p = os.path.join(TOUT, "odi", "scenari", "SCENARIO_SCEN_ORPHAN.md")
    assert os.path.isfile(p), "manca SCENARIO_SCEN_ORPHAN.md"
    with open(p, encoding="utf-8") as fh:
        txt = fh.read()
    assert "ORFANO" in txt
    p2 = os.path.join(TOUT, "odi", "scenari", "SCENARIO_SCEN_USED.md")
    assert os.path.isfile(p2)
    with open(p2, encoding="utf-8") as fh:
        assert "ORFANO" not in fh.read()


def test_perfile_bpel_e_generico():
    _collect()
    assert os.path.isfile(os.path.join(TOUT, "bpel", "BPEL_ShipBPEL.md"))
    with open(os.path.join(TOUT, "bpel", "BPEL_ShipBPEL.md"),
              encoding="utf-8") as fh:
        txt = fh.read()
    assert "doShip" in txt and "mermaid" in txt
    assert os.path.isfile(os.path.join(TOUT, "xml", "XML_mystery.md"))


def test_fast_ogni_file_ha_doc_istantanea():
    per, coll = _collect_args("perfile_fast", "--fast")
    cart = next(c for c in per["cartelle"] if c["name"] == "repo-e")
    nodoc = [fd["file"] for fd in cart.get("file_docs", []) if not fd.get("doc")]
    assert nodoc == [], f"file senza doc in fast: {nodoc}"
    heavies = [t for t in coll["tool_runs"]
               if t["tool"] in ("odi_doc", "soa_analyze", "bpmn_doc", "lp_doc")
               and t["status"] == "ok"]
    assert heavies == [], f"run pesanti in fast: {heavies}"
    out = os.path.join(ROOT, "dossier-clienti", "perfile_fast",
                       "tools_output", "repo-e")
    assert os.path.isfile(os.path.join(out, "odi", "MAP_E_A", "MAPPA_MAP_E_A.md"))
    assert os.path.isfile(os.path.join(out, "bpmn", "flows_ship_nested", "SCHEDA_flows_ship_nested.md"))


def test_budget_odi_docs_uno_full_uno_inventario():
    per, coll = _collect_args("perfile_budget", "--max-odi-docs", "1")
    cart = next(c for c in per["cartelle"] if c["name"] == "repo-e")
    runs = [t for t in coll["tool_runs"] if t["tool"] == "odi_doc"]
    assert sum(1 for t in runs if t["status"] == "ok") == 1
    assert sum(1 for t in runs if t["status"] == "skipped") == 1
    nodoc = [fd["file"] for fd in cart.get("file_docs", [])
             if fd["kind"] == "odi-mapping" and not fd.get("doc")]
    assert nodoc == []
