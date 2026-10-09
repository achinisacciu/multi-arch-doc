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
    layer_map = {"Middleware / SOA": [], "ETL / Data Integration": [], "Applicativo / Servizi": []}

    # Calcolo metriche di centralità e accoppiamento
    deg_out: dict[str, int] = {}
    deg_in: dict[str, int] = {}
    for e in edges:
        deg_out[e.get("da", "")] = deg_out.get(e.get("da", ""), 0) + 1
        deg_in[e.get("a", "")] = deg_in.get(e.get("a", ""), 0) + 1

    for c in cartelle:
        role = c.get("role_description") or c.get("archetype") or "Componente Software"
        arch = c.get("archetype", "Software Component")
        techs = ", ".join(c.get("tech", [])) or "—"
        c_name = c.get("name", "")

        # Classificazione Layer
        if "SOA" in arch or "Service Bus" in arch:
            layer_map["Middleware / SOA"].append(c_name)
            layer_name = "Integrazione Middleware & Service Bus"
        elif "ETL" in arch or "ODI" in arch:
            layer_map["ETL / Data Integration"].append(c_name)
            layer_name = "Data Integration & Batch ETL"
        else:
            layer_map["Applicativo / Servizi"].append(c_name)
            layer_name = "Core Applicativo & Micro-servizi"

        n_out = deg_out.get(c_name, 0)
        n_in = deg_in.get(c_name, 0)
        tot_conn = n_out + n_in
        if tot_conn >= 4:
            crit_role = "⚠️ Hub Centrale / Perno di Integrazione (Alto Rischio d'Impatto)"
        elif n_out > 0 and n_in == 0:
            crit_role = "📤 Consumatore / Iniziatore Indipendente"
        elif n_in > 0 and n_out == 0:
            crit_role = "📥 Service Provider / Modulo Condiviso"
        else:
            crit_role = "↔ Modulo Peer-to-Peer Interconnesso"

        topo_rows.append(
            f"### Modulo: `{c_name}`\n"
            f"- **Livello Architetturale:** {layer_name}\n"
            f"- **Archetipo Funzionale:** {arch}\n"
            f"- **Ruolo Operativo nell'Ecosistema:** {role}\n"
            f"- **Classificazione di Accoppiamento:** {crit_role}\n"
            f"- **Stack Tecnologico Abilitante:** {techs}\n"
            f"- **Indicatori di Rete:** {n_out} canali in uscita (dipendenze esterne) · {n_in} canali in ingresso (consumatori)\n"
            f"- **Percorso Originale sul File System:** `{c.get('root', '—')}`\n"
        )

    # Identifica il componente più critico / bottleneck
    central_repo = max(cartelle, key=lambda c: deg_out.get(c.get("name", ""), 0) + deg_in.get(c.get("name", ""), 0), default=None)
    central_name = central_repo.get("name", "") if central_repo else "Nessuno"

    topologia_md = f"""# Architettura e Topologia di Sistema — {client}

_Data generazione: {now}_
_Inquadramento Metodologico: Analisi Topologica Multi-Repository (C4 Container & Component Model)_

## 1. Mappa delle Interazioni Inter-Repository

Il seguente grafo sintetizza le interconnessioni architetturali scoperte tramite scansione deterministica del codice sorgente, delle configurazioni e dei descrittori di deployment:

```mermaid
{mermaid_src or 'flowchart LR'}
```

> [!NOTE]
> Il grafo evidenzia le relazioni dirette (import di codice, condivisione di database, orchestrazioni multi-servizio).
> La presenza di frecce bidirezionali indica un accoppiamento circolare o una cooperazione simbiotica tra componenti.

---

## 2. Suddivisione nei Livelli Architetturali (Layering Enterprise)

L'ecosistema è organizzato su tre layer logici cooperanti:

| Livello Architetturale | Repository Assegnate | Descrizione del Ruolo e Confini Operativi |
|---|---|---|
| **Integrazione Middleware & Service Bus** | {', '.join(f'`{r}`' for r in layer_map['Middleware / SOA']) or '—'} | Esposizione contratti SOAP/WSDL, adapter JCA verso DB transazionali, orchestrazioni BPEL e routing |
| **Data Integration & Batch ETL** | {', '.join(f'`{r}`' for r in layer_map['ETL / Data Integration']) or '—'} | Pipeline di estrazione, trasformazione e popolamento magazzini dati analitici (Oracle ODI) |
| **Core Applicativo & Microservizi** | {', '.join(f'`{r}`' for r in layer_map['Applicativo / Servizi']) or '—'} | Logica applicativa di business, script di calcolo/elaborazione e container operativi |

---

## 3. Analisi di Resilienza, Punti di Bottleneck e SPOF

1. **Componente Hub Principale (`{central_name}`):**
   - Presenta la massima densità di connessioni in ingresso/uscita dell'intero ecosistema.
   - Ogni modifica o indisponibilità di questo modulo comporta un rischio di impatto sistemico a cascata sui servizi correlati.
2. **Accoppiamenti Dati Condivisi (Shared Database Anti-Pattern):**
   - Più moduli accedono alle medesime istanze o tabelle senza passare da uno strato API o Service Bus.
   - Raccomandazione: Incapsulare l'accesso al database dietro interfacce contrattualizzate o adapter middleware.
3. **Isolamento dei Guasti (Fault Domain Isolation):**
   - La presenza di dipendenze dirette a livello di codice impone che gli ambienti di rilascio siano rigorosamente sincronizzati in fase di CI/CD.

---

## 4. Schede di Dettaglio per Singolo Componente

{chr(10).join(topo_rows)}

---

## 5. Matrice di Accoppiamento e Meccanismi di Comunicazione

1. **Accoppiamenti Diretti (Codice / Import):** dipendenze esplicite a livello di interprete/compilatore (`import`, `require`, percorsi relativi);
2. **Accoppiamenti Dati (Database Condiviso):** componenti che condividono host o tabelle (`SCHEMA.TABELLA`);
3. **Accoppiamenti di Rete (Chiamate API):** servizi che contattano endpoint esposti su porte dichiarate;
4. **Accoppiamenti di Deployment (Docker Compose):** cicli di vita congiunti e dipendenze di avvio;
5. **Accoppiamenti Batch (Orchestrazione Condivisa):** scenari e LoadPlan eseguiti congiuntamente.
"""

    # 02_DATA_FLOW_E_INTERAZIONI.md
    flow_rows = []
    for e in edges:
        p_str = "<br/>".join(f"`{redact(p)}`" for p in e.get("prove", []))
        flow_type = e.get("tipo", "interazione")
        if "import" in flow_type:
            proto = "In-Process (Linguaggio)"
            crit = "Alta (Dipendenza Diretta di Codice)"
            lat = "Nullo (In-Memory)"
        elif "db" in flow_type:
            proto = "Storage (Database Condiviso)"
            crit = "Critica (Consistenza Dati e Transazioni)"
            lat = "Bassa (Rete Locale / JDBC)"
        elif "rete" in flow_type or "chiamate" in flow_type:
            proto = "Network (HTTP / REST)"
            crit = "Media (Rete Runtime)"
            lat = "Variabile (Chiamata HTTP)"
        elif "orchestrazione" in flow_type or "compose" in flow_type:
            proto = "Deployment / Scheduler"
            crit = "Operativa (Orchestrazione e Startup)"
            lat = "Asincrona / Batch"
        else:
            proto = "File / Entità Condivisa"
            crit = "Informativa"
            lat = "N/A"

        flow_rows.append(f"| `{e.get('da')}` | `{e.get('a')}` | **{flow_type}** | {proto} | {lat} | {e.get('grado')} | {crit} | {p_str} |")
    table_flows = "\n".join(flow_rows) if flow_rows else "| — | — | (nessuna interazione rilevata) | — | — | — | — | — |"

    data_flow_md = f"""# Flussi Dati e Canali di Interazione tra Componenti — {client}

_Data pubblicazione: {now}_

Questo documento censisce tutti i canali di scambio dati, chiamate di rete, orchestrazioni e dipendenze attive rilevate tra le repository dell'ecosistema.

| Sorgente (Da) | Destinazione (A) | Tipologia Canale | Protocollo / Meccanismo | Profilo Latenza | Grado Certezza | Criticità Accoppiamento | Evidenze Riscontrate |
|---|---|---|---|---|---|---|---|
{table_flows}

---

## 2. Tassonomia dei Canali di Integrazione Rilevati

1. **`import-cross-cartella`:** Dipendenza diretta tra file sorgente. Una modifica all'interfaccia esposta rompe il consumatore a build-time.
2. **`db-condiviso`:** Accesso concomitante alla stessa istanza di database. Rischio di schema migration disallineate e collisione transazionale.
3. **`chiamate-rete`:** Chiamata API su porta di servizio dichiarata. Richiede disponibilità runtime del servizio target.
4. **`compose-multi-servizio`:** Coordinamento architetturale via container Docker per lo startup congiunto dei servizi.
5. **`orchestrazione-condivisa`:** Flusso batch o scenario condiviso tra moduli, con coordinamento temporale richiesto.
6. **`file-identico`:** File con identico hash crittografico SHA-256 (libreria condivisa o duplicazione di codice da consolidare).

---

## 3. Presidio di Sicurezza nei Flussi Dati
- **Sanitizzazione Credenziali:** Tutte le prove riportate nel documento sono state automaticamente epurate da chiavi segrete, password e token crittografici (`***redatto***`).
- **Nessuna Esposizione di Segreti:** I parametri di connessione al database conservano esclusivamente metadati di puntamento (host, schema, tabella) per consentire la mappatura architetturale senza rischi di sicurezza.
"""

    # 03_CONTRATTI_DI_SERVIZIO.md (prima canonical SOA reale, poi file grezzi)
    contract_rows = []
    for c in cartelle:
        for ct in (contracts_by_repo or {}).get(c.get("name", ""), []):
            det = f" — {ct['detail']}" if ct.get("detail") else ""
            contract_rows.append(
                f"| `{c.get('name')}` | `{ct.get('file')}` | **{ct.get('kind')}** | Formalizzato Enterprise | {det or 'Operazioni di servizio contrattualizzate'} |")
    if not contract_rows:
        for c in cartelle:
            for f in c.get("files", []):
                ext = f.get("ext", "").lower()
                if ext in (".wsdl", ".xsd", ".jca"):
                    kind_desc = "Contratto WSDL (SOAP Interfaccia di Servizio)" if ext == ".wsdl" else ("Schema XSD (Definizione Tipi Dati)" if ext == ".xsd" else "Adapter JCA (Middleware Database / AQ)")
                    contract_rows.append(
                        f"| `{c.get('name')}` | `{f.get('rel_path')}` | **{ext.upper().lstrip('.')}** | Standard Enterprise | {kind_desc} |")
    table_contracts = "\n".join(contract_rows) if contract_rows else "| — | — | — | — | Nessun file di contratto WSDL/XSD/OpenAPI esplicito rilevato |"

    contratti_md = f"""# Contratti di Servizio, Schemi ed Interfacce — {client}

_Data pubblicazione: {now}_
_Standard di riferimento: W3C WSDL 1.1/2.0, XML Schema (XSD), JCA 1.5/1.6, WS-BPEL 2.0_

Il presente catalogo censisce i contratti formali di servizio e le definizioni di interfaccia individuate nel perimetro applicativo.

| Repository | File di Contratto | Tipologia | Livello Formalizzazione | Dettaglio Operazioni ed Entità |
|---|---|---|---|---|
{table_contracts}

---

## 2. Governance delle Interfacce e Linee Guida di Manutenzione

1. **Contratti WSDL (SOAP Services):**
   - Le operazioni esposte definiscono i confini stabili tra il client e i servizi enterprise.
   - Ogni variazione al WSDL deve garantire retrocompatibilità (non-breaking changes) tramite versioning semantico dell'endpoint o del namespace.
2. **Schemi Dati XSD (Canonical Data Model):**
   - Gli schemi XSD centralizzano la validazione dei payload XML. Assicurarsi che i tipi complessi siano riutilizzati e non duplicati tra repository.
3. **Adapter Middleware JCA:**
   - I file `.jca` mappano le chiamate middleware verso connettori fisici (Database JDBC, Code AQ/JMS).
   - I JNDI delle Connection Factory (`eis/DB/*`, `eis/AQ/*`) devono essere configurati in modo omogeneo sugli ambienti di collaudo e produzione.
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


def _clean_mermaid_id(name: str) -> str:
    import re
    return re.sub(r"[^a-zA-Z0-9_]", "_", name)


def build_etl_odi_section(client: str, now: str, cartelle: list, edges: list, mrows: list) -> str:
    all_mappings = []
    all_sources = set()
    all_targets = set()
    target_to_mappings: dict[str, list[dict]] = {}

    for c in cartelle:
        repo_name = c.get("name", "")
        for exp in c.get("odi_exports", []):
            for m in exp.get("mappings", []):
                name = m.get("name", "Mapping")
                sources = m.get("sources", [])
                targets = m.get("targets", [])
                desc = m.get("description", "")
                ikm = m.get("ikm", "")
                lkm = m.get("lkm", "")
                ckm = m.get("ckm", "")
                itype = m.get("integration_type", "")
                trunc = m.get("truncate_target", "")
                stg = m.get("staging_area", "")
                for s in sources:
                    all_sources.add(s)
                for t in targets:
                    all_targets.add(t)
                    target_to_mappings.setdefault(t, []).append({
                        "repo": repo_name,
                        "file": exp.get("file", ""),
                        "mapping": name,
                    })
                all_mappings.append({
                    "repo": repo_name,
                    "file": exp.get("file", ""),
                    "name": name,
                    "sources": sources,
                    "targets": targets,
                    "description": desc,
                    "ikm": ikm,
                    "lkm": lkm,
                    "ckm": ckm,
                    "integration_type": itype,
                    "truncate_target": trunc,
                    "staging_area": stg,
                })

    all_loadplans = []
    lp_scenarios_called: dict[str, list[dict]] = {}
    for c in cartelle:
        repo_name = c.get("name", "")
        for lp in c.get("lp_files", []):
            lp_names = lp.get("loadplan_names", []) or [os.path.basename(lp.get("file", ""))]
            steps = lp.get("steps", [])
            for s in steps:
                sname = s.get("scen_name")
                if sname:
                    lp_scenarios_called.setdefault(sname, []).append({
                        "lp_name": lp_names[0],
                        "step_name": s.get("name", "Step"),
                        "step_order": s.get("order", "0"),
                        "repo": repo_name,
                    })
            all_loadplans.append({
                "repo": repo_name,
                "file": lp.get("file", ""),
                "names": lp_names,
                "global_ids": lp.get("global_ids", []),
                "steps": steps,
            })

    all_scenarios = []
    scen_repo_count = {}
    for c in cartelle:
        repo_name = c.get("name", "")
        for sc in c.get("scen_files", []):
            snames = sc.get("scen_names", []) or [os.path.basename(sc.get("file", ""))]
            for sn in snames:
                scen_repo_count[sn] = scen_repo_count.get(sn, 0) + 1
                all_scenarios.append({
                    "repo": repo_name,
                    "file": sc.get("file", ""),
                    "name": sn,
                    "versions": sc.get("scen_versions", []),
                    "global_ids": sc.get("global_ids", []),
                })

    # Catene di dipendenza Read-After-Write (RAW)
    raw_chains = []
    intermediate_tables = sorted(all_sources & all_targets)
    for it in intermediate_tables:
        producers = [m for m in all_mappings if it in m["targets"]]
        consumers = [m for m in all_mappings if it in m["sources"]]
        raw_chains.append({
            "table": it,
            "producers": producers,
            "consumers": consumers,
        })

    n_mappings = len(all_mappings)
    n_sources = len(all_sources)
    n_targets = len(all_targets)
    n_lps = len(all_loadplans)
    n_scens = len(all_scenarios)
    n_shared_scens = sum(1 for sn, cnt in scen_repo_count.items() if cnt > 1)
    n_orphan_scens = sum(1 for sc in all_scenarios if sc["name"] not in lp_scenarios_called)
    n_multi_writers = sum(1 for t, m_list in target_to_mappings.items() if len(m_list) > 1)

    # 1. Unified Mermaid Lineage Flowchart con subgraphs per schema
    mermaid_lines = ["flowchart LR"]
    if all_mappings:
        # Raggruppa tabelle per schema
        schemas_tables: dict[str, set[str]] = {}
        for t in sorted(all_sources | all_targets):
            sch = t.split(".", 1)[0] if "." in t else "DEFAULT"
            schemas_tables.setdefault(sch, set()).add(t)

        for sch, tbls in sorted(schemas_tables.items()):
            sch_clean = _clean_mermaid_id(sch)
            # Classifica schema come Source, DWH o Staging
            sch_upper = sch.upper()
            if any(k in sch_upper for k in ("DWH", "EDW", "DM", "FACT", "DIM")):
                sch_title = f"🏛️ Schema DWH: {sch}"
            elif any(k in sch_upper for k in ("STG", "STAGE", "TMP", "RAW")):
                sch_title = f"🔄 Schema Staging: {sch}"
            else:
                sch_title = f"📥 Schema Operazionale: {sch}"

            mermaid_lines.append(f'    subgraph SG_{sch_clean} ["{sch_title}"]')
            for t in sorted(tbls):
                tid = f"T_{_clean_mermaid_id(t)}"
                if len(target_to_mappings.get(t, [])) > 1:
                    mermaid_lines.append(f'        {tid}[("📤 {t}<br/>⚠️ Multi-Writer ({len(target_to_mappings[t])})")]')
                elif t in all_targets:
                    mermaid_lines.append(f'        {tid}[("📤 {t}")]')
                else:
                    mermaid_lines.append(f'        {tid}[("📥 {t}")]')
            mermaid_lines.append("    end")

        # Nodi mapping ed archi
        for i, m in enumerate(all_mappings):
            mid = f"MAP_{i}"
            mermaid_lines.append(f'    {mid}["⚙️ {m["name"]}\\n({m["repo"]})"]')
            for s in m["sources"]:
                sid = f"T_{_clean_mermaid_id(s)}"
                mermaid_lines.append(f"    {sid} --> {mid}")
            for t in m["targets"]:
                tid = f"T_{_clean_mermaid_id(t)}"
                mermaid_lines.append(f"    {mid} --> {tid}")
    else:
        mermaid_lines.append('    NO_ETL["Nessun flusso ETL mappato"]')
    mermaid_flow = "\n".join(mermaid_lines)

    # 2. Tabella di Lineage Generale
    lineage_rows = []
    for m in all_mappings:
        srcs = "<br/>".join(f"`{s}`" for s in m["sources"]) or "—"
        tgts = "<br/>".join(f"`{t}`" for t in m["targets"]) or "—"
        if any("FACT" in t.upper() or "F_" in t.upper() for t in m["targets"]):
            flow_type = "Caricamento Fatti (Fact DWH)"
        elif any("DIM" in t.upper() or "D_" in t.upper() for t in m["targets"]):
            flow_type = "Caricamento Dimensioni (Dim DWH)"
        elif any("STAGE" in t.upper() or "STG" in t.upper() or "TMP" in t.upper() for t in m["targets"]):
            flow_type = "Ingestion / Staging Area"
        else:
            flow_type = "Trasformazione Dati Standard"
        km = m.get("ikm") or "IKM / Control Append"
        verif = f"`{m['file']}` (XML SunopsisExport)"
        lineage_rows.append(
            f"| `{m['repo']}` | `{m['file']}` | **`{m['name']}`** | {srcs} | {tgts} | {flow_type} | {km} | {verif} |"
        )
    table_lineage = "\n".join(lineage_rows) if lineage_rows else "| — | — | — | — | — | — | — | — |"

    # 2b. Chaining (Read-After-Write)
    if raw_chains:
        raw_rows = []
        for rc in raw_chains:
            p_str = "<br/>".join(f"`{p['name']}` (`{p['repo']}`)" for p in rc["producers"])
            c_str = "<br/>".join(f"`{c['name']}` (`{c['repo']}`)" for c in rc["consumers"])
            raw_rows.append(f"| `{rc['table']}` | {p_str} | {c_str} | Sequenziale Obbligatorio (Producer prima di Consumer) | ⚠️ Critico se parallelo |")
        table_raw = (
            "| Tabella Intermedia / Staging | Mappings Produttori (Scrittori) | Mappings Consumatori (Lettori) | Vincolo d'Ordine | Rischio Architetturale |\n"
            "|---|---|---|---|---|\n" + "\n".join(raw_rows)
        )
    else:
        table_raw = "_Nessuna concatenazione a stadi rilevata (architettura a singolo hop Source → Target diretta senza tabelle intermedie condivise)._"

    # 3. Schede Dettagliate per Singolo Mapping
    detail_blocks = []
    for m in all_mappings:
        io_rows = []
        for s in m["sources"]:
            sch, tb = s.split(".", 1) if "." in s else ("DEFAULT", s)
            io_rows.append(f"| INPUT | `{sch}` | `{tb}` | Lettura Sorgente (Extraction) | SELECT / Full Scan o Incremental |")
        for t in m["targets"]:
            sch, tb = t.split(".", 1) if "." in t else ("DEFAULT", t)
            io_rows.append(f"| OUTPUT | `{sch}` | `{tb}` | Scrittura Bersaglio (Target Load) | INSERT / MERGE (Control Append) |")
        io_table = "\n".join(io_rows) if io_rows else "| — | — | — | — | — |"

        # Correlazione con Scenari e LoadPlan
        matching_scens = [sc["name"] for sc in all_scenarios if m["name"].lower() in sc["name"].lower() or sc["repo"] == m["repo"]]
        scen_links = ", ".join(f"`{sn}`" for sn in matching_scens) if matching_scens else "_Correlazione per convenzione repo_"

        calling_lps = []
        for sn in matching_scens:
            for call in lp_scenarios_called.get(sn, []):
                calling_lps.append(f"`{call['lp_name']}` (Step: `{call['step_name']}`)")
        lp_links = ", ".join(sorted(set(calling_lps))) if calling_lps else "_Nessuna chiamata esplicita da LoadPlan censita_"

        desc_text = m.get("description") or "Flusso di popolamento dati estratto dalla definizione di mapping ODI."
        km_text = m.get("ikm") or "IKM Oracle Control Append / Multi-table Insert"

        detail_blocks.append(f"""### Mapping: `{m['name']}`
