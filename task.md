# TASK — audit + test + implementazione (allineato a PIANO.md)

Legenda: `[ ]` da fare · `[/]` in corso · `[x]` fatto · priorità P0>P1>P2.
Convenzioni: cliente parametrico `--client` (default `clientone`); output in
`dossier-clienti/<client>/` (ignorato da git); prove citate `file:riga`;
dubbio = `NON confermato`. Skill attive: TDD (RED→GREEN→REFACTOR), ponytail
full (stdlib, minimo diff, `ponytail:` per scorciatoie), QA `.qa/`+`qa.config.json`.

---

## A. AUDIT (stato esistente + debito)

### A0. Baseline repo
- [x] A0.1 — Verifica `AGENT.md` senza nomi cliente (grep zero occorrenze). _Fatto 2026-09-17._
- [x] A0.2 — `git init` + commit iniziale + commit `f14d2ba` (F0+F1). _Fatto._
- [x] A0.3 — Ponytail-audit su `multirepo/*.py`: una riga per finding
      (`delete|stdlib|yagni|shrink`), chiudere con `net: -N lines possible`.
      File: `multirepo/collect.py`, `crosslink.py`, `report.py`.
- [x] A0.4 — Ponytail-debt ledger: rieseguire
      `Select-String -Path "multirepo\*.py" -Pattern "ponytail:"` e riportare
      qui i marker con ceiling/trigger (oggi: `collect.py:23` hash troncato,
      `collect.py:44` tech naive).

### A1. Audit riuso 4 progetti (verificare, non fidarsi)
- [x] A1.1 — JCA: `jcaParser.ts` API reali (`parseJcaContent`,
      `extractSqlTables`, `detectSqlType`), `ecosystemParser.ts`,
      `masterDocGenerator.ts`, worker, test faseA–I. _Fatto §1 PIANO._
- [x] A1.2 — ODI `src/{parser,doc_builder,flow_builder,csv_builder,main}.py`
      + `run.py` batch + `tools/inspect_odi_fields.py` + `.qa/` + `qa.config.json`.
      _Fatto._
- [x] A1.3 — `master-csv/run.py` (colonne progetto,mapping,schema,table,tipo,
      utf-8-sig) + `master-csv/verifica.py` (conteggi schemi/tabelle
      source+target). _Fatto 2026-09-17._
- [x] A1.4 — `lp_doc_test/{lp_parser,doc_builder,run}.py` (SnpLoadPlan/SnpScen,
      step tree, classificazione auto, `*_LOADPLAN.md`). _Fatto 2026-09-17._
- [x] A1.5 — Verifica `OdiMappingParser` su 1 XML reale anonimizzato:
      `to_dict()` ritorna `sources/targets` come `SCHEMA.TABELLA` (formato che
      `master-csv` si aspetta) oppure serve normalizzazione? Prova:
      `python odi/.../run.py <file> --format csv` su copia anonima.
      Accept: sì/no documentato in `PIANO.md §1`.
- [x] A1.6 — Verifica `OdiLoadPlanParser.to_dict()` su `lp_doc_test/LoadPlan/`:
      chiavi reali (`load_plan`, `scenarios`, `_scen_tasks`, `lp_vars`,
      `lp_step_vars`)? Confronta con assunzioni in `lp_doc_test/run.py:56-63`.
      Accept: elenco chiavi confermato o correzione.
- [x] A1.7 — SOA platform: `scan`+`analyze` su `fixtures/` — quanti dei 9 parser
      (`parsers/{bpmn,bpel,sca,wsdl,xsd,xslt,jca,mediator,config}`) si attivano
      su fixture Python? Accept: matrice parser×fixture (atteso: quasi zero —
      fixture non-SOA; documenta il gap).
- [x] A1.8 — `bpmn/xml-analyzer` su `fixtures/`: produce
      `report.md+schema.json`? Accept: sì/no + esempio output.

### A2. Audit qualità/copertura (QA skill §10 segnali)
- [x] A2.1 — File sorgente senza test: `multirepo/collect.py` coperto (T1.1),
      `crosslink.py`/`report.py` coperti da retrofit (T2.1/T2.2). Resta scoperto:
      logica `matrix_md` multi-arco, `redact()` in `report.py`, `git_info()`
      failure paths. Elencali qui con priorità.
- [x] A2.2 — Coverage: abilita `pytest-cov` se installato (`pip show pytest-cov`),
      altrimenti registra `ponytail: no-cov, upgrade: aggiungi pytest-cov se serve`.
      Threshold `qa.config.json`: 70, `fail_below: false` (non bloccare).
