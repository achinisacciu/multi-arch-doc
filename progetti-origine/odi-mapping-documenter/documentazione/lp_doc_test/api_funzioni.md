# ODI Load Plan Documenter - API e Funzioni

## Panoramica Moduli

Il sottoprogetto è composto da **tre file sorgente** con responsabilità separate: entry point CLI (`run.py`), parsing XML (`lp_parser.py`) e generazione Markdown (`doc_builder.py`).

---

## `lp_parser.py` - Parser XML

### Funzioni di modulo

#### `_parse_xml_objects(xml_path: str)`
Genera coppie `(class_name, obj_element)` per tutti gli elementi `<Object>` di un file XML di esportazione.

- Usa `lxml.etree` con parser `recover=True` e `huge_tree=True`.
- `class_name` è l'ultimo segmento dell'attributo `class` (es. `SnpLoadPlan`).

#### `_get_field(obj, field_name, default=None)`
Recupera il testo di un campo `<Field>` dato il nome.

- Rileva i valori `null`/vuoti e restituisce `default`.
- Ritorna il testo ripulito da spazi.

### Classe `OdiLoadPlanParser`

#### Costruttore `__init__(xml_path, scenario_paths=None)`

- **Parametri:**
  - `xml_path: str` — percorso del file XML del Load Plan.
  - `scenario_paths: list[str] | None` — percorsi dei file XML di scenario.
- Inizializza i dizionari dati e invoca la pipeline: `_parse_loadplan_file()` → (eventuali) `_parse_scenario_file()` → `_build_step_tree()` → `_link_scenarios_to_steps()`.

### Parsing del Load Plan

| Metodo | Tipo oggetto | Chiave | Campi principali |
|--------|--------------|--------|------------------|
| `_parse_load_plan` | `SnpLoadPlan` | `ILoadPlan` | Nome, ID, GlobalId, date/utenti, flag di log, KeepLog, TaskLogLevel |
| `_parse_plan_agent` | `SnpPlanAgent` | `IPlanAgent` | Nome agente, contesto, scenario, scheduling, job type, repeat, date |
| `_parse_lp_step` | `SnpLpStep` | `ILpStep` | Nome/tipo step, ordine, parent, contesto, errore, restart, variabili inline, priorità, timeout |
| `_parse_lp_var` | `SnpLpVar` | `ILpVar` | Nome, tipo, default value |
| `_parse_lp_step_var` | `SnpLpStepVar` | `ILpStepVar` | Riferimento a `ILpStep`, nome/valore/operatore variabile |
| `_parse_fk_ref` | `SnpFKXRef` | - (append) | `RefKey`, `RefObjGlobalId`, `RefObjFQName`, `RefObjFQType` |

### Parsing degli scenari

| Metodo | Tipo oggetto | Chiave | Campi principali |
|--------|--------------|--------|------------------|
| `_parse_scen` | `SnpScen` | `ScenNo` | Nome/versione scenario, `IMapping`, date/utenti |
| `_parse_scen_step` | `SnpScenStep` | `(ScenNo, Nno)` | Nome/tipo step, tabella, `ResName`, `LschemaName`, `ModCode`, `GenInfo` (Knowledge Module) |
| `_parse_scen_task` | `SnpScenTask` | `(ScenNo, ScenTaskNo)` | Nomi task, `TaskType`, `DefTxt`/`ColTxt` (SQL), schemi/tecnologie, ordine |

### Post-processing

| Metodo | Descrizione |
|--------|-------------|
| `_build_step_tree()` | Collega ogni step ai suoi figli tramite `ParILpStep`; popola `_root_steps` (step senza padre), ordinati per `StepOrder`; aggancia le variabili di step |
| `_link_scenarios_to_steps()` | Per ogni step che referenzia uno scenario, aggancia `_scenario`, `_scen_steps` e `_scen_tasks`; ricorre sui figli con `_link_scenarios_to_steps_in_children()` |

### Proprietà e metodi esposti

- `root_steps` — proprietà che restituisce la lista degli step radice.
- `to_dict()` — serializza l'intero modello in un dizionario con chiavi: `load_plan`, `plan_agents`, `lp_steps`, `lp_vars`, `lp_step_vars`, `fk_refs`, `scenarios`, `_scen_steps`, `_scen_tasks` (liste ordinate).

