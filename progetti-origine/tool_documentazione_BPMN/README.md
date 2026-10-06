# SOA Platform Studio — Unified Single-Entry

Piattaforma deterministica per **ricostruire processi, dipendenze, implementazioni, dati, trasformazioni ed endpoint** da un progetto SOA completo. **Un solo repo, un solo comando.**

> `npm run dev` avvia tutto: **Vite frontend :3000 (proxy /api) + Python backend :8000**. In prod: `npm run serve` serve `dist/` + API su **single-port :8000**.

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

## 🚀 Quick Start — Unificato (consigliato)

Prerequisiti: **Node 18+**, **Python 3.11+**

```bash
# 1. Installa tutto (una volta)
npm install
pip install -e ./bpmn-reverse-engineer   # deps: lxml, networkx, pydantic, rich, click

# 2. Dev — single entry (Vite + API)
npm run dev
# → frontend: http://127.0.0.1:3000
# → backend API: http://127.0.0.1:8000/api/health  (proxied via Vite /api)
# Log: [frontend] blue, [backend] green

# 3. Prod — single port
npm run serve
# → build + http://127.0.0.1:8000/ (SPA + API)

# 4. Build only
npm run build
```

### Script disponibili

| Script | Cosa fa | Porte |
|--------|---------|-------|
| `npm run dev` | Vite + Python backend (concurrently) | :3000 + :8000 |
| `npm run dev:frontend` | Solo Vite | :3000 |
| `npm run dev:backend` | Solo backend API | :8000 |
| `npm run build` | `vite build` → `dist/` | — |
| `npm run serve` | build + backend serve dist | :8000 single-port |
| `npm run typecheck` | `tsc --noEmit --skipLibCheck` | — |
| `npm run bpmn:serve:legacy` | Legacy BPMN-only server | :8001 |

Proxy: `vite.config.ts:22` fa `'/api' → http://127.0.0.1:8000`. Override con `VITE_API_BASE` in `.env`.

---

## Struttura repository

```
tool_documentazione_BPMN/
├── package.json                 # ★ UNICO entrypoint — scripts dev/build/serve
├── vite.config.ts               # proxy /api -> :8000, build chunks
├── src/                         # ★ UNICO frontend React (Oracle SOA & ADF Studio)
│   ├── App.tsx                  # single UI, 10 tab viewers, platformApi integration
│   ├── services/
│   │   ├── platformApi.ts       # ★ unified API client (relative + VITE_API_BASE)
│   │   ├── ecosystemParser.ts   # 9 parser locali (fallback drag&drop)
│   │   └── masterDocGenerator.ts
│   ├── components/              # 19 viewers (Registry, Graph, Trace, Impact, etc.)
│   └── data/sampleEcosystem.ts  # Helios Financial demo
├── soa-reverse-engineer/        # Platform V1.3 — core Python
│   ├── web/server.py            # ★ UNICO backend server (serve dist + API)
│   ├── cli/main.py              # scan, analyze, trace, impact, explain, serve
│   ├── ingestion/               # scanner, artifact_detector (4 livelli), registry
│   ├── parsers/                 # bpmn, bpel, sca, wsdl, xsd, xslt, jca...
│   ├── graph/                   # graph_builder (MultiDiGraph), lineage, traversal
│   └── documentation/           # technical, functional, explain
├── bpmn-reverse-engineer/       # Tool 1.5 — BPMN parser (ora adapter della Platform)
│   ├── src/bpmn_reverse_engineer/
│   │   ├── web/server.py        # LEGACY — deprecato, usa Unified server
│   │   └── parser/ analyzers/ exporters/
│   └── examples/
├── dist/                        # build output (generato da npm run build)
└── .env.example                 # VITE_API_BASE=""
```

**Prima:** 3 front-end separati (src/ :3000, bpmn web :8000 HTML, soa web :8000) con porte in conflitto e doppio `serve`.  
**Ora:** 1 front-end (`src/`), 1 backend (`soa/web/server.py`), 1 comando (`npm run dev`).

---

## Frontend — src/ (Vite + React 19)