- [x] A2.3 — Lint Python (`max_line_length: 100`): `ruff` installato?
      `python -m ruff --version`. Se no, o installa o disabilita esplicitamente
      in `qa.config.json` (niente stati ambigui).
- [x] A2.4 — Leak-scan: `Select-String` pattern
      `(passwd|pwd|secret|api[_-]?key|token|u:[^@]+@)` su `multirepo/`,
      `fixtures/`, `dossier-clienti/clientone/CLIENT-REPORT.md`.
      Accept: 0 segreti reali (solo logica di redazione in `report.py:32-34`).
- [x] A2.5 — Verifica `.gitignore` copre `dossier-clienti/`, `__pycache__/`,
      `.qa/**/reports/`? (oggi: solo prime due — i report sono committati
      di proposito; conferma la scelta o ignora i report).

### A3. Audit segnali crosslink (correttezza, non solo presenza)
- [x] A3.1 — S3: `import_pattern()` perde `import repo_b` con alias
      (`import repo_b as rb`), `from . import x`, `require("./repo-b")`?
      Scrivi 5 casi limite e classifica: rilevato/perso/falso-positivo.
- [x] A3.2 — S6: `DB_RE` perde `jdbc:oracle:thin:@host:1521/db`,
      `DATABASE_URL=postgres://u:p@host/db`, `spring.datasource.url`?
      Elenca 5 formati reali attesi e gap.
- [x] A3.3 — S8: `config.properties` identici in repo-a/repo-b generano sia
      S6 che S8 sullo stesso file — doppio conteggio voluto o rumore?
      Decidi: unificare prove o tenere separati (oggi: separati, 4 archi).
- [x] A3.4 — S1: con `--ignore-git` le fixture sono pulite, ma su repo reali
      dentro un monorepo S1 esplode (N×N tutto connesso). Definisci regola:
      S1 vale solo se `top == cartella stessa`? Proponi e testa.
- [x] A3.5 — `matrix_md`/`report.py` con >3 archi per coppia: `<br/>` leggibile?
      Test con 4 archi repo-a→repo-b (oggi ok) + caso 6 archi sintetico.

---

## T. TEST (TDD: RED→GREEN→REFACTOR; retrofit per esistente)

### T1. Unit esistenti (verdi, non rompere)
- [x] T1.1 — `test_collect_inventory.py`: `per-cartella.json` con
      `rel_path`+`ext`, `.py` in exts, `sha256`, `tech` contiene `python`.
- [x] T2.1 — `test_crosslink_matrix.py` (retrofit): 4 archi attesi
      (import/db/file-identico repo-a→repo-b, compose repo-b→repo-a),
      repo-c isolata.
- [x] T2.2 — `test_report_outputs.py` (retrofit): `CLIENT-REPORT.md` con
      header cliente + sezione matrice; CSV con header `da,a,tipo,grado,prove`.

### T3. Unit TDD nuovi (uno per comportamento, test-first, niente mock)
- [x] T3.1 — RED: `collect` rileva file `.jca` con `tech=jca`:
      aggiungi `fixtures/repo-a/OrderDbAdapter.jca` minimo + test che
      `tech` contenga `jca`. Oggi: passa già per estensione? Verifica —
      se passa subito, il test è sbagliato (skill: test che passa = testa
      comportamento esistente). Riformula su contenuto (es. adapter name).
- [x] T3.2 — RED: `collect` classifica `SnpMapping` XML (ODI export) in
      `per-cartella.json` (es. campo `odi_exports: [{file, mappings}]`).
      Fixture: mini `SunopsisExport` con 1 `SnpMapping`. Oggi manca → RED vera.
- [x] T3.3 — RED: `collect` classifica LoadPlan vs Scenario
      (logica `_classify_xml` da `lp_doc_test/run.py`: `SnpLoadPlan` vs
      `SnpScen`) in `per-cartella.json` (`lp_files`, `scen_files`).
      Fixture: 2 mini XML. Oggi manca → RED.
- [x] T3.4 — RED: `crosslink` S9 orchestrazione condivisa: 2 cartelle con
      `*_LOADPLAN.md` che citano lo stesso scenario → arco
      `orchestrazione-condivisa 🔶`. Fixture sintetiche, oggi manca → RED.
- [x] T3.5 — RED: `report` redazione segreti: fixture con
      `db.password=SuperSegreta123` → `CLIENT-REPORT.md` NON contiene il valore
      (`***redatto***`), `crosslink.json` locale sì/no secondo decisione A3.
      Oggi `redact()` copre solo `.md` — estendi test a CSV.
