# Configurazione e Ambiente - ODI Mapping Documenter

Questo documento descrive la gestione dell'ambiente di esecuzione, i file di configurazione presenti nel progetto e i parametri disponibili.

---

## 1. File di Configurazione e Ambiente

| File | Tipo | Scopo |
|------|------|-------|
| `requirements.txt` | Dipendenze Python | Elenca le librerie necessarie per eseguire il tool |
| `README.md` | Documentazione | Guida utente con istruzioni di installazione e utilizzo |
| `SKILL.md` | Metadati AI | Descrizione del progetto per l'uso in assistenti AI/agenti |
| `qa/skill.md` | Metadati AI | Skill QA framework per agenti (scaffolding, esecuzione, report) |
| `qa/references/report-template.md` | Template QA | Template Markdown per report di qualità (unit, coverage, security, ecc.) |
| `qa/references/toolstack.md` | Riferimento QA | Stack di tool consigliato per categoria e linguaggio (pytest, ruff, bandit, ecc.) |
| `qa/references/writing-guide.md` | Guida QA | Pattern e regole per la scrittura dei test per categoria |
| `tests/__init__.py` | Markers Python | Segnaposto per rendere `tests/` un package Python (nessun test presente) |
| `src/__init__.py` | Markers Python | Segnaposto per rendere `src/` un package Python (file vuoto) |

### Nessun file `.env` o variabile d'ambiente richiesta

> **Importante:** il progetto **non richiede alcun file `.env`**, `settings.py`, `docker-compose.yml` o file di configurazione aggiuntivo. Tutta la configurazione avviene tramite **argomenti da riga di comando**. La dipendenza `python-dotenv` è presente in `requirements.txt` ma **non viene utilizzata** nel codice core attivo.

---

## 2. Variabili d'Ambiente

Il tool **non definisce né legge variabili d'ambiente**. L'intera configurazione avviene tramite argomenti CLI (vedi sezione 3).

| Nome variabile | Scopo | Obbligatoria | Default |
|----------------|-------|:------------:|---------|
| *(nessuna)* | Il progetto non utilizza variabili d'ambiente | - | - |

---

## 3. Parametri da Riga di Comando (CLI)

La configurazione principale avviene tramite gli argomenti passati allo script `run.py` (o direttamente a `src/main.py`).

### 3.1 Sintassi generale

```bash
python run.py <percorso_file_o_cartella> [--output-dir <dir>] [--format <formato>]
```

### 3.2 Tabella dei parametri

| Parametro | Posizione | Descrizione | Valori ammessi | Default |
|-----------|-----------|-------------|----------------|---------|
| `<percorso>` | Argomento posizionale | File XML singolo **oppure** cartella da processare ricorsivamente. Se omesso, usa la cartella `data/`. | Percorso file o directory | Cartella `data/` |
| `--output-dir` | Flag opzionale | Cartella radice di output. **Nota:** il tool aggiunge automaticamente una sottocartella con timestamp (`<output-dir>/<YYYYMMDD_HHMMSS>/`). | Percorso directory | `output/` |
| `--format` | Flag opzionale | Filtra i formati di output da generare. | `all`, `technical`, `business`, `flow`, `csv` | `all` |

### 3.3 Dettaglio del flag `--format`

| Valore | Output generati |
|--------|-----------------|
| `all` (default) | Tutti: tecnico + business + flusso + CSV |
| `technical` | Solo `<nome>_TECNICO.md` |
| `business` | Solo `<nome>_BUSINESS.md` |
| `flow` | Solo `<nome>_FLUSSO.md` |
| `csv` | Solo `<nome>_MAPPING_RULES.csv` |

### 3.4 Nota sul parser alternativo

`src/parse_odi_xml.py` può essere eseguito in autonomia con una sintassi leggermente diversa (solo formati `technical`/`business`/`both`, nessun batch):

```bash
python src/parse_odi_xml.py <file_xml> [--output-dir <dir>] [--format technical|business|both]
```

---

## 4. Struttura degli Output

L'output viene organizzato automaticamente in sottocartelle per tipo. La cartella di output è **timestampata** per evitare collisioni tra esecuzioni.

