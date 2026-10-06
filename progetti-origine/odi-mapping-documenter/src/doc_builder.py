#!/usr/bin/env python3
"""
ODI 12c Documentation Builder Module
Generates Markdown documentation from parsed mapping data.
"""

from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Any

def generate_technical_markdown(data: Dict[str, Any], output_path: Path) -> str:
    """Generate technical documentation in Markdown."""
    m = data.get('mapping', {})
    lines = []
    lines.append(f"# Documentazione Tecnica - Mapping: {m.get('name', 'N/A')}")
    lines.append("")
    
    # Informazioni Generali
    lines.append("## Informazioni Generali")
    lines.append("")
    lines.append("| Campo | Valore |")
    lines.append("|-------|--------|")
    lines.append(f"| **Nome Mapping** | {m.get('name', 'N/A')} |")
    if m.get('description'):
        lines.append(f"| **Descrizione** | {m.get('description')} |")
    lines.append(f"| **Folder ID** | `{m.get('i_folder', 'N/A')}` |")
    lines.append(f"| **Global ID** | `{m.get('global_id', 'N/A')}` |")
    lines.append(f"| **Creato il** | {m.get('first_date', 'N/A')} |")
    lines.append(f"| **Ultima modifica** | {m.get('last_date', 'N/A')} |")
    lines.append(f"| **Creato da** | {m.get('first_user', 'N/A')} |")
    lines.append(f"| **Ultimo utente** | {m.get('last_user', 'N/A')} |")
    lines.append("")

    # Topologia
    if data.get('contexts'):
        lines.append("## Contesti e Schemi")
        lines.append("")
        lines.append("**Contesti:**")
        for ctx in data['contexts']:
            lines.append(f"- `{ctx.get('qualified_name', 'N/A')}`")
        
    if data.get('logical_schemas'):
        lines.append("\n**Logical Schemas Coinvolti:**")
        for ls in data['logical_schemas']:
            lines.append(f"- `{ls.get('qualified_name', 'N/A')}`")
        lines.append("")

    lines.append("## Flusso Dati Principale")
    lines.append("")
    
    lines.append("### Sorgenti (Sources)")
    lines.append("")
    if data.get('sources'):
        for src in data['sources']:
            lines.append(f"- `{src}`")
    else:
        lines.append("_Nessuna sorgente diretta rilevata._")
    lines.append("")

    lines.append("### Target (Targets)")
    lines.append("")
    if data.get('targets'):
        for tgt in data['targets']:
            lines.append(f"- `{tgt}`")
    else:
        lines.append("_Nessun target diretto rilevato._")
    lines.append("")

    if data.get('lookups'):
        lines.append("### Tabelle di Lookup")
        lines.append("")
        for lk in data['lookups']:
            lines.append(f"- `{lk}`")
        lines.append("")

    # Componenti del Mapping
    lines.append("## Componenti del Mapping")
    lines.append("")
    lines.append("| ID | Nome Componente | Tipo | Alias | Datastore Associato |")
    lines.append("|----|-----------------|------|-------|---------------------|")
    for comp in data.get('components', []):
        ds_name = comp.get('datastore_name') or '-'
        alias = comp.get('alias') or '-'
        lines.append(f"| {comp.get('i_map_comp', 'N/A')} | **{comp.get('name', 'N/A')}** | {comp.get('type_name', 'N/A')} | {alias} | `{ds_name}` |")
    lines.append("")

    # Dettagli Trasformazioni
    lines.append("## Logica di Trasformazione")
    lines.append("")

    joins = data.get('join_conditions', [])
    if joins:
        lines.append("### Condizioni di JOIN")
        lines.append("")
        for join in joins:
            lines.append(f"#### {join.get('name', 'JOIN')}")
            if join.get('inputs'):
                lines.append("\n**Input:**")
                for inp in join['inputs']:
                    ds = inp.get('source_datastore') or inp.get('source_component')
                    lines.append(f"- `{inp.get('cp_name')}` ← `{ds}` (componente: `{inp.get('source_component')}`)")
            
            if join.get('conditions'):
                lines.append("\n**Condizioni:**")
                for cond in join['conditions']:
                    lines.append(f"- `{cond}`")
            lines.append("")

    filters = data.get('filter_conditions', [])
    if filters:
        lines.append("### Filtri (FILTER)")
        lines.append("")
        for filt in filters:
            lines.append(f"#### {filt.get('name', 'FILTER')}")
            for cond in filt.get('conditions', []):
                lines.append(f"- `{cond}`")
            lines.append("")

    aggs = data.get('aggregates', [])
    if aggs:
        lines.append("### Aggregazioni (AGGREGATE)")
        lines.append("")
        for agg in aggs:
            lines.append(f"#### {agg.get('name', 'AGGREGATE')}")
            if agg.get('group_by'):
                lines.append("\n**GROUP BY:**")
                lines.append("| Attributo | Espressione |")
                lines.append("|-----------|-------------|")
                for gb in agg['group_by']:
                    lines.append(f"| `{gb.get('attribute')}` | `{gb.get('expression')}` |")
            
            if agg.get('aggregations'):
                lines.append("\n**Funzioni di Aggregazione:**")
                lines.append("| Attributo Output | Espressione | Funzione |")
                lines.append("|------------------|-------------|----------|")
                for ag in agg['aggregations']:
                    lines.append(f"| `{ag.get('attribute')}` | `{ag.get('expression')}` | {ag.get('function', 'N/A')} |")
            lines.append("")

    exprs = data.get('expressions', [])
    if exprs:
        lines.append("### Espressioni Personalizzate (EXPRESSION)")
        lines.append("")
        for expr_comp in exprs:
            lines.append(f"#### {expr_comp.get('name', 'EXPRESSION')}")
            lines.append("| Attributo di Output | Espressione |")
            lines.append("|---------------------|-------------|")
            for e in expr_comp.get('expressions', []):
                lines.append(f"| `{e.get('attribute')}` | `{e.get('expression')}` |")
            lines.append("")

    # Mappatura Target
    tgt_attrs = data.get('target_attributes', [])
    if tgt_attrs:
        lines.append("## Mappatura Attributi Target")
        lines.append("")
        by_ds = defaultdict(list)
        for ta in tgt_attrs:
            by_ds[ta.get('datastore', 'Unknown')].append(ta)

        for ds_name, attrs in by_ds.items():
            lines.append(f"### Target: `{ds_name}`")
            lines.append("")
            lines.append("| Colonna Target | Espressione Sorgente | Tipo Dato | Obbligatorio |")
            lines.append("|----------------|---------------------|-----------|--------------|")
            for a in attrs:
                req = "✓ Sì" if a.get('is_required') else "No"
                dtype = f"{a.get('attr_type', 'N/A')}"
                if a.get('length'): dtype += f"({a.get('length')},{a.get('scale', 0)})"
                
                lines.append(f"| `{a.get('attribute')}` | `{a.get('source_expression', 'N/A')}` | {dtype} | {req} |")
            lines.append("")
    else:
        lines.append("## Mappatura Attributi Target")
        lines.append("\n_Nota: Gli attributi target non sono stati estratti esplicitamente. Fare riferimento alle Espressioni di output._\n")

    # Esecuzione
    kms = data.get('kms', [])
    if kms:
        lines.append("## Knowledge Modules (KM)")
        lines.append("")
        for km in kms:
            lines.append(f"- `{km.get('name')}`")
        lines.append("")

    eus = data.get('execution_units', [])
    if eus:
        lines.append("## Execution Units (Unità di Esecuzione)")
        lines.append("")
        lines.append("| Nome | Business Name | Gruppo | Logical Schema | KM Assegnato |")
        lines.append("|------|--------------|--------|----------------|--------------|")
        for eu in eus:
            lines.append(f"| `{eu.get('name')}` | {eu.get('business_name', '') or '-'} | {eu.get('group', '') or '-'} | `{eu.get('logical_schema', '') or '-'}` | `{eu.get('km', '') or '-'}` |")
        lines.append("")

    scenarios = data.get('scenarios', [])
    if scenarios:
        lines.append("## Scenari di Esecuzione")
        lines.append("")
        for scen in scenarios:
            lines.append(f"### Scenario: {scen.get('scen_name', 'N/A')} (v{scen.get('scen_version', 'N/A')})")
            lines.append("")
            lines.append(f"- **ID Scenario:** `{scen.get('scen_no')}`")
            lines.append(f"- **Ultima modifica:** {scen.get('last_date', 'N/A')} ({scen.get('last_user', 'N/A')})")
            lines.append("")

            for step in scen.get('steps', []):
                lines.append(f"#### Step: {step.get('step_name', 'N/A')}")
                lines.append(f"- **Tabella/Risorsa:** `{step.get('table_name', 'N/A')}`")
                lines.append(f"- **Logical Schema:** `{step.get('lschema_name', 'N/A')}`")
                
                if step.get('tasks'):
                    lines.append("\n| # | Nome Task | KM | Tipo |")
                    lines.append("|---|-----------|-----|------|")
                    for task in step['tasks']:
                        task_name = f"{task.get('task_name1', '')} / {task.get('task_name2', '')}"
                        lines.append(f"| {task.get('scen_task_no')} | {task_name} | `{task.get('task_name3', '')}` | {task.get('task_type', '')} |")
                lines.append("")

    # SQL Generato (con tag details per collassarlo)
    sql_stmts = data.get('generated_sql', [])
    if sql_stmts:
        lines.append("## Codice SQL Generato")
        lines.append("")
        lines.append("> Clicca su 'Details' per espandere il codice SQL generato da ODI.")
        lines.append("")
        
        for stmt in sql_stmts:
            lines.append(f"<details>")
            lines.append(f"<summary><b>Task {stmt.get('task_no')}</b> - {stmt.get('task_name1', '')} / {stmt.get('task_name2', '')}</summary>")
            lines.append("")
            lines.append(f"- **Logical Schema:** `{stmt.get('lschema', 'N/A')}`")
            lines.append(f"- **Tecnologia:** `{stmt.get('tech', 'N/A')}`")
            lines.append(f"- **Tipo Command:** {stmt.get('type')}")
            lines.append("")
            lines.append("```sql")
            lines.append(stmt.get('sql', ''))
            lines.append("```")
            lines.append("")
            lines.append("</details>")
            lines.append("")

    deps = data.get('dependencies', {})
    if any(deps.values()):
        lines.append("## Dipendenze Esterne")
        lines.append("")
        if deps.get('tables'):
            lines.append("### Tabelle Dipendenti")
            for t in deps['tables']:
                lines.append(f"- `{t}`")
            lines.append("")
        if deps.get('columns'):
            lines.append("### Colonne Dipendenti")
            for c in deps['columns']:
                lines.append(f"- `{c}`")
            lines.append("")

    content = "\n".join(lines)
    Path(output_path).write_text(content, encoding='utf-8')
    return content


