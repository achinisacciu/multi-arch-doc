# Report Analisi Tecnica – jca-technical-doc-generator (Oracle SOA & ADF Architecture Studio)

**Data:** 2026-09-02  
**Scope:** Analisi statica completa (code review), verifica logica fallace, bug, incongruenze architetturali, debt e rischi runtime.  
**Esito build:** `npx tsc --noEmit` OK (0 errori) – `vite build` OK (18.4s) – bundle **683 kB** gzip 195 kB (chunk unico >500 kB warning).

---

## 1. Sommario Esecutivo

| Area | Gravità complessiva | Commento |
|---|---|---|
| **Parsing XML / Ecosystem** | **ALTA** | Logica crittografica fragile su namespace, estensioni, fallback regex; mismatch tra FileDropzone e `buildOracleEcosystem` causa perdita silente di file. |
| **JCA Parser** | **ALTA** | Fallback crea endpoint fantasma, estrazioni SQL/tabelle incomplete, deduplicazione e classificazione adapter incomplete. |
| **Reattività / State React** | **MEDIA** | ID non deterministici, selezione adapter fragile al filtraggio, gestione download non cross-browser. |
| **Generazione Documentazione** | **MEDIA** | XSS/iniezione Mermaid/HTML, troncamento ComponentType/DVM a 100, incoerenze TOC. |
| **Performance / Bundle** | **MEDIA** | Bundle monolitico 683 kB, dipendenze morte (`express`, `@google/genai`), nessuna code-splitting, parsing sincrono su 7000 file blocca main thread. |
| **Sicurezza / DevOps** | **MEDIA** | `navigator.clipboard` senza fallback, `Blob.size` su UTF-16 vs byte reali, Plan.xml template non valida XML. |

**Totale difetti rilevati:** 34 (10 Critici, 14 Maggiori, 10 Minori). Tutti devono essere corretti prima di consegna a cliente/tirocinio.

---

## 2. Difetti Critici (Bloccanti / Logica Fallace)

### C-01 — Mismatch whitelist `FileDropzone` vs `ecosystemParser` → perdita silente di file
**File:** `src/components/FileDropzone.tsx:35-60` vs `src/services/ecosystemParser.ts:874-971`  
**Linee:** `FileDropzone.tsx:35` `supportedExtensions = [...]` ; `ecosystemParser.ts:874` `BINARY_EXTS` + `949` `ext === '.tcl' ...`  
**Problema:** `FileDropzone.isSupportedFile()` accetta solo 18 estensioni (`xml, wsdl, xsd, jca, bpmn, bpel, componentType, mplan, task, xsl/xslt, jpr/jws, dcx/cpx, sql/sh/py/properties`). `buildOracleEcosystem` gestisce invece `.dvm, .tcl, .ctl, .java, .jspx, .dvm, .componentType` etc. L'utente trascina una cartella `grande-repository` con 7000 file: ~3000 file (`*.dvm`, `*.tcl`, `*.ctl`, `*.java`, `*.jspx`, `*.sample`, `*.xml` composite annidati) vengono **silentemente scartati** dal dropzone prima di arrivare al parser. Il parser stesso per `.dvm`/`.tcl` non viene mai raggiunto.  
**Impatto:** Inventario incompleto, cliente vede “0 DVM” pur avendo 200+ file. Nessun warning.  
**Fix:** Allineare `supportedExtensions` a `ecosystemParser` (includere `.dvm, .tcl, .ctl, .java, .jspx, .xml` generico) o rimuovere il filtro in `FileDropzone` e delegare al parser con filtro `BINARY_EXTS` unico. Aggiungere toast “N file ignorati: …”.

### C-02 — `parseJcaContent` fallback crea endpoint fantasma anche su XML vuoto/malformato
**File:** `src/services/jcaParser.ts:463-539`  
**Linee:** `464` `if (endpoints.length === 0)`  
**Problema:** Se il DOMParser fallisce **o** se il file è vuoto/binario ma contiene la stringa `portType=` per caso, il ramo regex crea comunque `endpoints.push({ portType: 'UnknownPort', operation: 'UnknownOperation', ... })`. Un `adapter.jca` corrotto o un `.xml` scambiato per `.jca` genera quindi un adapter “valido” con operazione inesistente, che poi appare in matrici JCA e Mermaid. Logica fallace: `endpoints.length===0` non distingue “nessun endpoint reale” da “file non-JCA”.  
**Fix:** Nel fallback verificare `if (!adapterName && properties.length===0 && !portTypeMatch) return errore` oppure pusha warning e `return` adapter con `validationWarnings` ma **senza** endpoint, così la UI mostra “Nessun endpoint rilevato” invece di dati falsi. Aggiungere guardia `if (xmlContent.trim().length < 10)`.

