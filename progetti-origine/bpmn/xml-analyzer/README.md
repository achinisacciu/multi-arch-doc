# XML Analyzer & Documenter

Analizzatore XML **generalista** (non legato a ODI), senza intelligenza artificiale.
Analizza qualunque documento XML, ne mostra struttura, statistiche e tabella dei campi,
e genera documentazione tecnica in Markdown.

Per ogni file analizzato il risultato viene **persistito su disco** in:

```
output/<timestamp>_<nomeFile>/
├─ report.md      ← documentazione tecnica generata
└─ schema.json    ← modello strutturale (nodes, stats) consumabile da altri tool
```

## Funzionalità

- Validazione sintassi XML in tempo reale
- Albero gerarchico visuale e collassabile
- Statistiche (elementi totali, profondità, tag più frequenti)
- Tabella dei campi con XPath, tipo di dato, ricorrenze, opzionalità e attributi
- Generazione documentazione `.md` (motore locale rule-based, nessuna AI)
- Persistenza output su disco + cronologia dei run precedenti
- Caricamento di un file singolo, drag & drop, oppure di **un'intera cartella**
  (vengono caricati tutti i file `.xml`, `.bpmn`, `.bpel` al suo interno)

## Avvio

```bash
npm install
npm run dev
```

Server: http://localhost:3000

## API

| Metodo | Percorso | Descrizione |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Stato del server |
| `POST` | `/api/output/save` | Salva `report.md` + `schema.json` in `output/<ts>_<file>/` |
| `GET` | `/api/outputs` | Elenca i run salvati |
| `GET` | `/api/output/:runName/:fileName` | Legge un file di un run salvato |

Body di `POST /api/output/save`:

```json
{
  "fileName": "esempio.xml",
  "reportMd": "# Markdown...",
  "schemaJson": { "fileName": "...", "stats": {}, "nodes": [] }
}
```

## Struttura del progetto

```
src/
├─ App.tsx                    UI principale
├─ engine/
│  └─ documenter.ts           generatore .md (rule-based, no AI)
├─ components/                pannelli UI
├─ utils/
│  └─ xmlParser.ts            parser e analisi XML
└─ types.ts                   tipi del modello di analisi
server.ts                     server Express + Vite, API di persistenza
```
