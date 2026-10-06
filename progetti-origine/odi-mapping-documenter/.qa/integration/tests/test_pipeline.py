# Categoria: integration
# File sorgente: src/main.py
# Creato: 2026-07-17
# Aggiornato: 2026-07-17

import os
import tempfile
from pathlib import Path

import main as main_module
from fixtures import build_sample_mapping_xml


def _write_tmp(xml: str) -> Path:
    fd, path = tempfile.mkstemp(suffix=".xml")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(xml)
    return Path(path)


class TestEndToEndPipeline:
    """Processa un XML reale attraverso l'intera pipeline di main."""

    def test_process_single_xml_all_formats(self):
        # Arrange
        xml = _write_tmp(build_sample_mapping_xml())
        out = Path(tempfile.mkdtemp())
        # Act
        ok = main_module.process_single_xml(xml, out, "all")
        # Assert
        assert ok is True
        files = {p.name for p in out.glob("*")}
        assert any("_TECNICO.md" in f for f in files)
        assert any("_BUSINESS.md" in f for f in files)
        assert any("_FLUSSO.md" in f for f in files)
        assert any("_MAPPING_RULES.csv" in f for f in files)
        assert any("mapping_sources_targets.json" in f for f in files)

    def test_process_single_xml_handles_missing_file(self):
        # Arrange / Act
        out = Path(tempfile.mkdtemp())
        ok = main_module.process_single_xml(
            Path(tempfile.mktemp(suffix=".xml")), out, "all"
        )
        # Assert
        assert ok is False
        # Assert — nessun documento generato
        assert not any(out.glob("*_TECNICO.md"))

    def test_process_single_xml_technical_only(self):
        # Arrange
        xml = _write_tmp(build_sample_mapping_xml())
        out = Path(tempfile.mkdtemp())
        # Act
        main_module.process_single_xml(xml, out, "technical")
        # Assert
        files = {p.name for p in out.glob("*")}
        assert any("_TECNICO.md" in f for f in files)
        assert not any("_BUSINESS.md" in f for f in files)
