# test_enhanced_odi_and_docs.py — Verifica TDD per documentazione approfondita ed ETL ODI.
from __future__ import annotations

import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
sys.path.insert(0, ROOT)

from multirepo.doc_packager import build_sviluppo, build_business, build_architettura
from multirepo.file_docs import odi_inventory_markdown


def test_04_trasformazioni_etl_odi_deep_content():
    """Verifica che 04_TRASFORMAZIONI_ETL_ODI.md contenga analisi approfondita, lineage Mermaid,
    dettaglio step LoadPlan, scenari orfani/condivisi e matrice dei rischi."""
    cartelle = [
        {
            "name": "repo-a",
            "root": "/tmp/repo-a",
            "odi_exports": [
                {
                    "file": "MAP_Orders.xml",
                    "mappings": [
                        {
                            "name": "MAP_Orders",
                            "sources": ["SALES.ORDERS", "SALES.CUSTOMERS"],
                            "targets": ["DWH.FACT_ORDERS"],
                        }
                    ],
                }
            ],
            "lp_files": [],
            "scen_files": [{"file": "Scenario_Shared.xml", "scen_names": ["SCEN_SHARED"]}],
            "initiators": [],
            "db_inventory": [],
            "jca_adapters": [],
            "files": [{"rel_path": "MAP_Orders.xml", "ext": ".xml"}],
        },
        {
            "name": "repo-b",
            "root": "/tmp/repo-b",
            "odi_exports": [
                {
                    "file": "MAP_Ship.xml",
                    "mappings": [
                        {
                            "name": "MAP_Ship",
                            "sources": ["LOGISTICS.SHIPMENTS"],
                            "targets": ["DWH.FACT_ORDERS"],
                        }
                    ],
                }
            ],
            "lp_files": [
                {
                    "file": "LoadPlan_Main.xml",
                    "loadplan_names": ["LP_MAIN"],
                    "steps": [
                        {"order": "1", "name": "STEP_1", "type": "SCENARIO", "scen_name": "SCEN_SHARED"}
                    ],
                }
            ],
            "scen_files": [{"file": "Scenario_Shared.xml", "scen_names": ["SCEN_SHARED"]}],
            "initiators": [],
            "db_inventory": [],
            "jca_adapters": [],
            "files": [{"rel_path": "MAP_Ship.xml", "ext": ".xml"}],
        },
        {
            "name": "repo-e",
            "root": "/tmp/repo-e",
            "odi_exports": [
                {
                    "file": "MAP_E_A.xml",
                    "mappings": [
                        {
                            "name": "MAP_E_A",
                            "sources": ["SALES.ORDERS_E"],
                            "targets": ["DWH.FACT_E"],
                        }
                    ],
                }
            ],
            "lp_files": [
                {
                    "file": "LP_E_Main.xml",
                    "loadplan_names": ["LP_E_MAIN"],
                    "steps": [
                        {"order": "1", "name": "STEP_RUN_USED", "type": "SCENARIO", "scen_name": "SCEN_USED"}
                    ],
                }
            ],
            "scen_files": [
                {"file": "SCEN_Used.xml", "scen_names": ["SCEN_USED"]},
                {"file": "SCEN_Orphan.xml", "scen_names": ["SCEN_ORPHAN"]},
            ],
            "initiators": [],
            "db_inventory": [],
            "jca_adapters": [],
            "files": [{"rel_path": "LP_E_Main.xml", "ext": ".xml"}],
        },
    ]

    edges = [
        {"da": "repo-a", "a": "repo-b", "tipo": "entita-condivise", "grado": "🔍 indizio", "prove": ["DWH.FACT_ORDERS"]}
    ]
    mrows = [
        ("repo-a", "MAP_Orders", "SALES", "ORDERS", "input"),
        ("repo-a", "MAP_Orders", "SALES", "CUSTOMERS", "input"),
        ("repo-a", "MAP_Orders", "DWH", "FACT_ORDERS", "output"),
        ("repo-b", "MAP_Ship", "LOGISTICS", "SHIPMENTS", "input"),
        ("repo-b", "MAP_Ship", "DWH", "FACT_ORDERS", "output"),
    ]

    docs = build_sviluppo("test_client", "2026-10-09 12:00:00", cartelle, edges, mrows)
    etl_doc = docs["04_TRASFORMAZIONI_ETL_ODI.md"]

    # 1. Deve contenere il diagramma Mermaid di lineage
    assert "```mermaid" in etl_doc
    assert "flowchart" in etl_doc
    assert "SALES.ORDERS" in etl_doc
    assert "DWH.FACT_ORDERS" in etl_doc

    # 2. Deve evidenziare convergenze / multi-writer (DWH.FACT_ORDERS scritto da repo-a e repo-b)
    assert "DWH.FACT_ORDERS" in etl_doc
    assert "Multi-Writer" in etl_doc or "Convergenza" in etl_doc or "multipli" in etl_doc

    # 3. Deve contenere audit scenari con distinzione tra attivi, condivisi e orfani
    assert "SCEN_ORPHAN" in etl_doc
    assert "Orfano" in etl_doc or "ORFANO" in etl_doc
    assert "SCEN_SHARED" in etl_doc
    assert "Condiviso" in etl_doc or "condiviso" in etl_doc

    # 4. Deve contenere metriche KPI e sintesi numerica
    assert "Metriche" in etl_doc or "KPI" in etl_doc or "Totale Mapping" in etl_doc


def test_odi_inventory_markdown_enhanced():
    """Verifica che la scheda per-file dell'export ODI includa dettagli e diagramma."""
    exp = {
        "file": "MAP_Orders.xml",
        "mappings": [
            {
                "name": "MAP_Orders",
                "sources": ["SALES.ORDERS", "SALES.CUSTOMERS"],
                "targets": ["DWH.FACT_ORDERS"],
            }
        ],
        "loadplan_names": [],
        "scen_names": [],
    }
    md = odi_inventory_markdown(exp)
    assert "MAP_Orders" in md
    assert "SALES.ORDERS" in md
    assert "DWH.FACT_ORDERS" in md
    assert "```mermaid" in md or "Lineage" in md or "Direzione" in md