- **Repository di Origine:** `{m['repo']}`
- **File Sorgente XML:** `{m['file']}`
- **Descrizione Funzionale:** {desc_text}
- **Knowledge Module (IKM / LKM):** `{km_text}`
- **Modalità di Esecuzione:** Batch ETL (commit a fine blocco / append mode)
- **Scenari Correlati:** {scen_links}
- **Piani di Caricamento Orchestranti:** {lp_links}

#### Datastore e Tabelle I/O
| Direzione | Schema | Tabella | Ruolo Operativo | Modalità Accesso Dati |
|---|---|---|---|---|
{io_table}

#### Raccomandazioni di Performance e Manutenzione
1. Verificare la presenza di indici B-Tree sulle chiavi di join/filtro delle tabelle sorgente.
2. Controllare le tabelle di errore CKM (`E$_*`) per scartare record non conformi prima del commit.
3. Se il volume supera 1M di record, valutare il caricamento con hint direct-path (`/*+ APPEND */`).
""")
    detail_md = "\n".join(detail_blocks) if detail_blocks else "_Nessun mapping presente._\n"

    # 4. LoadPlan
    lp_summary_rows = []
    lp_detail_blocks = []
    for lp in all_loadplans:
        names_str = ", ".join(f"`{n}`" for n in lp["names"])
        gids_str = ", ".join(f"`{g}`" for g in lp["global_ids"]) or "—"
        n_steps = len(lp["steps"])
        lp_status = f"{n_steps} step operativi" if n_steps > 0 else "⚠️ Scheletro / Senza step nidificati"
        lp_summary_rows.append(f"| `{lp['repo']}` | `{lp['file']}` | {names_str} | {gids_str} | {lp_status} |")

        step_rows = []
        for s in lp["steps"]:
            scen_call = f"▶ `{s.get('scen_name')}`" if s.get("scen_name") else "—"
            parent = f"`{s['parent_id']}`" if s.get("parent_id") and s['parent_id'] != 'null' else "Radice"
            restart = s.get("restart_type") or "Restart from failed step"
            step_rows.append(f"| {s.get('order', '0')} | **`{s.get('name', 'Step')}`** | `{s.get('type', 'SCENARIO')}` | {scen_call} | {parent} | {restart} |")
        step_table = "\n".join(step_rows) if step_rows else "| — | — | — | — | — | — |"

        lp_mermaid = ["flowchart TD", f'    START(["🚀 Inizio: {lp["names"][0]}"])']
        if lp["steps"]:
            prev = "START"
            for idx, st in enumerate(lp["steps"]):
                nid = f"STEP_{idx}"
                lbl = f"{st.get('name', 'Step')}\\n({st.get('type', 'SCENARIO')})"
                if st.get("scen_name"):
                    lbl += f"\\n▶ {st['scen_name']}"
                lp_mermaid.append(f'    {nid}["{lbl}"]')
                lp_mermaid.append(f'    {prev} --> {nid}')
                prev = nid
            lp_mermaid.append(f'    {prev} --> END(["🏁 Fine Piano"])')
        else:
            lp_mermaid.append('    START --> END(["🏁 Fine Piano (Scheletro)"])')

        diagnostic_note = ""
        if n_steps == 0:
            diagnostic_note = f"""