```
output/
└── 20260804_120000/                 # Timestamp della singola esecuzione
    ├── tecnico/                     # Documentazione tecnica
    │   ├── <mapping1>_TECNICO.md
    │   └── ...
    ├── business/                    # Documentazione business
    │   ├── <mapping1>_BUSINESS.md
    │   └── ...
    ├── flussi/                      # Diagrammi di flusso Mermaid
    │   ├── <mapping1>_FLUSSO.md
    │   └── ...
    ├── csv/                         # Regole di mapping in formato CSV
    │   ├── <mapping1>_MAPPING_RULES.csv
    │   └── ...
    ├── mapping_sources_targets.json # Riepilogo sorgenti/target di tutti i mapping
    └── <export>_INDEX.md            # Indice SmartExport (solo per export multi-mapping)
```

### Convenzioni sui nomi

| Regola | Dettaglio |
|--------|-----------|
| Nome derivato | Il nome dei file deriva dal nome del mapping ODI |
| Caratteri non alfanumerici | Sostituiti con `_` (funzione `safe_filename` in `src/main.py`) |
| Nomi duplicati | In caso di collisione viene aggiunto suffisso numerico (`_2`, `_3`, ...) |
| Default mapping | Se il nome è vuoto viene usato `mapping` |

---

## 5. Dipendenze e Requisiti

### 5.1 `requirements.txt`

| Pacchetto | Versione minima | Uso effettivo |
|-----------|-----------------|---------------|
| `lxml` | `>=5.0.0` | **Sì** - parser principale in `src/parser.py` e tool `tools/inspect_odi_fields.py` |
| `click` | `>=8.0.0` | **No** - presente nei requisiti ma `src/main.py` usa `sys.argv` |
| `pydantic` | `>=2.0.0` | **No** - presente nei requisiti ma non usato nel codice core |
| `python-dotenv` | `>=1.0.0` | **No** - presente nei requisiti ma nessuna variabile d'ambiente letta |

> **Suggerimento:** solo `lxml` è realmente necessario per il funzionamento. Le altre tre dipendenze possono essere rimosse per semplificare l'ambiente, oppure utilizzate in futuro.

### 5.2 Requisiti di sistema

| Requisito | Valore |
|-----------|--------|
| Python | `>= 3.10` (uso di `tuple[bool, dict]` e `set[str]` nel typing) |
| Sistema operativo | Windows / Linux / macOS (il tool usa solo `pathlib`, nessuna dipendenza OS-specifica) |
| Encoding | Supporta file XML in `utf-8` e `ISO-8859-1` (il parser `lxml` rispetta la dichiarazione XML) |
| Memoria | File XML molto grandi richiedono memoria proporzionale (il parser carica tutto in RAM per indici O(1)) |

---

## 6. Profili / Ambienti

Il tool **non distingue tra profili** (Sviluppo, Staging, Produzione) in quanto è uno strumento di documentazione *offline*: non si connette a database né a repository ODI, ma lavora esclusivamente su file XML di export.

L'unica "configurazione ambientale" rilevante riguarda la **struttura dei dati di input**, organizzati per progetto:

| Cartella `data/` | Progetto ODI | Contenuto |
|------------------|--------------|-----------|
| `data/prove/` | Test/sviluppo | File di prova e SmartExport di esempio |
| `data/PROGETTO_1/` | PROGETTO_1 | Mapping del dominio PROGETTO_1 |
| `data/PROGETTO_2/` | PROGETTO_2 | Mapping ETL Audit PROGETTO_2 |

---

## 7. Risoluzione Problemi di Configurazione

| Problema | Causa probabile | Soluzione |
|----------|-----------------|-----------|
| `Errore di importazione dei moduli` | `src/` non nel path | Eseguire sempre da root con `python run.py` |
| `lxml` non trovato | Dipendenze non installate | `pip install -r requirements.txt` |
| File XML non trovato | Percorso errato | Verificare il percorso assoluto/relativo dalla root |
| Encoding corrotto in output | Terminale non UTF-8 | Il tool riconfigura `stdout` su UTF-8 automaticamente |
| Output "vuoti" | SmartExport senza ownership affidabile | Il parser attiva il fallback globale (warning in console). Per documenti corretti, esportare un mapping per file |

---

*Documentazione generata automaticamente per ODI Mapping Documenter v1.0*