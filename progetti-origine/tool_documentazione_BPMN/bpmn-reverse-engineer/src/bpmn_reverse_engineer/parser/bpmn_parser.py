"""Robust BPMN 2.0 parser — namespace-agnostic, no invention."""

from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

from lxml import etree

from ..models.elements import BpmnElement
from ..models.flows import MessageFlow, SequenceFlow
from ..models.process import BpmnDocument, BpmnProcess, Collaboration, Lane, Participant, SourceInfo
from ..models.references import ExplicitReference, ExtensionElement

from .extensions import extension_to_full_structure, extract_extension_elements, serialize_element
from .namespaces import (
    ACTIVITY_TYPES,
    EVENT_DEFINITIONS,
    EVENT_TYPES,
    GATEWAY_TYPES,
    KNOWN_ELEMENTS,
    local_name,
    namespace_uri,
)

# Attributes that constitute explicit references (local-name matching)
REFERENCE_ATTRS = {
    "calledElement",
    "processRef",
    "messageRef",
    "operationRef",
    "interfaceRef",
    "resourceRef",
    "itemSubjectRef",
    "itemRef",
    "dataStoreRef",
    "structureRef",
    "typeRef",
    "elementRef",
    "sourceRef",
    "targetRef",
    "calledElementRef",
}

# Also look for any attribute ending with "Ref" / "Refs" in extensions
REF_SUFFIXES = ("Ref", "Refs", "QName", "qname")


def _raw_attrs(elem: etree._Element) -> dict[str, Any]:
    return {k: v for k, v in elem.attrib.items()}


def _doc(elem: etree._Element) -> str | None:
    parts: list[str] = []
    for child in elem:
        if local_name(child.tag) == "documentation":
            t = (child.text or "").strip()
            if t:
                parts.append(t)
            # also handle HTML inside?
            else:
                # concatenate all text content
                txt = "".join(child.itertext()).strip()
                if txt:
                    parts.append(txt)
    if not parts:
        return None
    return "\n".join(parts)


def _incoming(elem: etree._Element) -> list[str]:
    return [ (c.text or "").strip() for c in elem if local_name(c.tag) == "incoming" and (c.text or "").strip() ]


def _outgoing(elem: etree._Element) -> list[str]:
    return [ (c.text or "").strip() for c in elem if local_name(c.tag) == "outgoing" and (c.text or "").strip() ]


def _event_definitions(elem: etree._Element) -> list[str]:
    defs: list[str] = []
    for child in elem:
        ln = local_name(child.tag)
        if ln in EVENT_DEFINITIONS:
            defs.append(ln)
    return defs


def _is_in_bpmndi_subtree(elem: etree._Element) -> bool:
    # check ancestors for BPMNDI / DI / DC namespaces or tags like BPMNDiagram
    cur = elem
    while cur is not None:
        if not isinstance(cur.tag, str):
            cur = cur.getparent()
            continue
        ln = local_name(cur.tag)
        ns = namespace_uri(cur.tag) or ""
        if "BPMNDI" in cur.tag or "bpmndi" in ln.lower() or "BPMNDI" in ns:
            return True
        if ln in {"BPMNDiagram", "BPMNPlane", "BPMNShape", "BPMNEdge", "Bounds", "waypoint"}:
            return True
        if "DD/20100524" in ns or "DI" in ns:
            return True
        cur = cur.getparent()
    return False