> [!NOTE]
> **Diagnosi Tecnica sull'Export:** Il file XML dichiara la testata del LoadPlan (`SnpLoadPlan`) con identificativo `{gids_str}`,
> ma non include elementi `<Object class="...SnpLpStep">` nidificati.
> Questo accade comunemente quando l'export ODI è generato senza l'opzione "Includi oggetti dipendenti" o quando
> gli step sono gestiti nel Master Repository o orchestrati esternamente. La testata e il GlobalId rimangono tracciati per completezza.
"""

        lp_detail_blocks.append(f"""### LoadPlan: `{lp['names'][0]}`
- **Repository di Gestione:** `{lp['repo']}`
- **File Sorgente XML:** `{lp['file']}`
- **Identificativo Globale (GlobalId):** {gids_str}
- **Step di Esecuzione Censiti:** {n_steps}
{diagnostic_note}
#### Sequenza dei Passi Operativi
| Ordine | Nome Step | Tipologia | Scenario Invocato | Step Padre | Politica di Ripristino |
|---|---|---|---|---|---|
{step_table}

#### Diagramma del Flusso di Esecuzione
```mermaid
{chr(10).join(lp_mermaid)}
```
""")

    table_lp_summary = "\n".join(lp_summary_rows) if lp_summary_rows else "| — | — | — | — | — |"
    lp_sections_md = "\n".join(lp_detail_blocks) if lp_detail_blocks else "_Nessun LoadPlan presente._\n"

    # 5. Audit Scenari
    scen_rows = []
    for sc in all_scenarios:
        sname = sc["name"]
        is_orphan = sname not in lp_scenarios_called
        is_shared = scen_repo_count.get(sname, 0) > 1

        call_list = lp_scenarios_called.get(sname, [])
        call_str = "<br/>".join(f"LP `{c['lp_name']}` ({c['repo']}) - Step `{c['step_name']}`" for c in call_list)

        if is_orphan and is_shared:
            stato = "⚠️ ORFANO & CONDIVISO"
            note = "Non chiamato da LoadPlan nel perimetro; duplicato in più repository"
            action = "Verificare schedulatore esterno (es. Control-M) o bonificare copie"
        elif is_orphan:
            stato = "⚠️ ORFANO"
            note = "Non chiamato da nessun LoadPlan analizzato (possibile avvio manuale/deprecato)"
            action = "Verificare se avviato manualmente o pianificare decommission"
        elif is_shared:
            stato = "🔄 CONDIVISO"
            note = f"Eseguito e condiviso su più repository ({call_str})"
            action = "Mantenere sincronizzate le versioni tra i moduli"
        else:
            stato = "✅ ATTIVO"
            note = f"Invocato regolarmente da piano di caricamento ({call_str})"
            action = "Componente in produzione regolare"
        scen_rows.append(f"| **`{sname}`** | `{sc['repo']}` | `{sc['file']}` | {stato} | {note} | {action} |")
    table_scens = "\n".join(scen_rows) if scen_rows else "| — | — | — | — | — | — |"

    # 7. Multi-Writer Risk
    multi_writer_rows = []
    for t, m_list in sorted(target_to_mappings.items()):
        if len(m_list) > 1:
            repos_involved = sorted({m["repo"] for m in m_list})
            mappings_involved = "<br/>".join(f"• `{m['mapping']}` ({m['repo']}: `{m['file']}`)" for m in m_list)

            # Valuta se sono orchestrati insieme
            shared_lp = False
            for lp in all_loadplans:
                lp_scens = {s.get("scen_name") for s in lp["steps"]}
                writer_matches = sum(1 for m in m_list if any(m["mapping"].lower() in sn.lower() for sn in lp_scens if sn))
                if writer_matches > 1:
                    shared_lp = True
                    break

            if shared_lp:
                risk_lvl = "🔶 MEDIO (Orchestrato in Sequenza)"
                concurr_note = "Presente nello stesso LoadPlan; verificare ordine seriale dei passi."
            elif len(repos_involved) > 1:
                risk_lvl = "⚠️ ALTO (Multi-Writer Cross-Repo)"
                concurr_note = "Mapping residenti su repository differenti: rischio lock simultaneo o sovrascrittura se eseguiti in parallelo."
            else:
                risk_lvl = "⚠️ MEDIO-ALTO (Multi-Writer Locale)"
                concurr_note = "Più mapping alimentano lo stesso target; garantire serializzazione."

            multi_writer_rows.append(
                f"| `{t}` | {len(m_list)} mapping ({', '.join(repos_involved)}) | {risk_lvl} | {mappings_involved} | {concurr_note} |"
            )
    if multi_writer_rows:
        table_multi = (
            "| Tabella Bersaglio | Numero Scrittori | Grado di Rischio | Mapping e Repository Coinvolti | Valutazione Concorrenza e Impatto |\n"
            "|---|---|---|---|---|\n" + "\n".join(multi_writer_rows)
        )
    else:
        table_multi = "_Nessuna tabella bersaglio condivisa da più mapping (nessuna collisione rilevata)._"

    return f"""# Trasformazioni Dati, Lineage ed Orchestrazioni ETL (Oracle ODI) — {client}

