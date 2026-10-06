# Categoria: fixture
# File sorgente: conftest
# Creato: 2026-07-17
# Descrizione: rende i moduli in src/ importabili dai test in .qa/

import sys
from pathlib import Path

SRC = Path(__file__).resolve().parent.parent.parent / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))
