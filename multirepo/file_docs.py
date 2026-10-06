"""file_docs.py — router per-file XML + doc builders stdlib-only.

Regola utente: se un XML e' riconosciuto (ODI mapping / LP / scenario,
BPMN, BPEL, SCA, WSDL, XSD, XSLT, JCA, ...) si documenta nel suo formato;
se non si capisce cosa sia -> doc generica leggera .md.

Solo stdlib (xml.etree). Niente lxml per non aggiungere dipendenze a collect.
"""
from __future__ import annotations

import os
import re

MAX_SNIFF_BYTES = 5_000_000

# --- nomi sicuri -----------------------------------------------------------

_SAFE_RE = re.compile(r"[^\w\-]+")


def safe_name(name: str, fallback: str = "doc") -> str:
    s = _SAFE_RE.sub("_", (name or "").strip()).strip("_")
    return s or fallback


def _local(tag: str) -> str:
    if not isinstance(tag, str):
        return ""
    if "}" in tag:
        return tag.split("}", 1)[1]
    return tag.split(":")[-1]


def _ns(tag: str) -> str:
    if isinstance(tag, str) and tag.startswith("{"):
        return tag[1:].split("}", 1)[0]
    return ""


# --- hints namespace/root (port di artifact_detector, senza dipendenze) ----

NS_HINTS = {
    "schemas.xmlsoap.org/wsdl": "wsdl",
    "www.w3.org/2001/XMLSchema": "xsd",
    "www.w3.org/1999/XSL/Transform": "xslt",
    "docs.oasis-open.org/wsbpel": "bpel",
    "xmlns.oracle.com/sca/1.0/mediator": "mediator",
    "xmlns.oracle.com/sca/1.0": "sca",
    "xmlns.oracle.com/bpel/workflow/taskDefinition": "humantask",
    "platform.integration.oracle/blocks/adapter/fw/metadata": "jca",
    "omg.org/spec/BPMN": "bpmn",
}

ROOT_HINTS = {
    "adapter-config": "jca",
    "composite": "sca",
    "Mediator": "mediator",
    "taskDefinition": "humantask",
    "schema": "xsd",
    "stylesheet": "xslt",
    "transform": "xslt",
    "process": "bpel",  # bpel:process (confermato da fingerprint invoke/partnerLink)
    "definitions": None,  # ambiguo BPMN vs WSDL -> namespace/fingerprint
    "wsdl:definitions": None,
}

EXT_HINTS = {
    ".bpel": "bpel",
    ".bpmn": "bpmn",
    ".wsdl": "wsdl",
    ".xsd": "xsd",
    ".xsl": "xslt",
    ".xslt": "xslt",
    ".jca": "jca",
    ".mplan": "mediator",
    ".task": "humantask",
    ".dvm": "dvm",
    ".componenttype": "sca",
}


def _root_info(path: str) -> tuple[str, str, str]:
    """(local, ns, head_text). head_text serve per fingerprint senza full-parse."""
    import xml.etree.ElementTree as ET

    try:
        if os.path.getsize(path) > MAX_SNIFF_BYTES:
            return "", "", ""
    except OSError:
        return "", "", ""
    try:
        root = ET.parse(path).getroot()
        return _local(root.tag), _ns(root.tag), ""
    except Exception:
        pass
    try:
        with open(path, encoding="utf-8", errors="ignore") as fh:
            head = fh.read(8000)
    except OSError:
        return "", "", ""
    m = re.search(r"<\s*([A-Za-z_][\w:.\-]*)", head)
    local = (m.group(1).split(":")[-1] if m else "")
    nsm = re.search(r'xmlns(?::\w+)?="([^"]+)"', head)
    return local, (nsm.group(1) if nsm else ""), head.lower()