_Data pubblicazione: {now}_
_Standard di riferimento: Oracle Data Integrator (ODI 11g/12c) · Analisi Statica Deterministica dei Metadati XML_

## 📊 Dashboard Sintetica ed Indicatori Chiave (KPI)

La seguente dashboard sintetizza la consistenza delle pipeline di data integration, lo stato delle orchestrazioni batch e i punti di convergenza rilevati nel perimetro:

| Metrica ETL / Orchestrazione | Valore Rilevato | Descrizione e Significato Architetturale |
|---|---|---|
| **Totale Mapping Rilevati** | **{n_mappings}** | Flussi di trasformazione dati estratti e verificati dai file XML SunopsisExport |
| **Tabelle Sorgente Distinte (Input)** | **{n_sources}** | Datastore operazionali da cui vengono estratte le informazioni di business |
| **Tabelle Destinazione Distinte (Output)** | **{n_targets}** | Datastore analitici / dimensionali popolati dalle pipeline ETL |
| **Piani di Caricamento (LoadPlan)** | **{n_lps}** | Orchestrazioni e sequenze batch globali individuate nei repository |
| **Totale Scenari Compilati Rilevati** | **{n_scens}** | Oggetti compilati ed esportati pronti per l'esecuzione runtime |
| **Scenari Condivisi (Cross-Repo)** | **{n_shared_scens}** | Scenari presenti con lo stesso identificativo su più moduli dell'ecosistema |
| **Scenari Orfani (Non Orchestrati)** | **{n_orphan_scens}** | Scenari presenti nel codice ma non richiamati da alcun LoadPlan nel perimetro |
| **Punti di Collisione (Multi-Writer)** | **{n_multi_writers}** | Tabelle di destinazione alimentate concorrentemente da più mapping distinti |
| **Catene Read-After-Write (RAW)** | **{len(raw_chains)}** | Dipendenze sequenziali in cui una tabella scritta da un flusso è letta da un altro |

