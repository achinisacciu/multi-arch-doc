# SOA/BPMN Reverse Engineering Platform

**Obiettivo:** `Dato un progetto SOA completo, ricostruire automaticamente processo, dipendenze, implementazioni, dati, trasformazioni, endpoint e diramazioni`

> V0.1 BPMN Structural ✅ → V0.2 Semantic Enricher ✅ (Tool 1.5, schema 1.5) → **V0.3-V1.3 Platform** (questo pacchetto) — BPMN è solo il punto di ingresso.

```
                 PROJECT
                    │
        ┌───────────┴───────────┐
        │                       │
      BPMN                    SCA
        │                       │
      BPEL                    WSDL
        │                       │
     MEDIATOR                  XSD
        │                       │
     ADAPTER                   XSLT
        │                       │
   HUMAN TASK               CONFIG
        │                       │
        └───────────┬───────────┘
                    ↓
            ARTIFACT INDEX
                    ↓
          DEPENDENCY RESOLVER
                    ↓
          CANONICAL MODEL
                    ↓
             PROCESS GRAPH
                    ↓
        SEMANTIC ANALYZER
                    ↓
       ┌────────────┴────────────┐
       ↓                         ↓
 TECHNICAL DOCS           FUNCTIONAL DOCS
```

---

## Installazione

Prerequisiti: **Python 3.11+**, `lxml`, `networkx`, `pydantic`, `rich`, `click` (già in `bpmn-reverse-engineer`)

```bash
# Usa lo stesso venv del Tool BPMN
pip install -e ./bpmn-reverse-engineer
# Platform è in soa-reverse-engineer/ (nessun pip install extra per ora, run via python)
```

---

## Uso completo — CLI Platform

Tutte le CLI deterministiche, offline, senza LLM.

### 1. Scan — Artifact Registry (§3)

Inventaria con 4 livelli: `extension` + `namespace` + `root` + `fingerprint` (non solo estensione). Riconosce `bpmn,bpel,wsdl,xsd,xsl,composite,jca,mplan,task,dvm,componentType,cpx,sh,py...`

```bash
python soa-reverse-engineer/cli/main.py scan /path/to/project
python soa-reverse-engineer/cli/main.py scan /path/to/project --output registry.json --recursive
python soa-reverse-engineer/cli/main.py scan ./helios-loan --output /tmp/registry.json

# Output
# Registry: 13 artifact(s) — {'sca_composite':1, 'bpel':1, 'bpmn':1, 'wsdl':1, 'xsd':1, ...}
# Totale: 13 | Root: /path
```

Output `registry.json`:
```json
{
  "root": "/project",
  "total": 13,
  "by_type": {"sca_composite":1, "bpel":1, "bpmn":1, "wsdl":2, "xsd":2},
  "artifacts": [
    {"id":"artifact_abc123", "type":"bpmn", "path":"/abs/.../process.bpmn", "relativePath":"BPMN/process.bpmn", "detected_by":"extension+namespace", "sha256":"...", "size":1234}
  ]
}
```
ID deterministico `artifact_<hash12>` su `relativePath::fileName`.

### 2. Detect — singolo file

```bash
python soa-reverse-engineer/cli/main.py detect /path/to/service.wsdl
# Type: wsdl  detected_by: extension+namespace
```

### 3. Analyze — WSDL+XSD+SCA+BPEL+BPMN+XSLT + Lineage (V0.4-V0.7)

```bash
python soa-reverse-engineer/cli/main.py analyze /path/to/project
python soa-reverse-engineer/cli/main.py analyze /path/to/project --output canonical.json --recursive

# Esempio helios-loan (13 file agnostici)
python soa-reverse-engineer/cli/main.py analyze ./helios-loan -o /tmp/canonical.json
# Parsed: 1 WSDL, 2 XSD, 1 SCA, 1 BPEL, 1 BPMN, 1 XSLT
#   WSDL LoanService — 1 portTypes, 2 ops, imports=['Schemas/LoanSchema.xsd']
#   XSD LoanSchema — 2 elements, 2 complexTypes, imports=[]
#   SCA LoanApprovalService — 1 services, 4 components, 2 references, 2 wires
#   BPEL ProcessLoanBPEL — 2 partnerLinks, 1 invokes
#   XSLT LoanToBpelRequest — 1 templates, 2 for-each
# Dependency Graph: 5 edges — 2 resolved, 0 unresolved
# Global Graph: 18 nodes, 12 edges, density 0.04
```