def _odi_classes(path: str) -> set[str]:
    """Classi Snp* presenti nel file (solo nomi classe, leggero)."""
    import xml.etree.ElementTree as ET

    try:
        if os.path.getsize(path) > MAX_SNIFF_BYTES:
            return set()
        root = ET.parse(path).getroot()
    except Exception:
        return set()
    out: set[str] = set()
    for obj in root.iter():
        if not isinstance(obj.tag, str) or _local(obj.tag) != "Object":
            continue
        cls = (obj.get("class") or "").rsplit(".", 1)[-1]
        if cls:
            out.add(cls)
    return out


def _fingerprint(head: str, path: str) -> str:
    """Fingerprint testuale quando root/namespace sono ambigui."""
    if not head:
        try:
            with open(path, encoding="utf-8", errors="ignore") as fh:
                head = fh.read(8000).lower()
        except OSError:
            return ""
    if "snp mapping" in head or "snp Lees" in head:
        return ""
    if "partnerlink" in head and (
            "wsbpel" in head or "<invoke" in head or "<receive" in head
            or "<reply" in head or "partnerlinktype" in head):
        return "bpel"
    if "bpmn:process" in head or 'xmlns:bpmn="http://www.omg.org' in head:
        return "bpmn"
    if "porttype" in head and "binding" in head:
        return "wsdl"
    return ""


def classify_xml(path: str, rel: str = "") -> dict:
    """Classifica un file XML. Ritorna {file, kind, detected_by, detail}.

    kind in: odi-mapping|odi-lp|odi-scen|bpmn|bpel|sca|wsdl|xsd|xslt|
    jca|mediator|humantask|dvm|config-xml|other-xml|unknown|non-xml.
    """
    name = os.path.basename(path)
    rel = rel or name
    _base, ext = os.path.splitext(name)
    ext = ext.lower()
    if name == "composite.xml":
        return {"file": rel, "kind": "sca",
                "detected_by": "filename",
                "detail": "composite SCA Oracle"}
    if name.endswith(".componentType"):
        return {"file": rel, "kind": "sca",
                "detected_by": "filename",
                "detail": "SCA componentType"}

    # 1. ODI per classi Snp* (priorita' massima: root SunopsisExport generico)
    if ext == ".xml":
        classes = _odi_classes(path)
        if "SnpMapping" in classes:
            return {"file": rel, "kind": "odi-mapping",
                    "detected_by": "odi-class:SnpMapping",
                    "detail": "export ODI con mapping"}
        if "SnpLoadPlan" in classes:
            return {"file": rel, "kind": "odi-lp",
                    "detected_by": "odi-class:SnpLoadPlan",
                    "detail": "LoadPlan ODI"}
        if "SnpScen" in classes:
            return {"file": rel, "kind": "odi-scen",
                    "detected_by": "odi-class:SnpScen",
                    "detail": "scenario ODI"}

    local, ns, head = _root_info(path)
    # Layout grafici JDeveloper (.designer/*_graphics.xml): niente semantica.
    if local in ("graphics", "diagram") and ext == ".xml":
        return {"file": rel, "kind": "other-xml",
                "detected_by": "root-layout",
                "detail": f"root <{local}>: layout grafico, doc generica"}
    if not local and ext != ".xml":
        # non parsabile come XML ma estensione nota SOA
        kind = EXT_HINTS.get(ext)
        if kind:
            return {"file": rel, "kind": kind, "detected_by": "extension",
                    "detail": f"estensione {ext}, contenuto non XML o illeggibile"}
        return {"file": rel, "kind": "non-xml", "detected_by": "extension",
                "detail": "non XML"}

    # 2. namespace
    if ns:
        for hint, kind in NS_HINTS.items():
            if hint in ns:
                if kind == "bpmn" or ext in (".xml", ".bpmn"):
                    return {"file": rel, "kind": kind,
                            "detected_by": "namespace",
                            "detail": f"namespace {ns[:80]}"}
                if ext == ".xml" or EXT_HINTS.get(ext) == kind:
                    return {"file": rel, "kind": kind,
                            "detected_by": "namespace",
                            "detail": f"namespace {ns[:80]}"}
    # 3. root
    if local in ROOT_HINTS and ROOT_HINTS[local]:
        kind = ROOT_HINTS[local]
        if kind == "bpel":
            # root process da solo e' debole: conferma via fingerprint/estensione
            fp = _fingerprint(head, path)
            if ext == ".bpel" or fp == "bpel":
                return {"file": rel, "kind": "bpel",
                        "detected_by": "root+fingerprint" if fp else "extension+root",
                        "detail": "process BPEL"}
        else:
            return {"file": rel, "kind": kind, "detected_by": "root",
                    "detail": f"root <{local}>"}
    if local == "definitions" or local.endswith("definitions"):
        fp = _fingerprint(head, path)
        if fp in ("bpmn", "wsdl"):
            return {"file": rel, "kind": fp,
                    "detected_by": "root+fingerprint",
                    "detail": f"root <{local}> con fingerprint {fp}"}
        if ns and "BPMN" in ns:
            return {"file": rel, "kind": "bpmn", "detected_by": "namespace+root",
                    "detail": f"root <{local}> namespace BPMN"}
        if ns and "wsdl" in ns.lower():
            return {"file": rel, "kind": "wsdl", "detected_by": "namespace+root",
                    "detail": f"root <{local}> namespace WSDL"}
    # 4. fingerprint su contenuto (file .xml con root custom ma corpo BPEL/BPMN)
    if ext == ".xml":
        fp = _fingerprint(head, path)
        if fp in ("bpel", "bpmn", "wsdl"):
            return {"file": rel, "kind": fp, "detected_by": "fingerprint",
                    "detail": f"impronta contenuto {fp}"}
    # 5. estensione SOA non-XML
    if ext in EXT_HINTS:
        return {"file": rel, "kind": EXT_HINTS[ext], "detected_by": "extension",
                "detail": f"estensione {ext}"}
    # 6. fallback generico
    if ext == ".xml":
        if local:
            return {"file": rel, "kind": "other-xml",
                    "detected_by": "extension+root-fallback",
                    "detail": f"root <{local}> non riconosciuto: doc generica"}
        return {"file": rel, "kind": "unknown", "detected_by": "extension",
                "detail": "XML illeggibile: doc generica minimale"}
    return {"file": rel, "kind": "non-xml", "detected_by": "extension",
            "detail": "non XML"}


