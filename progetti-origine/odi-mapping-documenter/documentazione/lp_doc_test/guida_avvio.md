# ODI Load Plan Documenter - Guida di Avvio

Questa guida spiega come installare ed eseguire `lp_doc_test` per generare la documentazione Markdown dei Load Plan ODI.

---

## Prerequisiti

| Requisito | Minimo | Verifica |
|-----------|--------|----------|
| Python | 3.10 | `python --version` |
| `lxml` | >= 5.0 | `python -c "import lxml; print(lxml.__version__)"` |

---

## Installazione

1. Posizionarsi nella cartella del sottoprogetto:

```bash
cd lp_doc_test
```

2. Installare la dipendenza:

```bash
pip install lxml
```

3. Verificare che tutto sia pronto:

```bash
python -c "from lp_parser import OdiLoadPlanParser; from doc_builder import generate_markdown; print('OK')"
```

---

## Esecuzione

### Modalità 1 - File singolo

```bash
python run.py <file.xml>
```

Elabora il Load Plan indicato (senza scenari espliciti).

### Modalità 2 - File + scenari

```bash
python run.py <file.xml> --scenarios <scenario1.xml> <scenario2.xml> ...
```

Associa al Load Plan i file di scenario indicati.

### Modalità 3 - Cartella

```bash
python run.py <cartella>
```

Rileva automaticamente i Load Plan (`SnpLoadPlan`) e i file scenario (`SnpScen`) presenti in tutta la cartella (ricorsivo).

---

## Esempi con i file di esempio

Partendo da `lp_doc_test/`:

```bash
# 1. LP singolo senza scenari
python run.py "LoadPlan/LP_SimulazioneStart 2.xml"

# 2. LP con scenari espliciti
python run.py "LoadPlan/LP_SimulazioneStart 2.xml" --scenarios "LoadPlan/LP_SimulazionePCG_Start 2.xml"

# 3. Intera cartella con rilevamento automatico
python run.py LoadPlan
```

### Output atteso a console (modalità cartella)

```
Trovati 4 load plan, 3 file scenario

LP file: LP_SimulazioneStart 2.xml
  + Scenarios: ...
  OK -> SimulazioneStart_LOADPLAN.md
       (3 scenari, 5 task SQL, 2 variabili LP, 4 variabili step)
```

---

## Dove si trovano i risultati

```
lp_doc_test/
└── output/
    ├── SimulazionePCG_End_LOADPLAN.md
    ├── SimulazionePCG_Loop_LOADPLAN.md
    ├── SimulazionePCG_Start_LOADPLAN.md
    └── SimulazioneStart_LOADPLAN.md
```

I file Markdown si visualizzano direttamente su GitHub, VS Code, Obsidian o qualsiasi editor Markdown.

---

## Cosa contiene il documento generato

1. **Informazioni Generali** - nome, ID, GlobalId, date, utenti, parametri di log del Load Plan.
2. **Agenti di Esecuzione / Schedulazione** - agente, contesto, scenario, job type, schedulazione e repeat.
3. **Struttura del Load Plan** - albero gerarchico degli step (tipi, abilitazione, contesto, errori, timeout, variabili).
4. **Variabili del Load Plan** - variabili LP con tipo e default.
5. **Scenari Collegati** - per ogni scenario: passaggi con Knowledge Module e task SQL.
6. **Footer statistico** - step radice, step LP, passaggi scenario, task SQL totali.

---

## Risoluzione dei problemi

| Problema | Causa | Soluzione |
|----------|-------|-----------|
| `ModuleNotFoundError: No module named 'lxml'` | Dipendenza mancante | `pip install lxml` |
| `Percorso non valido: <path>` | Percorso errato | Verificare che il file/cartella esista |
| `Nessun Load Plan trovato in <folder>` | Nessun XML con `SnpLoadPlan` | Controllare la classificazione dei file |
| `Nessun file XML trovato in <folder>` | Cartella senza `.xml` | Puntare alla cartella giusta |
| Sezione "Scenari" vuota | Nessuno scenario passato o non referenziato | Usare `--scenarios` o la modalità cartella |

---

## Note finali

- La cartella `output/` è creata automaticamente accanto agli script.
- I file di input non vengono mai modificati (solo lettura).
- Se un documento sembra "vuoto" (es. `Load Plan: N/A`, `0 step radice`), verificare che il file XML contenga davvero oggetti `SnpLoadPlan` e che sia stato usato il percorso corretto.