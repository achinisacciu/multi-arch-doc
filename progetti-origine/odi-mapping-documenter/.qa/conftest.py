# Categoria: fixture
# File sorgente: conftest
# Creato: 2026-07-17
# Descrizione: rende i moduli in src/ importabili da tutti i test in .qa/

import sys
from pathlib import Path

SRC = Path(__file__).resolve().parent.parent / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))