# --- BPEL per-file (stdlib) -------------------------------------------------

def parse_bpel(path: str) -> dict:
    """Estrae processo/partnerLink/invoke/receive/variabili da un BPEL (best-effort)."""
    import xml.etree.ElementTree as ET

    info: dict = {"process": os.path.splitext(os.path.basename(path))[0],
                  "partner_links": [], "invokes": [], "receives": [],
                  "variables": [], "scopes": [], "assigns": 0,
                  "faults": [], "error": ""}
    try:
        if os.path.getsize(path) > MAX_SNIFF_BYTES:
            info["error"] = "file troppo grande, skipped"
            return info
        root = ET.parse(path).getroot()
    except Exception as e:
        info["error"] = f"{type(e).__name__}: {e}"[:200]
        return info
    if _local(root.tag) == "process":
        info["process"] = root.get("name") or info["process"]
    for el in root.iter():
        if not isinstance(el.tag, str):
            continue
        t = _local(el.tag)
        if t == "partnerLink" and el.get("name"):
            info["partner_links"].append({
                "name": el.get("name") or "",
                "type": el.get("partnerLinkType") or "",
                "myRole": el.get("myRole") or "",
                "partnerRole": el.get("partnerRole") or ""})
        elif t == "invoke":
            info["invokes"].append({
                "name": el.get("name") or "",
                "partnerLink": el.get("partnerLink") or "",
                "operation": el.get("operation") or "",
                "portType": (el.get("portType") or "").split(":")[-1]})
        elif t == "receive":
            info["receives"].append({
                "name": el.get("name") or "",
                "partnerLink": el.get("partnerLink") or "",
                "operation": el.get("operation") or "",
                "createInstance": el.get("createInstance") in ("yes", "true")})
        elif t == "variable" and el.get("name"):
            info["variables"].append({"name": el.get("name") or "",
                                      "messageType": (el.get("messageType") or "").split(":")[-1],
                                      "element": (el.get("element") or "").split(":")[-1]})
        elif t == "scope" and el.get("name"):
            info["scopes"].append(el.get("name") or "")
        elif t == "assign":
            info["assigns"] += 1
        elif t in ("catch", "catchAll"):
            info["faults"].append(el.get("faultName") or t)
    return info