- [x] T3.6 — RED: `report` master CSV: da `per-cartella.json` con
      `mapping_sources_targets` finti → `master_csv_input_output.csv` con
      colonne `progetto,mapping,schema,table,tipo` (logica `master-csv/run.py`).
- [x] T3.7 — RED: `report` verifica: da stessi dati → `verifica_mapping.txt`
      con conteggi (logica `master-csv/verifica.py`).
- [x] T3.8 — Anti-pattern gate (ogni nuovo test): nessuna assert su mock,
      nessun metodo test-only in produzione, mock completi o nessun mock.
      Checklist in coda a ogni test run.

### T4. Integration (fixture end-to-end, TDD)
- [x] T4.1 — Pipeline `collect → crosslink → report` su fixture `--ignore-git`
      per `clientone` + secondo cliente (`pippo`): assert output isolati
      (`dossier-clienti/<client>/` non si sovrappongono), matrice pippo = 0 archi
      su (repo-a, repo-c). (Parziale oggi via test singoli — manca il test e2e.)
- [x] T4.2 — Pipeline con fixture ODI mini (T3.2+T3.3): `per-cartella.json`
      → `master_csv` → `verifica` → `CLIENT-REPORT §6` popolata (non placeholder).
- [x] T4.3 — Idempotenza: due run consecutive stesso cliente → stessi archi
      (a meno di `created`), nessun duplicato in CSV. Assert diff stabile.
- [x] T4.4 — `--dry-run` non scrive nulla: run con `--dry-run`, assert
      nessun file nuovo in `dossier-clienti/`.

### T5. QA framework (skill `qa/skill.md` FASE 2–4)
- [x] T5.1 — Header test: ogni file in `.qa/unit/tests/` ha header
      `data · categoria · sorgente` (oggi ok su 3 file — verifica nuovi).
- [x] T5.2 — Naming: `test_<modulo>_<comportamento>.py`
      no dipendenze d'ordine (oggi ok — mantieni).
- [x] T5.3 — Report dopo ogni run in `.qa/unit/reports/YYYY-MM-DD_unit.md`
      + aggiorna `PIANO.md §7` stato (oggi: `2026-09-17_unit.md` fermo a 1 test —
      aggiorna a 3 passed).
- [x] T5.4 — Decidi e registra: `integration/` e `e2e/` dentro `.qa/` (skill)
      vs `tests/` flat (ponytail)? Una riga di decisione in `qa.config.json`
      o qui. P0 per evitare deriva struttura.

---

## I. IMPLEMENTAZIONE (minimo diff, stdlib-first, sottoprocessi a lista args)

### I1. F1 — Collect per-cartella (in corso)
- [x] I1.1 — Inventario stdlib: `files[{rel_path, ext, sha256}]`, `tech` naive,
      `db_refs{file,line,key}` → `per-cartella.json`. (`collect.py`)
- [x] I1.2 — Rilevamento ODI export: se file `.xml` contiene `<SunopsisExport`
      + `SnpMapping` → `odi_exports[{file, mappings}]` in `per-cartella.json`.
      Riuso: sniff come `lp_doc_test/run.py:_classify_xml` (lxml già dep ODI;
      fallback `xml.etree` stdlib se lxml assente → `skipped` onesto).
      Test: T3.2. `ponytail: sniff naive root+Object/class, upgrade: full OdiMappingParser se serve`.
- [x] I1.3 — Rilevamento LoadPlan/Scenari: `lp_files[]`, `scen_files[]`
      (classi `SnpLoadPlan` vs `SnpScen`). Test: T3.3.
- [x] I1.4 — Esecuzione tool reali dove presenti (mai shell, lista args,
      timeout per cartella): SOA `scan/analyze` → `canonical.json`;
      ODI `run.py --format all` su cartelle con export → output per-cartella;
      `lp_doc_test/run.py` su cartelle con LP → `*_LOADPLAN.md`.
      Assente = `skipped` con motivo in `collect.json` (pattern F0 `check_tools`).
- [x] I1.5 — Normalizzazione chiavi TS↔Python: `path`+`extension` (TS) →
      `rel_path`+`ext` (nostro) quando si importano `canonical.json`/ecosystem.
      Funzione `normalize_ts_entry()` + test.
- [x] I1.6 — Fixture ODI mini: `fixtures/repo-a/mapping_SunopsisExport.xml`
      (1 mapping, sources `SCHEMA.TAB_A`), `fixtures/repo-b/LoadPlan.xml`
      (`SnpLoadPlan`) + `Scenario.xml` (`SnpScen`). Dati finti, mai reali.

