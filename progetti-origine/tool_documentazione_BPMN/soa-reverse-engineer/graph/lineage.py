"""
V0.7 — Data Lineage (§17) + §18 XSLT field mapping
Estrae source_field transformed_by target_field da XSLT value-of
"""
from pathlib import Path
from typing import List, Dict, Any
from lxml import etree

def _local_name(tag: str) -> str:
    if "}" in tag:
        return tag.split("}", 1)[1]
    return tag.split(":")[-1]

def extract_field_mappings(xslt_content: str) -> List[Dict[str, str]]:
    """
    Estrae mapping campo sorgente -> campo destinazione da XSLT.
    Cerca <xsl:value-of select="..."> dentro un elemento di output.
    Ritorna [{source: "ns0:LoanApplication/ns0:amount", target: "tns:amount", transform: "value-of"}]
    """
    mappings: List[Dict[str, str]] = []
    try:
        parser = etree.XMLParser(recover=True, remove_blank_text=True)
        root = etree.fromstring(xslt_content.encode("utf-8"), parser=parser)
        if isinstance(root, etree._ElementTree):
            root = root.getroot()

        for el in root.iter():
            if not isinstance(el.tag, str):
                continue
            if _local_name(el.tag) == "value-of":
                select = el.get("select") or ""
                if not select:
                    continue
                # trova target: parent element
                parent = el.getparent()
                # sali finché non trovi un elemento non xsl
                while parent is not None and isinstance(parent.tag, str) and _local_name(parent.tag) in ("value-of", "template", "stylesheet", "transform", "for-each", "choose", "when", "if"):
                    parent = parent.getparent()
                target = _local_name(parent.tag) if parent is not None and isinstance(parent.tag, str) else "unknown"
                # prova a includere namespace prefix se presente
                if parent is not None and ":" in parent.tag:
                    target = parent.tag.split(":")[-1]  # keep local for now
                    # try to get full with prefix
                    if isinstance(parent.tag, str) and ":" in str(parent.tag):
                        # lxml tag is {ns}local, need to recover prefix from original? use select's ns
                        pass
                mappings.append({
                    "source": select,
                    "target": target,
                    "transform": "value-of",
                    "select": select,
                })
    except Exception:
        pass
    return mappings

def build_lineage_for_xslt(xslt_info: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Wrapper che usa rawContent da parser XSLT."""
    content = xslt_info.get("rawContent") or xslt_info.get("rawXml") or ""
    if not content:
        return []
    return extract_field_mappings(content)

def build_global_lineage(wsdls: List[Dict], xsds: List[Dict], xslt_list: List[Dict]) -> Dict[str, Any]:
    """
    Costruisce lineage globale: XSD element -> WSDL message -> XSLT mapping -> target
    Per V0.7 solo XSLT field mappings come lineage edges.
    """
    nodes = []
    edges = []
    for xslt in xslt_list:
        mappings = build_lineage_for_xslt(xslt)
        for m in mappings:
            src = m["source"]
            tgt = m["target"]
            # crea nodi se non esistono
            sid = f"field:{src}"
            tid = f"field:{tgt}"
            if not any(n["id"] == sid for n in nodes):
                nodes.append({"id": sid, "type": "field", "name": src, "source": xslt["relativePath"]})
            if not any(n["id"] == tid for n in nodes):
                nodes.append({"id": tid, "type": "field", "name": tgt, "source": xslt["relativePath"]})
            edges.append({
                "source": sid,
                "target": tid,
                "type": "transforms",
                "via": xslt["id"],
                "via_file": xslt["relativePath"],
                "transform": m["transform"],
                "confidence": 0.9,
                "evidence": {"artifact": xslt["relativePath"], "select": src}
            })

    return {
        "nodes": nodes,
        "edges": edges,
        "stats": {
            "xslt_count": len(xslt_list),
            "mappings": len(edges),
            "fields": len(nodes),
        }
    }
