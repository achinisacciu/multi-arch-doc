# bpmn-reverse-engineer

**BPMN 2.0 Structural + Semantic Reverse Engineering — Tool 1.5**

Tool deterministico locale che trasforma file `.bpmn` (singolo o cartella) in modello normalizzato + grafo di esecuzione + analisi strutturale **arricchita**, senza inventare semantica.

> Input: `BPMN XML` (file o cartella) → Output: `analisi/` + `analisi anonimi/` → `bpmn_analysis.json` + `bpmn_analysis.md` + `bpmn_graph.json/.graphml`

Evoluzione del Tool 1: ora con **Tool 1.5 Semantic Enricher** (backfill `incoming/outgoing`, interpretazione `extensionElements` → `service_implementations`, tracking `unresolved_references` verso Tool 2). Costruito come componente del sistema che collegherà BPMN ↔ BPEL, SCA, Mediator, JCA, WSDL, XSD, XSLT, endpoint e risorse esterne.

---

## Cosa fa / Cosa NON fa

**Fa (Tool 1.5):**
- Parse robusto BPMN 2.0 (namespace-agnostico, `lxml recover`, vendor extensions)
- Estrae processi, eventi, activities, gateway, `sequence/messageFlow`, lane/participant, `documentation`, `extensionElements`, reference esplicite
- **Arricchisce** `incoming/outgoing` vuoti inferendoli da `sequenceFlow` (`enriched_incoming/outgoing`, `was_*_enriched`) — ogni nodo diventa auto-descrittivo
- **Interpreta** `extensionElements` (Oracle/SOA, `adapter`, `binding`) → `service_implementations` (`task_id, operationRef, endpoint, adapter, status`)
- Classifica elementi sconosciuti come `unknown_bpmn_element`
- Costruisce grafo `networkx` e calcola path `start → end`
- Genera metriche estese (`num_service_implementations`, `num_unresolved_refs`), `structural_warnings` e **sezioni Tool 1.5** nel report
- Batch su cartella (`--recursive`, `--pattern`) e **mini frontend web** (`serve`) — sempre due output `analisi/` + `analisi anonimi/` (schema `1.5`)

**NON fa (per design):**
- Non risolve WSDL/BPEL/composite — traccia solo `unresolved_references` per Tool 2
- Non interpreta `conditionExpression` oltre al verbatim
- Non usa LLM nel core — è deterministico (LLM separabile come layer opzionale)
- Non collega cross-artifact completo — sarà Tool 2

---

## Installazione

Prerequisiti: **Python 3.11+**

```bash
git clone <repo>
cd bpmn-reverse-engineer
pip install -e ".[dev]"
```

Dipendenze: `lxml`, `networkx`, `pydantic`, `rich`, `click`

---

## Utilizzo

### Singolo file

```bash
bpmn-reverse-engineer analyze path/to/process.bpmn
bpmn-reverse-engineer analyze process.bpmn --output ./analysis --verbose
bpmn-reverse-engineer analyze process.bpmn --no-graph   # solo JSON+MD
```

### Cartella (batch)

```bash
bpmn-reverse-engineer analyze path/to/folder --output ./analysis
bpmn-reverse-engineer analyze ./bpmn_folder --recursive --pattern "*.bpmn"
bpmn-reverse-engineer analyze ./project --output ./analysis --verbose --recursive
```

Accetta cartella come input: raccoglie tutti i `.bpmn` (default `*.bpmn`, custom `--pattern`), opzionale `--recursive`. Genera **sempre** due cartelle top-level `analisi/` e `analisi anonimi/` (anche per singolo file, confermato), con sottocartelle per file che preservano la struttura relativa.

### Mini frontend (senza riga di comando)

```bash
bpmn-reverse-engineer serve
bpmn-reverse-engineer serve --port 8000 --open-browser
bpmn-reverse-engineer serve --host 0.0.0.0 --port 8080
```

