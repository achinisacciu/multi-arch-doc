# ODI Load Plan Documenter - Configurazione

## Prerequisiti di Ambiente

| Requisito | Versione | Note |
|-----------|----------|------|
| **Python** | 3.10+ | Union type (`str \| None`) nei tipi |
| **`lxml`** | >= 5.0 | Libreria di parsing XML |

### Installazione delle dipendenze

```bash
pip install lxml
```

Le altre importazioni (`pathlib`, `sys`, `typing`) fanno parte della standard library.

---

## Input Atteso

### File XML di esportazione ODI

Il tool legge i file XML nel formato `SunopsisExport` generato da ODI. Il formato è basato su:

```xml
<SunopsisExport>
  <Object class="oracle.odi.domain...SnpLoadPlan">
    <Field name="LoadPlanName">...</Field>
    ...
  </Object>
</SunopsisExport>
```

La classificazione avviene tramite l'attributo `class` degli elementi `<Object>` (ultimo segmento):

| Valore atteso | Classificazione |
|---------------|-----------------|
| `SnpLoadPlan` | Load Plan |
| `SnpScen` | Scenario |

### Modalità di invocazione

| Modalità | Sintassi | Comportamento |
|----------|----------|---------------|
| **File singolo** | `python run.py <file.xml>` | Elabora il Load Plan indicato (senza scenari, a meno di `--scenarios`) |
| **File + scenari** | `python run.py <file.xml> --scenarios a.xml b.xml` | Elabora il Load Plan con gli scenari espliciti |
| **Cartella** | `python run.py <cartella>` | Rileva automaticamente LP (`SnpLoadPlan`) e scenari (`SnpScen`) |

### Regole di classificazione (`_classify_xml`)

- I file vengono ispezionati con `ET.parse(recover=True, huge_tree=True)`.
- Si considera la prima classe corrispondente tra `SnpLoadPlan` e `SnpScen` tra gli `<Object>`.
- In caso di eccezioni di parsing, il file è classificato come `other` e ignorato.

---

## Argomenti della riga di comando

```
python run.py <input> [--scenarios file.xml ...]
```

| Argomento | Obbligatorio | Descrizione |
|-----------|--------------|-------------|
| `<input>` | Sì | Percorso di un file XML o di una cartella |
| `--scenarios` | No | Lista di file XML di scenario (solo con input file) |

**Exit codes:**
- `1` — nessun argomento, nessun input valido o percorso non valido.
- `0` — completato (anche senza LP trovati, in modalità cartella).

---

## Output Generato

### Struttura

```
lp_doc_test/
└── output/
    └── <safe_name>_LOADPLAN.md
```

- `safe_name` deriva da `load_plan_name` dell'XML; i caratteri non alfanumerici (o non ` -_`) sono sostituiti con `_`.
- Se `load_plan_name` è vuoto, si usa lo stem del file.
- La cartella `output/` è creata automaticamente (si trova accanto agli script).

### Contenuto del documento

Il documento Markdown include:

1. **Informazioni Generali** — tabella con nome, ID, GlobalId, date di creazione/modifica, utenti, parametri di log.
2. **Agenti di Esecuzione / Schedulazione** — per ogni agente: contesto, scenario, stato, job type, log level, schedulazione (Immediate / Hourly / Daily / Weekly / Monthly), repeat, tolleranza errori.
3. **Struttura del Load Plan** — albero ricorsivo degli step con tipo, abilitazione, contesto, comportamento su errore, timeout, scenario collegato, step scenario (con Knowledge Module), task SQL, variabili di step.
4. **Variabili del Load Plan** — nome, tipo, default.
5. **Scenari Collegati** — metadati per scenario, passaggi (con `Target`, `Logical schema`, `Technology`, Knowledge Module) e task SQL.
6. **Footer statistico** — step radice, step LP totali, passaggi scenario, task SQL totali.

---

## Formati delle etichette

Il generatore converte i codici interni in etichette human-readable (vedi [index.md](index.md#etichette-utilizzate-dal-generatore)).

### Schedulazione agenti (`_fmt_schedule`)

| `SType` | Etichetta generata |
|---------|--------------------|
| `I` (o assente) | `Immediate / On-demand` |
| `H` | `Every hour at minute <m> ...` |
| `D` | `Daily at <h>:<m>` |
| `W` | `Weekly on day <d> at <h>:<m>` |
| `M` | `Monthly on day <d> at <h>:<m>` |
| altri | `Type <SType>` |

### Operatori variabili (`VarOp`)

| Codice | Simbolo |
|--------|---------|
| `S` | `=` |
| `A` | `+=` |
| `M` | `-=` |

---

## Comportamenti Particolari

| Caso | Comportamento |
|------|---------------|
| `load_plan_name` assente | Usa il nome file (stem) come fallback |
| XML non valido | `recover=True` ne limita il parsing; classificazione `other` |
| Nessun file XML in cartella | Messaggio `Nessun file XML trovato in <folder>` |
| Nessun Load Plan in cartella | Messaggio `Nessun Load Plan trovato in <folder>` |
| File `--scenarios` inesistente | Filtrato via `Path.exists()` (silenziosamente) |
| Percorso non file né cartella | `Percorso non valido: <path>` e exit `1` |

---

## Esempio di Esecuzione con File di Esempio

I file in `LoadPlan/` permettono di provare lo strumento senza export ODI reale:

```bash
# Elabora un singolo Load Plan con i suoi scenari
python run.py "LoadPlan/LP_SimulazioneStart 2.xml" --scenarios "LoadPlan/LP_SimulazionePCG_Start 2.xml"

# Processa l'intera cartella LoadPlan/ (rilevamento automatico)
python run.py LoadPlan
```

L'output sarà generato in `output/` con nome `SimulazioneStart_LOADPLAN.md` (o simile).