Output `canonical.json` contiene `registry, wsdls, xsds, composites, bpels, bpmns, xslts, lineage{edges}, graph{edges,stats}, global_graph{nodes,edges}, version 0.7` + `technical.md`/`functional.md` generati accanto.

### 4. Trace — V1.2 (§22)

```bash
python soa-reverse-engineer/cli/main.py trace /path/to/project --from "ActivityA"
python soa-reverse-engineer/cli/main.py trace /path/to/project --from "LoanService_ep" --to "CreditDbAdapter" --max-depth 10
# Path 1: ActivityA -> operation -> WSDL -> SCA Reference -> BPEL -> Adapter -> Database
```

### 5. Impact — V1.2 (§23)

```bash
python soa-reverse-engineer/cli/main.py impact /path/to/project "schema.xsd"
python soa-reverse-engineer/cli/main.py impact ./helios-loan "LoanSchema.xsd"
# → WSDL che lo importa → Service → BPEL → BPMN
# Se modifico questo XSD, quali processi si rompono?
```

### 6. Explain — V1.3 (§24-25)

```bash
python soa-reverse-engineer/cli/main.py explain /path/to/project --process "LoanApprovalService"
# ## What this process does — LoanApprovalService
# The process starts when ...
# 1. Assess Credit Risk (userTask)
# Evidence: 5 relations tracked. LLM layer non abilitato — deterministico.
```

LLM solo layer finale, mai source of truth (`documentation/explain.py:1`).

### 7. Serve — Platform + Frontend

```bash
python soa-reverse-engineer/cli/main.py serve --port 8001
# http://127.0.0.1:8001 → serve dist/ (Vite build) + /api/health + /api/analyze
```

---

## Architettura (§26)

```
soa-reverse-engineer/
├── cli/main.py            # scan, analyze, trace, impact, explain, detect, serve
├── ingestion/             # scanner.py, artifact_detector.py, registry.py (§3)
├── parsers/               # bpmn/, bpel/, sca/, wsdl/, xsd/, xslt/, jca/, mediator/, config/ (§2)
├── model/                 # artifacts.py, canonical.py, services.py, schemas.py, transformations.py, endpoints.py, relationships.py (§6)
├── resolution/            # qname, namespace, reference, dependency, confidence (§5, §11)
├── graph/                 # graph_builder (MultiDiGraph §9), traversal, lineage (§17), impact (§23), types (§10)
├── analysis/              # process, dependency, data, error, coverage (§12, §21)
├── documentation/         # technical, functional (§13), trace, explain
├── evidence/              # provenance (§7-8), evidence_store (§11)
├── export/                # json, markdown, graphml, html
└── tests/
```

**Principi:** Provenance `artifact,xpath,line`, Evidence `explicit|resolved|inferred|heuristic|unknown|ambiguous` + `confidence`, Canonical `id,type,name,source_artifact`, NON legare al BPMN (§2), LLM solo finale (§25).

---

## Roadmap

- V0.1 BPMN structural ✅
- V0.2 Semantic enrichment ✅ (Tool 1.5)
- V0.3 Scanner + Registry ✅
- V0.4 WSDL+XSD ✅
- V0.5 SCA ✅
- V0.6 BPEL ✅
- V0.7 XSLT/lineage ✅
- V0.8 Global Graph ✅
- V0.9 Evidence ✅
- V1.0 Engine ✅
- V1.1 Docs ✅
- V1.2 Trace/Impact ✅
- V1.3 LLM explain ✅

---

## Test

```bash
# BPMN Tool
cd bpmn-reverse-engineer && pytest -v

# Platform
python soa-reverse-engineer/cli/main.py scan bpmn-reverse-engineer/examples
python soa-reverse-engineer/cli/main.py analyze /tmp/helios_full --output /tmp/out.json
python -m pytest soa-reverse-engineer/tests -v  # quando aggiunti

# Frontend
npx tsc --noEmit --skipLibCheck && npm run build
```

Sample agnostico: `src/data/sampleEcosystem.ts` — Helios Financial (dati fittizi).

## Integrazione con BPMN Tool

`bpmn-reverse-engineer` resta adapter BPMN per la Platform. La Platform riusa `bpmn_reverse_engineer/parser` + `analyzers` per BPMN e aggiunge gli altri adapter. Output BPMN `schema 1.5` è già parte del Canonical Model (`cross_artifact` placeholder).