### I2. F2 — Crosslink S1–S9
- [x] I2.1 — S1/S3/S5/S6/S8 + `--ignore-git` + matrice multi-arco + print UTF-8.
- [x] I2.2 — S9 orchestrazione condivisa (da `lp_doc_test`): parse
      `*_LOADPLAN.md` o `to_dict()` per `scenario → loadplan`; se stesso
      scenario in ≥2 cartelle → arco 🔶. Test: T3.4.
- [x] I2.3 — S2 dipendenze condivise: `pom_details`/`package.json`/`requirements`
      (riuso `docgen.py` `pom_details` + SOA registry). Confronto
      `group:artifact` tra cartelle; versioni divergenti = rischio (non arco).
- [x] I2.4 — S4 chiamate rete: URL/host:porta in config/codice di A vs
      `server.port`/compose/`main` di B. Max 🔶 (porta in ascolto non verificata
      → dirlo nel report §10).
- [x] I2.5 — S7 entità condivise: stesse tabelle SQL (da `extractSqlTables` JCA /
      `mapping_sources_targets`) o stessi package Java in ≥2 cartelle → 🔍.
- [x] I2.6 — Regola S1 monorepo (da A3.4): implementa decisione + test
      (fixture dentro stesso repo → S1 ignorato di default? flag?).
- [x] I2.7 — Mermaid inter-cartella: da `crosslink.json` → blocco Mermaid
      (nodi cartelle, archi etichettati tipo+grado; sanitizza `[]{}"|`
      come `sanitizeMermaid` JCA). Test: rendering senza eccezioni + snapshot.

### I3. F3 — Report + master + verifica + loadplan docs
- [x] I3.1 — `CLIENT-REPORT.md` §§1–11 + `crosslink_rules.csv` (utf-8-sig). Base.
- [x] I3.2 — `master_csv_input_output.csv` per cliente da tutti i
      `mapping_sources_targets.json` per-cartella (port della logica
      `master-csv/run.py:extract_rows`; progetto = nome cartella). Test: T3.6.
- [x] I3.3 — `verifica_mapping.txt` per cliente (port `master-csv/verifica.py:
      generate_report`) → alimenta §6/§8. Test: T3.7.
- [x] I3.4 — Sezione §7 LoadPlan: per ogni `*_LOADPLAN.md` per-cartella,
      tabella (schedule, restart, exception behavior, n scenari/task SQL/
      variabili) + link ai file. Riuso etichette `doc_builder.py`
      (STEP/TASK_TYPE_LABELS).
- [x] I3.5 — `redact()` centrale: estendi a CSV + `mapping_sources_targets`
      pubblicati (pattern `inspect_odi_fields.py`: mai valori sensibili nei
      report; valori grezzi solo in JSON locale). Test: T3.5.
- [x] I3.6 — Glossario §9: seed da `BUSINESS.md` ODI
      da fixture) con formato termine→spiegazione. YAGNI oltre.

### I4. F4 — Viewer web (opzionale, solo se richiesto)
- [x] I4.1 — `server.py` stdlib (127.0.0.1:8091) + `frontend/index.html`:
  Sfoglia (browse server-side) + Analizza (POST /api/run → pipeline) +
  matrice; fallback comandi manuali + drop crosslink. `test_server` ×3.
      Se sì: riuso `bpmn-visualizer` (bpmn-js) + `platformApi.ts`, tab Cliente
      (lista cartelle via browse, run, matrice colorata, report render, ZIP).
- [x] I4.2 — Accept: `python server.py` → http://127.0.0.1:8091 →
  Sfoglia, Analizza, matrice. Smoke `test_frontend` + `test_server` verdi.
      (browse/add/run/matrix visibili). Porte: mai `:3001/:3002/:8000`.

### I5. F5 — Hardening + docs
- [x] I5.1 — `py_compile` su ogni `.py` toccato + `pytest` verde prima di ogni commit.
- [x] I5.2 — Aggiorna `PIANO.md §7` + `task.md` (spunta voci) a ogni fase chiusa.
- [x] I5.3 — `CLIENTS.md`: esempio terzo cliente + nota anonimia dati reali.
- [x] I5.4 — Pulizia: rimossi `.pytest_cache/.coverage/.ruff_cache`, `.gitignore` esteso.
      `git status` pulito a parte `dossier-clienti/` (ignorato).
- [ ] I5.5 — Run reale su copia anonima di 1 repo consentito: tempi nel ledger,
      0 segreti, 0 affermazioni senza prove (`grep NON confermata` atteso dove
      mancano evidenze).

