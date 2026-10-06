# ODI Load Plan Documenter - Test e Qualità

## Panoramica

Il sottoprogetto `lp_doc_test` non dispone di una suite di test automatici dedicata. La verifica avviene tramite **casi d'uso manuali** sui file XML di esempio contenuti in `LoadPlan/` e sui documenti Markdown generati. Questa pagina descrive procedure di verifica, scenari limite noti e controlli di qualità.

---

## Ambiente di test

- Python 3.10+ con `lxml` installato.
- I file XML di esempio in `lp_doc_test/LoadPlan/` sono sufficienti per la maggior parte dei test.
- Directory di output: `lp_doc_test/output/` (creata automaticamente).

---

## Casi di test suggeriti

### 1. File singolo (LP senza scenari)

```bash
python run.py "LoadPlan/LP_SimulazioneStart 2.xml"
```

**Atteso:**
- Generazione di `output/SimulazioneStart_LOADPLAN.md`.
- La sezione "Informazioni Generali" contiene i dati del Load Plan.
- Se lo step referenzia scenari ma nessun file scenario è passato, la sezione "Scenari Collegati" può risultare vuota o parziale.

### 2. File singolo con `--scenarios`

```bash
python run.py "LoadPlan/LP_SimulazioneStart 2.xml" --scenarios "LoadPlan/LP_SimulazionePCG_Start 2.xml"
```

**Atteso:**
- Gli scenari passati compaiono nella sezione "Scenari Collegati".
- Gli step collegati mostrano i passaggi scenario e i task SQL.

### 3. Cartella con rilevamento automatico

```bash
python run.py LoadPlan
```

**Atteso:**
- Classificazione automatica dei 4 file in `LoadPlan/`.
- Elaborazione di tutti i Load Plan trovati, producendo i corrispondenti `*_LOADPLAN.md`.

### 4. Cartella senza Load Plan

- Creare una cartella con un solo XML di scenario (o nessun XML).
- **Atteso:** messaggio `Nessun Load Plan trovato in <folder>` o `Nessun file XML trovato in <folder>`.

### 5. Percorso non valido

- Passare un percorso inesistente.
- **Atteso:** `Percorso non valido: <path>` ed exit `1`.

### 6. Nessun argomento

- Lanciare `python run.py`.
- **Atteso:** stampa dell'usage ed exit `1`.

### 7. File scenario inesistente

- Passare `--scenarios file_inesistente.xml`.
- **Atteso:** il file viene filtrato via `exists()`, senza errori; l'elaborazione prosegue.

---

## Controlli di qualità sul Markdown generato

### Coerenza della struttura

Il documento deve contenere (nell'ordine):
1. Titolo `# Load Plan: <nome>`.
2. Sezione `## Informazioni Generali`.
3. Sezione `## Agenti di Esecuzione / Schedulazione` (se presenti agenti).
4. Sezione `## Struttura del Load Plan` (se presenti step).
5. Sezione `## Variabili del Load Plan` (se presenti).
6. Sezione `## Scenari Collegati` (se presenti scenari).
7. Footer statistico.

### Verifica delle etichette

- I codici nei tipi step (`SE`, `S`, `F`, `W`, `SR`), nei comportamenti errori (`R`, `S`, `C`), nei task (`L`, `J`, `C`, `E`, `I`) e negli step scenario (`M`, `P`, `V`) devono essere tradotti in etichette human-readable.

### Verifica dell'albero step

- Gli step figli devono essere indentati sotto il padre.
- Gli step disabilitati devono essere marcati con `[DISABLED]`.
- Le variabili di step devono comparire con operatore (`=`, `+=`, `-=`).

### Verifica degli scenari

- Il collegamento step → scenario deve essere coerente con `ScenNo` / `ScenName` nei dati.
- I task SQL (`DefTxt` / `ColTxt`) devono apparire in blocchi ```sql```.

### Robustezza (dati mancanti)

- Un Load Plan senza `load_plan_name` non deve causare errori: il generatore usa lo stem del file come nome.
- Campi `None` non devono produrre eccezioni (gestiti da `_clean`).

---

## Limiti noti

- **`recover=True`**: XML malformati vengono riparati in modo best-effort; il risultato può perdere dati.
- **Scenario unico per step**: il collegamento si basa sul campo `ScenNo` dello step; scenari non referenziati da alcuno step appaiono comunque nella sezione "Scenari Collegati".
- **Estrazione Knowledge Module via regex**: `_extract_xml_attr` opera su frammenti `GenInfo`; variazioni di formato dell'XML possono produrre attributi vuoti.
- **Modalità cartella**: tutti gli scenari trovati vengono associati a *tutti* i Load Plan; eventuali scenari di un LP specifico non vengono isolati per LP.
- **Nessun test automatico**: la verifica è manuale; è consigliata l'aggiunta di unit test per parser e builder.

---

## Suggerimenti per la copertura automatica futura

- Unit test per `_parse_load_plan`, `_parse_plan_agent`, `_parse_lp_step` con fixture XML minime.
- Test di `_build_step_tree` su gerarchie annidate (padre/figlio).
- Test di `_link_scenarios_to_steps` con scenari multipli.
- Golden-file test di `generate_markdown` sui file di esempio in `LoadPlan/`.
- Test di `_classify_xml` per LP, scenario e file estraneo.

---

## Conclusione

Con i file XML di esempio presenti in `LoadPlan/` è possibile eseguire verifiche manuali rapide e ripetibili. L'integrazione di una suite di test automatici (fixture + golden files) aumenterebbe sensibilmente la robustezza del parser e del generatore.