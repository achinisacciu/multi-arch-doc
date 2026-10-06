# Master CSV Generator - Configurazione

## Prerequisiti di Ambiente

| Requisito | Versione | Note |
|-----------|----------|------|
| **Python** | 3.10+ | Usa il typing moderno e le union type (`str \| None`) |
| **Sistema** | Windows / Linux / macOS | Multipiattaforma |
| **Librerie** | `csv`, `json`, `sys`, `datetime`, `pathlib`, `collections`, `typing` | Solo standard library, nessuna installazione |

Non è richiesto nessun file di configurazione (`requirements.txt`, `.env`, `.ini`, `.yaml`) né variabili d'ambiente per l'esecuzione.

---

## Input Atteso

### Directory di input

Lo strumento accetta **una singola directory** come argomento CLI. Scansiona in modo ricorsivo l'intera sottostruttura alla ricerca di file `.json`.

### Formato JSON atteso

Viene atteso il formato prodotto dal progetto principale `ODI Mapping Documenter`: un dizionario a due livelli.

```json
{
  "nome_mapping": {
    "sources": ["SCHEMA_SRC.TABELLA_SRC", "..."],
    "targets": ["SCHEMA_TGT.TABELLA_TGT", "..."]
  }
}
```

**Regole di parsing:**
- Ogni elemento di `sources` / `targets` deve essere una **stringa contenente un punto** per essere considerato.
- Il `schema` equivale a tutto ciò che precede il primo punto; la `table` a ciò che lo segue.
- Elementi `non-stringa` o privi del punto vengono **ignorati** silenziosamente.

### Deduzione del progetto

Il campo `progetto` viene dedotto dal **nome della cartella padre** del file JSON, non da contenuti interni.

---

## Argomenti della riga di comando

### `run.py`

```
python run.py <directory_path>
```

| Argomento | Obbligatorio | Descrizione |
|-----------|--------------|-------------|
| `<directory_path>` | Sì | Directory da scansionare ricorsivamente |

**Exit codes:**
- `1` — argomento mancante o directory non valida.
- `0` — esecuzione completata (anche se non ci sono JSON o righe).

### `verifica.py`

```
python verifica.py <directory_path>
```

Argomento e gestione equivalenti a `run.py`; l'output è un report statistico testuale.

---

## Output Generato

### Struttura

```
output/
└── <timestamp: YYYYMMDD_HHMMSS>/
    ├── master_csv_input_output.csv     (da run.py)
    └── verifica_mapping.txt            (da verifica.py)
```

- Gli output sono scritti nella cartella `output/` **relativa alla cartella dello script** (non dell'input).
- Il timestamp (`YYYYMMDD_HHMMSS`) evita collisioni di nome tra esecuzioni.
- Nessuna sovrascrittura: ogni esecuzione crea una nuova sottocartella.

### Esempio di CSV (intestazione)

```
progetto,mapping,schema,table,tipo
Progetto_1,MAP_1,STG,ANAG_CUSTOMER,input
Progetto_1,MAP_2,DWH,ANAG_CUSTOMER,output
Progetto_1,MAP_2,STG,PERM_USER,output
```

Il file è scritto in **UTF-8 con BOM** (`utf-8-sig`) per una corretta apertura in Microsoft Excel.

---

## Comportamenti particolari

| Caso | Comportamento |
|------|---------------|
| Nessun file JSON | Stampa `[Attenzione] Nessun file JSON trovato` ed esce con codice `0` |
| JSON non valido | Catturato come `json.JSONDecodeError` e segnalato a console, il batch continua |
| File che non è un dizionario | Segnalato e saltato |
| Nessuna riga estratta | Termina senza produrre file CSV |

---

## Riepilogo tra Master CSV e Verifica

| Aspetto | `run.py` | `verifica.py` |
|---------|----------|---------------|
| **Output** | CSV unificato input/output | Report statistico testuale |
| **Contenuto** | `progetto, mapping, schema, table, tipo` | Conteggi per progetto e mapping |
| **File prodotto** | `master_csv_input_output.csv` | `verifica_mapping.txt` |
| **Uso tipico** | Analisi tabellare / Excel | Riepilogo numerico e QA |