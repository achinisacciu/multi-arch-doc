# Categoria: unit
# File sorgente: src/parser.py
# Creato: 2026-07-17
# Aggiornato: 2026-07-17

import os
import tempfile
from pathlib import Path

from parser import OdiMappingParser
from fixtures import build_sample_mapping_xml


def _write_tmp(xml: str) -> str:
    fd, path = tempfile.mkstemp(suffix=".xml")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(xml)
    return path


class TestOdiMappingParserInit:
    """Parsing dello skeleton XML e strutture dati base."""

    def test_parses_mapping_metadata(self):
        # Arrange
        path = _write_tmp(build_sample_mapping_xml())
        # Act
        parser = OdiMappingParser(path)
        # Assert
        assert parser.mapping["name"] == "MAPPING_TEST"
        assert parser.mapping["description"] == "Mapping di test sintetico"
        assert parser.mapping["global_id"] == "GID_MAP"

    def test_parses_datastores_by_adapter_type(self):
        # Arrange / Act
        parser = OdiMappingParser(_write_tmp(build_sample_mapping_xml()))
        # Assert
        assert parser.datastores["R1"]["qualified_name"] == "SRC_SCHEMA.SRC_TABLE"
        assert parser.kms["R4"]["qualified_name"] == "KM_TEST"
        assert "R2" in parser.datastores

    def test_get_field_returns_none_for_null(self):
        # Arrange / Act
        parser = OdiMappingParser(_write_tmp(build_sample_mapping_xml()))
        # Assert — campo non presente nel mapping ritorna default None
        assert parser._get_field(parser.root.find("Object"), "NonExistent") is None

    def test_ignores_objects_without_id(self):
        # Arrange / Act — SnpMapRef senza IMapRef non deve popolare il dict
        xml = build_sample_mapping_xml().replace('<Field name="IMapRef">R4</Field>', "")
        parser = OdiMappingParser(_write_tmp(xml))
        # Assert
        assert "R4" not in parser.kms


class TestFlowAnalysis:
    """Identificazione sorgenti, target, lookup e join."""

    def test_find_sources_and_targets(self):
        # Arrange / Act
        parser = OdiMappingParser(_write_tmp(build_sample_mapping_xml()))
        sources, targets = parser.find_sources_and_targets()
        # Assert
        assert "SRC_SCHEMA.SRC_TABLE" in sources
        assert "TGT_SCHEMA.TGT_TABLE" in targets

    def test_find_lookup_tables(self):
        # Arrange / Act
        parser = OdiMappingParser(_write_tmp(build_sample_mapping_xml()))
        # Assert — LKP ha input e output => lookup
        assert "LKP_SCHEMA.LKP_TABLE" in parser.find_lookup_tables()

    def test_get_join_conditions(self):
        # Arrange / Act
        parser = OdiMappingParser(_write_tmp(build_sample_mapping_xml()))
        joins = parser.get_join_conditions()
        # Assert
        assert len(joins) == 1
        assert joins[0]["name"] == "JOIN_COMP"
        assert any("SRC.ID = LKP.ID" in c for c in joins[0]["conditions"])

    def test_get_filter_conditions(self):
        # Arrange / Act
        parser = OdiMappingParser(_write_tmp(build_sample_mapping_xml()))
        # Assert
        assert len(parser.get_filter_conditions()) == 1

    def test_get_aggregate_info_detects_sum(self):
        # Arrange / Act
        parser = OdiMappingParser(_write_tmp(build_sample_mapping_xml()))
        aggs = parser.get_aggregate_info()
        # Assert
        assert any(a["function"] == "SUM" for agg in aggs for a in agg["aggregations"])


class TestToDictExport:
    """Esportazione completa in dizionario."""

    def test_to_dict_contains_all_sections(self):
        # Arrange / Act
        parser = OdiMappingParser(_write_tmp(build_sample_mapping_xml()))
        data = parser.to_dict()
        # Assert
        for key in ("mapping", "sources", "targets", "components", "join_conditions",
                    "filter_conditions", "aggregates", "expressions", "target_attributes",
                    "kms", "dependencies", "scenarios", "generated_sql",
                    "execution_units", "mapping_flow"):
            assert key in data

    def test_target_attributes_carries_expression(self):
        # Arrange / Act
        parser = OdiMappingParser(_write_tmp(build_sample_mapping_xml()))
        data = parser.to_dict()
        # Assert
        attrs = {a["attribute"]: a for a in data["target_attributes"]}
        assert "ID_PROGETTO" in attrs
        assert attrs["ID_PROGETTO"]["is_required"] is True

    def test_dependencies_capture_tables(self):
        # Arrange / Act
        parser = OdiMappingParser(_write_tmp(build_sample_mapping_xml()))
        data = parser.to_dict()
        # Assert
        assert "SRC_SCHEMA.SRC_TABLE" in data["dependencies"]["tables"]

    def test_generated_sql_from_scenario_tasks(self):
        # Arrange / Act
        parser = OdiMappingParser(_write_tmp(build_sample_mapping_xml()))
        data = parser.to_dict()
        # Assert
        sqls = data["generated_sql"]
        assert any(s["type"] == "DEF" and "INSERT" in s["sql"] for s in sqls)
        assert any(s["type"] == "COL" for s in sqls)

    def test_mapping_flow_builds_nodes_and_edges(self):
        # Arrange / Act
        parser = OdiMappingParser(_write_tmp(build_sample_mapping_xml()))
        flow = parser.get_mapping_flow()
        # Assert
        assert len(flow["nodes"]) == 7
        assert len(flow["edges"]) >= 6
