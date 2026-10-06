# Categoria: unit
# File sorgente: src/doc_builder.py, src/flow_builder.py, src/csv_builder.py
# Creato: 2026-07-17
# Aggiornato: 2026-07-17

import os
import tempfile
from pathlib import Path

from parser import OdiMappingParser
from doc_builder import generate_technical_markdown, generate_business_markdown
from flow_builder import generate_flow_diagram
from csv_builder import generate_csv
from fixtures import build_sample_mapping_xml


def _data():
    parser = OdiMappingParser(
        _tmp_path(build_sample_mapping_xml())
    )
    return parser.to_dict()


def _tmp_path(xml: str) -> str:
    fd, path = tempfile.mkstemp(suffix=".xml")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(xml)
    return path


class TestDocBuilder:
    """Generazione Markdown tecnico e business."""

    def test_technical_markdown_written(self):
        # Arrange
        data = _data()
        out = Path(tempfile.mktemp(suffix=".md"))
        # Act
        content = generate_technical_markdown(data, out)
        # Assert
        assert out.exists()
        assert "MAPPING_TEST" in content
        assert "Sorgenti" in content

    def test_business_markdown_has_final_result(self):
        # Arrange
        data = _data()
        out = Path(tempfile.mktemp(suffix=".md"))
        # Act
        content = generate_business_markdown(data, out)
        # Assert
        assert "Risultato Finale" in content
        assert "ID_PROGETTO" in content


class TestFlowBuilder:
    """Generazione diagramma Mermaid."""

    def test_flow_diagram_contains_mermaid(self):
        # Arrange
        data = _data()
        out = Path(tempfile.mktemp(suffix=".md"))
        # Act
        content = generate_flow_diagram(data, out)
        # Assert
        assert "```mermaid" in content
        assert "graph LR" in content
        assert "classDef source" in content


class TestCsvBuilder:
    """Generazione CSV delle regole di mapping."""

    def test_csv_written_with_header(self):
        # Arrange
        data = _data()
        out = Path(tempfile.mktemp(suffix=".csv"))
        # Act
        generate_csv(data, out)
        # Assert
        assert out.exists()
        text = out.read_text(encoding="utf-8-sig")
        assert "Mapping_Name" in text
        assert "JOIN_CONDITION" in text

    def test_csv_skipped_when_no_rows(self):
        # Arrange — mapping senza espressioni/condizioni
        data = _data()
        data["expressions"] = []
        data["aggregates"] = []
        data["join_conditions"] = []
        data["filter_conditions"] = []
        out = Path(tempfile.mktemp(suffix=".csv"))
        # Act
        generate_csv(data, out)
        # Assert — nessun file creato
        assert not out.exists()