def bpel_mermaid(info: dict) -> str:
    """Grafo invoke: processo -> partnerLink/operation."""
    proc = safe_name(info.get("process") or "process")
    lines = ["flowchart LR", f'  P["{proc}"]']
    seen: set[str] = set()
    for inv in info.get("invokes", []):
        pl = inv.get("partnerLink") or "?"
        op = inv.get("operation") or "?"
        node = safe_name(f"{pl}_{op}")
        label = f"{pl}\\n{op}".replace('"', "'")[:60]
        if node not in seen:
            seen.add(node)
            lines.append(f'  N_{node}["{label}"]')
        lines.append(f"  P -->|invoke| N_{node}")
    for rec in info.get("receives", []):
        op = rec.get("operation") or "?"
        node = safe_name(f"in_{rec.get('partnerLink', '')}_{op}")
        if node not in seen:
            seen.add(node)
            lines.append(f'  N_{node}["in: {op}"]'.replace('"', "'"))
        lines.append(f"  N_{node} -->|receive| P")
    if len(lines) == 2:
        lines.append("  P -.->|nessun invoke/receive| P")
    return "\n".join(lines)


def bpel_markdown(info: dict, rel: str) -> str:
    proc = info.get("process") or "?"
    out = [f"# BPEL — {proc}", "", f"_File: `{rel}`_",
           f"_PartnerLink: {len(info.get('partner_links', []))} · "
           f"Invoke: {len(info.get('invokes', []))} · "
           f"Receive: {len(info.get('receives', []))} · "
           f"Variabili: {len(info.get('variables', []))}_", ""]
    if info.get("error"):
        out += [f"> [!WARNING]", f"> {info['error']} — NON confermato", ""]
    out += ["## PartnerLink", ""]
    if info.get("partner_links"):
        out += ["| Nome | Tipo | myRole | partnerRole |",
                "|---|---|---|---|"]
        out += [f"| `{p['name']}` | `{p['type']}` | `{p['myRole']}` | `{p['partnerRole']}` |"
                for p in info["partner_links"]]
    else:
        out += ["_Nessun partnerLink — NON confermato_"]
    out += ["", "## Invoke (chi chiama chi)", ""]
    if info.get("invokes"):
        out += ["| Invoke | PartnerLink | Operation | PortType |",
                "|---|---|---|---|"]
        out += [f"| `{v.get('name', '—')}` | `{v.get('partnerLink', '—')}` | "
                f"`{v.get('operation', '—')}` | `{v.get('portType', '—')}` |"
                for v in info["invokes"]]
    else:
        out += ["_Nessun invoke — NON confermato_"]
    out += ["", "## Receive / entrypoint", ""]
    if info.get("receives"):
        out += [f"- `{r.get('name', '—')}` via `{r.get('partnerLink', '—')}` "
                f"op `{r.get('operation', '—')}`"
                f"{' (createInstance)' if r.get('createInstance') else ''}"
                for r in info["receives"]]
    else:
        out += ["_Nessun receive — NON confermato_"]
    if info.get("variables"):
        out += ["", "## Variabili",
                ", ".join(f"`{v['name']}`" for v in info["variables"])]
    if info.get("faults"):
        out += ["", "## Fault handler",
                ", ".join(f"`{f}`" for f in info["faults"])]
    out += ["", "## Grafo invoke", "", "```mermaid",
            bpel_mermaid(info), "```", ""]
    return "\n".join(out)


# --- XML generico leggero ----------------------------------------------------

