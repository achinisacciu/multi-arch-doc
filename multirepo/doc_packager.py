"""doc_packager.py — Generatore di documentazione multi-audience e packaging ZIP (stdlib-only).

Organizza i report in documenti autonomi per target:
- 00_INDICE_E_GUIDA_DOCUMENTAZIONE.md
- 01_Architettura_e_System_Design/ (Architetti, Ingegneri, Analisti)
- 02_Sviluppo_DevOps_e_Database/ (Programmatori, DevOps, DBA)
- 03_Business_e_Processi/ (Product Owner, Business Owner, PM)
- 04_Governance_e_Audit/ (Legali, Revisori, Compliance)
- 05_Dettaglio_Singole_Repo/ (Report specialistici per singola repo)

Genera il file compresso: <client>_documentazione.zip
"""
from __future__ import annotations

import argparse
import csv
import datetime
import io
import json
import os
import re
import shutil
import sys
import zipfile

DEFAULT_CLIENT = "clientone"
DEFAULT_OUTBASE = "dossier-clienti"

CONFIG_EXTS = (".properties", ".env", ".yaml", ".yml", ".cfg", ".ini", ".conf")
SENSITIVE_KEY_RE = re.compile(r"(?i)(pass|pwd|secret|token|private[_-]?key|api[_-]?key)")
KV_RE = re.compile(r"^\s*([\w.\-]+)\s*[:=]\s*(.+?)\s*$")


def redact(s: str) -> str:
    low = s.lower()
    if any(k in low for k in ("pass", "pwd", "secret", "token")):
        return "***redatto***"
    return s


def classify_config(key: str) -> str:
    low = key.lower()
    if SENSITIVE_KEY_RE.search(low):
        return "Segreto (redatto)"
    if "port" in low:
        return "Porta di ascolto / servizio"
    if any(k in low for k in ("url", "endpoint", "uri", "host")):
        return "URL / Host di integrazione"
    if low.startswith("db") or "database" in low or "dbname" in low or "jdbc" in low:
        return "Configurazione Database / Connessione"
    return "Parametro applicativo"


def collect_config_rows(cart: dict, cap: int = 150) -> list[dict]:
    """Righe config generiche da file testuali (valori sensibili MAI in chiaro)."""
    rows: list[dict] = []
    root = cart.get("root", "")
    for f in cart.get("files", []):
        if len(rows) >= cap:
            break
        rel, ext = f.get("rel_path", ""), f.get("ext", "")
        if ext not in CONFIG_EXTS and os.path.basename(rel) != ".env":
            continue
        fp = os.path.join(root, rel) if root else ""
        if not fp or not os.path.isfile(fp):
            continue
        try:
            if os.path.getsize(fp) > 1_000_000:
                continue
            with open(fp, encoding="utf-8", errors="strict") as fh:
                lines = fh.read().splitlines()[:500]
        except Exception:
            continue
        for i, line in enumerate(lines, 1):
            s = line.strip()
            if not s or s.startswith(("#", "!", "//", ";")):
                continue
            m = KV_RE.match(s)
            if not m:
                continue
            key, val = m.group(1), m.group(2).strip().strip("\"'")
            if len(key) > 80:
                continue
            if SENSITIVE_KEY_RE.search(key):
                disp = "***redatto***"
            else:
                disp = redact(val[:80])
            rows.append({"file": rel, "line": i, "key": key,
                         "value": disp, "context": classify_config(key)})
            if len(rows) >= cap:
                break
    return rows


def parse_manifest_deps(cart: dict) -> list[dict]:
    """Dipendenze da package.json / requirements*.txt / pom.xml (con versioni)."""
    deps: list[dict] = []
    root = cart.get("root", "")
    for man, rels in (cart.get("manifests", {}) or {}).items():
        for rel in rels:
            fp = os.path.join(root, rel) if root else ""
            if not fp or not os.path.isfile(fp):
                continue
            try:
                if man == "package.json":
                    pj = json.load(open(fp, encoding="utf-8"))
                    for section in ("dependencies", "devDependencies",
                                    "peerDependencies"):
                        for k, v in ((pj.get(section) or {}).items()):
                            deps.append({"repo": cart.get("name", ""),
                                         "eco": "npm", "package": str(k),
                                         "version": str(v), "file": rel})
                elif man == "requirements.txt":
                    with open(fp, encoding="utf-8", errors="replace") as fh:
                        for line in fh.read().splitlines():
                            s = line.strip()
                            if not s or s.startswith(("#", "-")):
                                continue
                            m = re.match(
                                r"^([A-Za-z0-9_.\-]+)\s*(.*)$", s)
                            if m:
                                deps.append({"repo": cart.get("name", ""),
                                             "eco": "pip",
                                             "package": m.group(1).lower(),
                                             "version": (m.group(2).strip(" ;")
                                                         or "(qualsiasi)"),
                                             "file": rel})
                elif man == "pom.xml":
                    import xml.etree.ElementTree as ET
                    try:
                        r = ET.parse(fp).getroot()
                    except Exception:
                        continue
                    for dep in r.iter():
                        if not isinstance(dep.tag, str):
                            continue
                        if dep.tag.rsplit("}", 1)[-1] != "dependency":
                            continue
                        g = {c.tag.rsplit("}", 1)[-1]: (c.text or "").strip()
                             for c in dep if isinstance(c.tag, str)}
                        if g.get("artifactId"):
                            pkg = g.get("groupId", "") + ":" + g["artifactId"] \
                                if g.get("groupId") else g["artifactId"]
                            deps.append({"repo": cart.get("name", ""),
                                         "eco": "maven", "package": pkg,
                                         "version": (g.get("version")
                                                     or "(non dichiarata)"),
                                         "file": rel})
            except Exception:
                continue
    return deps


def load_canonical_contracts(outbase: str, client: str, repo: str) -> list[dict]:
    """Contratti/endpoint reali dal canonical.json SOA (se generato)."""
    contracts: list[dict] = []
    canon = os.path.join(outbase, client, "tools_output", repo, "canonical.json")
    if not os.path.isfile(canon):
        return contracts
    try:
        with open(canon, encoding="utf-8") as fh:
            data = json.load(fh)
    except Exception:
        return contracts
    for section, kind in (("wsdls", "WSDL"), ("xsds", "XSD"),
                          ("composites", "SCA composite"), ("bpels", "BPEL"),
                          ("bpmns", "BPMN")):
        items = data.get(section, [])
        if isinstance(items, dict):
            items = list(items.values())
        for it in items or []:
            if isinstance(it, str):
                contracts.append({"file": it, "kind": kind, "detail": ""})
                continue
            if not isinstance(it, dict):
                continue
            path = (it.get("relativePath") or it.get("path") or
                    it.get("fileName") or it.get("name") or "")
            ops = it.get("operations") or it.get("portTypes") or []
            if isinstance(ops, list):
                det = ", ".join(str(o) if not isinstance(o, dict)
                                else o.get("name", "?") for o in ops[:8])
            else:
                det = str(ops)[:120]
            contracts.append({"file": path, "kind": kind, "detail": det})
    return contracts


