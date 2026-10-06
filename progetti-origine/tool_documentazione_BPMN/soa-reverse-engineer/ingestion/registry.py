"""
V0.3 — Artifact Registry
Produce inventario deterministico come §3 con Evidence.
ID deterministico via hash su relativePath::fileName (come ecosystemParser.ts:883)
"""
from pathlib import Path
import hashlib
from typing import List, Dict, Any
from .artifact_detector import detect_artifact_type

def _stable_id(relative_path: str, file_name: str) -> str:
    h = hashlib.sha256(f"{relative_path}::{file_name}".encode("utf-8")).hexdigest()[:12]
    return f"artifact_{h}"

def _file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()

def build_registry(scanned_files: List[Path], root: Path, with_hash: bool = True) -> Dict[str, Any]:
    """
    Ritorna {"artifacts": [...], "stats": {...}}
    Ogni artifact: {id, type, path, relativePath, fileName, detected_by, sha256, size, root_local, namespace}
    """
    root = Path(root).resolve()
    artifacts: List[Dict[str, Any]] = []
    by_type: Dict[str, int] = {}

    for p in sorted(scanned_files, key=lambda x: str(x.relative_to(root)).lower() if x.is_relative_to(root) else str(x).lower()):
        try:
            rel = str(p.relative_to(root)).replace("\\", "/") if p.is_relative_to(root) else p.name
        except Exception:
            rel = p.name
        atype, detected_by = detect_artifact_type(p)
        # extra root info
        from .artifact_detector import _parse_root_info
        local, ns, _ = _parse_root_info(p)
        sha = _file_sha256(p) if with_hash and p.exists() else None
        size = p.stat().st_size if p.exists() else 0
        aid = _stable_id(rel, p.name)
        artifacts.append({
            "id": aid,
            "type": atype.value,
            "path": str(p),
            "relativePath": rel,
            "fileName": p.name,
            "detected_by": detected_by,
            "root_local": local,
            "namespace": ns,
            "sha256": sha,
            "size": size,
        })
        by_type[atype.value] = by_type.get(atype.value, 0) + 1

    return {
        "root": str(root),
        "generated_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "total": len(artifacts),
        "by_type": by_type,
        "artifacts": artifacts,
    }

def registry_to_json(registry: Dict[str, Any], indent: int = 2) -> str:
    import json
    return json.dumps(registry, indent=indent, ensure_ascii=False)