def generic_xml_summary(path: str, cap_tags: int = 40) -> dict:
    """Snapshot leggero di un XML non riconosciuto (root/ns/profondita'/tag)."""
    import xml.etree.ElementTree as ET

    info: dict = {"root": "", "ns": "", "depth": 0, "n_elements": 0,
                  "tags": {}, "attrs": [], "error": ""}
    try:
        if os.path.getsize(path) > MAX_SNIFF_BYTES:
            info["error"] = "file troppo grande, skipped"
            return info
        root = ET.parse(path).getroot()
    except Exception as e:
        info["error"] = f"{type(e).__name__}: {e}"[:200]
        return info
    info["root"] = _local(root.tag)
    info["ns"] = _ns(root.tag)
    counts: dict[str, int] = {}
    max_depth = 0
    stack = [(root, 1)]
    n = 0
    while stack:
        el, d = stack.pop()
        n += 1
        max_depth = max(max_depth, d)
        if n > 20000:
            break
        if isinstance(el.tag, str):
            counts[_local(el.tag)] = counts.get(_local(el.tag), 0) + 1
        for child in list(el)[:500]:
            stack.append((child, d + 1))
    info["n_elements"] = n
    info["depth"] = max_depth
    info["tags"] = dict(sorted(counts.items(), key=lambda kv: -kv[1])[:cap_tags])
    try:
        info["attrs"] = sorted({a.split("}")[-1] for a in root.attrib})[:20]
    except Exception:
        info["attrs"] = []
    return info


def generic_xml_markdown(info: dict, rel: str) -> str:
    out = [f"# XML generico — `{rel}`", "",
           "_Nessun parser specialistico lo riconosce "
           "(non ODI/BPMN/BPEL/WSDL/XSD/XSLT/JCA/SCA): scheda descrittiva._", ""]
    if info.get("error"):
        out += [f"> [!WARNING]", f"> {info['error']} — NON confermato", ""]
        return "\n".join(out)
    out += [f"- **Root:** `{info.get('root', '?')}`",
            f"- **Namespace:** `{info.get('ns') or '—'}`",
            f"- **Elementi:** {info.get('n_elements', 0)} · "
            f"**profondità max:** {info.get('depth', 0)}"]
    if info.get("attrs"):
        out += [f"- **Attributi root:** {', '.join(f'`{a}`' for a in info['attrs'])}"]
    out += ["", "## Tag più frequenti", ""]
    if info.get("tags"):
        out += ["| Tag | Occorrenze |", "|---|---:|"]
        out += [f"| `{t}` | {c} |" for t, c in info["tags"].items()]
    else:
        out += ["_Nessun tag — NON confermato_"]
    out += ["", "_Dettaglio completo: aprire il file sorgente._", ""]
    return "\n".join(out)


# --- contratti/adapter inventario (WSDL/XSD/XSLT/SCA/JCA/...) -----------------

CONTRACT_KINDS = {"wsdl", "xsd", "xslt", "sca", "mediator", "humantask",
                  "dvm", "config-xml"}

_NAMED_TAGS = {
    "operation", "portType", "binding", "service", "port",
    "element", "complexType", "simpleType",
    "template", "variable",
    "component", "reference", "wire", "property",
    "partnerLink", "invoke",
}


def contract_summary(path: str, cap: int = 60) -> dict:
    """Inventario istantaneo di un contratto/adapter (nomi operazioni/entita')."""
    import xml.etree.ElementTree as ET

    info: dict = {"root": "", "ns": "", "items": {}, "n_elements": 0,
                  "error": ""}
    try:
        if os.path.getsize(path) > MAX_SNIFF_BYTES:
            info["error"] = "file troppo grande, skipped"
            return info
        root = ET.parse(path).getroot()
    except Exception as e:
        info["error"] = f"{type(e).__name__}: {e}"[:200]
        return info
    info["root"] = _local(root.tag)
    info["ns"] = _ns(root.tag)
    items: dict[str, list[str]] = {}
    n = 0
    for el in root.iter():
        if not isinstance(el.tag, str):
            continue
        n += 1
        if n > 20000:
            break
        t = _local(el.tag)
        if t in _NAMED_TAGS:
            nm = el.get("name") or ""
            if nm and len(items.setdefault(t, [])) < cap:
                items[t].append(nm)
    info["n_elements"] = n
    info["items"] = items
    return info


