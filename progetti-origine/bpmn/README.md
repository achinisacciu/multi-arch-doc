# Workspace BPMN / SOA

Raccolta di strumenti per analizzare, documentare e visualizzare processi BPMN e XML.
Nessun componente usa intelligenza artificiale: tutta l'analisi e la documentazione sono rule-based.

## Struttura

```
bpmn/
├─ bpmn-visualizer/      ★ Progetto principale: visualizzazione BPMN (bpmn-js), export
│                        SVG/PNG/PDF, documentazione, lineage e generazione diagrammi .drawio.
├─ xml-analyzer/         Analizzatore XML generalista (non legato a ODI). Per ogni file
│                        genera report.md + schema.json in output/<timestamp>_<nomeFile>/.
│                        La cartella di input è selezionabile a runtime.
├─ samples/              Dati di test (SOA_*, campione). Cartelle messe da parte, non cancellate.
├─ docs/                 Documentazione d'uso.
└─ archivio/             Varianti precedenti e fork (non usati, conservati per riferimento).
```

## Flusso dati

```
[ cartella scelta dall'utente ]
        │
        ▼
   xml-analyzer ──► output/<timestamp>_<nomeFile>/
        │              ├─ report.md
        │              └─ schema.json
        │
        ▼
   bpmn-visualizer ──► rendering bpmn-js / mermaid / .drawio / export
```

## Progetti

### bpmn-visualizer
- Viewer/editor BPMN via `bpmn-js`
- Documentazione automatica, analisi di complessità, lineage tra processi
- Export SVG, PNG, PDF, Markdown, JSON e diagrammi `.drawio`

```bash
cd bpmn-visualizer
npm install
npm run dev        # http://localhost:3000
```

### xml-analyzer
- Parser XML generalista con albero, statistiche, tabella campi e documentazione `.md`
- Persistenza su disco in `output/<timestamp>_<nomeFile>/{report.md, schema.json}`
- Accetta un file, un drag&drop o una intera cartella selezionata dall'utente

```bash
cd xml-analyzer
npm install
npm run dev
```

## Samples

I dati in `samples/` sono usati come input di prova:

- `samples/SOA_*/` — processi Oracle SOA/BPMN (ogni cartella contiene `default.bpmn` e `processes/*.bpmn`)
- `samples/campione/` — repository di test per il lineage (composite, BPEL, SQL)