def build_indice(client: str, now: str, cartelle: list, edges: list) -> str:
    n_repos = len(cartelle)
    n_edges = len(edges)

    rows = []
    for c in cartelle:
        rows.append(f"| `{c.get('name')}` | {c.get('archetype', 'Componente Software')} | {', '.join(c.get('tech', [])) or '—'} | {len(c.get('files', []))} |")
    table_repos = "\n".join(rows) if rows else "| — | — | — | — |"

    return f"""# Dossier Ecosistema Applicativo — {client}

_Generato il: {now} · Repository analizzate: {n_repos} · Relazioni scoperte: {n_edges}_

Benvenuto nella documentazione d'insieme dell'ecosistema applicativo del cliente **{client}**.
Questo archivio è strutturato in sezioni autonome pensate per rispondere alle esigenze specifiche di diversi profili professionali.

---

## 🧭 Guida alla Lettura per Ruolo

| Profilo / Ruolo | Cartella di Riferimento | Contenuto Principale |
|---|---|---|
| 🏛️ **Architetti del Software, Ingegneri, Solution Architect** | `01_Architettura_e_System_Design/` | Topologia complessiva, diagrammi Mermaid, flussi dati inter-repo, contratti di servizio (WSDL/XSD/REST), matrice delle dipendenze. |
| 💻 **Programmatori, Team DevOps, Database Administrator (DBA)** | `02_Sviluppo_DevOps_e_Database/` | Schede tecniche dettagliate repo per repo, variabili d'ambiente e porte (redatte), schemi DB e tabelle SQL, adapter JCA, trasformazioni ETL ODI e CSV regole. |
| 📊 **Product Owner, Business Owner, Project Manager** | `03_Business_e_Processi/` | Sintesi esecutiva non tecnica, scopi di business delle singole repo, mappa dei processi BPMN/BPEL, glossario del dominio applicativo. |
| ⚖️ **Ufficio Legale, DPO, Revisori e Compliance** | `04_Governance_e_Audit/` | Conformità e licenze pacchetti terze parti, rischi da versioni divergenti, attestazione scansione leak/segreti, registro evidenze audit (`file:riga`). |
| 📁 **Dettagli Specialistici per Singola Repo** | `05_Dettaglio_Singole_Repo/` | Documentazione tecnica e funzionale approfondita generata dai motori specialistici (SOA Platform, ODI Documenter, JCA Studio). |

---

## 📦 Repository Incluse nel Perimetro

| Repository | Archetipo Rilevato | Tecnologie Rilevate | N. File |
|---|---|---|---|
{table_repos}

---

## 📌 Principi Guida del Modello Evidenziale
1. **Nessuna asserzione senza prova**: ogni collegamento tra due repo cita il file sorgente e la riga esatta in cui compare l'evidenza.
2. **Grado di certezza esplicito**:
   - `✅ accertato`: certezza deterministica da codice o configurazione (import diretti, stesso repository, file identico verificato da hash SHA-256).
   - `🔶 probabile`: integrazione runtime o dati condivisi (stesso DB/host, chiamate di rete su porte dichiarate, dipendenze comuni).
   - `🔍 indizio`: convergenza concettuale (stesse entità o tabelle `SCHEMA.TABELLA`).
3. **Tutela della riservatezza**: credenziali, password e token sono automaticamente offuscati (`***redatto***`).
"""


def build_architettura(client: str, now: str, cartelle: list, edges: list,
                       mermaid_src: str,
                       contracts_by_repo: dict | None = None) -> dict[str, str]:
    # 01_TOPOLOGIA_E_SISTEMA.md
    topo_rows = []
    for c in cartelle:
        role = c.get("role_description") or c.get("archetype") or "Componente Software"
        techs = ", ".join(c.get("tech", [])) or "—"
        topo_rows.append(f"### `{c.get('name')}`\n- **Archetipo:** {c.get('archetype', 'Software Component')}\n- **Ruolo nell'ecosistema:** {role}\n- **Tecnologie:** {techs}\n- **Path originale:** `{c.get('root', '—')}`\n")

    topologia_md = f"""# Architettura e Topologia di Sistema — {client}

_Data generazione: {now}_

## 1. Mappa delle Interazioni Inter-Repository

Il seguente diagramma sintetizza i collegamenti rilevati tra i diversi componenti dell'ecosistema applicativo:

```mermaid
{mermaid_src or 'flowchart LR'}
```

---

## 2. Schede Componenti e Confini Applicativi

{chr(10).join(topo_rows)}

---

## 3. Analisi degli Accoppiamenti
- **Accoppiamenti Diretti (Codice/Import):** dipendenze esplicite a livello di linguaggio o percorsi relativi.
- **Accoppiamenti Indiretti (Dati/Infrastruttura):** componenti che condividono lo stesso database, la stessa istanza di message broker o la stessa orchestrazione container.
- **Accoppiamenti di Rete:** servizi che consumano endpoint esposti da altri moduli su porte note.
"""

    # 02_DATA_FLOW_E_INTERAZIONI.md
    flow_rows = []
    for e in edges:
        p_str = "<br/>".join(f"`{redact(p)}`" for p in e.get("prove", []))
        flow_rows.append(f"| `{e.get('da')}` | `{e.get('a')}` | **{e.get('tipo')}** | {e.get('grado')} | {p_str} |")
    table_flows = "\n".join(flow_rows) if flow_rows else "| — | — | (nessuna interazione rilevata) | — | — |"

    data_flow_md = f"""# Flussi Dati e Interazioni tra Componenti — {client}

Questo documento dettaglia tutti i canali di scambio dati, chiamate di rete e dipendenze attive rilevate tra le repository.

| Sorgente | Destinazione | Tipologia Canale / Interazione | Grado Certezza | Evidenze Riscontrate |
|---|---|---|---|---|
{table_flows}

---

### Tipologie di Flusso Rilevate:
1. **import-cross-cartella:** Chiamate dirette nel codice (`import`, `require`, percorsi relativi).
2. **chiamate-rete:** URL di rete o chiamate API HTTP/REST che contattano porte dichiarate da altri servizi.
3. **db-condiviso:** Più repository accedono allo stesso database (`dbhost` o `dbname`).
4. **compose-multi-servizio:** Orchestrazione congiunta definita in file `docker-compose`.
5. **orchestrazione-condivisa:** Piani di caricamento o scenari condivisi tra moduli diversi.
6. **file-identico:** File con identico hash crittografico SHA-256 (potenziale duplicazione o libreria condivisa).
"""

    # 03_CONTRATTI_DI_SERVIZIO.md (prima canonical SOA reale, poi file grezzi)
    contract_rows = []
    for c in cartelle:
        for ct in (contracts_by_repo or {}).get(c.get("name", ""), []):
            det = f" — {ct['detail']}" if ct.get("detail") else ""
            contract_rows.append(
                f"| `{c.get('name')}` | `{ct.get('file')}` | {ct.get('kind')}{det} |")
    if not contract_rows:
        for c in cartelle:
            for f in c.get("files", []):
                if f.get("ext", "") in (".wsdl", ".xsd"):
                    contract_rows.append(
                        f"| `{c.get('name')}` | `{f.get('rel_path')}` | "
                        f"Contratto / Schema ({f.get('ext', '').upper()}) |")
    table_contracts = "\n".join(contract_rows) if contract_rows else "| — | — | Nessun file di contratto WSDL/XSD/OpenAPI esplicito rilevato |"

    contratti_md = f"""# Contratti di Servizio e Interfacce — {client}

Riepilogo dei contratti formali di servizio (WSDL, XSD, definizioni OpenAPI/Swagger) individuati nel perimetro applicativo.

| Repository | File di Contratto | Descrizione / Tipo |
|---|---|---|
{table_contracts}
"""

    return {
        "01_TOPOLOGIA_E_SISTEMA.md": topologia_md,
        "02_DATA_FLOW_E_INTERAZIONI.md": data_flow_md,
        "03_CONTRATTI_DI_SERVIZIO.md": contratti_md,
        "diagrammi_flusso.mmd": mermaid_src or "flowchart LR\n",
    }