def contract_markdown(info: dict, rel: str, kind: str) -> str:
    out = [f"# {kind.upper()} (inventario) — `{rel}`", "",
           "_Nessun parser full eseguito qui (fast mode o fuori budget): "
           "scheda inventario istantanea._", ""]
    if info.get("error"):
        out += [f"> [!WARNING]", f"> {info['error']} — NON confermato", ""]
        return "\n".join(out)
    out += [f"- **Root:** `{info.get('root', '?')}`",
            f"- **Namespace:** `{info.get('ns') or '—'}`",
            f"- **Elementi:** {info.get('n_elements', 0)}", ""]
    if info.get("items"):
        out += ["## Entità nominate", ""]
        for tag in sorted(info["items"]):
            vals = info["items"][tag]
            shown = ", ".join(f"`{v}`" for v in vals[:30])
            more = f" (+{len(vals) - 30})" if len(vals) > 30 else ""
            out += [f"- **{tag}** ({len(vals)}): {shown}{more}"]
        out += [""]
    else:
        out += ["_Nessuna entità nominata tra quelle note — aprire il file._", ""]
    return "\n".join(out)

# --- ODI inventario (istantaneo, da sniff: copre OGNI export) ------------------

def odi_inventory_markdown(exp: dict) -> str:
    """Scheda inventario per un export ODI (mapping/LP/scenari dai Field sniffati).

    Istantanea e sempre disponibile: garantisce la doc per-file anche quando
    il parser full ODI e' skippato (fast mode) o fuori budget.
    """
    rel = exp.get("file", "?")
    out = [f"# ODI (inventario) — `{rel}`", ""]
    maps = exp.get("mappings", [])
    if maps:
        out += ["## Mapping rilevati", "",
                "| Mapping | Sorgenti | Destinazioni |",
                "|---|---|---|"]
        for m in maps:
            srcs = ", ".join(f"`{s}`" for s in m.get("sources", [])) or "—"
            tgts = ", ".join(f"`{t}`" for t in m.get("targets", [])) or "—"
            out += [f"| `{m.get('name', '?')}` | {srcs} | {tgts} |"]
        out += [""]
    if exp.get("loadplan_names"):
        out += ["## LoadPlan",
                ", ".join(f"`{n}`" for n in exp["loadplan_names"]), ""]
    if exp.get("scen_names"):
        out += ["## Scenari",
                ", ".join(f"`{n}`" for n in exp["scen_names"]), ""]
    out += ["_Scheda inventario da sniff Field (Name/SourceTable/TargetTable). "
            "Per TECNICO/BUSINESS/FLUSSO/CSV vedi doc full ODI, se generata._", ""]
    return "\n".join(out)


# --- scenari (anche orfani) --------------------------------------------------
def scenario_markdown(scen_name: str, rel: str, callers: list[str],
                      is_orphan: bool) -> str:
    out = [f"# Scenario ODI — {scen_name}", "", f"_File: `{rel}`_", ""]
    if is_orphan:
        out += ["> [!CAUTION]",
                "> **ORFANO** — nessuno step di nessun LoadPlan del cliente "
                "richiama questo scenario (verifica su `SnpLpStep.ScensName`).",
                "> Verificare a mano se è deprecato o avviato fuori ODI.", ""]
    else:
        out += ["## Chiamato da", ""]
        out += [f"- `{c}`" for c in callers] or ["_—_"]
        out += [""]
    out += ["## Contenuto",
            "Dettaglio task SQL / variabili: vedi doc del LoadPlan chiamante, "
            "oppure aprire l'XML sorgente (step tree completo nel `*_LOADPLAN.md`).",
            ""]
    return "\n".join(out)