def parse_bpmn(file_path: str | Path) -> BpmnDocument:
    path = Path(file_path)
    raw = path.read_bytes()
    sha = hashlib.sha256(raw).hexdigest()
    size = len(raw)

    parser = etree.XMLParser(recover=True, remove_blank_text=False)
    try:
        root = etree.fromstring(raw, parser=parser)
    except etree.XMLSyntaxError as e:
        raise ValueError(f"Invalid XML: {e}") from e

    # If file had XML declaration and we got root as element, fine.
    # Sometimes parser gives tree; ensure root is element
    if isinstance(root, etree._ElementTree):
        root = root.getroot()

    source = SourceInfo(filename=path.name, sha256=sha, size_bytes=size)
    doc = BpmnDocument(source=source)

    # Collect all elements in document order
    # We'll first scan for high-level constructs
    # Use iterative BFS to handle nested subprocesses

    # --- Collaborations & Participants & MessageFlows (top-level under definitions) ---
    collaborations: list[etree._Element] = []
    participants_elems: list[etree._Element] = []
    message_flows_elems: list[etree._Element] = []

    for elem in root.iter():
        if not isinstance(elem.tag, str):
            continue
        if _is_in_bpmndi_subtree(elem):
            continue
        ln = local_name(elem.tag)
        if ln == "collaboration":
            collaborations.append(elem)
        elif ln == "participant":
            participants_elems.append(elem)
        elif ln == "messageFlow":
            # messageFlow can be under collaboration or definitions
            message_flows_elems.append(elem)

    for coll in collaborations:
        cid = coll.get("id") or "unknown_collab"
        doc.collaborations.append(
            Collaboration(id=cid, name=coll.get("name"), raw_attributes=_raw_attrs(coll),)
        )

    for p_elem in participants_elems:
        pid = p_elem.get("id") or "unknown_participant"
        doc.participants.append(
            Participant(
                id=pid,
                name=p_elem.get("name"),
                process_ref=p_elem.get("processRef"),
                raw_attributes=_raw_attrs(p_elem),
            )
        )

    for mf in message_flows_elems:
        mid = mf.get("id") or "unknown_mf"
        doc_msg = _doc(mf)
        doc.message_flows.append(
            MessageFlow(
                id=mid,
                name=mf.get("name"),
                source_ref=mf.get("sourceRef"),
                target_ref=mf.get("targetRef"),
                raw_attributes=_raw_attrs(mf),
                documentation=doc_msg,
            )
        )

    # --- Processes and their children ---
    # We need to capture lane info early so we can assign lane to elements
    lane_map: dict[str, tuple[str, str | None]] = {}  # flowNodeRef -> (laneId, laneName)

    # Collect lanes (laneSet -> lane)
    for elem in root.iter():
        if not isinstance(elem.tag, str):
            continue
        if _is_in_bpmndi_subtree(elem):
            continue
        if local_name(elem.tag) == "lane":
            lid = elem.get("id") or "unknown_lane"
            lname = elem.get("name")
            flow_refs: list[str] = []
            for child in elem:
                if local_name(child.tag) == "flowNodeRef":
                    txt = (child.text or "").strip()
                    if txt:
                        flow_refs.append(txt)
                        lane_map[txt] = (lid, lname)
            # raw_attributes include id/name but we capture
            doc.lanes.append(Lane(id=lid, name=lname, flow_node_refs=flow_refs, raw_attributes=_raw_attrs(elem)))

    # If lanes defined inside process laneSet, also capture.
    # lane_map already built above covers both.

    # Find process elements
    process_elems: list[etree._Element] = []
    for elem in root.iter():
        if not isinstance(elem.tag, str):
            continue
        if _is_in_bpmndi_subtree(elem):
            continue
        if local_name(elem.tag) == "process":
            process_elems.append(elem)

    # Also check for definitions attributes (namespace)
    definitions_ns = namespace_uri(root.tag)

    for proc in process_elems:
        pid = proc.get("id") or "unknown_process"
        pname = proc.get("name")
        is_exec = proc.get("isExecutable")
        exec_bool: bool | None = None
        if is_exec is not None:
            exec_bool = is_exec.lower() in ("true", "1")
        doc.processes.append(
            BpmnProcess(
                id=pid,
                name=pname,
                namespace=namespace_uri(proc.tag),
                is_executable=exec_bool,
                raw_attributes=_raw_attrs(proc),
                documentation=_doc(proc),
            )
        )

        # Extensions on process itself
        ext_list, raw_children = extract_extension_elements(proc)
        for rc in raw_children:
            ext = extension_to_full_structure(rc, pid, "process")
            doc.extensions.append(ExtensionElement(**ext))

        # Parse child flow elements
        # Need to handle nested subProcesss recursively
        _parse_process_children(
            proc,
            doc,
            lane_map,
            pid,
            pname,
            is_root_process=True,
        )

    # Also handle elements that might be outside any process but still flow nodes? (unlikely)
    # Already handled via lane map.

    # References extraction already done partially; now comprehensive scan
    _extract_references(doc, root)

    # Extensions already partially; scan all elements for any extensionElements not captured?
    # We handled per-process and per-element; ensure any top-level extensions (collaboration etc) are captured
    for elem in root.iter():
        if not isinstance(elem.tag, str):
            continue
        if _is_in_bpmndi_subtree(elem):
            continue
        ln = local_name(elem.tag)
        if ln == "extensionElements":
            # already handled per-parent; avoid double count
            continue
        # if this element has extensionElements child, we already extracted in _parse_process_children for flow nodes
        # but for collaboration/participant we may not have
        if ln in {"collaboration", "participant", "definitions"}:
            _, raw_children = extract_extension_elements(elem)
            for rc in raw_children:
                # avoid duplicate if already added
                # check by raw_xml
                raw_xml = etree.tostring(rc, encoding="unicode")
                if any(e.raw_xml == raw_xml for e in doc.extensions):
                    continue
                parent_id = elem.get("id")
                ext = extension_to_full_structure(rc, parent_id, ln)
                doc.extensions.append(ExtensionElement(**ext))

    # Build unknown_elements list convenience
    doc.unknown_elements = [e for e in doc.elements if e.is_unknown]

    return doc


