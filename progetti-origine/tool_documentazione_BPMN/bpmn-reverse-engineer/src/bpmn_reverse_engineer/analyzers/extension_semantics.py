"""Tool 1.5 — semantic enrichment of extensions + service implementations."""

from __future__ import annotations

from typing import Any

from ..models.process import BpmnDocument
from ..models.references import ServiceImplementation

# Known Oracle/SOA namespaces to interpret — others fallback to raw
ORACLE_NS_HINTS = [
    "xmlns.oracle.com/bpm",
    "xmlns.oracle.com/pcbpel",
    "http://xmlns.oracle.com",
    "oracle.com",
]

def _is_oracle_ns(ns: str | None) -> bool:
    if not ns:
        return False
    return any(h in ns for h in ORACLE_NS_HINTS)

def _extract_endpoint_from_extension(ext) -> tuple[str | None, str | None, str | None]:
    """Try to guess endpoint/binding from ExtensionElement attributes/text/structure."""
    attrs = ext.attributes or {}
    # common keys
    for k in ("endpoint", "endpointUri", "uri", "address", "location", "url"):
        for ak, av in attrs.items():
            local = ak.split("}")[-1].split(":")[-1]
            if local.lower() == k.lower():
                return av, attrs.get("binding") or attrs.get("type"), None
    # check structure children recursively for endpoint-like
    def walk(node: dict[str, Any]) -> tuple[str | None, str | None]:
        if not isinstance(node, dict):
            return None, None
        attrs = node.get("attributes") or {}
        for ak, av in attrs.items():
            local = ak.split("}")[-1].split(":")[-1]
            if local.lower() in ("endpoint", "uri", "address", "location"):
                return av, node.get("tag")
        for child in node.get("children", []) or []:
            v, t = walk(child)
            if v:
                return v, t
        return None, None
    if ext.structure:
        v, t = walk(ext.structure)
        if v:
            return v, None, t
    return None, None, None