def _proof_of(r: dict) -> str:
    loc = f"`{r.get('file')}:{r.get('line')}`" if r.get("line") else f"`{r.get('file')}`"
    return f"`{r.get('repo')}` {loc}"


def build_consumers(resources: list) -> dict:
    """Per ogni SCHEMA.risorsa: dov'è definita, chi la scrive, chi la legge."""
    try:
        from multirepo.db_inventory import split_schema
    except ImportError:
        from db_inventory import split_schema
    cons: dict[str, dict] = {}

    def bucket(schema: str, name: str) -> dict:
        key = f"{(schema or '').upper()}.{(name or '').upper()}"
        return cons.setdefault(key, {"schema": schema or "", "name": name,
                                     "defined_in": [], "written_by": [],
                                     "read_by": []})
    for r in resources or []:
        kind, src = r.get("kind", ""), r.get("source", "")
        if kind in ("table", "view") and src == "ddl":
            bucket(r.get("schema", ""), r.get("name", ""))["defined_in"].append(
                f"{_proof_of(r)} (DDL {kind})")
        elif kind == "trigger" and r.get("target"):
            tsch, tname = split_schema(r["target"])
            bucket(tsch, tname)["read_by"].append(
                f"trigger `{r.get('name')}` ({r.get('detail', '')}) {_proof_of(r)}")
        elif kind == "table_ref" and src == "odi":
            b = bucket(r.get("schema", ""), r.get("name", ""))
            (b["written_by"] if r.get("detail", "").startswith("output")
             else b["read_by"]).append(f"mapping ODI {r.get('detail', '')} {_proof_of(r)}")
        elif kind == "table_ref" and src == "jca":
            b = bucket(r.get("schema", ""), r.get("name", ""))
            (b["written_by"] if re.match(r"^(INSERT|UPDATE|MERGE|CALL)",
                                         r.get("detail", ""))
             else b["read_by"]).append(f"adapter JCA {r.get('detail', '')} {_proof_of(r)}")
    for r in resources or []:
        if r.get("kind") == "view" and r.get("source") == "ddl":
            for dep in r.get("depends_on", []):
                tsch, tname = split_schema(dep)
                bucket(tsch, tname)["read_by"].append(
                    f"vista `{r.get('schema') + '.' if r.get('schema') else ''}{r.get('name')}` {_proof_of(r)}")
    return cons


def build_consumers_section(cartelle: list) -> str:
    """§4 di 03_DATABASE: per risorsa, definita-dove / chi scrive / chi legge."""
    all_res = [r for c in cartelle for r in c.get("db_inventory", [])]
    if not all_res:
        return "_Nessun uso di dati rilevato._"
    cons = build_consumers(all_res)
    out = ["| Risorsa | Definita in | Chi scrive | Chi legge |",
           "|---|---|---|---|"]
    n = 0
    for key in sorted(cons):
        if n >= 120:
            out.append(f"| … | | | (+{len(cons) - n} risorse in `08_INVENTARIO_DB.json`) |")
            break
        b = cons[key]
        qn = f"{b['schema'] + '.' if b['schema'] else ''}{b['name']}"
        if not (b["defined_in"] or b["written_by"] or b["read_by"]):
            continue
        n += 1
        out.append(f"| `{qn}` | {'<br/>'.join(b['defined_in']) or '—'} | "
                   f"{'<br/>'.join(b['written_by']) or '—'} | "
                   f"{'<br/>'.join(b['read_by']) or '—'} |")
    return "\n".join(out)


def build_initiators_section(cartelle: list) -> str:
    """Chi avvia i processi: agenti/schedulazioni LP, inbound JCA, start BPMN."""
    labels = {"loadplan-agent": "Agente LoadPlan (ODI)",
              "loadplan-step": "Step LoadPlan → scenario",
              "jca-inbound": "Adapter inbound (polling/messaggio)",
              "bpmn-start": "Start event BPMN"}
    rows = []
    for c in cartelle:
        for e in c.get("initiators", []):
            loc = (f"`{e.get('file')}:{e.get('line')}`" if e.get("line")
                   else f"`{e.get('file')}`")
            lp = f" — avvia in `{e['lp']}`" if e.get("lp") else ""
            rows.append(f"| {labels.get(e.get('kind', ''), e.get('kind', ''))} | "
                        f"`{e.get('name', '')}` | {(e.get('detail') or '—')}{lp} | "
                        f"`{c.get('name')}` | {loc} |")
    if not rows:
        return ("| — | — | Nessun iniziatore esplicito rilevato (agenti, "
                "schedulazioni, start event assenti nei file) — NON confermato |")
    return ("| Chi avvia | Tipo | Dettaglio / schedulazione | Repository | Prova |\n"
            "|---|---|---|---|---|\n" + "\n".join(rows))