Apre `http://127.0.0.1:8000`: drag&drop di file `.bpmn` o **cartella intera**, selezione multipla, opzioni (`path-limit`, `anonymize`, `both`), avvio analisi e download **ZIP** con `analisi/` + `analisi anonimi/`.

Help:
```bash
bpmn-reverse-engineer analyze --help
bpmn-reverse-engineer serve --help
```

### Opzioni `analyze`

| Flag | Default | Descrizione |
|---|---|---|
| `--output` / `-o` | `./analysis` | directory di output (conterrà `analisi/` + `analisi anonimi/`) |
| `--json/--no-json` | `--json` | esporta JSON |
| `--markdown/--no-markdown` | `--markdown` | esporta Markdown |
| `--graph/--no-graph` | `--graph` | esporta grafo JSON+GraphML |
| `--verbose` / `-v` | off | dettagli warning |
| `--path-limit` | 100 | limite enumerazione path |
| `--anonymize` | off | solo `analisi anonimi/` |
| `--both` | off | esplicito entrambe |
| `--recursive` / `-r` | off | ricerca ricorsiva se input è cartella |
| `--pattern` | `*.bpmn` | glob per cartella (es. `*.bpmn`) |

> Default senza flag: genera **entrambe** `analisi/` e `analisi anonimi/` (confermato). `--anonymize` → solo anonimi, `--both` → entrambe esplicite.

### Opzioni `serve`

| Flag | Default | Descrizione |
|---|---|---|
| `--host` | `127.0.0.1` | host bind |
| `--port` | `8000` | porta |
| `--open-browser` | off | apri browser automaticamente |

---

## Output diagnostico

```
BPMN Reverse Engineer
────────────────────────────────────
Output analisi: /abs/path/analysis/analisi
Output anonimi: /abs/path/analysis/analisi anonimi

Elaborazione: sample.bpmn -> analysis/analisi/sample | analysis/analisi anonimi/sample
  OK P:1 A:4 G:1 Paths:2 Warn:2

Batch completato: 12 OK, 0 errori su 12 file
Riepilogo batch: analysis/batch_index.json
```

---

## Output su disco

```
# singolo file
analysis/
├── analisi/
│   └── bpmn_analysis.json   # normalizzato + metriche estese + service_implementations
│   ├── bpmn_analysis.md     # 16 sezioni (incl. Tool 1.5)
│   ├── bpmn_graph.json
│   └── bpmn_graph.graphml
├── analisi anonimi/          # stessi file con valori wrappati in ``
│   └── bpmn_analysis.json
│   └── ...
├── batch_index.json          # solo per batch/cartella
└── batch_summary.md

# batch cartella (2 file, con sottostruttura preservata)
analysis/
├── analisi/
│   ├── 01_linear/
│   │   ├── bpmn_analysis.json
│   │   └── ...
│   └── sub/02_gateway/
│       └── ...
├── analisi anonimi/
│   ├── 01_linear/            # versioni anonimizzate
│   └── sub/02_gateway/
├── batch_index.json
└── batch_summary.md
```

**Cosa viene wrappato in `` quando in `analisi anonimi/`:** `process.id/name/namespace`, `element.id/name/documentation/lane`, `enriched_incoming/outgoing`, `implementation/operationRef`, `sequenceFlow.*`, `references.value`, `extensions.*`, `service_implementations.*`, `flow_node_refs`, `graph node/edge ids` — mai `tool_version`, `schema_version`, `metrics` (conteggi), `is_executable`, `sha256`.

---

## Struttura output

### `analisi/bpmn_analysis.json` (estratto, schema 1.5)

