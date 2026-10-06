# Master CSV Generator - Test e Qualità

## Panoramica

Il sottoprogetto `master-csv` al momento non dispone di una suite di test automatici dedicata. Gli script sono verificabili tramite **casi d'uso manuali** e **controlli di sanity**. Questa pagina raccoglie le procedure di verifica consigliate, gli scenari limite noti e i controlli di qualità applicabili.

---

## Ambiente di test

Per qualunque test è necessaria una directory contenente file JSON della forma:

```json
{
  "MAPPING_1": {
    "sources": ["STG.TABLE_A", "STG.TABLE_B"],
    "targets": ["DWH.TABLE_C"]
  }
}
```

È possibile riutilizzare gli output JSON già generati dal progetto principale oppure creare file ad hoc.

---

## Casi di test suggeriti

### 1. Directory con file JSON validi

**Input:** cartella con almeno un file JSON del formato atteso.

**Output attesi (`run.py`):**
- Stampa del numero di file JSON trovati.
- Una riga per ogni sorgente (`input`) e per ogni target (`output`).
- Creazione di `output/<timestamp>/master_csv_input_output.csv`.
- Riepilogo finale con conteggio righe, progetti e mapping.

**Verifiche (`verifica.py`):**
- Generazione di `verifica_mapping.txt` con conteggi coerenti al contenuto dei JSON.

### 2. JSON non valido

- Creare un file con contenuto non JSON (es. testo libero).
- **Atteso:** l'esecuzione segnala `[Errore] JSON non valido: ...` ma **prosegue** con gli altri file.

### 3. File JSON che non è un dizionario

- Utilizzare un JSON contenente una lista o uno scalare (es. `[1,2,3]`).
- **Atteso:** messaggio `[Ignorato] Il file JSON non e' un dizionario valido` e continuazione del batch.

### 4. Elementi non stringa / senza punto

- Inserire in `sources` valori come `42` o `"SENZA_PUNTO"`.
- **Atteso:** nessuna riga generata per questi elementi.

### 5. Directory senza file JSON

- **Atteso:** warning `[Attenzione] Nessun file JSON trovato` ed exit code `0`.

### 6. Percorso non valido

- Passare un percorso che non esiste o un file (non una directory).
- **Atteso:** `[Errore] '...' non e' una directory valida` ed exit code `1`.

### 7. Argomento mancante

- Lanciare `python run.py` senza argomenti.
- **Atteso:** stampa del usage ed exit code `1`.

---

## Controlli di qualità

### Invarianza dell'encoding

Il CSV deve essere generato in **UTF-8 con BOM** per un'apertura corretta in Excel. Verificare che intestazioni e righe non contengano caratteri corrotti.

### Integrità dei dati

- Il numero di righe nel CSV deve corrispondere alla somma degli elementi (sorgenti + target) validi in tutti i JSON.
- I campi `schema` e `table` devono essere coerenti con la separazione sul primo punto.
- Il campo `progetto` deve corrispondere al nome della cartella di ciascun file.

### Coerenza tra `run.py` e `verifica.py`

Eseguite sulla stessa directory, l'elenco delle tabelle in `master_csv_input_output.csv` e i conteggi in `verifica_mapping.txt` devono produrre numeri allineati.

---

## Limiti noti

- **Una riga per elemento**: viene generata una riga per ogni sorgente/target; la dimensione del CSV cresce linearmente con il numero di tabelle.
- **Deduzione progetto dal solo nome della cartella**: file JSON posti alla radice o in cartelle senza nome significativo produrranno progetti con nomi generici.
- **Errori isolati non bloccanti**: un JSON non valido viene segnalato e saltato, senza possibilità di correzione automatica.
- **Nessun test automatico**: la verifica si basa su procedure manuali; è suggerita l'aggiunta di una suite di unit test per `extract_rows` ed `extract_counts`.

---

## Suggerimenti per la copertura automatica futura

Unit test consigliati:

- `extract_rows` con combinazioni di stringhe valide, senza punto e non stringhe.
- `generate_csv` per validare intestazione, encoding BOM e contenuto.
- `extract_counts` per verificare il conteggio di schemi/tabelle (source vs target).
- Gestione del timestamp (unicità della cartella output).

---

## Conclusione

Nonostante l'assenza di test automatici, la semplicità e la struttura imperativa degli script rendono la verifica manuale (casi 1-7) semplice e ripetibile. Per l'integrazione in CI si consiglia di aggiungere gli unit test elencati sopra.