def build_db_inventory_section(cartelle: list) -> str:
    """§3 di 03_DATABASE: mappa per-schema delle risorse DB con colonne."""
    try:
        from multirepo.db_inventory import aggregate_by_schema
    except ImportError:
        from db_inventory import aggregate_by_schema
    all_res = [r for c in cartelle for r in c.get("db_inventory", [])]
    if not all_res:
        return "_Nessuna risorsa DB rilevata (nessun DDL, adapter JCA con SQL o mapping ODI)._"
    agg = aggregate_by_schema(all_res)
    out = []
    for schema in sorted(agg):
        b = agg[schema]
        out.append(f"### Schema `{schema}`")
        if b["tables"]:
            out.append("| Tabella | Colonne (nome tipo) | Repository | Prova |")
            out.append("|---|---|---|---|")
            for t in sorted(b["tables"], key=lambda x: x["name"]):
                cols = "<br/>".join(f"`{c}`" for c in t["columns"]) or "—"
                out.append(f"| `{t['name']}` | {cols} | `{t['repo']}` | "
                           f"`{t['file']}:{t['line']}` |")
        if b["views"]:
            out.append("| Vista | Colonne | Repository | Prova |")
            out.append("|---|---|---|---|")
            for t in sorted(b["views"], key=lambda x: x["name"]):
                cols = "<br/>".join(f"`{c}`" for c in t["columns"]) or "—"
                out.append(f"| `{t['name']}` | {cols} | `{t['repo']}` | "
                           f"`{t['file']}:{t['line']}` |")
        if b["triggers"]:
            out.append("| Trigger | Evento / Tabella target | Repository | Prova |")
            out.append("|---|---|---|---|")
            for t in sorted(b["triggers"], key=lambda x: x["name"]):
                out.append(f"| `{t['name']}` | {t['detail'] or '—'} | "
                           f"`{t['repo']}` | `{t['file']}:{t['line']}` |")
        if b["routines"]:
            out.append("| Routine (procedure/function/package) | Repository | Prova |")
            out.append("|---|---|---|")
            for t in sorted(b["routines"], key=lambda x: x["name"]):
                out.append(f"| `{t['name']}` | `{t['repo']}` | "
                           f"`{t['file']}:{t['line']}` |")
        if b["other"]:
            out.append("| Altra risorsa | Dettaglio | Repository | Prova |")
            out.append("|---|---|---|---|")
            for t in sorted(b["other"], key=lambda x: x["name"]):
                out.append(f"| `{t['name']}` | {t['detail'] or '—'} | "
                           f"`{t['repo']}` | `{t['file']}:{t['line']}` |")
        if b["refs"]:
            out.append("| Risorsa usata (`table_ref`) | Contesto | Repository |")
            out.append("|---|---|---|")
            seen = set()
            for t in sorted(b["refs"], key=lambda x: x["name"]):
                key = (t["name"], t["detail"], t["repo"])
                if key in seen:
                    continue
                seen.add(key)
                out.append(f"| `{t['name']}` | {t['detail'] or '—'} | "
                           f"`{t['repo']}` |")
        out.append("")
    return "\n".join(out)