```json
{
  "tool_version": "0.1.0",
  "schema_version": "1.5",
  "source": { "filename": "process.bpmn", "sha256": "...", "size_bytes": 12345 },
  "processes": [{ "id": "Process_1", "name": "...", "is_executable": true }],
  "elements": [{
    "id": "Task_A",
    "type": "serviceTask",
    "incoming": ["F1"],
    "outgoing": ["F2"],
    "enriched_incoming": ["F1"],
    "enriched_outgoing": ["F2"],
    "was_incoming_enriched": true,
    "implementation": "##WebService",
    "operation_ref": "myOp",
    "lane_id": "Lane_1"
  }],
  "sequence_flows": [{ "id": "F1", "source_ref": "Start", "target_ref": "Task_A", "condition": null }],
  "references": [{ "source_element": "Send1", "attribute": "operationRef", "value": "myOp", "resolved": false }],
  "extensions": [{ "parent_id": "Service_1", "tag": "adapter", "namespace": "http://example.com/ext", "raw_xml": "..." }],
  "service_implementations": [{ "task_id": "Service_Pay", "task_type": "serviceTask", "endpoint": "http://example.com/pay", "adapter": "PaymentAdapter", "status": "ambiguous", "source": "extensionElements/adapter" }],
  "unresolved_references": [{ "source_element": "Send1", "attribute": "operationRef", "value": "myOp", "reason": "no WSDL/BPEL resolver yet (Tool 2)" }],
  "metrics": { "num_processes": 1, "num_gateways": 2, "num_service_implementations": 1, "num_unresolved_refs": 2 },
  "paths": [{ "path_id": "P1", "nodes": ["Start","GW","Task_A","End"], "conditions": ["F2=${x>0}"] }],
  "structural_warnings": [{ "code": "unreachable_node", "message": "..." }]
}
```

Principio: campo assente → `null` / `"unknown"`, mai inventato. Nuovi campi Tool 1.5 additivi, default `[]`/`0`, retrocompatibili.

### `bpmn_graph.json`

```json
{ "nodes": [{"id":"Task_A","type":"serviceTask","lane":"Lane_1"}], "edges": [{"source":"Start","target":"Task_A","flow_id":"F1"}] }
```

---

## Architettura

```
src/bpmn_reverse_engineer/
├── cli.py                    # Rich CLI + batch + serve, sempre due cartelle
├── anonymize.py              # wrap valori estratti (incl. enriched, service_implementations)
├── web/
│   └── server.py             # mini frontend http.server (drag&drop cartella, ZIP con analisi + anonimi)
├── parser/
│   ├── bpmn_parser.py        # parser robusto (local-name, lxml recover)
│   ├── namespaces.py
│   └── extensions.py         # serializzazione extensionElements → JSON
├── models/
│   ├── process.py            # BpmnDocument (schema_version 1.5, service_implementations, unresolved_references)
│   ├── elements.py           # BpmnElement (enriched_incoming/outgoing, implementation, operation_ref)
│   ├── flows.py
│   └── references.py         # ExplicitReference (+resolved), ServiceImplementation, ExtensionElement
├── graph/process_graph.py    # build_graph (DiGraph)
├── analyzers/
│   ├── enrich_flows.py       # Tool 1.5: backfill incoming/outgoing + tipizzazione operationRef
│   ├── extension_semantics.py# Tool 1.5: extension → service_implementations
│   ├── metrics.py            # compute_metrics (+ num_service_implementations...) + warnings
│   └── paths.py              # all_simple_paths
└── exporters/
    ├── json_exporter.py
    ├── markdown_exporter.py  # 16 sezioni (15 Service Implementations, 16 Unresolved)
    └── graph_exporter.py
```

Pipeline Tool 1.5:

```
BPMN XML → Parsing (lxml) → Enrich Flows (backfill) → Extension Semantics → Graph (networkx) → Structural analysis → JSON + Markdown (16 sezioni) + GraphML → analisi/ + analisi anonimi/
```

### Modello dati

```
BpmnDocument (schema_version 1.5)
 ├── metadata (tool_version, schema_version, source)
 ├── processes[] / collaborations[] / participants[] / lanes[]
 ├── elements[]               # + enriched_incoming/outgoing, was_*_enriched, implementation, operation_ref, interface_ref, message_ref
 ├── sequence_flows[] / message_flows[]
 ├── references[]             # + resolved, target_hint
 ├── extensions[]
 ├── service_implementations[]# Tool 1.5: task_id, operationRef, endpoint, adapter, status, source
 ├── unresolved_references[]  # verso Tool 2
 ├── cross_artifact: null     # placeholder Tool 2
 ├── metrics{}                # + num_service_implementations, num_messages, num_unresolved_refs
 ├── paths[] / structural_warnings[]
 └── unknown_elements[]
```