---

## Decisioni registrate (T5.4, A2.5, T3.8 — 2026-09-17)
- T5.4: tutto pytest resta in `.qa/unit/tests/` (anche le guardie integration);
  niente `integration/`/`e2e/` separati finché non esiste un backend da testare.
- A2.5: `.qa/**/reports/*.md` committati di proposito (audit trail); ignorati
  solo `dossier-clienti/` e `__pycache__/`.
- T3.8 gate superato: zero mock, zero metodi test-only in produzione,
  nessun mock parziale (solo subprocess reali + import diretti).
- A1.7: SOA `analyze` ok su fixture (canonical + technical/functional);
  nota upstream: `DeprecationWarning datetime.utcnow` nel loro `cli/main.py:206`.
- A1.8: `xml-analyzer` verificato solo via docs (`dev/build/start/lint` in
  package.json) — esecuzione TS fuori scope F1–F3.

## Stato 2026-09-17 (notte fonda): 66/67. Resta solo I5.5 run reale,
trasformato in handoff: `TESTER.md` con runbook + template segnalazione —
il tester (tu) lancia su dati reali e riporta, mai contenuti riservati.
- A0.3 audit: Lean already. Ship. (considerati e tenuti: `run_tool` giustificato
  da timeout/encoding; costanti default duplicate per CLI standalone;
  matrice raggruppata duplicata in report per non accoppiare i CLI.)
- A0.4 ledger: 7 marker `ponytail:`, 0 senza trigger (tutti con upgrade path).
- T5.1: header `data·categoria·sorgente` su 21/21 file. T5.2: rinominato
  `test_pure_units.py` → `test_pure_helpers.py`.
- I2.6: S1 solo se top E' una cartella (normcase/normpath); `--ignore-git`
  ora solo override. I3.6: glossario da evidenze, cap 20, stato onesto.
- I4: yagni (CLI+md+CSV bastano). I5.4: cache rimosse + `.gitignore` esteso.

## Ordine suggerito (dipendenze) — stato 2026-09-17 (sera)
Fatti anche: I1.4 ledger (SOA scan ok, ODI csv ok su fixture sintetica,
JCA skipped onesto), I1.5 `normalize_ts_entry` (3 test), T4.2 §6 da master,
T3.1 sniff `.jca` (OrderDb/selectEmployees, repo-c resta isolata),
A2.2 coverage 9% in-process (atteso: test via subprocess; fail_below=false).
Lezioni: (1) mio edit "whitespace" aveva commentato 4 voci EXT_TECH —
mai edit cosmetici senza `pytest`; (2) `conftest.ROOT` off-by-one —
ora `conftest.run()` per tutti, 0 warning.
1. [x] A2.4 leak-scan (0 hit) + A2.3 lint (ruff check verde).
2. [x] T5.3 aggiorna report QA (12 passed).
3. [x] I1.2 → T3.2, I1.3 → T3.3 (rilevamento ODI/LP).
4. [x] I1.6 fixture ODI mini.
5. [x] I2.2 S9 + T3.4.
6. [x] I3.2+I3.3 master+verifica + T3.6/T3.7.
7. [x] A3.1–A3.5 audit segnali (2026-09-17): S3 fixato `[-_.]` equivalenti
   (probe 5/5 + `test_import_pattern` 5 test); S6 JDBC resta parziale noto
   (match debole su `dbhost`, upgrade = parser JDBC + redazione); S6+S8 doppio
   conteggio tenuto (segnali diversi, entrambi veri); S1 invariato
   (`--ignore-git` per fixture/monorepo); matrice `<br/>` ok fino a 6 archi.
   Resta I2.4/I2.5 (S4/S7).
8. [x] I3.4 §7 LoadPlan (tabella da per-cartella) + warning-zero via
   `conftest.run()` (erano 13 `PytestUnhandledThreadExceptionWarning` cp1252;
   causa: stdout UTF-8 decodificata con locale; fix: child PYTHONUTF8=1 +
   parent encoding utf-8 esplicito). A1.5: nomi mapping OK su 6 XML reali,
   ma `SourceTable` reale assente (serve `OdiMappingParser` — upgrade noto).
   A1.6: `SnpLoadPlan`+`LoadPlanName` OK sui 4 LP reali. S4 (8080) + S7
   (DWH.FACT_ORDERS) verdi in TDD.
9. [x] T4.1/T4.3/T4.4 integration (resta T4.2: §6 popolata da master — parziale).
10. [ ] I4 solo su richiesta; I5 a ogni chiusura fase.
