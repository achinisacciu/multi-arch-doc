# ODI Mapping Documenter

Generatore automatico di documentazione per **mapping Oracle Data Integrator (ODI) 12c** a partire da file XML di esportazione (`SunopsisExport`).

A partire da un singolo file XML di un mapping ODI, il progetto produce documentazione Markdown in tre formati complementari, un dump JSON dei dati grezzi e un file CSV tabellare delle regole di trasformazione, utile per sviluppatori, DBA, analisti e business user.

## Cosa fa

Il tool:

1. **Parsa** un file XML di export ODI 12c utilizzando `lxml` per garantire alte prestazioni e robustezza. Ricostruisce il flusso relazionale del mapping (Componenti, Connection Points, Attributi, Espressioni).
2. **Genera documentazione** e report a partire dai dati estratti.

### Output prodotti

Per ogni mapping vengono generati i seguenti file (il nome e derivato dal nome del mapping, con caratteri non alfanumerici sostituiti da `_`). I file sono organizzati in sottocartelle per tipo:

| File | Sottocartella | Formato | Destinatari | Contenuto |
|------|---------------|---------|-------------|-----------|
| `<nome>_TECNICO.md` | `tecnico/` | Technical | Sviluppatori / DBA | Flusso dati, JOIN, filtri, aggregazioni, espressioni, mappatura attributi target, Knowledge Modules, Execution Units, scenari, SQL generato, dipendenze. |
| `<nome>_BUSINESS.md` | `business/` | Business | Analisti / Business | Descrizione narrativa del flusso, regole di business, relazioni tra entita, calcoli spiegati in linguaggio naturale. |
| `<nome>_FLUSSO.md` | `flussi/` | Flow | Tutti | Diagramma di flusso (Mermaid.js) dei componenti. |
| `<nome>_MAPPING_RULES.csv` | `csv/` | CSV | Data Engineer / Audit | Una riga per ogni attributo o condizione mappata (espressioni, join, filtri, aggregazioni). Formato Excel-friendly (UTF-8 con BOM). |

## Struttura del progetto

```text
odi-mapping-documenter/
├── run.py                # Script di avvio rapido (entry point comodo)
├── requirements.txt      # Dipendenze Python (lxml, click, pydantic, ecc.)
├── README.md             # Questo file
├── SKILL.md              # Metadati/skill per uso in assistenti AI
├── data/                 # File XML di input (singoli file o cartelle intere)
├── output/               # Cartella di default per i documenti generati
├── src/                  # Sorgenti dell'applicazione
│   ├── __init__.py
│   ├── main.py           # Logica CLI e orchestrazione
│   ├── parser.py         # OdiMappingParser: parsing XML -> dict (lxml)
│   ├── parse_odi_xml.py  # Parser alternativo con xml.etree.ElementTree
│   ├── doc_builder.py    # Generazione Markdown tecnico e business
│   ├── flow_builder.py   # Generazione diagramma di flusso (Mermaid)
│   └── csv_builder.py    # Generazione file CSV delle regole di mapping
├── tools/                # Script di utilita e ispezione
│   └── inspect_odi_fields.py  # Ispezione campi SunopsisExport/SmartExport
├── qa/                   # Framework QA e riferimenti per test/audit
│   ├── skill.md
│   └── references/
└── tests/                # Cartella riservata a futuri unit test
```

## Prerequisiti

- Python 3.10+
- Le dipendenze elencate in `requirements.txt`:
  - `lxml`, `click`, `pydantic`, `python-dotenv`

## Installazione

Dalla root del progetto, esegui:

```bash
pip install -r requirements.txt
```

## Utilizzo

Il modo più semplice per lanciare il tool è utilizzare lo script `run.py` dalla root del progetto.

### Esecuzione di base
Se non specifichi un file XML, il tool processerà automaticamente la cartella `data/` (ricercando ricorsivamente tutti i file `.xml`):

```bash
python run.py
```

### Specificare il file XML di input

```bash
python run.py data/prove/MAP_Flow_Fact_Progetti.xml
```

### Modalita batch: processare una cartella intera

Puoi passare una cartella per processare ricorsivamente tutti i file XML contenuti:

```bash
python run.py data/prove/
python run.py data/RP_EQUITY_EDH/
```

### Specificare il formato di output

Puoi scegliere di generare solo alcuni formati tramite il flag `--format`. I valori possibili sono: `all` (default), `technical`, `business`, `flow`, `csv`.

```bash
# Genera solo il file CSV delle regole di mapping
python run.py data/prove/SmartExport.xml --format csv

# Genera solo la documentazione tecnica e il flusso
python run.py data/prove/ --format technical
```

### Specificare la cartella di output

Per default i file vengono generati in `output/<timestamp>/`. Puoi cambiare la cartella radice con `--output-dir`:

```bash
python run.py data/prove/ --output-dir my_output/
```


### Cartella di output
I file vengono generati in `output/<timestamp>/`, organizzati in sottocartelle per tipo:

```text
output/
└── 20260804_120000/
    ├── <nome>_INDEX.md              # Indice SmartExport (solo per file multi-mapping)
    ├── mapping_sources_targets.json # Riepilogo sorgenti/target
    ├── tecnico/                     # Documentazione tecnica
    │   └── <nome>_TECNICO.md
    ├── business/                    # Documentazione business
    │   └── <nome>_BUSINESS.md
    ├── flussi/                      # Diagrammi di flusso Mermaid
    │   └── <nome>_FLUSSO.md
    └── csv/                         # Regole di mapping in formato CSV
        └── <nome>_MAPPING_RULES.csv
```

Al termine dell'elaborazione viene generato un file riepilogativo JSON:

| File | Formato | Destinatari | Contenuto |
|------|---------|-------------|-----------|
| `mapping_sources_targets.json` | JSON | Interoperabilità | Riepilogo di tutti i mapping con l'elenco di sorgenti e target per ciascuno. |

Per file SmartExport contenenti piu mapping viene inoltre generato un indice riassuntivo `*_INDEX.md` con tabella di stato e link ai documenti generati.

## Flusso di funzionamento interno

```text
XML ODI ──▶ OdiMappingParser (src/parser.py)
                │  to_dict()
                ▼
            dict dei dati estratti
        ┌───────┼───────────────┐───────────────┐
        ▼       ▼               ▼               ▼
   doc_builder  flow_builder   csv_builder
   (TECNICO +   (FLUSSO)       (CSV)
    BUSINESS)
```

Il parser (basato su `lxml`) estrae componenti, connection point, attributi, espressioni, connessioni, scenari ed execution unit, e li ricompone in sorgenti, target, lookup, JOIN, filtri, aggregazioni ed espressioni personalizzate sfruttando indici in memoria per garantire tempi di esecuzione ottimali (O(1) lookup).

Per i file SmartExport contenenti piu mapping, il parser partiziona gli oggetti per mapping e genera un indice riassuntivo.

## Note

- L'XML in ingresso deve essere un export ODI 12c con root `<SunopsisExport>` e contenere oggetti `SnpMapping`.
- I diagrammi Mermaid nei file `_FLUSSO.md` sono visualizzabili su GitHub, VS Code (con estensione Mermaid) e Obsidian.
- Il file CSV viene generato con encoding `utf-8-sig` per assicurare la corretta lettura delle lettere accentate direttamente aprendo il file con Microsoft Excel.