Estendibile a `ProjectArtifact` per Tool 2.

---

## Robustezza

- `local_name` + `namespace_uri` (Clark), no XPath `bpmn:`
- `XMLParser(recover=True)` per XML malformati
- Ignora `BPMNDI`, accetta `bpmn2:`, `bpmn:`, nessun prefisso
- Preserva `extensionElements` verbatim + `raw_xml`
- Backfill `incoming/outgoing` da `sequenceFlow` se vuoti (Tool 1.5, tracciato con `was_*_enriched`)
- Explicit reference con `nsmap` QName, suffix `Ref/QName`

---

## Frontend web

- `bpmn-reverse-engineer serve` → `http://127.0.0.1:8000`
- Accetta **file multipli** e **cartella** (webkitdirectory + `DataTransfer.webkitGetAsEntry` ricorsivo), filtro solo `.bpmn`, preserva struttura relativa
- Opzioni: `path-limit`, `anonymize`, `both`, `verbose`
- ZIP scaricabile con `analisi/` + `analisi anonimi/` che preservano sottocartelle

---

## Esempio

```bash
bpmn-reverse-engineer analyze examples/sample_process.bpmn --output ./analysis --verbose
cat analysis/analisi/bpmn_analysis.json | head -n 50
cat analysis/analisi/bpmn_analysis.md   # 16 sezioni

# batch
bpmn-reverse-engineer analyze ./bpmn_folder --recursive --output ./analysis
ls analysis/analisi/ && ls "analysis/analisi anonimi/"
```

---

## Test

```bash
pytest -v
pytest --cov=src/bpmn_reverse_engineer
```

Fixtures: lineare, exclusive/parallel gateway, lane, messageFlow, timer, boundary, subprocess, callActivity, extensionElements, conditionExpression, unknown, **enriched flows**, **service implementations**.

---

## Limiti attuali

- BPMNDI non esportato
- Path enumeration limitata (default 100)
- `association`/`dataObject` come elementi
- Nessuna validazione XSD strict
- WSDL/BPEL/composite non risolti — solo `unresolved_references` per Tool 2

---

## Roadmap → Tool 2

```
                    ┌─────────────────┐
                    │ Project Folder  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Artifact Scanner│
                    └────────┬────────┘
              ┌──────────────▼──────────────┐
              │       Artifact Model        │
              └──────────────┬──────────────┘
       ┌─────────────────────┼─────────────────────┐
       │                     │                     │
     BPMN                  BPEL                 WSDL
       │                     │                     │
    Mediator               XSLT                  XSD
       │                     │                     │
    Adapter              Endpoint              Schema
       └─────────────────────┼─────────────────────┘
                    ┌────────▼────────┐
                    │ Dependency Graph│
                    └────────┬────────┘
                    ┌────────▼────────┐
                    │ Reverse Engine  │
                    └────────┬────────┘
              ┌──────────────▼──────────────┐
              │ Technical + Functional Docs │
              └─────────────────────────────┘
```

```
Tool 1   = BPMN Structural Extractor (completato)
Tool 1.5 = BPMN Semantic Enricher  (attuale, schema 1.5) ← backfill + service_implementations
Tool 2   = Cross-artifact Resolver  (prossimo) → scanner multi-file, QName→artifact, Dependency Graph
Tool 3   = Architecture Reconstructor → docs funzionali
```

---

```
Tool 1.5 = BPMN Structural + Semantic Enricher (schema 1.5)

Input:
BPMN (file o cartella)

Output:
analisi/ + analisi anonimi/
Normalized BPMN Model + Enriched Flows + Service Implementations + Execution Graph + Structural Analysis

Next:
Cross-artifact Dependency Resolution (WSDL/BPEL/Composite → Dependency Graph)
```