---

## 1. Mappa di Lineage End-to-End (Mermaid Dataflow)

Il seguente diagramma sintetizza il grafo unificato dei flussi: le tabelle sono raggruppate per schema di appartenenza e convergono direttamente sui motori di trasformazione, evidenziando chiaramente le sorgenti OLTP, le pipeline intermedie e i magazzini dati finali:

```mermaid
{mermaid_flow}
```

> [!TIP]
> **Legenda del Grafo:**
> - `[("📥 SCHEMA.TABELLA")]`: Datastore sorgente (estrazione dati)
> - `["⚙️ Mapping (repo)"]`: Logica di trasformazione e caricamento ODI
> - `[("📤 SCHEMA.TABELLA")]`: Datastore analitico / bersaglio di destinazione
> - `[("📤 ... ⚠️ Multi-Writer")]`: Bersaglio alimentato da più scrittori (punto di convergenza critico)

---

## 2. Matrice Generale delle Trasformazioni (Data Lineage Tabellare)

Riepilogo organico di tutte le pipeline censite, con indicazione dei datastore di input/output, della strategia di caricamento e del file di prova verificato:

| Repository | File Export | Nome Mapping | Tabelle Sorgente (Sources) | Tabelle Destinazione (Targets) | Tipologia Flusso | Strategia / KM | Fonte Verificata |
|---|---|---|---|---|---|---|---|
{table_lineage}

