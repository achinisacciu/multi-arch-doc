"""
V0.3 — Project Scanner
Scansiona ricorsivamente un Project Folder e raccoglie tutti i file candidati.
"""
from pathlib import Path
from typing import List, Set

# Estensioni note (da src/components/FileDropzone.tsx + metadata.json)
KNOWN_EXTENSIONS = {
    ".bpmn", ".bpel", ".wsdl", ".xsd", ".xsl", ".xslt",
    ".jca", ".mplan", ".task", ".composite", ".xml",
    ".componentType", ".dvm", ".cpx", ".dcx", ".jpr", ".jws",
    ".py", ".sh", ".properties", ".cfg", ".config", ".json"
}

BINARY_EXTS = {".jar", ".class", ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".zip", ".jar", ".war", ".ear", ".sar"}
EXCLUDED_DIRS: Set[str] = {".git", ".hg", ".svn", "node_modules", "dist", "build", ".venv", "venv", "__pycache__", ".pytest_cache", ".vite", "target", "out", ".idea", ".vscode"}

def _is_excluded(path: Path, root: Path) -> bool:
    try:
        rel = path.relative_to(root)
    except ValueError:
        rel = path
    for part in rel.parts:
        if part in EXCLUDED_DIRS:
            return True
        if part.startswith(".") and part not in (".bpmn",):  # hidden files/dirs
            # allow .bpmn hidden? no
            if part in {".git", ".hg"}:
                return True
    return False

def scan_project(root: Path, recursive: bool = True, respect_gitignore: bool = False) -> List[Path]:
    """
    Raccoglie tutti i file sotto root.
    - Esclude BINARY_EXTS e dirs in EXCLUDED_DIRS
    - Se recursive=False, solo figli diretti
    - Ritorna lista ordinata deterministicamente
    """
    root = Path(root).resolve()
    if not root.exists():
        raise FileNotFoundError(f"Root not found: {root}")
    if root.is_file():
        return [root] if root.suffix.lower() not in BINARY_EXTS else []

    files: List[Path] = []
    if recursive:
        for p in root.rglob("*"):
            if p.is_file():
                if _is_excluded(p, root):
                    continue
                if p.suffix.lower() in BINARY_EXTS:
                    continue
                # also skip very large binary-like
                # keep all others — detector deciderà il tipo
                files.append(p)
    else:
        for p in root.iterdir():
            if p.is_file() and p.suffix.lower() not in BINARY_EXTS and not _is_excluded(p, root):
                files.append(p)

    # deterministic order
    files.sort(key=lambda x: str(x.relative_to(root)).lower())
    return files

def filter_by_known_extensions(files: List[Path]) -> List[Path]:
    """Filtra solo estensioni note (utile per quick preview)."""
    return [p for p in files if p.suffix.lower() in KNOWN_EXTENSIONS or p.suffix.lower() == ".xml" or p.name == "composite.xml"]