def _parse_process_children(
    container: etree._Element,
    doc: BpmnDocument,
    lane_map: dict[str, tuple[str, str | None]],
    process_id: str | None,
    process_name: str | None,
    is_root_process: bool = False,
):
    """Parse direct children of a process or subprocess. Handles sequenceFlow and flow nodes."""

    # We need to handle 2-level: subprocess children may include same element types.
    # We'll iterate over direct children of container.
    for child in container:
        if not isinstance(child.tag, str):
            continue
        ln = local_name(child.tag)
        ns = namespace_uri(child.tag)

        # Skip bpmndi, documentation, extensionElements, laneSet, etc. that are not flow nodes
        if ln in {"documentation", "extensionElements", "laneSet", "ioSpecification", "property"}:
            continue
        if ln == "laneSet":
            continue

        # SequenceFlow is special
        if ln == "sequenceFlow":
            sf_id = child.get("id") or "unknown_flow"
            # conditionExpression child
            cond_text: str | None = None
            cond_lang: str | None = None
            doc_txt: str | None = _doc(child)
            for c2 in child:
                if local_name(c2.tag) == "conditionExpression":
                    cond_text = (c2.text or "").strip() or "".join(c2.itertext()).strip() or None
                    # Keep raw exactly as appears: if CDATA or expression, preserve text
                    if cond_text == "":
                        cond_text = None
                    # formal check for language attr
                    cond_lang = c2.get("language") or c2.get("{http://www.w3.org/1999/xlink}language")
                    # also try xsi type?
                    if cond_lang is None:
                        # look for any attribute containing language
                        for k, v in c2.attrib.items():
                            if "language" in k.lower():
                                cond_lang = v
                    break
            # isDefault: check if this flow is referenced as gateway default
            # We'll later mark is_default after scanning gateways — for now false
            raw = _raw_attrs(child)
            doc.sequence_flows.append(
                SequenceFlow(
                    id=sf_id,
                    name=child.get("name"),
                    source_ref=child.get("sourceRef"),
                    target_ref=child.get("targetRef"),
                    condition=cond_text,
                    condition_language=cond_lang,
                    is_default=False,
                    raw_attributes=raw,
                    documentation=doc_txt,
                )
            )
            # extensions on sequenceFlow?
            _, raw_children = extract_extension_elements(child)
            for rc in raw_children:
                ext = extension_to_full_structure(rc, sf_id, "sequenceFlow")
                doc.extensions.append(ExtensionElement(**ext))
            continue

        # Check if this child is a flow node (event, activity, gateway) or subprocess container
        # Determine type
        element_type = ln
        is_unknown = False

        # Ignore BPMNDI elements
        if _is_in_bpmndi_subtree(child):
            continue

        # Known flow node types or unknown BPMN
        # We consider any element that is under BPMN namespace and not a known structural element as potential unknown.
        # But we should ignore child elements like incoming/outgoing which already handled as not flow node.
        if ln in {"incoming", "outgoing", "conditionExpression", "default", "extensionElements"}:
            continue

        # Determine if this is a candidate BPMN element
        # Heuristics: if it has id attribute and is under process/subProcess, treat as flow node or unknown.
        # Also if its namespace is BPMN or no namespace.
        is_bpmn_candidate = False
        if ns is None or "BPMN" in (ns or "") or ln in KNOWN_ELEMENTS or ln in EVENT_DEFINITIONS or ln in EVENT_TYPES or ln in ACTIVITY_TYPES or ln in GATEWAY_TYPES:
            is_bpmn_candidate = True
        else:
            # Check if tag looks like bpmn local name but with custom prefix — treat as candidate if parent is process
            # We already in process context, so consider any element with at least an id
            if child.get("id") is not None:
                is_bpmn_candidate = True

        if not is_bpmn_candidate:
            continue

        # Now classify: if ln not in KNOWN_ELEMENTS and not in any known set except definitions/process, it's unknown
        # BUT we want to treat sequenceFlow/collaboration etc already handled; for flow nodes, check.
        known_flow_types = EVENT_TYPES | ACTIVITY_TYPES | GATEWAY_TYPES
        if ln not in known_flow_types and ln not in {"subProcess", "adHocSubProcess", "transaction", "callActivity"} and ln != "sequenceFlow":
            # Check if this ln is something like dataObject etc — then we may ignore or treat as element?
            # Spec says: if other BPMN elements found, register as unknown_bpmn_element keeping tag etc.
            # So if ln not in KNOWN_ELEMENTS and not structural, treat as unknown but still record as element if it has id/name.
            # However, avoid treating_lane stuff; already handled.
            if ln in KNOWN_ELEMENTS:
                # known but not flow node (e.g., dataObject) — still record as element? spec says elements contains all
                # For now record as element with its type
                pass
            else:
                # Unknown element heuristic: must be immediate child of process/subProcess and have id or name
                # or be custom extension with bpmn namespace? We'll mark as unknown.
                # But ignore if it's clearly not BPMN (e.g., some vendor extension at process level that is not flow node)
                # Vendor extensions are inside extensionElements, not direct child, so safe to mark unknown.
                if child.get("id") is not None or child.get("name") is not None:
                    is_unknown = True
                else:
                    # Might be something like property — skip
                    continue

        # Create BpmnElement for this flow node
        elem_id = child.get("id")
        if elem_id is None:
            # If no id, but it's a flow node, we generate placeholder? Spec says id required but tolerate missing
            # Use generated id to keep graph consistent — but also record raw_attributes
            elem_id = f"unknown_{ln}_{len(doc.elements)}"

        # Gather element data
        elem_doc = _doc(child)
        incoming = _incoming(child)
        outgoing = _outgoing(child)
        event_defs = _event_definitions(child)
        ext_list, raw_children = extract_extension_elements(child)
        # default flow for gateways
        default_flow: str | None = None
        for c2 in child:
            if local_name(c2.tag) == "default":
                # sometimes default is attribute, sometimes child?
                pass
        # attribute default
        if child.get("default") is not None:
            default_flow = child.get("default")

        lane_id, lane_name = lane_map.get(elem_id, (None, None))  # type: ignore

        bpmn_elem = BpmnElement(
            id=elem_id,
            name=child.get("name"),
            type=element_type if not is_unknown else "unknown_bpmn_element",
            namespace=ns,
            documentation=elem_doc,
            incoming=incoming,
            outgoing=outgoing,
            raw_attributes=_raw_attrs(child),
            extensions=ext_list,
            event_definitions=event_defs,
            default_flow=default_flow,
            lane_id=lane_id,
            lane_name=lane_name,
            process_id=process_id,
            process_name=process_name,
            is_unknown=is_unknown,
            original_tag=child.tag if is_unknown else None,
        )
        doc.elements.append(bpmn_elem)

        # Extensions global list
        for rc in raw_children:
            ext = extension_to_full_structure(rc, elem_id, element_type)
            doc.extensions.append(ExtensionElement(**ext))

        # If this is a subprocess, recurse into its children
        if ln in {"subProcess", "adHocSubProcess", "transaction"}:
            _parse_process_children(child, doc, lane_map, process_id, process_name, is_root_process=False)
        # callActivity is not container, but could have extensions
        # boundaryEvent is attached, already captured

    # After parsing all, mark default sequence flows
    # Gateway default attribute indicates which flow is default
    for elem in doc.elements:
        if elem.default_flow:
            for sf in doc.sequence_flows:
                if sf.id == elem.default_flow:
                    sf.is_default = True