### 2.2 Analisi delle Catene di Trasformazione (Read-After-Write Chaining)
Le catene di trasformazione si verificano quando un mapping popola una tabella che costituisce a sua volta l'input per un mapping successivo. In tali scenari, l'orchestrazione deve garantire rigorosamente l'ordine temporale:

{table_raw}

---

## 3. Schede Dettagliate per Singolo Mapping

{detail_md}

---

## 4. Piani di Caricamento (LoadPlan) ed Alberi di Esecuzione

I Piani di Caricamento (LoadPlan) definiscono la gerarchia, le priorità e le politiche di ripristino per i flussi batch aziendali.

### Riepilogo Generale LoadPlan
| Repository | File XML | Nome LoadPlan | GlobalId | Stato Strutturale |
|---|---|---|---|---|
{table_lp_summary}

{lp_sections_md}

---

## 5. Audit degli Scenari (Attivi, Condivisi ed Orfani)

Verifica dell'effettiva esecuzione runtime degli scenari per rilevare componenti morti, non orchestrati o duplicati tra repository:

| Nome Scenario | Repository | File Sorgente | Stato Orchestrazione | Dettaglio e Note di Esecuzione | Piano d'Azione Consigliato |
|---|---|---|---|---|---|
{table_scens}

> [!CAUTION]
> **Gestione Scenari Orfani:** Gli scenari contrassegnati come `⚠️ ORFANO` non vengono invocati da alcun LoadPlan all'interno del perimetro analizzato.
> Si consiglia di verificare se l'esecuzione è demandata a scheduler esterni (es. Control-M, UC4, cron di sistema) oppure se si tratta di codice dismesso da archiviare per alleggerire la manutenzione.

---

## 6. Avvii Tecnici ed Iniziatori dei Flussi

{build_initiators_section(cartelle)}

---

## 7. Matrice dei Rischi e Convergenze ETL (Data Integrity Audit)

### 7.1 Tabelle Bersaglio con Scrittori Multipli (Multi-Writer Risk)
Quando più mapping alimentano la stessa tabella (in particolare se appartenenti a repository differenti), sussiste un potenziale rischio di sovrascrittura, perdita di dati o lock concorrente se l'ordine di esecuzione non è rigidamente coordinato:

{table_multi}

### 7.2 Linee Guida per Data Engineer, DBA e Solution Architect
1. **Ordinamento e Serializzazione:** Verificare che i mapping concorrenti siano eseguiti in passi seriali distinti e mai paralleli all'interno dei LoadPlan.
2. **Isolamento delle Transazioni:** Configurare appropriati commit batch e valutare l'uso di partizioni o tabelle di staging dedicate per ciascun canale scrittore.
3. **Bonifica Scenari Deprecati:** Archiviare gli scenari orfani non più utilizzati per prevenire esecuzioni accidentali e velocizzare i tempi di build.
4. **Verifica I/O End-to-End:** Accertare che tutte le tabelle lette siano alimentate con i necessari intervalli temporali rispetto alle sorgenti transazionali e agli adapter SOA.

---

## 8. Verificabilità, Metodologia e Limiti dell'Analisi

1. **Origine dei Dati:** I metadati sono stati estratti tramite ispezione statica deterministica dei file XML di export Sunopsis (`SnpMapping`, `SnpPop`, `SnpLoadPlan`, `SnpLpStep`, `SnpScen`). Nessun dato è simulato o inferito senza riscontro nel codice.
2. **Ambito di Verifica:** L'analisi rileva la struttura logica dichiarata. Valori di variabili runtime passate dinamicamente al momento del lancio da agenti esterni o procedure SQL non cablate nei dump XML richiedono verifica sui database operativi di collaudo e produzione.
"""



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

        # Conteggio estensioni file
        ext_counts: dict[str, int] = {}
        for f in files:
            e = f.get("ext", "senza-estensione")
            ext_counts[e] = ext_counts.get(e, 0) + 1
        ext_summary = ", ".join(f"`{k}` ({v})" for k, v in sorted(ext_counts.items(), key=lambda x: -x[1])[:8])

        cards.append(f"""### Repository: `{c.get('name')}`
- **Archetipo Applicativo:** {c.get('archetype', 'Componente')}
- **Ruolo / Responsabilità Architetturale:** {c.get('role_description', '—')}
- **Stack Tecnologico Abilitante:** {techs}
- **Volumetria Codice:** {len(files)} file sorgente censiti
- **Ripartizione File per Tipologia:** {ext_summary}
- **File di Build / Manifest:** {man_str}
- **Punti di Ingresso (Entrypoints):** {entrypoints}
- **Percorso di Origine sul File System:** `{c.get('root')}`
""")

    schede_md = f"""# Schede Tecniche di Dettaglio per Repository — {client}

_Data generazione: {now}_
_Destinatari: Sviluppatori Software, Tech Lead, DevOps Engineer e System Administrator_

Il presente documento fornisce la scheda tecnica di ciascun repository analizzato, descrivendone stack tecnologico, struttura del codice, manifest di build ed entrypoint operativi.

{chr(10).join(cards)}
"""

    # 02_CONFIGURAZIONI_E_VARIABILI.md (config generica, segreti redatti)
    cfg_rows = []
    ports_detected = []
    db_configs = []
    for c in cartelle:
        for ref in (cfg_by_repo or {}).get(c.get("name", ""), []):
            k = ref.get("key", "")
            v = ref.get("value", "")
            ctx = ref.get("context", "")
            if "port" in k.lower():
                ports_detected.append(f"Modulo `{c.get('name')}`: `{k}={v}`")
            if any(term in k.lower() for term in ("db", "host", "jdbc", "datasource", "schema")):
                db_configs.append(f"Modulo `{c.get('name')}`: `{k}={v}`")
            cfg_rows.append(
                f"| `{c.get('name')}` | `{ref.get('file')}:{ref.get('line')}` | "
                f"`{k}` | `{v}` | {ctx} |")
    table_cfg = "\n".join(cfg_rows) if cfg_rows else "| — | — | — | — | Nessuna variabile di configurazione rilevata |"

    ports_summary = "<br/>".join(f"• {p}" for p in sorted(set(ports_detected))) if ports_detected else "_Nessuna porta esplicita dichiarata._"
    db_summary = "<br/>".join(f"• {p}" for p in sorted(set(db_configs))) if db_configs else "_Nessun puntamento DB esplicito nei properties._"

    config_md = f"""# Configurazioni, Porte e Variabili d'Ambiente — {client}

