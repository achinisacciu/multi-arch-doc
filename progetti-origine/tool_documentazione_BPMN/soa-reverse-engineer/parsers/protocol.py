"""
Parser Protocol — §2: ogni tecnologia è un adapter verso Canonical Model.
"""
from typing import Protocol, List
from pathlib import Path

class ArtifactContext:
    """Contesto passato al parser: path, root element, namespace, file content."""
    def __init__(self, path: Path, root_local: str | None, namespace: str | None, content: str | None = None):
        self.path = path
        self.root_local = root_local
        self.namespace = namespace
        self.content = content

class CanonicalFragment:
    """Frammento canonico prodotto da un parser (porzione di CanonicalModel)."""
    def __init__(self, artifact_id: str, entities: List[dict] | None = None, dependencies: List[dict] | None = None):
        self.artifact_id = artifact_id
        self.entities = entities or []
        self.dependencies = dependencies or []

class ParserProtocol(Protocol):
    artifact_type: str  # es. "bpmn", "bpel", "wsdl"

    def can_parse(self, ctx: ArtifactContext) -> bool:
        """Ritorna True se questo parser può gestire l'artifact."""
        ...

    def parse(self, ctx: ArtifactContext) -> CanonicalFragment:
        """Esegue parsing deterministico e ritorna fragment con Evidence/Provenance."""
        ...