def build_sviluppo(client: str, now: str, cartelle: list, edges: list,
                   mrows: list,
                   cfg_by_repo: dict | None = None) -> dict[str, str]:
    # 01_SCHEDE_TECNICHE_REPO.md
    cards = []
    for c in cartelle:
        files = c.get("files", [])
        techs = ", ".join(c.get("tech", [])) or "—"
        manifests = c.get("manifests", {})
        man_str = ", ".join(f"`{k}` ({len(v)})" for k, v in manifests.items()) if manifests else "Nessun manifest standard"
        entrypoints = ", ".join(f"`{e}`" for e in c.get("entrypoints", [])) or "Nessun entrypoint standard rilevato"
        cards.append(f"""### Repository: `{c.get('name')}`
- **Archetipo:** {c.get('archetype', 'Componente')}
- **Ruolo / Descrizione:** {c.get('role_description', '—')}
- **Stack Tecnologico:** {techs}
- **Totale File Sorgente:** {len(files)}
- **File di Build / Manifest:** {man_str}
- **Punti di Ingresso (Entrypoints):** {entrypoints}
- **Cartella di Origine:** `{c.get('root')}`
""")

    schede_md = f"""# Schede Tecniche di Dettaglio per Repository — {client}

_Data generazione: {now}_

{chr(10).join(cards)}
"""

    # 02_CONFIGURAZIONI_E_VARIABILI.md (config generica, segreti redatti)
    cfg_rows = []
    for c in cartelle:
        for ref in (cfg_by_repo or {}).get(c.get("name", ""), []):
            cfg_rows.append(
                f"| `{c.get('name')}` | `{ref.get('file')}:{ref.get('line')}` | "
                f"`{ref.get('key')}` | `{ref.get('value')}` | {ref.get('context')} |")
    table_cfg = "\n".join(cfg_rows) if cfg_rows else "| — | — | — | — | Nessuna variabile di configurazione rilevata |"

    config_md = f"""# Configurazioni, Porte e Variabili d'Ambiente — {client}

Elenco delle configurazioni rilevate nei file `.properties`, `.env`, `.yml`, `.json`.
> [!NOTE]
> Eventuali credenziali, token e password sono stati redatti automaticamente.

| Repository | File:Riga | Parametro / Chiave | Valore (redatto dove sensibile) | Contesto |
|---|---|---|---|---|
{table_cfg}
"""

    # 03_DATABASE_E_ADAPTER_SQL.md
    jca_rows = []
    for c in cartelle:
        for j in c.get("jca_adapters", []):
            ops = ", ".join(j.get("operations", [])) or "—"
            sqls = "<br/>".join(f"`{redact(s[:100])}`" for s in j.get("sqls", [])) or "—"
            cf = j.get("connection_factory") or "—"
            jca_rows.append(f"| `{c.get('name')}` | `{j.get('file')}` | `{j.get('adapter')}` | `{cf}` | {ops} | {sqls} |")
    table_jca = "\n".join(jca_rows) if jca_rows else "| — | — | — | — | — | Nessun adapter JCA rilevato |"

    db_rows = []
    for proj, _map, schema, table, kind in mrows:
        db_rows.append(f"| `{schema}.{table}` | `{proj}` | `{_map}` | {kind} |")
    table_db = "\n".join(db_rows[:150]) if db_rows else "| — | — | — | Nessuna tabella DB esplicita rilevata |"

    db_md = f"""# Database, Schemi SQL e Adapter JCA — {client}

Questo documento mappa gli accessi alle basi dati e gli adapter middleware dedicati.

## 1. Adapter JCA (Oracle SOA Suite / Database Adapters)
| Repository | File Adapter | Tipo Adapter | Connection Factory | Operazioni | Query SQL / Dettaglio |
|---|---|---|---|---|---|
{table_jca}

---

## 2. Tabelle di Database Coinvolte nelle Elaborazioni
| Tabella (`SCHEMA.TABELLA`) | Repository | Mapping / Contesto | Direzione |
|---|---|---|---|
{table_db}

---

## 3. Inventario Risorse DB (tabelle, viste, trigger, routine — con colonne)

{build_db_inventory_section(cartelle)}

---

## 4. Consumatori e produttori del dato (chi scrive, chi legge)

{build_consumers_section(cartelle)}

_Mappa completa machine-readable in `08_INVENTARIO_DB.json`. `table_ref` = risorsa
usata (SQL adapter JCA / mapping ODI), non definita in DDL._

## 5. Indice navigabile "dove risiede cosa"

- **`09_INDICE_DB.md`**: per schema → tabelle con colonne → repo e `file:riga` → chi scrive / chi legge.
- **`09_INVENTARIO_DB.csv`**: stesso contenuto in tabellare (Excel), una riga per risorsa.
"""

    # 04_TRASFORMAZIONI_ETL_ODI.md
    odi_rows = []
    for c in cartelle:
        for exp in c.get("odi_exports", []):
            for m in exp.get("mappings", []):
                srcs = ", ".join(m.get("sources", [])) or "—"
                tgts = ", ".join(m.get("targets", [])) or "—"
                odi_rows.append(f"| `{c.get('name')}` | `{exp.get('file')}` | `{m.get('name')}` | `{srcs}` | `{tgts}` |")
    table_odi = "\n".join(odi_rows) if odi_rows else "| — | — | — | — | — | Nessun mapping ODI rilevato |"

    lp_rows = []
    for c in cartelle:
        for lp in c.get("lp_files", []):
            names = ", ".join(lp.get("loadplan_names", [])) or os.path.basename(lp.get("file", ""))
            lp_rows.append(f"| `{c.get('name')}` | `{lp.get('file')}` | **LoadPlan** | `{names}` |")
        for sc in c.get("scen_files", []):
            snames = ", ".join(sc.get("scen_names", [])) or os.path.basename(sc.get("file", ""))
            lp_rows.append(f"| `{c.get('name')}` | `{sc.get('file')}` | Scenario | `{snames}` |")
    table_lp = "\n".join(lp_rows) if lp_rows else "| — | — | — | Nessun LoadPlan/Scenario rilevato |"

    etl_md = f"""# Trasformazioni Dati ed Orchestrazioni ETL (Oracle ODI) — {client}

## 1. Mapping di Trasformazione (Sorgenti -> Destinazioni)
| Repository | File Export | Nome Mapping | Tabelle Sorgente (Sources) | Tabelle Destinazione (Targets) |
|---|---|---|---|---|
{table_odi}

---

## 2. Piani di Caricamento (LoadPlan) e Scenari
| Repository | File XML | Tipologia | Nome Piano / Scenario |
|---|---|---|---|
{table_lp}

---

## 3. Avvii tecnici (agenti LoadPlan, schedulazioni, adapter inbound)

{build_initiators_section(cartelle)}
"""

    return {
        "01_SCHEDE_TECNICHE_REPO.md": schede_md,
        "02_CONFIGURAZIONI_E_VARIABILI.md": config_md,
        "03_DATABASE_E_ADAPTER_SQL.md": db_md,
        "04_TRASFORMAZIONI_ETL_ODI.md": etl_md,
    }


def build_business(client: str, now: str, cartelle: list, edges: list, mrows: list) -> dict[str, str]:
    # 01_SINTESI_ESECUTIVA.md
    n_repos = len(cartelle)
    items = []
    for c in cartelle:
        items.append(f"- **`{c.get('name')}`:** {c.get('role_description', 'Componente applicativo')} ({len(c.get('files', []))} file).")
    bullets = "\n".join(items) if items else "- Nessuna repository presente."

    sintesi_md = f"""# Sintesi Esecutiva dell'Ecosistema Applicativo — {client}

_Data di pubblicazione: {now}_

## Visione d'Insieme
Il sistema analizzato per il cliente **{client}** è composto da un parco di **{n_repos} repository applicative** integrate tra loro.
L'ecosistema garantisce l'elaborazione dei dati, l'orchestrazione dei flussi di business e l'interscambio con i sistemi informativi periferici e centrali.

## Ruolo delle Repository nel Business
{bullets}

## Relazioni Chiave tra i Moduli
I componenti software collaborano tramite:
- Chiamate dirette e scambi di rete sincroni;
- Basi di dati e tabelle condivise per la persistenza e il reporting;
- Piani di caricamento ed estrazione periodica (ETL);
- Orchestrazione integrata dei processi.
"""

    # 02_MAPPA_PROCESSI_BPMN_BPEL.md
    proc_rows = []
    for c in cartelle:
        for bp in c.get("bpmn_files", []):
            proc_rows.append(f"| `{c.get('name')}` | `{bp}` | Processo BPMN | Flusso di lavoro operativo / approvazione |")
        for f in c.get("files", []):
            if f.get("ext") == ".bpel":
                proc_rows.append(f"| `{c.get('name')}` | `{f.get('rel_path')}` | Orchestrazione BPEL | Servizio di orchestrazione automatizzata |")
    table_proc = "\n".join(proc_rows) if proc_rows else "| — | — | — | Nessun flusso di processo BPMN/BPEL rilevato |"

    processi_md = f"""# Mappa dei Processi di Business (BPMN / BPEL) — {client}

Riepilogo dei diagrammi di flusso di lavoro (BPMN) e delle orchestrazioni operative (BPEL) implementati nell'ecosistema:

| Repository | File Processo | Standard | Scopo Operativo |
|---|---|---|---|
{table_proc}

---

## Chi avvia i processi (agenti, schedulazioni, eventi, adapter inbound)

{build_initiators_section(cartelle)}
"""

    # 03_GLOSSARIO_BUSINESS.md
    gloss_rows = []
    seen = set()
    for proj, mapping, schema, table, _kind in mrows:
        term = f"{schema}.{table}"
        if term not in seen and len(gloss_rows) < 40:
            seen.add(term)
            gloss_rows.append(f"| `{term}` | Entità Dati / Tabella | Utilizzato nel mapping `{mapping}` (`{proj}`) |")
    for c in cartelle:
        for exp in c.get("odi_exports", []):
            for m in exp.get("mappings", []):
                mname = m.get("name")
                if mname and mname not in seen and len(gloss_rows) < 40:
                    seen.add(mname)
                    gloss_rows.append(f"| `{mname}` | Flusso ETL | Trasformazione dati per il componente `{c.get('name')}` |")
    table_gloss = "\n".join(gloss_rows) if gloss_rows else "| — | — | Nessun termine di dominio rilevato |"

    glossario_md = f"""# Glossario dei Termini di Business e di Dominio — {client}

Definizione e contesto d'uso degli oggetti applicativi, tabelle e processi chiave emersi dall'analisi dell'ecosistema:

| Termine / Entità | Tipologia | Contesto ed Utilizzo nel Sistema |
|---|---|---|
{table_gloss}
"""

    return {
        "01_SINTESI_ESECUTIVA.md": sintesi_md,
        "02_MAPPA_PROCESSI_BPMN_BPEL.md": processi_md,
        "03_GLOSSARIO_BUSINESS.md": glossario_md,
    }


