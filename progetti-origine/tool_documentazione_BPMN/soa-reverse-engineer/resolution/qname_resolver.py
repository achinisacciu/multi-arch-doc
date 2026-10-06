"""
§5 Liv.1-2 — QName / Namespace Resolver
Risolve QName con prefix via nsmap, gestisce default namespace.
"""
from typing import Optional, Tuple

def split_qname(qname: str) -> Tuple[Optional[str], str]:
    if ":" in qname:
        prefix, local = qname.split(":", 1)
        return prefix, local
    return None, qname

def resolve_qname(qname: str, nsmap: dict, default_ns: str | None = None) -> Tuple[str | None, str]:
    """
    Ritorna (namespace, local) risolto.
    nsmap: dict prefix->uri (da lxml nsmap)
    """
    prefix, local = split_qname(qname)
    if prefix:
        ns = nsmap.get(prefix)
        return ns, local
    # no prefix → default namespace o qname stesso
    return default_ns, local

def qname_to_str(ns: str | None, local: str) -> str:
    return f"{{{ns}}}{local}" if ns else local