- **Single UI:** `src/App.tsx:39` — 10 tab (Overview, Registry, Graph, Trace & Impact, Docs, Composites, Orchestration, JCA, Contracts, DevOps)
- **API client:** `src/services/platformApi.ts:1` — `DEFAULT_BASE` auto: `""` (relative → proxy in dev, same-origin in prod) o `VITE_API_BASE` override
- **Local parse fallback:** `ecosystemParser.ts` per drag&drop senza backend
- **Proxy:** `vite.config.ts` — `server.proxy['/api'].target = 127.0.0.1:8000`

Verifica:
```bash
npx tsc --noEmit --skipLibCheck
npm run build
```

---

## Platform — soa-reverse-engineer

### Scan
```bash
python soa-reverse-engineer/cli/main.py scan ./my-project --output registry.json
# 4 livelli: extension + namespace + root + fingerprint
```

### Analyze
```bash
python soa-reverse-engineer/cli/main.py analyze ./my-project -o canonical.json
# Parsa WSDL, XSD, SCA, BPEL, BPMN, XSLT → graph + global_graph + lineage + docs
```

### Trace / Impact / Explain
```bash
python soa-reverse-engineer/cli/main.py trace ./my-project --from "LoanService_ep" --to "CreditDbAdapter"
python soa-reverse-engineer/cli/main.py impact ./my-project "LoanSchema.xsd"
python soa-reverse-engineer/cli/main.py explain ./my-project --process "LoanApprovalService"
```

### Serve (unified)
```bash
# Dev: usato da npm run dev:backend
python soa-reverse-engineer/cli/main.py serve --port 8000

# Con progetto pre-caricato
python soa-reverse-engineer/cli/main.py serve ./my-project --port 8000
```

API unified su `:8000`: `/api/health`, `/api/scan`, `/api/analyze`, `/api/registry?job=`, `/api/graph`, `/api/lineage`, `/api/trace?from=&to=`, `/api/impact?artifact=`, `/api/canonical`, `/api/download/<job>`, `/api/docs/technical`

---

## BPMN Tool — bpmn-reverse-engineer (adapter)

Ora parte della Platform, mantenuto per compatibilità:
```bash
bpmn-reverse-engineer analyze path/to/process.bpmn -o ./analysis
bpmn-reverse-engineer analyze ./bpmn_folder --recursive -o ./analysis
npm run bpmn:serve:legacy   # solo se serve BPMN-only su :8001 (deprecato)
```

---

## Env

`.env.example`:
```
VITE_API_BASE=""  # default proxy. Override es: http://192.168.1.10:8000
```

In `src/services/platformApi.ts`:
- `VITE_API_BASE=""` → relative `/api` (Vite proxy in dev `:3000` → `:8000`, in prod same-origin `:8000`)
- Se imposti `VITE_API_BASE=http://...`, usa quello.

---

## Migrazione da setup precedente

1. **Non serve più** avviare `bpmn-reverse-engineer serve` + `python soa/... serve` separati.
2. **Un solo comando:** `npm run dev` (sostituisce `vite --port=3000` + `python ... serve :8000` manuali).
3. **Frontend hardcoded `http://127.0.0.1:8000`** rimosso — ora auto via proxy; override nascosto in "Avanzate".
4. **bpmn web server** deprecato (warning + porta legacy `:8001` se serve).
5. **Dist serving:** prima Vite e Python separati, ora `soa/web/server.py` serve `dist/` su `:8000` dopo `npm run build`.

---

## Test

```bash
# Frontend
npm run typecheck && npm run build

# BPMN
cd bpmn-reverse-engineer && pytest -v

# Platform
python soa-reverse-engineer/cli/main.py scan ./bpmn-reverse-engineer/examples
python soa-reverse-engineer/cli/main.py analyze ./bpmn-reverse-engineer/examples -o /tmp/canonical.json
```

---

## Principi (§7-§11, §25)

- **Provenance** `evidence/provenance.py` → `artifact,xpath,line,raw_xml`
- **Evidence** `evidence/evidence_store.py` → `explicit|resolved|inferred|heuristic|unknown|ambiguous` + `confidence`
- **Canonical Model** `model/canonical.py` — `id,type,name,source_artifact,relationships`
- **NON legare al BPMN** — ogni tecnologia è `ParserProtocol`
- **LLM solo finale** — mai source of truth