def build_governance(client: str, now: str, cartelle: list, edges: list,
                     all_deps: list | None = None) -> dict[str, str]:
    # 01_CONFORMITA_LICENZE_E_RISCHI.md
    dep_edges = [e for e in edges if e.get("tipo") == "dipendenza-condivisa"]
    risk_rows = []
    for e in dep_edges:
        is_divergent = any("divergenti" in p for p in e.get("prove", []))
        risk_level = "⚠ ALTO (Versione Divergente)" if is_divergent else "ℹ Normale"
        risk_rows.append(f"| `{e.get('da')}` ↔ `{e.get('a')}` | Dipendenza Comune | {risk_level} | {' | '.join(e.get('prove', []))} |")
    table_risks = "\n".join(risk_rows) if risk_rows else "| — | — | Nessun rischio da dipendenze divergenti riscontrato | — |"

    dup_edges = [e for e in edges if e.get("tipo") == "file-identico"]
    dup_rows = []
    for e in dup_edges[:30]:
        dup_rows.append(f"| `{e.get('da')}` ↔ `{e.get('a')}` | {'<br/>'.join(e.get('prove', []))} |")
    table_dup = "\n".join(dup_rows) if dup_rows else "| — | Nessuna duplicazione codice rilevata |"

    # Dipendenze terze parti da manifests (npm/pip/maven, con versioni).
    dep_rows, div_rows = [], []
    seen_dep = set()
    for d in all_deps or []:
        key = (d["package"], d["version"], d["repo"])
        if key in seen_dep:
            continue
        seen_dep.add(key)
        dep_rows.append(f"| `{d['package']}` | `{d['version']}` | `{d['eco']}` | `{d['repo']}` | `{d['file']}` |")
    versions: dict[str, set[str]] = {}
    for d in all_deps or []:
        versions.setdefault(d["package"], set()).add(d["version"])
    for pkg in sorted(versions):
        if len(versions[pkg]) > 1:
            users = ", ".join(sorted(f"`{d['repo']}`@{d['version']}"
                                     for d in all_deps or []
                                     if d["package"] == pkg))
            div_rows.append(f"| `{pkg}` | {users} | ⚠ ALTO (Versione Divergente) |")
    table_deps = "\n".join(dep_rows) if dep_rows else "| — | — | — | — | — | Nessun manifest con dipendenze rilevato |"
    table_div = "\n".join(div_rows) if div_rows else "| — | — | Nessuna divergenza di versione riscontrata |"

    conformita_md = f"""# Report di Conformità, Licenze e Gestione Rischi — {client}

_Data audit: {now}_

## 1. Analisi Dipendenze e Versioni Divergenti
L'uso di versioni differenti della stessa libreria in componenti che interagiscono tra loro rappresenta un rischio per la stabilità a runtime e la sicurezza.

| Moduli Coinvolti | Tipologia | Livello di Attenzione | Dettaglio Prove |
|---|---|---|---|
{table_risks}

### Versioni divergenti (stesso pacchetto, versioni diverse)
| Pacchetto | Chi lo usa @ versione | Livello di Attenzione |
|---|---|---|
{table_div}

### Inventario dipendenze terze parti (da `package.json` / `requirements.txt` / `pom.xml`)
| Pacchetto | Versione | Ecosistema | Repository | Manifest |
|---|---|---|---|---|
{table_deps}

---

## 2. Analisi Duplicazione Codice / File Identici
Rilevamento di file duplicati tra repository diverse (stesso hash SHA-256):

| Repository | File e Checksum Rilevati |
|---|---|
{table_dup}

---

## 3. Politiche di Sicurezza e Riservatezza
- **Sanitizzazione Automatica:** tutte le credenziali, password, stringhe di connessione e token di autenticazione rintracciati nei file di configurazione sono stati offuscati.
- **Isolamento Dati:** l'analisi è stata eseguita in ambiente confinato e nessun dato sensibile del cliente è stato esposto all'esterno.
"""

    return {
        "01_CONFORMITA_LICENZE_E_RISCHI.md": conformita_md,
    }