def generate_business_markdown(data: Dict[str, Any], output_path: Path) -> str:
    """Generate business-friendly documentation in Markdown."""
    m = data.get('mapping', {})
    lines = []
    lines.append(f"# Documentazione Business - Mapping: {m.get('name', 'N/A')}")
    lines.append("")
    
    # Scopo e Panoramica
    lines.append("## Scopo del Processo")
    lines.append("")
    if m.get('description'):
        lines.append(f"{m.get('description')}")
        lines.append("")

    sources = data.get('sources', [])
    targets = data.get('targets', [])
    lookups = data.get('lookups', [])

    lines.append("Questo processo automatico (mapping) esegue le seguenti operazioni principali:")
    lines.append("")

    if sources:
        src_list = ", ".join([f"**{s.split('.')[-1]}**" for s in sources])
        lines.append(f"1. **Estrae i dati** dai seguenti sistemi/tabelle sorgente: {src_list}.")

    if lookups:
        lk_list = ", ".join([f"**{l.split('.')[-1]}**" for l in lookups])
        lines.append(f"2. **Verifica e arricchisce i dati** confrontandoli con tabelle di riferimento: {lk_list}.")

    transforms = []
    if data.get('join_conditions'):
        transforms.append("integrazione di dati provenienti da tabelle diverse (JOIN)")
    if data.get('filter_conditions'):
        transforms.append("selezione di solo una parte dei dati (Filtri)")
    if data.get('aggregates'):
        transforms.append("calcolo di totali e raggruppamenti (Aggregazioni)")
    if data.get('expressions'):
        transforms.append("applicazione di regole di calcolo personalizzate")

    if transforms:
        lines.append(f"3. **Trasforma i dati** mediante: {', '.join(transforms)}.")

    if targets:
        tgt_list = ", ".join([f"**{t.split('.')[-1]}**" for t in targets])
        lines.append(f"4. **Aggiorna la base dati** scrivendo il risultato finale in: {tgt_list}.")
    lines.append("")

    # Regole di Business
    lines.append("## Regole di Business Applicate")
    lines.append("")

    filters = data.get('filter_conditions', [])
    if filters:
        lines.append("### Criteri di Selezione (Filtri)")
        lines.append("")
        lines.append("Vengono elaborati esclusivamente i record che rispettano le seguenti condizioni:")
        lines.append("")
        for filt in filters:
            for cond in filt.get('conditions', []):
                # Try to humanize the filter
                desc = _humanize_condition(cond)
                lines.append(f"- {desc}")
        lines.append("")

    aggs = data.get('aggregates', [])
    if aggs:
        lines.append("### Logiche di Calcolo (Aggregazioni)")
        lines.append("")
        for agg in aggs:
            if agg.get('aggregations'):
                lines.append("I dati vengono raggrupati e su di essi vengono calcolati i seguenti totali:")
                lines.append("")
                for ag in agg['aggregations']:
                    func = ag.get('function', 'AUTO').upper()
                    attr = ag.get('attribute', 'risultato')
                    expr = ag.get('expression', '')
                    lines.append(f"- **{attr}**: Calcola la {func} di `{expr}`.")
                lines.append("")

    exprs = data.get('expressions', [])
    if exprs:
        lines.append("### Derivazione Campi Calcolati")
        lines.append("")
        lines.append("Vengono creati i seguenti nuovi campi applicando regole specifiche:")
        lines.append("")
        for expr_comp in exprs:
            for e in expr_comp.get('expressions', []):
                attr = e.get('attribute', '')
                expr = e.get('expression', '')
                desc = _business_description_dynamic(attr, expr)
                lines.append(f"- **{attr}**: {desc}")
        lines.append("")

    # Output
    tgt_attrs = data.get('target_attributes', [])
    if tgt_attrs:
        lines.append("## Struttura del Dato in Output")
        lines.append("")
        lines.append("Il risultato di questo processo viene memorizzato con la seguente struttura:")
        lines.append("")
        by_ds = defaultdict(list)
        for ta in tgt_attrs:
            by_ds[ta.get('datastore', 'Unknown')].append(ta)

        for ds_name, attrs in by_ds.items():
            lines.append(f"### Tabella di Destinazione: {ds_name.split('.')[-1]}")
            lines.append("")
            lines.append("| Campo | Significato / Origine |")
            lines.append("|-------|-----------------------|")
            for a in attrs:
                attr_name = a.get('attribute', '')
                expr = a.get('source_expression', '')
                desc = _business_description_dynamic(attr_name, expr)
                lines.append(f"| **{attr_name}** | {desc} |")
            lines.append("")
    else:
        # Fallback se non ci sono target_attributes ma ci sono expressions
        if exprs:
             lines.append("## Struttura del Dato in Output")
             lines.append("\nIl processo produce i seguenti campi risultanti:\n")
             for expr_comp in exprs:
                for e in expr_comp.get('expressions', []):
                    lines.append(f"- **{e.get('attribute', '')}**")

    # Esecuzione
    scenarios = data.get('scenarios', [])
    if scenarios:
        lines.append("## Modalità di Esecuzione")
        lines.append("")
        lines.append("Questo mapping è automatizzato e schedulato attraverso i seguenti scenari produttivi:")
        lines.append("")
        for scen in scenarios:
            lines.append(f"- **{scen.get('scen_name', 'N/A')}** (Versione {scen.get('scen_version', 'N/A')})")
        lines.append("")

    lines.append("---")
    lines.append("")
    lines.append("*Documento generato automaticamente dall'XML di Oracle Data Integrator (ODI) 12c*")
    lines.append(f"*Ultimo aggiornamento mapping: {m.get('last_date', 'N/A')}*")

    content = "\n".join(lines)
    Path(output_path).write_text(content, encoding='utf-8')
    return content


