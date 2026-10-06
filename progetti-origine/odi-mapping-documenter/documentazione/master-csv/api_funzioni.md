# Master CSV Generator - API e Funzioni

## Panoramica Moduli

Il progetto è composto da **due script** autonomi che condividono logica simile (scansione e parsing dei file JSON) ma producono output differenti.

---

## `run.py` - Master CSV Generator

### Funzioni di supporto

#### `find_json_files(root_dir: Path) -> List[Path]`
Individua tutti i percorsi dei file `.json` presenti in una directory.

- **Parametri:**
  - `root_dir: Path` — directory radice da cui cercare.
- **Ritorna:** `list[Path]` — file JSON trovati, ordinati per nome.
- **Nota:** usa `rglob("*.json")`, quindi include anche le sottocartelle.

#### `parse_json(file_path: Path) -> Dict[str, Any]`
Legge e decodifica un file JSON.

- **Parametri:**
  - `file_path: Path` — percorso del file da leggere.
- **Ritorna:** `dict` — contenuto JSON.
- **Eccezioni:** propaga `json.JSONDecodeError` se il file non è JSON valido.

#### `extract_rows(data: Dict[str, Any], project: str) -> List[Tuple[str, str, str, str, str]]`
Estrae le righe CSV da un mapping.

- **Parametri:**
  - `data: Dict` — struttura del mapping (chiavi `sources` / `targets`).
  - `project: str` — nome del progetto.
- **Ritorna:** lista di tuple a 5 elementi `(progetto, mapping, schema, table, tipo)`.
- **Logica:**
  - Itera su ogni coppia `mapping_name → mapping_data` del dizionario.
  - Per ogni elemento di tipo stringa in `sources` contenente un punto → genera una riga con `tipo="input"`.
  - Per ogni elemento di tipo stringa in `targets` contenente un punto → genera una riga con `tipo="output"`.
  - `schema` e `table` sono ricavati separando la stringa in corrispondenza del primo punto.

#### `generate_csv(rows: List[Tuple[str, str, str, str, str]], output_path: Path)`
Scrive le righe in un file CSV.

- **Parametri:**
  - `rows` — tuple estratti.
  - `output_path: Path` — percorso di destinazione.
- **Comportamento:** crea la cartella padre se mancante, scrive l'intestazione `progetto, mapping, schema, table, tipo` e le righe, con encoding **`utf-8-sig`** (BOM per Excel).

### Funzione principale

#### `main()`
Orchestra l'intero processo.

1. Riconfigura `stdout` in UTF-8 se necessario.
2. Verifica la presenza dell'argomento (percorso directory); se assente stampa l'usage ed esce.
3. Valida che il percorso sia una directory.
4. Scansiona i file JSON; se non ce ne sono, termina con un warning.
5. Per ogni file JSON: deduce il progetto dal nome della cartella padre, tenta di eseguire il parsing e cattura `json.JSONDecodeError` / eccezioni generiche senza interrompere il batch.
6. Se nessuna riga è stata estratta, termina.
7. Compone il nome di output con timestamp `YYYYMMDD_HHMMSS` e scrive `master_csv_input_output.csv` dentro `output/<timestamp>/`.
8. Stampa il riepilogo (righe generate, percorsi, numero progetti e mapping).

**Argomenti CLI:** `python run.py <directory_path>`

---

## `verifica.py` - Report Statistiche

### Funzioni di supporto

#### `find_json_files(root_dir: Path)`
Equivalente a quella di `run.py`: elenca i file `.json` ordinati.

#### `extract_counts(data: Dict[str, Any], project: str)`
Calcola i conteggi per mapping.

- **Ritorna:** `Dict[str, Dict[str, int]]` — per ogni mapping: `{"schemi", "tabelle", "source_tabelle", "target_tabelle"}`.
- **Logica:**
  - Raccoglie schemi e tabelle distinti da `sources` e `targets`.
  - `schemi` = schemi distinti.
  - `tabelle` = tabelle distinte (source + target).
  - `source_tabelle` = tabelle distinte in `sources`.
  - `target_tabelle` = tabelle distinte in `targets`.

#### `generate_report(all_data: Dict[str, Dict[str, Dict[str, int]]]) -> str`
Genera il testo del report statistico.

- **Ritorna:** `str` — report formattato con linee di separazione.
- **Contenuto:**
  - Header `VERIFICA MAPPING - REPORT STATISTICHE`.
  - Conteggio di progetti e mapping totali.
  - Sezione per ogni progetto con i conteggi di ciascun mapping.
  - Riepilogo finale con totali (progetti, mapping, tabelle source, tabelle target, schemi, tabelle).

### Funzione principale

#### `main()`
Orchestra il processo di verifica.

1. Valida il percorso directory di input.
2. Scansiona i file JSON e li raggruppa per progetto.
3. Accumula i conteggi per progetto.
4. Genera il report con `generate_report`.
5. Salva in `output/<timestamp>/verifica_mapping.txt` (creando le cartelle) e stampa il report a console.

**Argomenti CLI:** `output verifica.py <directory_path>`

---

## Strutture Dati Condivise

### Struttura dei file JSON di input

```json
{
  "NOME_MAPPING": {
    "sources": ["SCHEMA_SRC.TABELLA_SRC"],
    "targets": ["SCHEMA_TGT.TABELLA_TGT"]
  }
}
```

Ogni voce in `sources` / `targets` è una stringa `"SCHEMA.TABELLA"`. Gli elementi non stringa o privi del punto vengono ignorati.

### Tupla CSV

Tuple a 5 elementi `(progetto, mapping, schema, table, tipo)` con:

- `schema` = sottostringa prima del primo punto.
- `table` = sottostringa dopo il primo punto.
- `tipo` ∈ `{input, output}`.

---

## Note Sintetiche

- **Nessuna dipendenza esterna**: entrambi gli script usano solo la standard library.
- **Encoding** : file JSON letti in UTF-8; CSV scritto in UTF-8-SIG (BOM) per Excel.
- **Gestione errori**: di nuovi file non validi vengono segnalati e saltati.
- **Ordine deterministico**: i file e le righe sono elaborati in ordine alfabetico.