---

## `doc_builder.py` - Generatore Markdown

### Costanti di etichettatura

- `STEP_TYPE_LABELS` — tipi step LP (`SE`, `S`, `F`, `W`, `SR`).
- `EXCEPT_BEHAVIOR_LABELS` — comportamento errori (`R`, `S`, `C`).
- `RESTART_TYPE_LABELS` — tipo restart (`SF`, `ST`, `S`).
- `TASK_TYPE_LABELS` — tipo task scenario (`L`, `J`, `C`, `E`, `I`).
- `SCEN_STEP_TYPE_LABELS` — tipo step scenario (`M`, `P`, `V`).

### Funzioni di supporto

| Funzione | Descrizione |
|----------|-------------|
| `_clean(val)` | Converte un valore in stringa; `None` → `""` |
| `_fmt_schedule(agent)` | Formatta la schedulazione dell'agente (Immediate, Hourly, Daily, Weekly, Monthly) |
| `_step_type_label(t)` | Traduce il codice del tipo step in etichetta |
| `_format_sql(text)` | Avvolge un testo SQL in un blocco ```sql``` |
| `_render_step_tree(steps, level=0)` | Render ricorsivo dell'albero step in Markdown |
| `_extract_xml_attr(chunk, attr)` | Estrazione (regex) di un attributo XML da un frammento |
| `_all_steps(steps)` | Lista appiattita di tutti gli step (ricorsione sui figli) |
| `_count_all_steps(steps)` | Numero totale di step |

### Funzione principale

#### `generate_markdown(data: Dict[str, Any], output_path: Path) -> str`

Genera e scrive il documento Markdown per un Load Plan.

- **Parametri:**
  - `data` — dizionario prodotto da `to_dict()`.
  - `output_path` — percorso del file di destinazione.
- **Ritorna:** il testo Markdown generato.

**Sezioni prodotte (in ordine):**
1. Titolo con nome Load Plan.
2. **Informazioni Generali** (tabella): nome, ID, GlobalId, date, utenti, log.
3. **Agenti di Esecuzione / Schedulazione** (una sezione per agente).
4. **Struttura del Load Plan** (albero indentato degli step, con contesto, errore, timeout, scenario, step scenario, task SQL, variabili).
5. **Variabili del Load Plan** (LP vars).
6. **Scenari Collegati** (per scenario: metadati, passaggi con Knowledge Module, task SQL).
7. **Footer statistico** (step radice, step LP, passaggi scenario, task SQL totali).

---

## `run.py` - Entry Point CLI

### Funzioni di supporto

| Funzione | Descrizione |
|----------|-------------|
| `_classify_xml(path) -> str` | Legge velocemente l'XML e restituisce `"lp"`, `"scenario"` o `"other"` in base alla classe del primo `<Object>` |

### Funzioni principali

#### `process_file(lp_xml, output_dir, scenario_files)`
Processa un singolo Load Plan.

1. Istanzia `OdiLoadPlanParser` con i path LP e scenario.
2. Chiama `to_dict()`, ricava il nome sicuro (`safe`) dal `load_plan_name`.
3. Genera `output_dir/<safe>_LOADPLAN.md` tramite `generate_markdown`.
4. Stampa riepilogo: scenari, task SQL, variabili LP, variabili step.

#### `process_folder(folder, output_dir)`
Processa una cartella intera.

1. Raccoglie tutti gli XML con `rglob("*.xml")`.
2. Classifica ogni file con `_classify_xml`.
3. Processa ogni LP con tutti i file scenario trovati.

#### `main()`
Gestisce gli argomenti CLI.

- Supporta la sintassi:
  ```
  python run.py <file.xml> [--scenarios scen1.xml ...]
  python run.py <cartella>
  ```
- In modalità file: elabora il file indicato più eventuali `--scenarios`.
- In modalità cartella: rileva automaticamente LP e scenari.
- L'output viene scritto in `output/` (accanto agli script).

---

## Dipendenze

- `lxml` (>= 5.0) — parsing XML (`lp_parser.py`, `run.py`).
- Standard library — `pathlib`, `sys`, `typing`.