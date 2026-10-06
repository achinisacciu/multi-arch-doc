# API e Mappa Funzioni - ODI Mapping Documenter

Questa documento è la **mappa analitica completa** del codice sorgente di produzione.
Per ogni file vengono elencate tutte le funzioni, classi e metodi con descrizione,
parametri di input e valore di ritorno.

> **Nota:** I file di test sono documentati separatamente in [`test_e_qualita.md`](test_e_qualita.md).

---

## Indice

- [1. `run.py`](#1-runpy---launcher-di-avvio)
- [2. `src/main.py`](#2-srcmainpy---entry-point-cli-e-orchestrazione)
- [3. `src/parser.py`](#3-srcparserpy---parser-principale-lxml)
- [4. `src/parse_odi_xml.py`](#4-srcparse_odi_xmlpy---parser-alternativo-stdlib)
- [5. `src/doc_builder.py`](#5-srcdoc_builderpy---generatori-markdown)
- [6. `src/flow_builder.py`](#6-srcflow_builderpy---generatore-diagrammi-mermaid)
- [7. `src/csv_builder.py`](#7-srccsv_builderpy---generatore-csv)
- [8. `tools/inspect_odi_fields.py`](#8-toolsinspect_odi_fieldspy---ispettore-campi-odi)

---

## 1. `run.py` - Launcher di avvio

**Percorso:** `run.py`
**Responsabilità:** Script di avvio rapido dalla root del progetto. Aggiunge la cartella `src/` al path di Python e delega l'esecuzione al modulo `src/main.py`. Gestisce il default sulla cartella `data/` se non vengono passati argomenti.

### Funzioni

| Funzione | Descrizione | Input | Ritorno |
|----------|-------------|-------|---------|
| `main()` | Entry point dello script. Aggiunge `src/` al `sys.path`, verifica gli argomenti (default: cartella `data/`), importa ed esegue `main()` da `src/main.py`. Gestisce gli errori di importazione/esecuzione con messaggi utente in italiano. | Nessuno (usa `sys.argv`) | `None` |

---

## 2. `src/main.py` - Entry point CLI e orchestrazione

**Percorso:** `src/main.py`
**Responsabilità:** Orchestrazione principale del tool. Gestisce parsing argomenti CLI, modalità singolo file / batch cartella, generazione output in sottocartelle timestampate e produzione dei file di riepilogo (`mapping_sources_targets.json`, `*_INDEX.md`).

### Funzioni

| Funzione | Descrizione | Input | Ritorno |
|----------|-------------|-------|---------|
| `safe_filename(name: str) -> str` | Crea un nome filesystem-safe da un nome di mapping/export: sostituisce i caratteri non alfanumerici con `_` e rimuove i trattini estremi. | `name: str` - nome mapping | `str` - nome sicuro (default `"mapping"` se vuoto) |
| `generate_outputs_for_data(data: Dict[str, Any], safe_name: str, output_dir: Path, format_type: str) -> Dict[str, Path]` | Genera tutti gli output per un singolo mapping, organizzandoli in sottocartelle per tipo (`tecnico/`, `business/`, `flussi/`, `csv/`). Rispetta il filtro `format_type`. | `data` - dizionario mapping; `safe_name` - nome sicuro; `output_dir` - cartella di output; `format_type` - filtro formato (`all`/`technical`/`business`/`flow`/`csv`) | `Dict[str, Path]` - label → percorso file generato |
| `print_outputs(outputs: Dict[str, Path], prefix: str = "")` | Stampa a console gli output generati mostrando il percorso relativo (`sottocartella/file`). | `outputs` - dict label→path; `prefix` - stringa opzionale di prefisso | `None` |
| `process_single_xml(xml_file: Path, output_dir: Path, format_type: str) -> tuple[bool, dict]` | Elabora un singolo file XML. Se contiene più mapping (`len(mapping_ids) > 1`) delega a `process_multi_mapping()`. In caso contrario costruisce il dizionario via `parser.to_dict()` e genera gli output. | `xml_file: Path` - file XML; `output_dir: Path`; `format_type: str` | `tuple[bool, dict]` - `(successo, summary)` dove summary è `{mapping_name: {sources, targets}}` |
| `process_multi_mapping(parser: OdiMappingParser, xml_file: Path, output_dir: Path, format_type: str) -> tuple[bool, dict]` | Elabora file SmartExport con più mapping. Itera su `parser.to_dict_list()`, genera output per ogni mapping con nome univoco (suffisso `_2`, `_3`...), gestisce errori per mapping singoli e genera l'indice `*_INDEX.md`. | `parser` - istanza parser già inizializzata; `xml_file`; `output_dir`; `format_type` | `tuple[bool, dict]` - `(almeno_un_successo, summary)` |
| `generate_smartexport_index(parser: OdiMappingParser, export_name: str, results: List[Dict[str, Any]], index_path: Path)` | Genera un indice Markdown per export multi-mapping: tabella informazioni export (Admin), lista oggetti inclusi, tabella mapping con stato ✅/❌ e link ai file generati. | `parser` - parser (per `admin` e `smart_export_includes`); `export_name` - nome export; `results` - lista risultati per mapping; `index_path` - percorso file indice | `None` |
| `main()` | Entry point CLI. Riconfigura `stdout` su UTF-8, parsa manualmente `sys.argv` (`--output-dir`, `--format`), crea la sottocartella timestamp `output/<YYYYMMDD_HHMMSS>`, gestisce modalità batch (cartella → `rglob("*.xml")`) o file singolo. Scrive `mapping_sources_targets.json`. | Nessuno (usa `sys.argv`) | `None` |

---

## 3. `src/parser.py` - Parser principale (lxml)

**Percorso:** `src/parser.py` (2036 righe)
**Responsabilità:** Parser principale basato su `lxml`. Ricostruisce il flusso relazionale completo del mapping (componenti, connection points, attributi, espressioni, connessioni, proprietà, scenari, execution units). Supporta export singoli e SmartExport multi-mapping con **scoping/partizionamento** degli oggetti per mapping. Utilizza indici in-memory per lookup O(1).

### Classe `OdiMappingParser`

**Descrizione:** Classe principale del parser. Inizializza le strutture dati in-memory, costruisce una tabella di dispatch per i parser degli oggetti ODI e orchestra le fasi di parsing.

#### Costruttore

| Metodo | Descrizione | Input | Ritorno |
|--------|-------------|-------|---------|
| `__init__(self, xml_path: str)` | Inizializza il parser. Crea parser `lxml` con `recover=True` e `huge_tree=True` (per file molto grandi e XML non perfettamente ben formati). Inizializza tutti gli store in-memory, la tabella `_parsers` (dispatch), il registro mapping, gli indici di performance e gli alias dei campi. Esegue la pipeline: `_parse_header()` → `_parse_all()` → `_post_process()`. | `xml_path: str` - percorso file XML | `None` |

#### Helper di base

| Metodo | Descrizione | Input | Ritorno |
|--------|-------------|-------|---------|
| `_camel_to_upper_snake(name)` | Converte un nome camelCase in formato UPPER_SNAKE (es. `MappingId` → `MAPPING_ID`). | `name: str` | `str` |
| `_field_candidates(field_name)` | Genera una lista di candidati per la ricerca di un campo: il nome originale, gli alias in `FIELD_ALIASES`, la versione UPPER_SNAKE, maiuscolo e minuscolo. Aumenta la robustezza verso convenzioni diverse negli export ODI. | `field_name: str` | `List[str]` |
| `_resolve_mapping_id(value)` | Risolve un ID mapping attraverso la mappa di alias (`_mapping_alias_to_id`). | `value` | valore risolto (o l'originale) |
| `_local_tag(tag)` | Estrae il nome locale di un tag XML (rimuove il namespace tra `{}`). | `tag` - tag XML | `str` minuscola |
| `_get_field(obj, field_name, default=None)` | Estrae il valore di un campo da un elemento `Object`, provando tutti i candidati di nome. Tratta `None` e stringa `"null"` come assenti. | `obj` - elemento XML; `field_name: str`; `default` | valore del campo o `default` |
| `_mark_ownership(i_mapping)` | Se l'ID mapping è valorizzato, imposta `_has_component_ownership = True` (usato per decidere l'affidabilità dello scoping multi-mapping). | `i_mapping` | `None` |

#### Parsing header ed export

| Metodo | Descrizione | Input | Ritorno |
|--------|-------------|-------|---------|
| `_parse_header()` | Analizza gli elementi `Admin`, `Encryption` e `SmartExportList` dalla radice del documento. Popola `self.admin`, `self.encryption`, `self.smart_export_includes`, `self.smart_export_materialize_shortcut`. | Nessuno | `None` |
| `_parse_all()` | Scorre tutti gli elementi `<Object>` della radice e delega il parsing alla funzione appropriata tramite la tabella `_parsers` (basata sul nome classe). | Nessuno | `None` |
| `_post_process()` | Completamenti finali: imposta `self.mapping` sul primo mapping in ordine, normalizza gli ID, arricchisce i mapping con `folder_name`/`project_name`/`project_code`. | Nessuno | `None` |
| `_normalize_mapping_ids()` | Normalizza i campi `i_mapping` di tutti gli store (componenti, CP, attributi, espressioni, ecc.) usando gli alias di mapping. | Nessuno | `None` |

#### API pubblica

| Metodo | Descrizione | Input | Ritorno |
|--------|-------------|-------|---------|
| `mapping_ids()` | Restituisce la lista ordinata degli ID mapping presenti nell'export. | Nessuno | `List[str]` |
| `is_multi_mapping()` | Verifica se l'export contiene più di un mapping. | Nessuno | `bool` |
| `is_smart_export()` | Verifica se l'export è un SmartExport (flag `IsSmartExportFile=true` oppure multi-mapping). | Nessuno | `bool` |
| `can_scope_mappings()` | Indica se il parser ritiene affidabile il partizionamento degli oggetti per mapping (unico mapping oppure ownership presente). | Nessuno | `bool` |
| `to_dict_list()` | Restituisce una lista di dizionari mapping (uno per ogni mapping, compatibili con i builder). | Nessuno | `List[Dict]` |
| `to_dict() -> dict[str, Any]` | Metodo backward-compatible: restituisce il dizionario del primo mapping. | Nessuno | `Dict` |
| `to_dict_for_mapping(mapping_id)` | Costruisce il dizionario per uno specifico mapping, salvando/ripristinando lo stato del parser (snapshot) e applicando lo scoping. | `mapping_id` | `Dict` |

#### Selezione oggetti / Scoping

| Metodo | Descrizione | Input | Ritorno |
|--------|-------------|-------|---------|
| `_select_all_objects()` | Restituisce una copia di tutti gli oggetti parsati. Usato in modalità mapping singolo o come fallback. | Nessuno | `Dict` con tutti gli store |
| `_select_objects_for_mapping(mapping_id)` | Seleziona solo gli oggetti appartenenti a un mapping usando i campi reali ODI (IOwnerMapping, IOwnerMapComp, IOwnerMapCp, ecc.). Applica una **chiusura transitiva** (fix-point loop) per propagare l'appartenenza attraverso le relazioni. Include **safety fallback** se lo scoping produrrebbe output vuoti/incompleti. | `mapping_id` | `Dict` scoped |
| `_all_map_ref_stores()` | Restituisce la lista di coppie `(nome_store, store)` per gli store basati su MapRef (datastores, columns, kms, contexts, logical_schemas, data_types, keys). | Nessuno | `List[Tuple[str, Dict]]` |
| `_all_map_refs()` | Unifica tutti gli store MapRef in un unico dizionario `ref_id → info`. | Nessuno | `Dict` |

#### Parser per singolo oggetto ODI

| Metodo | Descrizione | Input | Ritorno |
|--------|-------------|-------|---------|
| `_parse_project(obj)` | Parsa `SnpProject`: registra progetto in `self.projects` con `project_name`, `project_code`, `global_id`. | `obj` - elemento XML | `None` |
| `_parse_folder(obj)` | Parsa `SnpFolder`: registra folder in `self.folders` con `folder_name`, `i_project`, `global_id`. | `obj` | `None` |
| `_parse_mapping(obj)` | Parsa `SnpMapping`: raccoglie gli ID candidati (IMapping, I_MAPPING, MappingId, GlobalId), registra gli alias, crea il record mapping (nome, descrizione, date, utenti, ID) e lo aggiunge a `self.mappings`/`_mapping_order`. | `obj` | `None` |
| `_parse_map_ref(obj)` | Parsa `SnpMapRef`: in base ad `AdapterIntfType` instrada il record nel relativo store (datastore, colonna, KM, contesto, logical schema, data type, key). | `obj` | `None` |
| `_parse_map_comp(obj)` | Parsa `SnpMapComp`: registra componente (nome, tipo, alias, datastore ref, ownership mapping). Marca ownership. | `obj` | `None` |
| `_parse_map_cp(obj)` | Parsa `SnpMapCp`: registra connection point (nome, direzione, owner component, cardinalità, ordine). | `obj` | `None` |
| `_parse_map_attr(obj)` | Parsa `SnpMapAttr`: registra attributo (nome, owner CP, tipi, lunghezza, scala, required, grp_func). | `obj` | `None` |
| `_parse_map_expr(obj)` | Parsa `SnpMapExpr`: registra espressione (testo, parsed text, owner attr/prop). Aggiorna gli indici `_expr_by_attr`/`_expr_by_prop`. | `obj` | `None` |
| `_parse_map_expr_ref(obj)` | Parsa `SnpMapExprRef`: registra riferimento espressione (owner expr, ref attr/comp/ref, ref_key/text). | `obj` | `None` |
| `_parse_map_conn(obj)` | Parsa `SnpMapConn`: registra connessione (start/end CP, ownership). Marca ownership. | `obj` | `None` |
| `_parse_map_prop(obj)` | Parsa `SnpMapProp`: registra proprietà (owner comp/attr/cp, deploy spec, exec unit, phy node, tipo e valore). | `obj` | `None` |
| `_parse_scen(obj)` | Parsa `SnpScen`: registra scenario (nome, versione, mapping, date, utenti). | `obj` | `None` |
| `_parse_scen_step(obj)` | Parsa `SnpScenStep`: registra step chiave `(scen_no, nno)` con tabella, logical schema, mod_code, gen_info. | `obj` | `None` |
| `_parse_scen_task(obj)` | Parsa `SnpScenTask`: registra task chiave `(scen_no, task_no)` con nomi task, testi SQL (def/col), schemi logici, tecnologie. | `obj` | `None` |
| `_parse_exec_unit(obj)` | Parsa `SnpExecUnit`: registra execution unit (nome, business name, gruppo, schema, KM, owner ds). Definita due volte: la seconda definizione (con `i_owner_ds` e `_resolve_mapping_id`) sovrascrive la prima. | `obj` | `None` |
| `_parse_exec_unit_grp(obj)` | Parsa `SnpExecUnitGrp`: registra gruppo exec unit (nome, owner ds). | `obj` | `None` |
| `_parse_deploy_spec(obj)` | Parsa `SnpDeploySpec`: registra deploy spec (nome, map ref, ownership). | `obj` | `None` |
| `_parse_phy_node(obj)` | Parsa `SnpPhyNode`: registra physical node (tipo, exec unit, map comp/cp, KM src/tgt, stage table). | `obj` | `None` |
| `_parse_fk_ref(obj)` | Parsa `SnpFKXRef`: aggiunge riferimento FK alla lista `self.fk_refs` (ref_key, FQ name/type, ownership). | `obj` | `None` |

#### Business logic e ricostruzione flusso

| Metodo | Descrizione | Input | Ritorno |
|--------|-------------|-------|---------|
| `_normalize_qualified_name(qualified_name: str) -> str` | Rimuove i prefissi tecnologici ODI dal nome modello (`ORACLE_`, `MSSQL_`, `M_...`, ecc.) dal nome qualificato. | `qualified_name: str` | `str` normalizzata |
| `get_datastore_name(map_ref_id: str)` | Restituisce il nome normalizzato del datastore dato un MapRef ID. | `map_ref_id: str` | `str` o `None` |
| `get_component_datastore(comp_id: str)` | Restituisce il datastore associato a un componente tramite il suo `i_map_ref`. | `comp_id: str` | `str` o `None` |
| `get_expr_for_attr(attr_id: str)` | Restituisce il testo dell'espressione per un attributo (lookup O(1) su `_expr_by_attr`). | `attr_id: str` | `str` o `None` |
| `get_expr_for_prop(prop_id: str)` | Restituisce il testo dell'espressione per una proprietà (lookup O(1) su `_expr_by_prop`). | `prop_id: str` | `str` o `None` |
| `_analyze_datastore_flow()` | Analizza il flusso delle connessioni per ogni datastore e determina il ruolo: SOURCE (solo output), TARGET (solo input), LOOKUP (entrambi). | Nessuno | `Dict[ds_name, role]` |
| `find_sources_and_targets()` | Restituisce liste ordinate di sorgenti e target. | Nessuno | `Tuple[List[str], List[str]]` |
| `find_lookup_tables()` | Restituisce lista ordinata delle tabelle di lookup. | Nessuno | `List[str]` |
| `get_join_conditions()` | Estrae i componenti JOIN con le loro condizioni (dalle proprietà `JOIN_CONDITION`) e input (CP di direzione input con relativa sorgente). | Nessuno | `List[Dict]` |
| `get_filter_conditions()` | Estrae i componenti FILTER con le condizioni (proprietà `FILTER_CONDITION`). | Nessuno | `List[Dict]` |
| `get_aggregate_info()` | Estrae i componenti AGGREGATE: distingue `group_by` da `aggregations` in base a `grp_func` e alla presenza di funzioni di aggregazione nell'espressione (SUM/COUNT/AVG/MIN/MAX). | Nessuno | `List[Dict]` |
| `get_expression_components()` | Estrae i componenti EXPRESSION con le espressioni sugli attributi di output. | Nessuno | `List[Dict]` |
| `get_target_attributes()` | Estrae gli attributi mappati sui datastore target (CP direzione input) con espressione sorgente, required, tipo/lunghezza/scala. | Nessuno | `List[Dict]` |
| `_unique_by_qualified_name(items)` | Rimuove duplicati di MapRef basati su `(adapter_type, qualified_name)`. | `items: List[Dict]` | `List[Dict]` |
| `_unique_components(components)` | Rimuove componenti duplicati in modalità fallback globale (chiave: nome+tipo+datastore+alias+descrizione). | `components: List[Dict]` | `List[Dict]` |
| `_merge_datastore_role(old_role, new_role)` | Unisce i ruoli quando più componenti datastore riferiscono la stessa tabella (LOOKUP prevale, TARGET+SOURCE → LOOKUP). | `old_role, new_role: str` | `str` |
| `get_km_usage()` | Restituisce la lista unica dei Knowledge Module usati. | Nessuno | `List[Dict]` |
| `get_dependencies()` | Estrae le dipendenze dai `fk_refs`, classificandole per tipo (tabelle, colonne, modelli, submodelli, chiavi). | Nessuno | `Dict[str, List[str]]` |
| `get_scenarios_info()` | Ricostruisce gli scenari con i relativi step e task (annidamento gerarchico). | Nessuno | `List[Dict]` |
| `get_generated_sql()` | Estrae il SQL generato dai task degli scenari (campo `def_txt`/`col_txt`) con tipo DEF/COL e relativi schema/tecnologia. | Nessuno | `List[Dict]` |
| `get_execution_units_info()` | Ricostruisce le execution unit risolvendo i nomi di gruppo, logical schema e KM tramite lookup. | Nessuno | `List[Dict]` |
| `get_mapping_flow()` | Costruisce il grafo del flusso: nodi (componenti con ruolo/type) e archi (connessioni risolte via CP → componente). **Merging** dei nodi datastore duplicati e gestione duplicati in modalità fallback. Restituisce `{nodes, edges}`. | Nessuno | `Dict[str, Any]` |
| `_to_dict_internal() -> dict[str, Any]` | Costruisce il dizionario finale completo: arricchisce i componenti con `datastore_name`, applica dedup in fallback, assembla tutte le sezioni (mapping, sources, targets, lookups, join, filtri, aggregazioni, espressioni, target attrs, KMs, dipendenze, scenari, SQL, exec units, contesti, schemi logici, mapping_flow). | Nessuno | `Dict[str, Any]` |

---

## 4. `src/parse_odi_xml.py` - Parser alternativo (stdlib)

**Percorso:** `src/parse_odi_xml.py` (1309 righe)
**Responsabilità:** Parser alternativo basato su `xml.etree.ElementTree` (libreria standard, zero dipendenze). Ricostruisce lo stesso modello di dati del parser principale. Include generatori Markdown autonomi e funzioni di business description.

### Classe `OdiMappingParser`

**Descrizione:** Versione stdlib del parser. Logica simile a `src/parser.py` ma senza supporto multi-mapping/SmartExport (usa solo `to_dict()`). Predilige il modello `{ 'key': value }` in stile snake_case.

#### Metodi

| Metodo | Descrizione | Input | Ritorno |
|--------|-------------|-------|---------|
| `__init__(self, xml_path)` | Inizializza gli store e lancia `_parse_all()`. | `xml_path` | `None` |
| `_get_field(obj, field_name, default=None)` | Estrae il valore di un campo da un elemento `Object`. | `obj`; `field_name`; `default` | valore o `default` |
| `_parse_all()` | Scorre gli oggetti `Object` e delega al parser della classe tramite catena `if/elif`. | Nessuno | `None` |
| `_parse_mapping(obj)` | Parsa `SnpMapping` in `self.mapping` (stile snake_case). | `obj` | `None` |
| `_parse_map_ref(obj)` | Parsa `SnpMapRef` e instrada per `AdapterIntfType`. | `obj` | `None` |
| `_parse_map_comp(obj)` | Parsa `SnpMapComp`. | `obj` | `None` |
| `_parse_map_cp(obj)` | Parsa `SnpMapCp`. | `obj` | `None` |
| `_parse_map_attr(obj)` | Parsa `SnpMapAttr`. | `obj` | `None` |
| `_parse_map_expr(obj)` | Parsa `SnpMapExpr`. | `obj` | `None` |
| `_parse_map_expr_ref(obj)` | Parsa `SnpMapExprRef`. | `obj` | `None` |
| `_parse_map_conn(obj)` | Parsa `SnpMapConn`. | `obj` | `None` |
| `_parse_map_prop(obj)` | Parsa `SnpMapProp`. | `obj` | `None` |
| `_parse_scen(obj)` | Parsa `SnpScen`. | `obj` | `None` |
| `_parse_scen_step(obj)` | Parsa `SnpScenStep`. | `obj` | `None` |
| `_parse_scen_task(obj)` | Parsa `SnpScenTask`. | `obj` | `None` |
| `_parse_exec_unit(obj)` | Parsa `SnpExecUnit`. | `obj` | `None` |
| `_parse_exec_unit_grp(obj)` | Parsa `SnpExecUnitGrp`. | `obj` | `None` |
| `_parse_deploy_spec(obj)` | Parsa `SnpDeploySpec`. | `obj` | `None` |
| `_parse_phy_node(obj)` | Parsa `SnpPhyNode`. | `obj` | `None` |
| `_parse_fk_ref(obj)` | Parsa `SnpFKXRef` (aggiunge a `self.fk_refs`). | `obj` | `None` |
| `_normalize_qualified_name(qualified_name)` | Sostituisce il prefisso modello con `project_code` nei nomi qualificati. | `qualified_name` | `str` |
| `get_datastore_name(map_ref_id)` | Nome datastore normalizzato per MapRef ID. | `map_ref_id` | `str` o `None` |
| `get_component_datastore(comp_id)` | Datastore associato a un componente. | `comp_id` | `str` o `None` |
| `get_cp_component(cp_id)` | Componente proprietario di un connection point. | `cp_id` | `str` o `None` |
| `get_expr_for_attr(attr_id)` | Testo espressione per attributo (ricerca lineare su `expressions`). | `attr_id` | `str` o `None` |
| `get_expr_for_prop(prop_id)` | Testo espressione per proprietà (ricerca lineare). | `prop_id` | `str` o `None` |
| `get_source_attributes(expr_id)` | Attributi sorgente referenziati da un'espressione (via expression_refs). | `expr_id` | `List[Dict]` |
| `find_sources_and_targets()` | Identifica sorgenti (solo output) e target (solo input) analizzando il flusso connessioni. | Nessuno | `Tuple[List, List]` |
| `find_lookup_tables()` | Datastore con input E output (lookup). | Nessuno | `List` |
| `get_join_conditions()` | Condizioni di JOIN e relativi input. | Nessuno | `List[Dict]` |
| `get_filter_conditions()` | Condizioni FILTER. | Nessuno | `List[Dict]` |
| `get_aggregate_info()` | GROUP BY e funzioni di aggregazione. | Nessuno | `List[Dict]` |
| `get_expression_components()` | Espressioni personalizzate per componente. | Nessuno | `List[Dict]` |
| `get_target_attributes()` | Attributi target con espressione sorgente e metadati. | Nessuno | `List[Dict]` |
| `get_km_usage()` | Knowledge Module usati. | Nessuno | `List[Dict]` |
| `get_dependencies()` | Dipendenze classificate (tables, columns, models, submodels, keys). | Nessuno | `Dict` |
| `get_scenarios_info()` | Scenari con step e task. | Nessuno | `List[Dict]` |
| `get_generated_sql()` | SQL generato dai task (DEF/COL). | Nessuno | `List[Dict]` |
| `get_execution_units_info()` | Execution units con gruppo/schema/KM risolti. | Nessuno | `List[Dict]` |
| `to_dict()` | Dizionario completo finale (senza `mapping_flow`). | Nessuno | `Dict` |

#### Funzioni di modulo (autonome)

| Funzione | Descrizione | Input | Ritorno |
|----------|-------------|-------|---------|
| `generate_technical_markdown(data, output_path)` | Genera documentazione tecnica Markdown autonoma (versione ridotta rispetto a `doc_builder.py`). | `data` - dict; `output_path` - Path | `str` (contenuto) |
| `generate_business_markdown(data, output_path)` | Genera documentazione business Markdown autonoma. | `data`; `output_path` | `str` |
| `_business_description(attr_name, expression)` | Genera descrizione business da nome attributo/espressione con matching pattern dedicati (ID_, DESCRIZIONE, IMPORTI, DATA, STATO, ecc.). | `attr_name`; `expression` | `str` |
| `main()` | Entry point autonomo dello script (`python parse_odi_xml.py <xml> [--output-dir] [--format]`). | Nessuno (usa `sys.argv`) | `None` |

---

## 5. `src/doc_builder.py` - Generatori Markdown

**Percorso:** `src/doc_builder.py` (462 righe)
**Responsabilità:** Genera la documentazione Markdown tecnica e business a partire dal dizionario dati del mapping.

### Funzioni

| Funzione | Descrizione | Input | Ritorno |
|----------|-------------|-------|---------|
| `generate_technical_markdown(data: Dict[str, Any], output_path: Path) -> str` | Genera documentazione tecnica completa: informazioni generali mapping, contesti/schemi, flusso dati (sorgenti/target/lookup), componenti, logica trasformazione (JOIN/filtri/aggregazioni/espressioni), mappatura attributi target, Knowledge Modules, Execution Units, scenari con task, SQL generato (in blocchi `<details>` collassabili), dipendenze esterne. | `data` - dict mapping; `output_path` - Path di scrittura | `str` - contenuto Markdown |
| `generate_business_markdown(data: Dict[str, Any], output_path: Path) -> str` | Genera documentazione business in linguaggio narrativo: scopo del processo, operazioni principali, regole di business (criteri selezione, logiche calcolo, campi calcolati), struttura dato output, modalità esecuzione. Usa helper `_humanize_condition` e `_business_description_dynamic` per tradurre le espressioni tecniche. | `data`; `output_path` | `str` |
| `_humanize_condition(cond: str) -> str` | Helper: traduce operatori SQL in linguaggio naturale (es. `=` → "è uguale a", `IS NULL` → "è vuoto"). | `cond: str` | `str` |
| `_business_description_dynamic(attr_name: str, expression: str) -> str` | Helper: analizza nome attributo ed espressione per generare una descrizione business generica. Riconosce SUM/COUNT/AVG, CASE WHEN, passaggi diretti, pattern su nome (ID_, DESCR/NOME, DATA/ANNO, IMPORTO, STATO, FLAG, PERCENT). | `attr_name: str`; `expression: str` | `str` |

---

## 6. `src/flow_builder.py` - Generatore diagrammi Mermaid

**Percorso:** `src/flow_builder.py` (105 righe)
**Responsabilità:** Genera un diagramma di flusso Mermaid.js a partire dal grafo `mapping_flow` del parser.

### Funzioni

| Funzione | Descrizione | Input | Ritorno |
|----------|-------------|-------|---------|
| `generate_flow_diagram(data, output_path)` | Genera un diagramma Mermaid `graph LR`: definisce le classi di stile per tipo (source, target, lookup, filter, join, aggregate, expression), crea ID nodi sicuri (`N0`, `N1`...), applica forme diverse per tipo (sorgente `[()]`, filtro `{}`, join `(( ))`, espressione `()`, ecc.), aggiunge gli archi dalle connessioni e una legenda. | `data` - dict (con `mapping` e `mapping_flow`); `output_path` - Path | `str` - contenuto Markdown con diagramma |

---

## 7. `src/csv_builder.py` - Generatore CSV

**Percorso:** `src/csv_builder.py` (292 righe)
**Responsabilità:** Genera un file CSV tabellare delle regole di mapping, Excel-friendly (encoding `utf-8-sig`).

### Costanti

| Costante | Descrizione |
|----------|-------------|
| `FIELDNAMES` | Lista delle 16 colonne del CSV: `Mapping_Name`, `Mapping_Description`, `Project`, `Folder`, `Category`, `Component_Name`, `Component_Type`, `Datastore`, `Attribute_Name`, `Expression`, `Function`, `Required`, `Data_Type`, `Length`, `Scale`, `Details`. |

### Funzioni

| Funzione | Descrizione | Input | Ritorno |
|----------|-------------|-------|---------|
| `_clean(value: Any) -> str` | Helper: normalizza un valore per il CSV sostituendo i caratteri di newline (`\r\n`, `\n`, `\r`) con spazi e convertendo `None` in stringa vuota. | `value: Any` | `str` |
| `generate_csv(data: dict, output_path: Path)` | Genera il CSV con **10 categorie** di righe: SOURCE, TARGET, LOOKUP, COMPONENT, TARGET_ATTRIBUTE, EXPRESSION, AGGREGATE_GROUP_BY, AGGREGATE_FUNCTION, JOIN_CONDITION, FILTER_CONDITION, KM, EXECUTION_UNIT, SCENARIO. Crea la cartella padre, scrive header + righe con `utf-8-sig`. Se non ci sono righe, aggiunge una riga INFO. | `data` - dict; `output_path` - Path | `Path` (percorso file scritto) |

---

## 8. `tools/inspect_odi_fields.py` - Ispettore campi ODI

**Percorso:** `tools/inspect_odi_fields.py` (116 righe)
**Responsabilità:** Tool di supporto che ispeziona un file SunopsisExport/SmartExport e stampa SOLO metadati (classe, conteggio oggetti, nomi campi) senza mai mostrare i valori dei campi. Utilizzabile su file riservati.

### Funzioni

| Funzione | Descrizione | Input | Ritorno |
|----------|-------------|-------|---------|
| `local_tag(tag)` | Estrae il nome locale di un tag XML (rimuove namespace). | `tag` | `str` |
| `main()` | Punto di ingresso: legge il file XML con `lxml` (recover+huge_tree), itera gli oggetti `Object`, raccoglie per classe il conteggio e i nomi dei `Field`, stampa report Markdown con tabella riassuntiva e dettaglio per le classi principali (SnpMapping, SnpMapComp, SnpMapCp, SnpMapAttr, SnpMapProp, SnpMapConn, SnpMapExpr, SnpMapExprRef, SnpMapRef, SnpScen, SnpScenStep, SnpScenTask, SnpExecUnit, SnpExecUnitGrp, SnpDeploySpec, SnpPhyNode, SnpProject, SnpFolder, SnpFKXRef). | Nessuno (usa `sys.argv`) | `None` |

---

*Fine mappa funzioni. Per i test vedere [`test_e_qualita.md`](test_e_qualita.md).*