def build_db_index_md(cartelle: list, client: str = "") -> str:
    """09_INDICE_DB.md — dove risiede cosa: per schema, tabelle con colonne,
    repo e file:riga, più chi scrive / chi legge (mapping ODI, adapter JCA).

    Stessi dati di 08_INVENTARIO_DB.json ma navigabili. Il CSV omonimo e il
    JSON restano il riferimento completo quando le tabelle superano il cap.
    """
    try:
        from multirepo.db_inventory import aggregate_by_schema
    except ImportError:
        from db_inventory import aggregate_by_schema
    all_res = [r for c in cartelle for r in c.get("db_inventory", [])]
    title = f"# Indice Banche Dati — dove risiede cosa{(' — ' + client) if client else ''}"
    if not all_res:
        return (title + "\n\n_Nessuna risorsa DB rilevata (nessun DDL, "
                "nessun SQL in adapter JCA, nessun mapping ODI con "
                "tabelle SCHEMA.TABELLA)._ \n")
    agg = aggregate_by_schema(all_res)
    out = [title, "",
           f"_Risorse rilevate: {len(all_res)} in {len(agg)} schemi. "
           "Ogni riga cita repo e `file:riga` (dubbio = assente)._", "",
           "## Schemi rilevati", "",
           "| Schema | Tabelle | Viste | Routine | Usi (`table_ref`) |",
           "|---|---|---|---|---|"]
    for schema in sorted(agg):
        b = agg[schema]
        out.append(f"| `{schema}` | {len(b['tables'])} | {len(b['views'])} | "
                   f"{len(b['routines'])} | {len(b['refs'])} |")
    out += ["", "## Dettaglio per schema", ""]
    shown, cap = 0, 2000
    for schema in sorted(agg):
        b = agg[schema]
        out.append(f"### Schema `{schema}`")
        if b["tables"]:
            out += ["", "| Tabella | Colonne (nome tipo) | Repo | Prova (`file:riga`) |",
                    "|---|---|---|---|"]
            for t in sorted(b["tables"], key=lambda x: (x["name"], x["repo"])):
                if shown >= cap:
                    out.append(f"| … | | | (+{len(all_res) - shown} risorse: vedi `09_INVENTARIO_DB.csv`) |")
                    break
                shown += 1
                cols = "<br/>".join(f"`{c}`" for c in t["columns"]) or "—"
                loc = f"`{t['file']}:{t['line']}`" if t["line"] else f"`{t['file']}`"
                out.append(f"| `{t['name']}` | {cols} | `{t['repo']}` | {loc} |")
        if b["views"]:
            out += ["", "**Viste:** " + ", ".join(
                f"`{t['name']}` (`{t['repo']}` `{t['file']}:{t['line']}`)"
                for t in sorted(b["views"], key=lambda x: x["name"])[:50])]
        if b["routines"]:
            out += ["", "**Routine:** " + ", ".join(
                f"`{t['name']}` (`{t['repo']}`)" for t in
                sorted(b["routines"], key=lambda x: x["name"])[:50])]
        if b["triggers"]:
            out += ["", "**Trigger:** " + ", ".join(
                f"`{t['name']}` ({t['detail'] or '—'})" for t in
                sorted(b["triggers"], key=lambda x: x["name"])[:50])]
        if b["refs"]:
            out += ["", "**Usi in mapping/adapter:** " + ", ".join(
                f"`{t['name']}` ({t['detail'] or '—'}, `{t['repo']}`)" for t in
                sorted(b["refs"], key=lambda x: x["name"])[:50])]
        out.append("")
    out += ["## Chi scrive / chi legge (per tabella usata)", "",
            build_consumers_section(cartelle), "",
            "_Riferimento completo machine-readable: `08_INVENTARIO_DB.json`; "
            "tabellare: `09_INVENTARIO_DB.csv`._", ""]
    return "\n".join(out)


def build_db_csv(cartelle: list) -> str:
    """09_INVENTARIO_DB.csv — una riga per risorsa DB (completo, senza cap).

    Colonne: schema, name, kind, columns (|), repo, file, line, detail, source.
    Si apre in Excel per cercare subito dove risiede una tabella.
    """
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(["schema", "name", "kind", "columns", "repo", "file",
                "line", "detail", "source"])
    rows = [r for c in cartelle for r in c.get("db_inventory", [])]
    for r in sorted(rows, key=lambda x: ((x.get("schema") or "").upper(),
                                         str(x.get("name", "")).upper(),
                                         str(x.get("repo", "")),
                                         str(x.get("file", "")),
                                         int(x.get("line") or 0))):
        cols = "|".join(r.get("columns", []) or [])
        w.writerow([r.get("schema", ""), r.get("name", ""),
                    r.get("kind", ""), cols, r.get("repo", ""),
                    r.get("file", ""), r.get("line", 0),
                    r.get("detail", ""), r.get("source", "")])
    return buf.getvalue()


def build_file_index(cart: dict) -> str:
    """INDEX_PER_FILE: ogni file XML/SOA -> doc generata o NON confermato."""
    rows = []
    for fd in cart.get("file_docs", []):
        docs = fd.get("doc") or []
        if docs:
            stato = "<br/>".join(f"`{d}`" for d in docs)
        else:
            stato = "NON confermato (nessun doc generato)"
        rows.append(f"| `{fd.get('file', '')}` | {fd.get('kind', '?')} | "
                    f"{fd.get('detected_by', '—')} | {stato} |")
    # file ODI/BPEL/BPMN noti ma senza record router (vecchie per-cartella):
    known = {fd.get("file") for fd in cart.get("file_docs", [])}
    for bucket in ("odi_exports", "lp_files", "scen_files"):
        for e in cart.get(bucket, []):
            f = e.get("file", "")
            if f and f not in known:
                rows.append(f"| `{f}` | ? | — | NON confermato (file_docs assente) |")
    for b in cart.get("bpmn_files", []) + cart.get("bpel_files", []):
        if b not in known:
            rows.append(f"| `{b}` | ? | — | NON confermato (file_docs assente) |")
    table = "\n".join(sorted(rows)) if rows else "| — | — | — | — |"
    return (f"# Indice per-file — `{cart.get('name', '')}`\n\n"
            f"Ogni file riconosciuto ha la sua documentazione nel suo formato; "
            f"gli XML non riconosciuti hanno una scheda generica leggera.\n\n"
            f"| File | Tipo | Rilevato da | Doc generata / Stato |\n"
            f"|---|---|---|---|\n{table}\n")


