# conftest: helper `run()` locale-indipendente per i sottoprocessi.
# I nostri script stampano UTF-8 (emoji ✅🔶🔍); decodificare con la locale
# Windows (cp1252) rompe i thread di lettura. Qui: child con PYTHONUTF8=1,
# parent con encoding utf-8 esplicito. Vale per qualsiasi locale/CI.
"""Helper condivisi dei test (stdlib only)."""
from __future__ import annotations

import os
import subprocess

ROOT = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)


def run(args, **kw):
    kw.setdefault("capture_output", True)
    kw.setdefault("text", True)
    kw.setdefault("encoding", "utf-8")
    kw.setdefault("errors", "replace")
    kw.setdefault("cwd", ROOT)
    kw.setdefault("timeout", 60)
    env = dict(os.environ, PYTHONUTF8="1", PYTHONIOENCODING="utf-8")
    kw.setdefault("env", env)
    return subprocess.run(args, **kw)
