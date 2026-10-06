"""ExtensionElements handling — preserve raw XML, no invention."""

from __future__ import annotations

from typing import Any

from lxml import etree

from .namespaces import local_name, namespace_uri


def serialize_element(elem: etree._Element) -> dict[str, Any]:
    """Recursively serialize an lxml element to a JSON-serializable dict."""
    ln = local_name(elem.tag)
    ns = namespace_uri(elem.tag)
    attrs: dict[str, Any] = {}
    for k, v in elem.attrib.items():
        # keep Clark notation for attribute names to avoid losing prefix info
        attrs[k] = v

    children = [serialize_element(c) for c in elem]

    text = (elem.text or "").strip() or None
    tail = (elem.tail or "").strip() or None

    return {
        "tag": ln,
        "full_tag": elem.tag,
        "namespace": ns,
        "attributes": attrs,
        "text": text,
        "tail": tail,
        "children": children,
    }


def extract_extension_elements(elem: etree._Element) -> tuple[list[dict[str, Any]], list[etree._Element]]:
    """Find direct bpmn:extensionElements children and return (serialized_list, raw_child_elements)."""
    result: list[dict[str, Any]] = []
    raw_children: list[etree._Element] = []
    for child in elem:
        if local_name(child.tag) == "extensionElements":
            for ext_child in child:
                raw_children.append(ext_child)
                result.append(serialize_element(ext_child))
    return result, raw_children


def extension_to_full_structure(ext_elem: etree._Element, parent_id: str | None, parent_type: str | None) -> dict[str, Any]:
    return {
        "parent_id": parent_id,
        "parent_type": parent_type,
        "namespace": namespace_uri(ext_elem.tag),
        "tag": local_name(ext_elem.tag),
        "full_tag": ext_elem.tag,
        "attributes": dict(ext_elem.attrib),
        "text": (ext_elem.text or "").strip() or None,
        "structure": serialize_element(ext_elem),
        "raw_xml": etree.tostring(ext_elem, encoding="unicode", pretty_print=False),
    }