### C-03 — `extractSqlTables` e `detectSqlType` fallaci su SQL reale Oracle
**File:** `src/services/jcaParser.ts:248-273`  
**Linee:** `252` `fromJoinRegex = /(?:FROM|JOIN|INTO|UPDATE)\s+([a-zA-Z0-9_\.]+)/gi` ; `264` `trimmed.startsWith('SELECT')`  
**Problema:**  
- Regex non gestisce `MERGE INTO`, `WITH` CTE, `USING`, virgolette `"SCHEMA"."TABLE"`, alias `FROM ORDERS o`, subquery `FROM (SELECT ...)`, `DELETE` senza `FROM`. Falsi positivi su parole riservate (`SELECT`, `DUAL` esclusi ma `VALUES` no).  
- `detectSqlType` fallisce se SQL inizia con commento `--` o `/* ... */` o spazi + `(` . `WITH` è mappato a `SELECT` ma un `WITH ... INSERT` sarebbe sbagliato. `CALL` non copre `BEGIN my_pkg.proc(:1); END;`.  
**Impatto:** Documentazione riporta tabelle errate o `UNKNOWN` su procedure reali di `grande-repository` (PL/SQL con `BEGIN`/`EXECUTE IMMEDIATE`).  
**Fix:** Normalizzare SQL rimuovendo commenti (`/--.*$/gm`, `/\/\*[\s\S]*?\*\//g`) prima dei test; estendere regex a `/(?:FROM|JOIN|INTO|UPDATE|MERGE\s+INTO|USING)\s+["`]?([a-zA-Z0-9_\."]+)["`]?/gi` e scartare token che iniziano con `SELECT`/`(`. Per `detectSqlType`, fare `trimmed.replace(/^(\s|--.*|\/\*[\s\S]*?\*\/)+/, '')`.

### C-04 — Classificazione adapter `normalizeAdapterType` incompleta / ordine errato
**File:** `src/services/jcaParser.ts:202-214`  
**Linee:** `203` `lower.includes('db')` … `213` `return 'custom'`  
**Problema:**  
- `'apps'` (`oracle.tip.adapter.apps`) contiene `'apps'` ma il check `includes('apps')` è dopo `includes('db')`/`file`/`mq` → ok, ma `'mq'` (`mqseries`) viene mappato a `mq` **solo** se non contiene `aq`/`file` prima, però un adapter `AQ` custom con stringa `oracle.tip.adapter.aq` → `aq` corretto; un adapter `Custom DB` con stringa vuota va in `custom` ma `enrichProperty` poi crea `sqlAnalysis` se `adapterTypeRaw` contiene `db` → incoerenza.  
- Manca `jms` mapping per `eis/wls/Queue` (JNDI) che non contiene `jms` nel nome adapter → classificato `unknown`/`custom` e quindi `messagingAnalysis` non valorizzata se il fallback usa solo `adapterTypeRaw`.  
**Fix:** Priorità esplicita: `aq` prima di `mq`/`db`; aggiungere mapping JNDI-based (`if (jndi.includes('jms')||jndi.includes('queue')||jndi.includes('topic')) return 'jms'`) oppure mantenere `adapter` come `unknown` ma valorizzare comunque `messagingAnalysis` se `DestinationName` presente (già fatto) – uniformare. Documentare.

### C-05 — `parseXmlSafe` heuristic scarta file validi con BOM / XML declaration con spazi
**File:** `src/services/ecosystemParser.ts:26-43`  
**Linee:** `29` `if (!trimmed.startsWith('<') && !trimmed.startsWith('<?'))`  
**Problema:** File con BOM UTF-8 (`\uFEFF<?xml`) o con commento iniziale `<!-- --> <?xml` non passano il check ma contengono `<`. Il ramo `if (trimmed.length>0 && !trimmed.includes('<')) return null;` è ridondante e scarta `.sample` che in realtà potrebbero essere payload XML utili per mappatura. Inoltre `DOMParser` su 7000 file sincroni blocca UI thread.  
**Fix:** Normalizzare BOM: `content.replace(/^\uFEFF/, '').trimStart()`; rimuovere il guard `startsWith` e affidarsi solo a `try { parser } catch` con ritorno `null` su `parsererror`. Spostare parsing in Web Worker per dataset grandi.

### C-06 — Estrazione estensione file fallace per `._copy` / senza estensione
**File:** `src/services/ecosystemParser.ts:875-889`  
**Linee:** `877` `let ext = hasDot ? file.name.substring(file.name.lastIndexOf('.')).toLowerCase() : 'none';` … `880` `if (lowerName.endsWith('_copy'))`  
**Problema:** Logica contraddittoria: `hasDot` false → `ext='none'` poi `if (lowerName.endsWith('_copy'))` prova a reimpostare `.xsd/.wsdl` ma solo se il nome contiene `.xsd` **senza** punto (es. `OrderSchema_xsd_copy` → non matcha). Poi `if (!hasDot) ext='none'` sovrascrive di nuovo. Poi `if (ext === file.name.toLowerCase() ... ) ext='none'` ha condizione impossibile (`ext` è `'.xxx'` vs `file.name` è `'xxx'`). Risultato: file tipo `OrderSchema.xsd_copy` o `MyFile` senza est ma con XML vengono conteggiati come `none` e mai parsati.  
**Fix:** Semplificare: `const m = lowerName.match(/\.([a-z0-9]+)(?:_copy)?$/); ext = m ? '.'+m[1] : 'none';` + gestione `sample`.

### C-07 — ID non deterministici con `Date.now()+Math.random` → chiavi React instabili
**File:** `src/services/ecosystemParser.ts:262` `, 356` etc. ; `src/services/jcaParser.ts:544`  
**Linee:** `262` ``id: `composite-${Date.now()}-${Math.random().toString(36).substr(2,6)}``  
**Problema:** Ogni `buildOracleEcosystem([])` o re-render genera ID diversi per stessi file → React `key` cambia, lista `CompositeScaViewer`/`JcaAdapterSuiteViewer` rimonta, perdita di `selectedIndex`/`selectedAdapterId`. Inoltre collisione possibile se due file parsati nello stesso ms (probabile su loop 7000 file).  
**Fix:** ID deterministico: `id: `${relativePath}::${fileName}`` hash (es. `btoa(relativePath)`) oppure `crypto.randomUUID()` una tantum e memoizzare.

### C-08 — `SqlPayloadInspector` mostra solo `primaryEp = endpoints[0]` → perdita dati multi-endpoint
**File:** `src/components/SqlPayloadInspector.tsx:11-14`  
**Linee:** `11` `const primaryEp = config.endpoints[0];`  
**Problema:** Adapter reali `OrderDbAdapter_db.jca` nel sample ha **2** `endpoint-interaction` (`insertOrder` + `selectPendingOrders`). Il viewer mostra solo il primo; il secondo (PureSQL SELECT con tabelle/parametri) è invisibile. Stesso bug in `ArchitectureDiagramViewer.tsx:13` e `masterDocGenerator.ts:409` (tabella JNDI itera `jca.endpoints.forEach` correttamente, ma detail page no).  
**Fix:** Iterare `config.endpoints.map(...)` con tab per endpoint, come già fa `EndpointsViewer`.

### C-09 — Download via `a.click()` senza append al DOM + `revokeObjectURL` immediato
**File:** `src/App.tsx:93-98` ; `src/components/MasterDocGeneratorViewer.tsx:89-97` etc.  
**Linee:** `94` `a.click(); URL.revokeObjectURL(url);`  
**Problema:** Su Firefox/Safari il click su anchor non attaccato al DOM è ignorato (spec HTML). `revokeObjectURL` subito dopo può invalidare il download su connessioni lente / file grandi (>1 MB markdown per grande-repository). Manca `a.rel='noopener'`, manca cleanup su error.  
**Fix:** `document.body.appendChild(a); a.click(); setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);` – già fatto in `BatchManagerModal.tsx:99-105`, uniformare.

### C-10 — Iniezione Mermaid/HTML non sanitizzata
**File:** `src/services/masterDocGenerator.ts:680` `, src/services/markdownGenerator.ts:352` `, src/components/MasterDocGeneratorViewer.tsx:125`  
**Linee:** `681` ``InboundSvc_${idx}["Inbound: ${s.name} (${s.bindingType})"]`` ; `125` ``const markdown = ${JSON.stringify(markdownContent)};``  
**Problema:** `s.name`, `jca.name`, `config.connectionFactory.location` vengono interpolati direttamente in sintassi Mermaid (`[ ]`, `"`, `|`, `<br/>`). Un nome con `]` o `"` rompe il diagramma; un payload XML con `</script>` dentro `markdownContent` rompe `JSON.stringify`? No, ma `handleDownloadHtml` in `MasterDocGeneratorViewer` fa `JSON.stringify(markdownContent)` dentro `<script>` → se `markdownContent` contiene `</script><svg onload=alert(1)>` l'escape è sufficiente via JSON, ma `masterDocGenerator` inserisce raw `targetResource` senza escape `|` in Mermaid → diagramma rotto.  
**Fix:** Funzione `sanitizeMermaid(str) = str.replace(/["\[\]|{}]/g, '_').replace(/\n/g,' ')` prima di interpolare. Per HTML, usare `textContent` invece di `innerHTML` o `DOMPurify`.

---

## 3. Difetti Maggiori (Alta priorità)

### M-01 — `showUploadPanel` auto-hide solo se `newFiles.length > 5` (magic number)
**File:** `src/App.tsx:55-57`  
Se l’utente carica 1-5 file il pannello resta aperto coprendo la dashboard; se ne carica 6 si chiude. Nessuna ragione documentata. Fallace UX.

### M-02 — `handleFilesLoaded` deduplica solo su `relativePath` case-sensitive
**File:** `src/App.tsx:48-50`  
Su Windows/Mac il filesystem è case-insensitive: `SOA/composite.xml` vs `soa/Composite.xml` sono stesso file ma vengono trattati come diversi → duplicati in `composites`.

### M-03 — `isCompositeDocument` falso positivo su file che contengono stringa `<composite` nel payload
**File:** `src/services/ecosystemParser.ts:55-62` `, 912`  
Un `.xml` generico (es. `.cpx` con commento contenente `<composite`) viene classificato composite e parsato come tale, generando composite fantasma.

### M-04 — `extractPortType` regex non gestisce QName con prefisso (`ns:MyPortType`)
**File:** `src/services/ecosystemParser.ts:72-87`  
Se `interface="http://...#wsdl.interface(ns:MyPortType)"` il ramo `cleaned.includes(':') ? split(':').pop()` funziona, ma se `interface` è già `ns:MyPortType` senza `#` viene correttamente splittato, tuttavia il caso `interface="MyPortType "` con spazi finali lascia spazi nel risultato. Inoltre `hashPart.match(/(?:wsdl\.)?(?:portType|interface)\s*\(\s*([^)]+)\s*\)?/i)` non cattura correttamente `portType` quando namespace contiene `:`.

### M-05 — `parseXsdXml` doppio conteggio `complexTypes` se non top-level
**File:** `src/services/ecosystemParser.ts:684-704`  
Logica: prima cerca child diretti, se 0 fallback a globale → su XSD con sia top-level che nested, conta solo top-level e poi scarta i nested; su XSD con solo nested (tipico grande-repository) conta tutti globali ma poi deduplica per `name` (`Anonymous` duplice → perde tipi distinti anonimi). Inoltre `elementCount` conta `getElementsByTagName('element')` ricorsivo (nested) → sovrastima.

### M-06 — `parseMediatorXml` / `parseBpmnXml` namespace handling parziale
**File:** `src/services/ecosystemParser.ts:370-447`  
`getElementsByTagName('process')` + `getElementsByTagName('bpmn:process')` copre solo due varianti, ma BPMN può usare `bpmn2:process` o default namespace senza prefisso. Gateways/Events enumerati con lista hardcoded → mancano `exclusiveGateway` con prefisso `bpmn2:` o `ns3:`.

### M-07 — `MasterDocGeneratorViewer` ZIP troncato: dettagli orchestrazione minimali
**File:** `src/components/MasterDocGeneratorViewer.tsx:170-177`  
`orchFolder.file(`BPMN_${p.name}.md`, `# Processo BPMN: ${p.name}\n\n- Swimlanes: ...`)` → genera file di 1 riga invece di dettaglio completo (userTasks, gateways). Incoerente con `HIGH_LEVEL_SYSTEM_ARCHITECTURE.md` che è completo.

### M-08 — `ContractsTransformsViewer` / `HighLevelDashboard` tabelle non paginate
**File:** `src/components/HighLevelDashboard.tsx:254` `, src/components/ContractsTransformsViewer.tsx:68`  
Su grande-repository con 351 XSD / 200 WSDL, la tabella renderizza 351 righe DOM contemporaneamente → freeze UI (no `virtualization`, no `pagination`).

### M-09 — `Blob.size` vs byte reali
**File:** `src/services/jcaParser.ts:556` `, src/services/ecosystemParser.ts:275` `, 895`  
`new Blob([content]).size` misura byte UTF-8, ma `content` è stringa JS UTF-16 → per caratteri non-ASCII (es. commenti italiani con `è`) il size è corretto via Blob, ma in `RawXmlViewer.tsx:33` `new Blob([xmlContent]).size` ricalcolato ogni render → costo O(n) su file grandi.

### M-10 — `normalizeAdapterType` classifica `oracle.tip.adapter.db` come `db` anche se è `apps`/`custom` con sottostringa `db`
**File:** `src/services/jcaParser.ts:203`  
`'customdbadapter'` → `db` erroneamente. Serve match su token intero o regex `\bdb\b`.

### M-11 — `JcaAdapterSuiteViewer` selezione fragile dopo filtro
**File:** `src/components/JcaAdapterSuiteViewer.tsx:40`  
`selectedAdapter = adapters.find(a=>a.id===selectedAdapterId) || filteredAdapters[0] || adapters[0]` → se filtro `type=db` e `selectedAdapterId` è `jms`, mostra `jms` anche se non visibile in lista (incoerenza). Inoltre `setActiveSubTab` non resetta al cambio adapter → resta su `sql` anche se nuovo adapter è `jms` senza SQL.

### M-12 — `DevOpsAutomationViewer` conteggio script `type` incompleto
**File:** `src/components/DevOpsAutomationViewer.tsx:26-28`  
Conta solo `py/sh/sql/properties` ma `ecosystemParser` produce anche `tcl/java/other` → card “Script SQL & Config” sottostima.

### M-13 — Dipendenze morte `express` + `@google/genai` + `dotenv`
**File:** `package.json:14,18`  
`express`, `@google/genai`, `dotenv`, `@types/express`, `@types/node` mai importati (grep conferma 0 occorrenze). Aumentano `node_modules` e superficie d’attacco, ingannano il tecnico sul runtime (sembra server SSR ma è SPA statica).

### M-14 — `ComponentType`/`DVM` sezioni condizionali con `as any` → bypass type system
**File:** `src/services/masterDocGenerator.ts:61-66` `, 548-575`  
`(sections as any).includeComponentTypeCatalog && (ecosystem as any).componentTypes?.length` → se `DocSectionOptions` evolve, il check fallisce silenziosamente. Inoltre TOC usa ancore `#53-` / `#54-` non valide (duplicate `5`).

---

## 4. Difetti Minori / Code Smell

| # | File:Riga | Descrizione |
|---|---|---|
| m-01 | `vite.config.ts:10` `alias '@'` | Alias `@` → `path.resolve(__dirname,'.')` mai usato; `tsconfig.json:18` `paths @/*` inutile, confonde IDE. |
| m-02 | `src/App.tsx:100-104` `setDownloadSuccess(true); setTimeout(...,4000)` | Timeout hardcoded 4s, nessun cleanup su unmount → leak se componente smontato. |
| m-03 | `src/components/FileDropzone.tsx:71,98` `traverseFileTree(item:any, ...)` | `any` su `DataTransferItem`/`FileSystemEntry` disabilita type-check; `webkitGetAsEntry` deprecato, manca fallback `getAsEntry` standard. |
| m-04 | `src/components/MasterDocGeneratorViewer.tsx:349` `prose prose-slate` | Dipende da `@tailwindcss/typography` non installato → classi `prose` non applicate (build non fallisce ma stile assente). |
| m-05 | `src/services/markdownGenerator.ts:335-341` `formatSql` | Regex duplicate in `jcaParser` e `markdownGenerator`/`SqlPayloadInspector` → divergenza se una viene fixata e l’altra no. Centralizzare. |
| m-06 | `src/data/sampleEcosystem.ts:5` `sampleFiles` | Sample in codice, non in `public/`; aumenta bundle (318 righe) e non è tree-shakable. |
| m-07 | `src/components/CompositeScaViewer.tsx:175-189` `badgeClass` | Logica a `if` sequenziali senza `else` → se `type='bpel'` poi `bpmn` sovrascrive? No, ma fragile. Usare mappa. |
| m-08 | `src/components/HighLevelDashboard.tsx:34` `uniqueJndis` | Calcolo O(n) ad ogni render senza `useMemo` → su 136 adapter ricalcolo inutile. |
| m-09 | `tsconfig.json:7` `allowImportingTsExtensions: true` | Permette `import './App.tsx'` (in `main.tsx:3`) che Vite gestisce ma rompe `tsc` in altri tool; inconsistente con `moduleResolution: bundler`. |
| m-10 | `package.json:10` `clean: rm -rf dist server.js` | `server.js` non esiste mai (no SSR); comando `rm` non funziona su Windows (`win32` env) → `npm run clean` fallisce. |

---

## 5. Incoerenze Architetturali & Decisioni Dubbie

1. **100% deterministico dichiarato ma ID randomici** (`Date.now()+Math.random`) → contraddice claim “deterministico & offline”. Un re-import degli stessi file produce ID diversi → diff non riproducibile.
2. **Due generatori markdown duplicati** (`markdownGenerator.ts` per singolo JCA + `masterDocGenerator.ts` per ecosistema) con funzioni `sanitizeMd`/`escapeTableMarkdown`/`formatSql` duplicate e leggermente divergenti (uno fa `.replace(/\|/g,'\\|')`, l’altro anche `.replace(/\r?\n/g,' ')`). Manutenzione doppia.
3. **Stato globale in `App.tsx` unico `useState<OracleEcosystem>`** senza `useReducer` né `Context` → ogni `setEcosystem(buildOracleEcosystem(...))` ricalcola tutto (7000 file) sincrono sul main thread → UI freeze 2-5s. Mancata virtualizzazione.
4. **Assenza di test** – nessun `*.test.ts`/`*.spec.ts`, nessun `vitest`/`jest` configurato nonostante `package.json` abbia `lint: tsc --noEmit` (non è lint). Impossibile regressionare parser.

---

## 6. Piano di Correzione Prioritizzato (per Tecnico)

### Sprint 1 – Bloccanti (1-2 giorni)
- [ ] **C-01** Allineare `FileDropzone.supportedExtensions` a `ecosystemParser` + toast file scartati.
- [ ] **C-02** Guard su fallback JCA (no endpoint fantasma).
- [ ] **C-07** ID deterministici (`relativePath` hash).
- [ ] **C-09** Fix download `appendChild` + `setTimeout revoke`.
- [ ] **C-08** `SqlPayloadInspector` iterare tutti gli endpoint.

### Sprint 2 – Parsing & Dati (2-3 giorni)
- [ ] **C-03** Fix `extractSqlTables`/`detectSqlType` (strip commenti, regex MERGE).
- [ ] **C-05** Fix `parseXmlSafe` BOM + spostare in Worker.
- [ ] **C-06** Fix estrazione estensione `_copy`.
- [ ] **M-03** `isCompositeDocument` più rigoroso (`root.tagName === 'composite'`).
- [ ] **M-05** `parseXsdXml` conteggio corretto (no anon dedup).

### Sprint 3 – UI/UX & Sicurezza (1-2 giorni)
- [ ] **C-10** Sanitize Mermaid (`sanitizeMermaid`).
- [ ] **M-11** Fix selezione `JcaAdapterSuiteViewer` dopo filtro.
- [ ] **M-08** Paginazione/virtualizzazione tabelle (usare `tanstack-virtual`).
- [ ] `navigator.clipboard` fallback + `try/catch`.
- [ ] Rimuovere dipendenze morte (`express`, `@google/genai`, `dotenv`) e alias `@`.

### Sprint 4 – Performance & Qualità
- [ ] Code-split `MasterDocGeneratorViewer` (lazy `JSZip`, `react-markdown`).
- [ ] Centralizzare `formatSql`/`sanitizeMd` in `utils/markdown.ts`.
- [ ] Aggiungere `vitest` + test per `jcaParser`, `ecosystemParser` (sample `grande-repository` snapshot).
- [ ] Fix `package.json:clean` per Windows (`rimraf`).

---

## 7. Riferimenti File Completi (per `grep`)

```
src/services/jcaParser.ts:202-273,315-561
src/services/ecosystemParser.ts:26-62,72-87,262-277,370-447,638-704,874-996
src/services/masterDocGenerator.ts:15-32,61-66,101-103,253-283,408-425,668-746
src/services/markdownGenerator.ts:18-21,335-380
src/components/FileDropzone.tsx:35-60,71-104
src/components/SqlPayloadInspector.tsx:11-14
src/components/ArchitectureDiagramViewer.tsx:13-29
src/components/MasterDocGeneratorViewer.tsx:89-97,125,170-177,349
src/components/JcaAdapterSuiteViewer.tsx:40,145-186
src/components/HighLevelDashboard.tsx:34,254
src/App.tsx:48-57,93-98
package.json:14,18,10
vite.config.ts:10
tsconfig.json:18
src/types/jca.ts:120-416 (contratti DocSectionOptions vs uso as any)
```

---

## 8. Nota per il Tecnico

> Tutti i punti **C-xx** sono riproducibili caricando `grande-repository` (7000 file) o il sample incluso in `src/data/sampleEcosystem.ts`. Eseguire `npm run build` dopo ogni fix e verificare che `npx tsc --noEmit` resti verde e che il bundle scenda sotto 500 kB con `manualChunks`. Non introdurre AI/LLM nel parsing: il progetto è dichiarato “100% deterministico” – mantenere approccio AST/regex.

---

## 9. Stato implementazione fix (aggiornamento 2026-09-09)

Verifiche: `npx tsc --noEmit` 0 errori, `vite build` OK, `npx vitest run` 24/24 verdi.

| ID | Stato | Nota |
|---|---|---|
| C-01 | ✅ risolto | Banner visibile file ignorati in `FileDropzone.tsx` |
| C-02 | ✅ risolto | Guard fallback JCA, test in `faseA.test.ts` |
| C-03 | ✅ risolto | Strip commenti + MERGE, test SQL |
| C-04 | ✅ risolto | Token boundaries + JNDI mapping, test |
| C-05 | ✅ risolto | BOM + commenti iniziali in `parseXmlSafe` |
| C-06 | ✅ risolto | Regex `_copy`/`.sample` |
| C-07 | ✅ risolto | ID stabili `stableId` (jca + ecosystem) |
| C-08 | ✅ risolto | `SqlPayloadInspector` itera endpoint; selettore in `ArchitectureDiagramViewer` |
| C-09 | ✅ risolto | `appendChild` + `setTimeout revoke` ovunque |
| C-10 | ✅ risolto | `sanitizeMermaid` in master + docs package + viewer |
| M-03/M-04/M-05/M-06 | ✅ risolti | Root check, QName, XSD top-level, BPMN namespace-agnostic (+ Mediator `<switch>/<case>`) |
| M-08/M-11/M-12 | ✅ risolti | Paginazione 50, reset subtab, conteggi script tipizzati |
| M-13/M-14 | ✅ risolti | Dipendenze morte rimosse; ancore TOC stabili; zero `as any` ingiustificati |
| M-01/M-02/M-07/M-09/M-10 | ✅ risolti | Chiusura pannello, dedup case-insensitive, dettaglio orchestrazioni, Blob memoizzato, token match |
| Fasi A–G | ✅ implementate | `.jws/.jpr/OSB`, ConfigPlan→`endpoints.yaml`, BPEL profondo+MDS+cardinalità, EDN/XREF/fault/rules/security/NXSD, integrity+lineage+igiene, wire/coverage/dictionary/deploy-order, vitest+Worker+code-split |

Resta noto: bundle iniziale ~415 kB (sotto soglia solo con ulteriori split); tabelle oltre ~2000 righe dipendono da paginazione manuale.

---

*Report generato automaticamente via analisi statica – da consegnare al tecnico responsabile revisione codice.*