def enrich_extensions(doc: BpmnDocument) -> BpmnDocument:
    """Create service_implementations from extensions + references + raw_attributes.

    Deterministico, solo quando sappiamo cosa significa l'extension.
    Altrimenti preserva raw e status=unresolved.
    """
    impls: list[ServiceImplementation] = []
    unresolved: list[dict[str, Any]] = []

    # index extensions by parent_id
    ext_by_parent: dict[str, list] = {}
    for ext in doc.extensions:
        pid = ext.parent_id or "unknown"
        ext_by_parent.setdefault(pid, []).append(ext)

    # index references by source
    ref_by_source: dict[str, dict[str, str]] = {}
    for r in doc.references:
        ref_by_source.setdefault(r.source_element, {})[r.attribute] = r.value

    for e in doc.elements:
        # only activities that may have service implementation
        if e.type not in ("serviceTask", "sendTask", "receiveTask", "task", "businessRuleTask", "callActivity", "scriptTask", "userTask"):
            # still check if it has extensions — could be gateway with binding
            pass

        exts = ext_by_parent.get(e.id, [])
        refs = ref_by_source.get(e.id, {})
        raw = e.raw_attributes or {}

        # Gather signals
        operation_ref = e.operation_ref or refs.get("operationRef") or refs.get("operation")
        interface_ref = e.interface_ref or refs.get("interfaceRef")
        message_ref = e.message_ref or refs.get("messageRef")
        implementation = e.implementation

        # Try to interpret each extension
        for ext in exts:
            endpoint, binding, tag_hint = _extract_endpoint_from_extension(ext)
            # Determine vendor
            ns = ext.namespace or ""
            is_oracle = _is_oracle_ns(ns)
            # Build ServiceImplementation if any signal present
            has_signal = any([operation_ref, interface_ref, message_ref, endpoint, ext.tag.lower() in ("adapter", "binding", "service", "reference")])
            if has_signal or e.type in ("serviceTask", "sendTask", "receiveTask"):
                # Create impl entry
                adapter = None
                # try to get adapter name from attributes
                for ak, av in (ext.attributes or {}).items():
                    local = ak.split("}")[-1].split(":")[-1].lower()
                    if local in ("adapter", "jcaadapter", "name", "ref"):
                        adapter = av
                        break
                # also check extension tag
                ext_tag = ext.tag
                status = "unresolved"
                # Heuristic: if we have operationRef or endpoint, consider partially resolved
                if operation_ref or endpoint:
                    status = "ambiguous" if not interface_ref else "resolved"

                impl = ServiceImplementation(
                    task_id=e.id,
                    task_name=e.name,
                    task_type=e.type,
                    implementation=implementation,
                    operation_ref=operation_ref,
                    interface_ref=interface_ref,
                    message_ref=message_ref,
                    endpoint=endpoint,
                    binding_type=binding or (ext.tag if ext.tag.lower() in ("binding", "adapter") else None),
                    adapter=adapter,
                    wsdl=refs.get("wsdlLocation") or refs.get("wsdl"),
                    namespace=ns,
                    source=f"extensionElements/{ext_tag}",
                    status=status,
                    extension_tag=ext_tag,
                    raw_attributes=dict(ext.attributes or {}),
                )
                # avoid duplicates for same task+operation+endpoint
                key = (impl.task_id, impl.operation_ref, impl.endpoint, impl.extension_tag)
                if not any((i.task_id, i.operation_ref, i.endpoint, i.extension_tag) == key for i in impls):
                    impls.append(impl)

        # If serviceTask with no extension but with operationRef/interfaceRef in references/raw, create entry from refs alone
        if e.type in ("serviceTask", "sendTask", "receiveTask") and not exts and any([operation_ref, interface_ref, message_ref, implementation]):
            impl = ServiceImplementation(
                task_id=e.id,
                task_name=e.name,
                task_type=e.type,
                implementation=implementation,
                operation_ref=operation_ref,
                interface_ref=interface_ref,
                message_ref=message_ref,
                endpoint=None,
                source="raw_attributes/references",
                status="unresolved" if not operation_ref else "ambiguous",
                raw_attributes=dict(raw),
            )
            if not any(i.task_id == e.id and i.operation_ref == operation_ref for i in impls):
                impls.append(impl)

        # Unresolved references tracking
        for attr in ("operationRef", "interfaceRef", "messageRef"):
            if attr in refs:
                val = refs[attr]
                # consider unresolved if not found in any WSDL/definition (we don't have WSDL yet -> always unresolved for 1.5)
                unresolved.append({"source_element": e.id, "attribute": attr, "value": val, "reason": "no WSDL/BPEL resolver yet (Tool 2)"})

    # Also global extensions not tied to a task (e.g., process-level)
    # Already counted per task; keep overall metrics

    # Attach to doc
    doc.service_implementations = [i.model_dump() if hasattr(i, "model_dump") else i for i in impls]  # keep as list[dict] for JSON compat
    # For pydantic, we store as list[Any] but also keep typed for metrics
    # Use actual objects for internal count
    doc.unresolved_references = unresolved  # type: ignore

    # Update metrics
    doc.metrics.num_service_implementations = len(impls)
    doc.metrics.num_unresolved_refs = len(unresolved)
    # count messages/interfaces/operations from references (approx)
    doc.metrics.num_messages = len([r for r in doc.references if r.attribute.lower() == "messageref"])
    doc.metrics.num_interfaces = len([r for r in doc.references if r.attribute.lower() == "interfaceref"])
    doc.metrics.num_operations = len([r for r in doc.references if r.attribute.lower() == "operationref"])

    # Also enrich references with resolved flag
    for r in doc.references:
        if r.attribute in ("operationRef", "interfaceRef", "messageRef", "calledElement", "processRef"):
            # Tool 1.5 cannot resolve without WSDL/BPEL, so mark unresolved
            r.resolved = False
            r.target_hint = f"await Tool 2 resolver (WSDL/composite)"

    return doc
