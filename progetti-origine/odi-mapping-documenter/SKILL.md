---
name: odi-mapping-documenter
description: Genera documentazione tecnica e business per mapping Oracle Data Integrator (ODI) 12c a partire da file XML di esportazione. Usa questa skill ogni volta che l'utente fornisce un file XML di ODI e chiede documentazione, analisi o spiegazione di un mapping, flusso ETL, o trasformazione dati. Si applica anche quando si menzionano mapping ODI, scenari, knowledge module, o si vuole comprendere il flusso dati tra sorgenti e target.
---

# ODI Mapping Documenter

Skill per generare documentazione completa di mapping ODI 12c a partire dai file XML di esportazione.

## Quando usare questa skill

- L'utente fornisce un file XML esportato da ODI 12c (SunopsisExport)
- L'utente chiede documentazione di un mapping ODI
- L'utente vuole analizzare flussi ETL, trasformazioni, join, filtri
- L'utente chiede spiegazioni su scenari, KM, o dipendenze

## Cosa produce

Due documenti Markdown complementari:

1. **Documentazione Tecnica** (`*_TECNICO.md`) — per sviluppatori ODI e DBA:
   - Informazioni generali del mapping
   - Contesti e logical schema coinvolti
   - Flusso dati (sorgenti, target, lookup)
   - Condizioni di JOIN con dettagli sugli input
   - Filtri applicati
   - Aggregazioni (GROUP BY e funzioni)
   - Espressioni personalizzate
   - Mappatura completa attributi target con espressioni sorgente
   - Knowledge Modules utilizzati
   - Execution Units
   - Scenari con step e task
   - SQL generato dai task
   - Dipendenze (tabelle, colonne, modelli, chiavi)

2. **Documentazione Business** (`*_BUSINESS.md`) — per analisti e business user:
   - Descrizione narrativa del flusso
   - Regole di business in linguaggio naturale
   - Relazioni tra entità
   - Filtri e condizioni in termini comprensibili
   - Calcoli personalizzati spiegati
   - Descrizione del risultato finale campo per campo

## Come usare

### Passo 1: Identificare il file XML

L'XML deve essere un file di esportazione ODI 12c con root `<SunopsisExport>`. Controlla che contenga oggetti `SnpMapping`.

### Passo 2: Eseguire il parser

```bash
python scripts/parse_odi_xml.py <file.xml> --output-dir <output_dir> --format both