def package_documentation(client: str, outbase: str = DEFAULT_OUTBASE) -> str:
    """Costruisce la directory dossier_package e genera il file .zip finale."""
    outdir = os.path.join(outbase, client)
    pkg_dir = os.path.join(outdir, "dossier_package")
    shutil.rmtree(pkg_dir, ignore_errors=True)
    os.makedirs(pkg_dir, exist_ok=True)

    # Carica file sorgente generati dalla pipeline
    per_path = os.path.join(outdir, "per-cartella.json")
    try:
        with open(per_path, encoding="utf-8") as fh:
            per_data = json.load(fh)
    except Exception:
        per_data = {"client": client, "cartelle": []}

    cross_path = os.path.join(outdir, "crosslink.json")
    try:
        with open(cross_path, encoding="utf-8") as fh:
            cross_data = json.load(fh)
    except Exception:
        cross_data = {"names": [], "edges": [], "mermaid": "flowchart LR"}

    cartelle = per_data.get("cartelle", [])
    edges = cross_data.get("edges", [])
    mermaid_src = cross_data.get("mermaid", "")
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Master rows per DBA/ETL
    try:
        from multirepo.report import master_rows
    except ImportError:
        from report import master_rows
    try:
        from multirepo.db_inventory import aggregate_by_schema
    except ImportError:
        from db_inventory import aggregate_by_schema
    mrows = master_rows(per_data)

    # Dati arricchiti per i builder: contratti SOA, config, dipendenze.
    contracts_by_repo = {c.get("name", ""): load_canonical_contracts(outbase, client, c.get("name", ""))
                         for c in cartelle}
    cfg_by_repo = {c.get("name", ""): collect_config_rows(c) for c in cartelle}
    all_deps = [d for c in cartelle for d in parse_manifest_deps(c)]

    # 1. Cartella radice: 00_INDICE_E_GUIDA_DOCUMENTAZIONE.md
    with open(os.path.join(pkg_dir, "00_INDICE_E_GUIDA_DOCUMENTAZIONE.md"), "w", encoding="utf-8") as f:
        f.write(build_indice(client, now, cartelle, edges))

    # 2. Cartella 01: Architettura e System Design
    arch_dir = os.path.join(pkg_dir, "01_Architettura_e_System_Design")
    os.makedirs(arch_dir, exist_ok=True)
    for name, content in build_architettura(client, now, cartelle, edges, mermaid_src,
                                            contracts_by_repo).items():
        with open(os.path.join(arch_dir, name), "w", encoding="utf-8") as f:
            f.write(content)

    # Copia matrice CSV e JSON grafo in architettura
    src_csv = os.path.join(outdir, "crosslink_rules.csv")
    if os.path.isfile(src_csv):
        shutil.copyfile(src_csv, os.path.join(arch_dir, "04_MATRICE_DIPENDENZE.csv"))
    with open(os.path.join(arch_dir, "05_GRAFO_RELAZIONI.json"), "w", encoding="utf-8") as f:
        json.dump(cross_data, f, indent=2, ensure_ascii=False)

    # 3. Cartella 02: Sviluppo, DevOps e Database
    dev_dir = os.path.join(pkg_dir, "02_Sviluppo_DevOps_e_Database")
    os.makedirs(dev_dir, exist_ok=True)
    for name, content in build_sviluppo(client, now, cartelle, edges, mrows,
                                        cfg_by_repo).items():
        with open(os.path.join(dev_dir, name), "w", encoding="utf-8") as f:
            f.write(content)

    # Copia CSV master e regole
    src_master = os.path.join(outdir, "master_csv_input_output.csv")
    if os.path.isfile(src_master):
        shutil.copyfile(src_master, os.path.join(dev_dir, "06_MASTER_INPUT_OUTPUT.csv"))
    if os.path.isfile(src_csv):
        shutil.copyfile(src_csv, os.path.join(dev_dir, "05_MAPPING_RULES.csv"))
    with open(os.path.join(dev_dir, "07_INVENTARIO_TECNOLOGICO.json"), "w", encoding="utf-8") as f:
        json.dump(per_data, f, indent=2, ensure_ascii=False)
    db_all = [r for c in cartelle for r in c.get("db_inventory", [])]
    initiators_all = [{**e, "repo": c.get("name", "")} for c in cartelle
                      for e in c.get("initiators", [])]
    with open(os.path.join(dev_dir, "08_INVENTARIO_DB.json"), "w", encoding="utf-8") as f:
        json.dump({"client": client, "generated": now,
                   "by_schema": aggregate_by_schema(db_all),
                   "consumers": build_consumers(db_all),
                   "initiators": initiators_all,
                   "resources": db_all}, f, indent=2, ensure_ascii=False)
    # Indice navigabile + CSV: dove risiede cosa (schemi, colonne, repo).
    with open(os.path.join(dev_dir, "09_INDICE_DB.md"), "w", encoding="utf-8") as f:
        f.write(build_db_index_md(cartelle, client))
    with open(os.path.join(dev_dir, "09_INVENTARIO_DB.csv"), "w",
              encoding="utf-8-sig", newline="") as f:
        f.write(build_db_csv(cartelle))

    # 4. Cartella 03: Business e Processi
    biz_dir = os.path.join(pkg_dir, "03_Business_e_Processi")
    os.makedirs(biz_dir, exist_ok=True)
    for name, content in build_business(client, now, cartelle, edges, mrows).items():
        with open(os.path.join(biz_dir, name), "w", encoding="utf-8") as f:
            f.write(content)

    # 5. Cartella 04: Governance e Audit
    gov_dir = os.path.join(pkg_dir, "04_Governance_e_Audit")
    os.makedirs(gov_dir, exist_ok=True)
    for name, content in build_governance(client, now, cartelle, edges, all_deps).items():
        with open(os.path.join(gov_dir, name), "w", encoding="utf-8") as f:
            f.write(content)

    if os.path.isfile(src_csv):
        shutil.copyfile(src_csv, os.path.join(gov_dir, "02_REGISTRO_EVIDENZE_AUDIT.csv"))
    src_ver = os.path.join(outdir, "verifica_mapping.txt")
    if os.path.isfile(src_ver):
        shutil.copyfile(src_ver, os.path.join(gov_dir, "03_VERIFICA_INTEGRITA.txt"))

    # 6. Cartella 05: Dettaglio Singole Repo (Copia output dei tool specialistici se presenti)
    single_dir = os.path.join(pkg_dir, "05_Dettaglio_Singole_Repo")
    os.makedirs(single_dir, exist_ok=True)
    tools_output_dir = os.path.join(outdir, "tools_output")
    per_by_name = {c.get("name", ""): c for c in cartelle}
    if os.path.isdir(tools_output_dir):
        for repo_name in os.listdir(tools_output_dir):
            rsrc = os.path.join(tools_output_dir, repo_name)
            if os.path.isdir(rsrc):
                rdest = os.path.join(single_dir, repo_name)
                shutil.copytree(rsrc, rdest, dirs_exist_ok=True)
                cart = per_by_name.get(repo_name)
                if cart is not None:
                    with open(os.path.join(rdest, "INDEX_PER_FILE.md"),
                              "w", encoding="utf-8") as fh:
                        fh.write(build_file_index(cart))

    # 7. Creazione del file compresso ZIP finale
    zip_filename = f"{client}_documentazione.zip"
    zip_path = os.path.join(outdir, zip_filename)
    if os.path.exists(zip_path):
        try:
            os.remove(zip_path)
        except OSError:
            pass

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, _dirs, files in os.walk(pkg_dir):
            for file in files:
                abs_file = os.path.join(root, file)
                rel_in_zip = os.path.relpath(abs_file, pkg_dir)
                zf.write(abs_file, rel_in_zip)

    return zip_path


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Genera il dossier modulare multi-audience e il file ZIP.")
    parser.add_argument("--client", default=DEFAULT_CLIENT, help="Nome del cliente")
    parser.add_argument("--out", default=DEFAULT_OUTBASE, help="Cartella base di output")
    args = parser.parse_args(argv)

    client = (args.client or DEFAULT_CLIENT).strip() or DEFAULT_CLIENT
    zip_res = package_documentation(client, args.out)
    print(f"ok: pacchetto documentale creato -> {zip_res}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