# --- FUNZIONI HELPER PER LA DOCUMENTAZIONE BUSINESS ---

def _humanize_condition(cond: str) -> str:
    """Cerca di rendere un filtro SQL più leggibile per il business."""
    cond = cond.replace("=", "è uguale a").replace("<>", "è diverso da")
    cond = cond.replace(">", "è maggiore di").replace("<", "è minore di")
    cond = cond.replace(">=", "è maggiore o uguale a").replace("<=", "è minore o uguale a")
    cond = cond.replace("IS NULL", "è vuoto").replace("IS NOT NULL", "non è vuoto")
    return f"`{cond}`"


def _business_description_dynamic(attr_name: str, expression: str) -> str:
    """Analizza il nome dell'attributo e l'espressione per generare una descrizione business generica."""
    if not expression:
        return "Campo di controllo interno."
        
    name_upper = attr_name.upper()
    expr_upper = expression.upper()

    # 1. Analisi basata sull'espressione
    if expr_upper.startswith("SUM(") or expr_upper.startswith("COUNT(") or expr_upper.startswith("AVG("):
        if "SUM" in expr_upper: return "Calcola il totale (somma) dei valori specificati."
        if "COUNT" in expr_upper: return "Conta il numero di occorrenze."
        if "AVG" in expr_upper: return "Calcola la media dei valori."
        
    if "CASE WHEN" in expr_upper:
        return "Valore derivato da una logica condizionale (se/allora)."
        
    # Se l'espressione è solo un passaggio diretto (es. COMPONENTE.NOME_CAMPO)
    if "." in expression and " " not in expression and "(" not in expression:
        parts = expression.split(".")
        src_table = parts[0].replace("ORACLE_", "").replace("_", " ").title()
        return f"Eredita il valore direttamente da: {expression}"

    # 2. Analisi basata sul nome attributo (Pattern matching generico)
    if name_upper.startswith("ID_") or name_upper.endswith("_ID") or name_upper == "ID":
        entity = name_upper.replace("ID_", "").replace("_ID", "").replace("_", " ").title()
        return f"Identificativo univoco della entità {entity}."
    elif "DESCR" in name_upper or "NAME" in name_upper or "NOME" in name_upper:
        return "Descrizione testuale o nome dell'elemento."
    elif "DATA" in name_upper or "DATE" in name_upper:
        if "ANNO" in name_upper or "YEAR" in name_upper:
            return "Anno di riferimento estratto da una data."
        return "Data di riferimento dell'evento."
    elif "IMPORTO" in name_upper or "TOTALE" in name_upper or "AMOUNT" in name_upper or "COSTO" in name_upper:
        return "Valore economico / importo monetario calcolato."
    elif "STATO" in name_upper or "STATUS" in name_upper:
        return "Codifica dello stato attuale dell'elemento."
    elif "FLAG" in name_upper:
        return "Indicatore booleano (Sì/No) derivato da una condizione."
    elif "PERCENT" in name_upper or "PCT" in name_upper or "RAPPORTO" in name_upper:
        return "Percentuale o rapporto tra due valori."

    # 3. Fallback
    return f"Valore derivato dall'espressione tecnica: `{expression}`"