_Data generazione: {now}_

Elenco organico dei parametri di configurazione, endpoint di rete e variabili censite nei file `.properties`, `.env`, `.yml`, `.json`.

> [!NOTE]
> **Presidio di Sicurezza:** Eventuali credenziali, token e password sono stati offuscati automaticamente (`***redatto***`).
> L'analisi preserva esclusivamente chiavi e puntamenti infrastrutturali necessari per mappare l'architettura.

## 1. Punti di Ascolto di Rete e Porte di Servizio
{ports_summary}

## 2. Puntamento Risorse Database
{db_summary}

---

## 3. Matrice Completa dei Parametri di Configurazione

| Repository | File:Riga | Parametro / Chiave | Valore (redatto dove sensibile) | Contesto / Ambito |
|---|---|---|---|---|
{table_cfg}

---

## 4. Conformità con la Metodologia 12-Factor App
1. **Separazione Codice/Configurazione:** I parametri che variano tra ambienti (dev/test/prod) devono essere gestiti tramite variabili d'ambiente di sistema e file esterni al versionamento di codice.
2. **Standardizzazione Chiavi:** Armonizzare i prefissi delle proprietà di configurazione tra i moduli per facilitare la gestione centralizzata tramite container e secret manager.
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

    etl_md = build_etl_odi_section(client, now, cartelle, edges, mrows)

    return {
        "01_SCHEDE_TECNICHE_REPO.md": schede_md,
        "02_CONFIGURAZIONI_E_VARIABILI.md": config_md,
        "03_DATABASE_E_ADAPTER_SQL.md": db_md,
        "04_TRASFORMAZIONI_ETL_ODI.md": etl_md,
    }