def _extract_references(doc: BpmnDocument, root: etree._Element):
    """Scan all attributes for explicit references."""
    # Build element id -> type map for source_type resolution
    id_to_type: dict[str, str] = {e.id: e.type for e in doc.elements}
    for proc in doc.processes:
        id_to_type[proc.id] = "process"
    for p in doc.participants:
        id_to_type[p.id] = "participant"

    # Iterate all elements in tree
    for elem in root.iter():
        if not isinstance(elem.tag, str):
            continue
        if _is_in_bpmndi_subtree(elem):
            continue
        ln = local_name(elem.tag)
        elem_id = elem.get("id") or elem.get("name") or ln
        # Check each attribute
        for attr_qname, val in elem.attrib.items():
            attr_local = local_name(attr_qname)
            # Match explicit reference attributes
            is_ref = False
            if attr_local in REFERENCE_ATTRS:
                is_ref = True
            elif any(attr_local.endswith(suf) for suf in REF_SUFFIXES):
                # Heuristic for extension references: e.g., custom:serviceRef
                # Only count if value looks like QName or not empty
                if val and val.strip():
                    # Avoid false positives like sourceRef/targetRef already handled but still valid
                    # For generic refs, ensure attribute contains Ref or QName
                    is_ref = True
            if is_ref:
                # Avoid counting sourceRef/targetRef of sequenceFlow as "explicit reference"? Spec says extract all explicit refs
                # Include them still but classify as explicit_xml_reference
                ns = namespace_uri(attr_qname) or namespace_uri(elem.tag)
                # Try to extract prefix namespace URI via elem.nsmap
                # lxml nsmap holds mapping
                prefix, _ = _split_qname(val)
                qname_ns = None
                if prefix and prefix in elem.nsmap:
                    qname_ns = elem.nsmap[prefix]
                doc.references.append(
                    ExplicitReference(
                        source_element=elem_id,
                        source_type=id_to_type.get(elem_id),
                        attribute=attr_local,
                        value=val,
                        namespace=qname_ns or ns,
                    )
                )

        # Also scan extensionElements' inner attributes already covered via iter, but ensure inner elements' refs are captured (they are part of iter)

    # Deduplicate? Keep duplicates if same source/attribute but different value — spec says keep all
    # But remove exact duplicates
    seen = set()
    deduped: list[ExplicitReference] = []
    for r in doc.references:
        key = (r.source_element, r.attribute, r.value)
        if key not in seen:
            seen.add(key)
            deduped.append(r)
    doc.references = deduped


def _split_qname(value: str) -> tuple[str | None, str]:
    if ":" in value:
        a, b = value.split(":", 1)
        return a, b
    return None, value
