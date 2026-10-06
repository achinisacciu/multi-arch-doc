# Master CSV Generator - Guida di Avvio

Questa guida descrive come installare ed eseguire `master-csv`, sia per generare il CSV unificato sia per produrre il report statistico di verifica.

---

## Prerequisiti

| Requisito | Minimo | Verifica |
|-----------|--------|----------|
| Python | 3.10 | `python --version` |
| Sistema | Windows / Linux / macOS | - |

Non sono richieste installazioni aggiuntive (nessun `pip install`).

---

## Installazione

1. Posizionarsi nella cartella del sottoprogetto:

```bash
cd master-csv
```

2. Verificare che Python sia disponibile:

```bash
python --version
```

3. Nessun altro passo è necessario: gli script usano solo la standard library.

---

## Esecuzione di `run.py` (generazione CSV)

```bash
python run.py <directory_path>
```

### Esempi

```bash
# Scansiona tutta la cartella output del progetto principale
python run.py ../output

# Scansiona una singola cartella di progetto
python run.py ../output/Progetto_1

# Percorso assoluto
python run.py "C:\dati\output"
```

### Output atteso a console

```
Trovati 12 file JSON.

  [Progetto_1\mapping_1.json] -> progetto: Progetto_1
    Estratte 3 righe.
  [Progetto_1\mapping_2.json] -> progetto: Progetto_1
    Estratte 2 righe.
  ...

[OK] Generato CSV con 25 righe.
File salvato in: ...\master-csv\output\20260803_160249\master_csv_input_output.csv
Progetti: 2 | Mapping: 12
```

### Dove si trova l'output

```
master-csv/
└── output/
    └── 20260803_160249/
        └── master_csv_input_output.csv
```

Il file si apre direttamente in Excel (encoding UTF-8 con BOM).

---

## Esecuzione di `verifica.py` (report statistico)

```bash
python verifica.py <directory_path>
```

### Esempio

```bash
python verifica.py ../output/Progetto
```

### Output atteso

```
Trovati 5 file JSON.

  [Progetto\mapping_1.json] -> progetto: Progetto
    Estratti 3 mapping.
  ...

==================================================
  VERIFICA MAPPING - REPORT STATISTICHE
==================================================

Progetti trovati: 1
Mapping totali:   3
...
```

Il report viene anche salvato in:

```
master-csv/output/<timestamp>/verifica_mapping.txt
```

---

## Guida rapida alla lettura del CSV

| Colonna | Significato |
|---------|-------------|
| `progetto` | Nome del progetto ODI, dal nome della cartella del JSON |
| `mapping` | Nome del mapping |
| `schema` | Schema della tabella |
| `table` | Nome della tabella |
| `tipo` | `input` (sorgente) oppure `output` (target) |

---

## Risoluzione dei problemi

| Problema | Causa | Soluzione |
|----------|-------|-----------|
| `Usage: python run.py <directory_path>` | Argomento mancante | Passare il percorso della directory |
| `[Errore] '...' non e' una directory valida.` | Percorso inesistente o file | Verificare il percorso |
| `[Attenzione] Nessun file JSON trovato` | Directory vuota o errata | Puntare alla cartella con i JSON |
| `[Errore] JSON non valido: ...` | File corrotto | Correggere o escludere il file |
| Output non si apre in Excel | Encoding errato | Usare l'ultima versione dello script (UTF-8 BOM) |

---

## Note finali

- Ogni esecuzione crea una nuova sottocartella timestampata in `output/`, quindi le versioni precedenti non vengono sovrascritte.
- Gli script non modificano i file di input: sono read-only rispetto alla directory sorgente.
- Per analisi successive (Power BI, dashboard) il CSV è pronto all'uso come sorgente dati tabellare.