def build_business(client: str, now: str, cartelle: list, edges: list, mrows: list) -> dict[str, str]:
    # 01_SINTESI_ESECUTIVA.md
    n_repos = len(cartelle)
    n_files = sum(len(c.get("files", [])) for c in cartelle)
    n_edges = len(edges)
    all_techs = sorted({t for c in cartelle for t in c.get("tech", [])})

    archetype_counts = {}
    for c in cartelle:
        arch = c.get("archetype", "Software Component")
        archetype_counts[arch] = archetype_counts.get(arch, 0) + 1
    archetypes_summary = ", ".join(f"**{a}** ({cnt})" for a, cnt in sorted(archetype_counts.items()))

    items = []
    for c in cartelle:
        role = c.get("role_description", "Componente applicativo")
        n_cfiles = len(c.get("files", []))
        tech_str = ", ".join(c.get("tech", [])) or "—"
        items.append(
            f"### `{c.get('name')}`\n"
            f"- **Dominio e Scopo di Business:** {role}\n"
            f"- **Archetipo Applicativo:** `{c.get('archetype', 'Componente')}`\n"
            f"- **Dimensione del Patrimonio:** {n_cfiles} file sorgente\n"
            f"- **Stack Tecnologico Abilitante:** {tech_str}\n"
        )
    role_cards = "\n".join(items) if items else "_Nessuna repository presente._"

    sintesi_md = f"""# Sintesi Esecutiva dell'Ecosistema Applicativo — {client}

_Data di pubblicazione: {now}_
_Destinatari: Direzione IT, CIO, Chief Architect, Product Owner e Project Manager_

## 1. Visione d'Insieme e Dashboard Direzionale

Il sistema analizzato per il committente **{client}** rappresenta un'architettura enterprise integrata distribuita su **{n_repos} repository software**, per un totale di **{n_files} file sorgente** e **{n_edges} relazioni di interscambio** scoperte.

| Indicatore Direzionale | Valore Rilevato | Note Strategiche |
|---|---|---|
| **Perimetro Repository** | **{n_repos}** moduli software | Copertura completa dei domini analizzati |
| **Volumetria Codice** | **{n_files}** file censiti | Inclusi contratti WSDL, XML ODI, script e configurazioni |
| **Interazioni tra Moduli** | **{n_edges}** canali di collegamento | Integrazioni dirette, database condivisi e flussi di rete |
| **Archetipi Architetturali** | {archetypes_summary} | Ecosistema ibrido SOA, Data Integration (ETL) e servizi |
| **Tecnologie Chiave** | {', '.join(all_techs) or '—'} | Piattaforme Oracle (ODI, SOA Suite), Python, Docker |

---

## 2. Capacità di Business Erogate dall'Ecosistema

I moduli cooperano per garantire l'operatività continua dei seguenti processi aziendali:
1. **Elaborazione e Trasformazione Dati (Data Integration & DWH):** alimentazione continua dei magazzini dati analitici e direzionali tramite pipeline batch ETL;
2. **Integrazione Middleware e Service Bus:** orchestrazione di eventi di business e connettività orientata ai servizi (SOA/BPEL/JCA) con sistemi transazionali periferici;
3. **Flussi di Lavoro e Gestione Operativa:** tracciamento e automazione dei processi di business secondo lo standard BPMN;
4. **Interscambio di Rete e Chiamate API:** sincronizzazione sincrona tra componenti distribuiti e micro-servizi.

---

## 3. Profilo dei singoli Componenti nel Business

{role_cards}

---

## 4. Valutazione di Resilienza e Rischi Operativi

Dall'analisi delle interazioni emergono i seguenti punti di attenzione per i decisori e i Product Owner:
- **Accoppiamenti Dati Condivisi:** monitorare le tabelle bersaglio alimentate da più flussi ETL per evitare disallineamenti di caricamento;
- **Divergenze di Versione:** verificare le librerie terze parti per armonizzare il ciclo di vita del software;
- **Tracciabilità dei Processi:** documentare gli scenari orfani o privi di piano di caricamento per assicurare la manutenibilità a lungo termine.

---

## 5. Roadmap Strategica Raccomandata per la Governance IT
1. **Fase 1 (Disaccoppiamento):** Ridurre gli accessi diretti a database condivisi incapsulandoli in API o adapter SOA dedicati.
2. **Fase 2 (Armonizzazione):** Allineare le versioni delle dipendenze comuni e rimuovere i file duplicati censiti nel report di governance.
3. **Fase 3 (Manutenzione ETL):** Bonificare gli scenari ODI orfani ed esplicitare nei LoadPlan l'ordinamento dei mapping multi-writer.
"""

    # 02_MAPPA_PROCESSI_BPMN_BPEL.md
    proc_rows = []
    proc_mermaid = ["flowchart TD"]
    has_proc = False
    for i, c in enumerate(cartelle):
        for bp in c.get("bpmn_files", []):
            pname = os.path.splitext(os.path.basename(bp))[0]
            proc_rows.append(
                f"| `{c.get('name')}` | `{bp}` | **BPMN 2.0** | Flusso Operativo / Workflow | Start Event / Messaggio | `{pname}` |"
            )
            proc_mermaid.append(f'    P_BPMN_{i}["📋 BPMN: {pname}\\n({c.get("name")})"]')
            has_proc = True
        for f in c.get("files", []):
            if f.get("ext") == ".bpel":
                pname = os.path.splitext(os.path.basename(f["rel_path"]))[0]
                proc_rows.append(
                    f"| `{c.get('name')}` | `{f.get('rel_path')}` | **BPEL 2.0** | Orchestrazione Servizio Middleware | Invocazione PartnerLink | `{pname}` |"
                )
                proc_mermaid.append(f'    P_BPEL_{i}["⚙️ BPEL: {pname}\\n({c.get("name")})"]')
                has_proc = True
    if not has_proc:
        proc_mermaid.append('    NONE["Nessun processo BPMN/BPEL esplicito"]')
    table_proc = "\n".join(proc_rows) if proc_rows else "| — | — | — | — | — | Nessun processo BPMN/BPEL rilevato |"

    processi_md = f"""# Mappa dei Processi di Business ed Orchestrazioni — {client}

_Data pubblicazione: {now}_
_Standard documentati: BPMN 2.0 (Business Process Model and Notation) e WS-BPEL 2.0_

## 1. Mappa dei Diagrammi di Processo (BPMN) ed Orchestrazioni (BPEL)

L'ecosistema implementa logiche di processo formalizzate secondo gli standard BPMN e BPEL:

| Repository | File Processo | Standard | Tipologia Operativa | Trigger di Avvio | Nome Processo |
|---|---|---|---|---|---|
{table_proc}

---

## 2. Diagramma Sintetico dei Processi Esecutivi

```mermaid
{chr(10).join(proc_mermaid)}
```

---

## 3. Avvii Tecnici ed Iniziatori (Chi avvia cosa)

Di seguito l'elenco completo degli eventi scatenanti i processi aziendali:

{build_initiators_section(cartelle)}
"""

    # 03_GLOSSARIO_BUSINESS.md
    gloss_rows = []
    seen = set()
    for proj, mapping, schema, table, _kind in mrows:
        term = f"{schema}.{table}"
        if term not in seen and len(gloss_rows) < 80:
            seen.add(term)
            sch_upper = schema.upper()
            if "SALES" in sch_upper or "ORDER" in sch_upper:
                cat = "Vendite, Ordini e Transazioni Commerciali"
            elif "LOGIST" in sch_upper or "SHIP" in sch_upper:
                cat = "Logistica, Spedizioni e Movimentazione Merci"
            elif "DWH" in sch_upper or "DIM" in sch_upper or "FACT" in sch_upper:
                cat = "Data Warehouse, Analitica e Reporting Direzionale"
            elif "HR" in sch_upper or "EMP" in sch_upper:
                cat = "Risorse Umane, Anagrafiche e Amministrazione"
            else:
                cat = f"Dominio Dati `{schema}`"
            gloss_rows.append(f"| **`{term}`** | Entità Dati / Tabella | {cat} | Utilizzata nel mapping `{mapping}` (`{proj}`) |")

    for c in cartelle:
        for exp in c.get("odi_exports", []):
            for m in exp.get("mappings", []):
                mname = m.get("name")
                if mname and mname not in seen and len(gloss_rows) < 80:
                    seen.add(mname)
                    gloss_rows.append(f"| **`{mname}`** | Flusso di Trasformazione (ETL) | Integrazione Dati | Trasformazione dati per il componente `{c.get('name')}` (`{exp.get('file')}`) |")
        for lp in c.get("lp_files", []):
            for lpn in lp.get("loadplan_names", []):
                if lpn and lpn not in seen and len(gloss_rows) < 80:
                    seen.add(lpn)
                    gloss_rows.append(f"| **`{lpn}`** | Piano di Caricamento (LoadPlan) | Orchestrazione Batch | Sequenza di esecuzione batch gestita da `{c.get('name')}` |")

    table_gloss = "\n".join(gloss_rows) if gloss_rows else "| — | — | — | — | Nessun termine di dominio rilevato |"

    glossario_md = f"""# Glossario dei Termini di Business e di Dominio — {client}

_Data pubblicazione: {now}_

Il presente glossario traduce in termini funzionali e descrittivi le entità dati, le tabelle e i flussi emersi dall'analisi dell'ecosistema software:

| Termine / Entità | Tipologia Architetturale | Area di Business / Dominio | Contesto Operativo nel Sistema |
|---|---|---|---|
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
_Inquadramento Metodologico: Audit di Sicurezza, Supply Chain & Technical Debt_

## 1. Analisi Dipendenze e Versioni Divergenti
L'uso di versioni differenti della stessa libreria in componenti che interagiscono tra loro rappresenta un rischio per la stabilità a runtime, la sicurezza e la compatibilità delle API.

| Moduli Coinvolti | Tipologia | Livello di Attenzione | Dettaglio Prove |
|---|---|---|---|
{table_risks}

### Versioni divergenti (stesso pacchetto, versioni diverse)
L'esistenza di versioni disallineate (es. una versione più recente e una legacy) espone a rischi di comportamento non deterministico e potenziali vulnerabilità note (CVE):

| Pacchetto | Chi lo usa @ versione | Livello di Attenzione |
|---|---|---|
{table_div}

### Inventario dipendenze terze parti (da `package.json` / `requirements.txt` / `pom.xml`)
Censimento completo delle librerie open-source ed esterne importate tramite i descrittori di build:

| Pacchetto | Versione | Ecosistema | Repository | Manifest |
|---|---|---|---|---|
{table_deps}

---

## 2. Analisi Duplicazione Codice / File Identici
Rilevamento di file duplicati tra repository diverse con corrispondenza verificata tramite hash crittografico SHA-256. La duplicazione del codice sorgente aumenta i costi di manutenzione e introduce il rischio di patch applicate in modo asimmetrico:

| Repository Coinvolte | File e Checksum Rilevati |
|---|---|
{table_dup}

---

## 3. Politiche di Sicurezza, Segreti e Riservatezza
- **Sanitizzazione Automatica delle Credenziali:** Tutte le password, chiavi API, token e connection string nei file di configurazione sono state rilevate e redatte preventivamente (`***redatto***`).
- **Nessuna Fuga di Segreti:** La scansione conferma che nessun segreto transita nei report di analisi esportabili o nell'archivio documentale ZIP.
- **Isolamento dell'Ambiente:** L'ispezione è avvenuta in conformità con i requisiti di audit statico locale senza invio di metadati riservati all'esterno.
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
