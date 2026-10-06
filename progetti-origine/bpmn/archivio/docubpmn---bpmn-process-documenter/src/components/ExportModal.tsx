import React, { useState } from 'react';
import { Download, FileText, Code, Printer, X, Check, Copy, Folder } from 'lucide-react';
import { BpmnDocumentation, IntegratedFolderDoc } from '../types';
import { getFriendlyTypeName } from '../utils/bpmnParser';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  doc?: BpmnDocumentation;
  integratedDoc?: IntegratedFolderDoc;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, doc, integratedDoc }) => {
  const [copiedMd, setCopiedMd] = useState(false);
  const [exportMode, setExportMode] = useState<'single' | 'folder'>(integratedDoc ? 'folder' : 'single');

  if (!isOpen) return null;

  const generateFolderMarkdown = (): string => {
    if (!integratedDoc) return '';
    return `# Documentazione Incrociata del Portafoglio Processi: ${integratedDoc.folderName}

**Totale File BPMN Caricati:** ${integratedDoc.totalFiles}  
**Data di Generazione:** ${new Date(integratedDoc.generatedAt).toLocaleString()}  
**Lingua:** ${integratedDoc.language.toUpperCase()}  

---

## 1. Sintesi Esecutiva del Portafoglio Processi
${integratedDoc.executiveSummary}

### 1.1 Complessità Ciclomatica del Portafoglio (McCabe Heatmap)
- **Media Complessità Portafoglio:** **v(G) = ${integratedDoc.averageComplexity || 0}**
- **Ranking di Complessità dei Processi:**
${integratedDoc.processComplexityRanking ? integratedDoc.processComplexityRanking.map((p, i) => `${i + 1}. **${p.processName}** (\`${p.fileName}\`): Score v(G) = **${p.score}** (${p.ratingLabel})`).join('\n') : '*Nessun dato.*'}

---

## 2. Tabella Comparativa dei Processi nella Cartella

| # | Nome Processo | ID Processo | Nome File | Task | Gateway | Lanes | Call Activities |
|---|---|---|---|---|---|---|---|
${integratedDoc.processSummaries.map((p, i) => `| ${i + 1} | **${p.processName}** | \`${p.processId}\` | \`${p.fileName}\` | ${p.tasksCount} | ${p.gatewaysCount} | ${p.lanesCount} | ${p.callActivitiesCount} |`).join('\n')}

---

## 3. Dipendenze e Chiamate Incrociate (Call Activities & Triggers)

${integratedDoc.crossLinks.length > 0 ? integratedDoc.crossLinks.map((l, i) => `
### ${i + 1}. Invocazione: ${l.sourceElementName} (\`${l.linkType}\`)
- **Processo Origine:** **${l.sourceProcessName}** (\`${l.sourceFileName}\`)
- **Processo Destinazione:** **${l.targetProcessName || 'Sottoprocesso Esterno'}**
- **Descrizione:** ${l.description}
`).join('\n') : '*Nessuna Call Activity esplicita rilevata tra i moduli.*'}

---

## 4. Matrice RACI Consolidata del Portafoglio

| Attività [Processo] | Responsible (R) | Accountable (A) | Consulted (C) | Informed (I) |
|---|---|---|---|---|
${integratedDoc.consolidatedRaci.map(m => `| ${m.taskName} | **${m.responsible}** | **${m.accountable}** | ${m.consulted} | ${m.informed} |`).join('\n')}

---

## 5. Ruoli Condivisi Tra I Processi

${integratedDoc.sharedRoles.map(r => `
### Ruolo: ${r.roleName}
- **Processi Coinvolti:** ${r.participatingProcesses.join(', ')}
- **Totale Task Assegnati:** ${r.totalTasksAcrossFolder}
`).join('\n')}

---

## 6. Catena del Valore End-to-End Enterprise (Value Stream)

${integratedDoc.endToEndValueStream.map(v => `
### Fase ${v.stepNumber}: ${v.phaseName}
- **ID Processo:** \`${v.processId}\`
- **Input Chiave:** ${v.keyInputs.join(', ')}
- **Output Prodotti:** ${v.keyOutputs.join(', ')}
${v.handoverTo ? `- **Passaggio di Consegne (Handover):** &rarr; ${v.handoverTo}` : ''}
`).join('\n')}

---

## 7. Rischi di Integrazione e Bottleneck tra Processi

| Rischio Identificato | Processi Coinvolti | Impatto Operativo | Mitigazione Consigliata |
|---|---|---|---|
${integratedDoc.crossProcessRisks.map(r => `| **${r.risk}** | ${r.involvedProcesses.join(', ')} | ${r.impact} | ${r.mitigation} |`).join('\n')}

---

## 8. Guida Utente Operativa del Portafoglio

${integratedDoc.integratedOperationalGuide}
`;
  };

  /**
   * Genera una documentazione in formato Markdown (.md) esaustiva e completa
   * strutturata esattamente nelle 8 sezioni principali.
   */
  const generateExhaustiveMarkdown = (): string => {
    if (!doc) return '';
    return `# Documentazione esaustiva del Processo BPMN: ${doc.processName}

**ID Processo:** \`${doc.processId}\`  
**Versione Documento:** ${doc.version || '1.0'}  
**Data di Generazione:** ${new Date(doc.generatedAt).toLocaleString()}  
**Lingua:** ${doc.language.toUpperCase()}  

---

## 1. Sintesi e obiettivi (Executive Summary & Objectives)

### 1.1 Sintesi Esecutiva
${doc.executiveSummary}

### 1.2 Target Audience
${doc.targetAudience}

### 1.3 Obiettivi Strategici e Risultati Attesi
${doc.businessObjectives.map((o, i) => `${i + 1}. **${o}**`).join('\n')}

### 1.4 Indice di Complessità Ciclomatica (McCabe Cyclomatic Score)
- **Score v(G):** **${doc.cyclomaticComplexity.score}**
- **Livello di Complessità:** **${doc.cyclomaticComplexity.ratingLabel}**
- **Formula Matematica:** v(G) = ${doc.cyclomaticComplexity.edgesCount} (Archi) - ${doc.cyclomaticComplexity.nodesCount} (Nodi) + 2 * ${doc.cyclomaticComplexity.connectedComponents} (Pools) = ${doc.cyclomaticComplexity.score}
- **Punti Decisionali (Gateway Split):** ${doc.cyclomaticComplexity.gatewayDecisionPoints}
- **Densità Gateway:** ${doc.cyclomaticComplexity.gatewayDensityRatio}%
- **Valutazione:** ${doc.cyclomaticComplexity.explanation}
- **Raccomandazioni di Semplificazione:**
${doc.cyclomaticComplexity.recommendations.map(r => `  - ${r}`).join('\n')}

---

## 2. Fasi del processo (Sequential Process Steps)

### Tabella Sintetica delle Fasi
| # | Fase / Attività | ID Elemento | Tipo BPMN | Attore Responsabile | Descrizione | Input / Output |
|---|---|---|---|---|---|---|
${doc.processSteps.map(s => {
  const inputsStr = s.inputs && s.inputs.length > 0 ? s.inputs.join(', ') : '-';
  const outputsStr = s.outputs && s.outputs.length > 0 ? s.outputs.join(', ') : '-';
  return `| ${s.stepNumber} | **${s.name}** | \`${s.elementId}\` | ${getFriendlyTypeName(s.type)} | **${s.actorRole}** | ${s.description} | IN: ${inputsStr}<br>OUT: ${outputsStr} |`;
}).join('\n')}

### Schede Dettagliate delle Fasi
${doc.processSteps.map(s => `
#### Fase ${s.stepNumber}: ${s.name}
- **ID Elemento:** \`${s.elementId}\`
- **Tipo BPMN:** ${getFriendlyTypeName(s.type)} (\`${s.type}\`)
- **Ruolo Incaricato:** **${s.actorRole}**
- **Descrizione Operativa:** ${s.description}
- **Input Richiesti:** ${s.inputs?.join(', ') || 'Nessuno'}
- **Output Prodotti:** ${s.outputs?.join(', ') || 'Nessuno'}
${s.decisionRules ? `- **Regola Decisionale:** \`${s.decisionRules}\`` : ''}
`).join('\n')}

---

## 3. Matrice RACI (Responsabilità)

| Attività del Processo | Elemento ID | Responsible (R) | Accountable (A) | Consulted (C) | Informed (I) |
|---|---|---|---|---|---|
${doc.raciMatrix.map(m => `| ${m.taskName} | \`${m.elementId}\` | **${m.responsible}** | **${m.accountable}** | ${m.consulted} | ${m.informed} |`).join('\n')}

---

## 4. Ruoli e Partecipanti (Pools & Lanes)

${doc.rolesAndParticipants.map(r => `
### Ruolo: ${r.name} (${r.type})
- **Tipologia BPMN:** ${r.type}
- **Task Assegnati:** ${r.assignedTasksCount} attività
- **Descrizione e Ambito di Responsabilità:** ${r.description}
`).join('\n')}

---

## 5. Gateway e Regole Decisionali

${doc.gateways.length > 0 ? doc.gateways.map(g => `
### Gateway: ${g.name}
- **ID Gateway:** \`${g.id}\`
- **Tipo Gateway:** ${getFriendlyTypeName(g.type)} (\`${g.type}\`)
- **Ramificazioni e Condizioni:**
${g.branches.map(b => `  - **Condizione:** \`${b.condition}\` &rarr; **Destinazione:** ${b.target}`).join('\n')}
`).join('\n') : '*Nessun gateway decisionale presente nel diagramma.*'}

---

## 6. Rischi e ottimizzazioni

### 6.1 Rischi, Eccezioni e Punti Critici
| Posizione / Componente | Rischio Identificato | Strategia di Mitigazione Raccomandata |
|---|---|---|
${doc.risksAndExceptions.map(r => `| **${r.location}** | ${r.risk} | ${r.mitigation} |`).join('\n')}

### 6.2 Raccomandazioni di Ottimizzazione del Processo
${doc.optimizationSuggestions.map((opt, i) => `${i + 1}. **${opt}**`).join('\n')}

---

## 7. Casi di test (Functional Test Scenarios)

${doc.testScenarios.map(tc => `
### ${tc.id}: ${tc.title}
- **Pre-condizioni:** ${tc.preconditions}
- **Sequenza di Fasi da Eseguire:**
${tc.pathSteps.map(step => `  1. ${step}`).join('\n')}
- **Risultato Atteso:** **${tc.expectedResult}**
`).join('\n')}

---

## 8. Guida utente operativa (User Manual Guide)

${doc.userManualGuide}
`;
  };

  const activeMarkdown = exportMode === 'folder' && integratedDoc ? generateFolderMarkdown() : generateExhaustiveMarkdown();
  const exportFileName = exportMode === 'folder' && integratedDoc
    ? `${integratedDoc.folderName.toLowerCase().replace(/\s+/g, '-')}-incrociato.md`
    : `${(doc?.processName || 'processo').toLowerCase().replace(/\s+/g, '-')}-esaustivo.md`;

  const handleDownloadMd = () => {
    const blob = new Blob([activeMarkdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = exportFileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyMd = () => {
    navigator.clipboard.writeText(activeMarkdown);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2000);
  };

  const handleDownloadJson = () => {
    const dataObj = exportMode === 'folder' && integratedDoc ? integratedDoc : doc;
    const jsonStr = JSON.stringify(dataObj, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = exportFileName.replace('.md', '.json');
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-scaleUp">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">Esporta Documentazione</h3>
              <p className="text-xs text-slate-500">Scarica il report esaustivo in formato Markdown (.md) o JSON</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Toggle if integratedDoc is present */}
        {integratedDoc && doc && (
          <div className="mt-4 flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setExportMode('folder')}
              className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                exportMode === 'folder'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Folder className="w-3.5 h-3.5" />
              Documentazione Incrociata Cartella
            </button>
            <button
              onClick={() => setExportMode('single')}
              className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                exportMode === 'single'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Processo Singolo
            </button>
          </div>
        )}

        {/* Options */}
        <div className="mt-6 space-y-3">
          
          {/* Download Markdown (.md) */}
          <button
            onClick={handleDownloadMd}
            className="w-full p-4 rounded-xl border border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50 hover:border-indigo-500 flex items-center gap-4 text-left transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-slate-900 group-hover:text-indigo-600">
                  {exportMode === 'folder' ? 'Esporta Markdown Cartella Incrociata (.md)' : 'Scarica Report Markdown Esaustivo (.md)'}
                </h4>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                  Consigliato
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {exportMode === 'folder' 
                  ? 'Include la sintesi di tutti i file BPMN, chiamate incrociate, RACI consolidata e guida di portafoglio.'
                  : 'Include tutte le 8 sezioni complete (Sintesi, Fasi, RACI, Ruoli, Gateway, Rischi, Test, Guida Operativa).'
                }
              </p>
            </div>
          </button>

          {/* Copy Markdown to Clipboard */}
          <button
            onClick={handleCopyMd}
            className="w-full p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 flex items-center gap-3 text-left transition-all"
          >
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
              {copiedMd ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </div>
            <div>
              <h4 className="font-bold text-xs text-slate-900">
                {copiedMd ? 'Markdown Copiato negli Appunti!' : 'Copia Testo Markdown Completo'}
              </h4>
              <p className="text-[11px] text-slate-500">Pronto da incollare in Notion, Confluence, GitHub o Wiki.</p>
            </div>
          </button>

          {/* Print / Save PDF */}
          <button
            onClick={handlePrintPdf}
            className="w-full p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 flex items-center gap-3 text-left transition-all"
          >
            <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-xs text-slate-900">Stampa / Salva in PDF (Report Stampa)</h4>
              <p className="text-[11px] text-slate-500">Genera la versione cartacea o PDF della schermata corrente.</p>
            </div>
          </button>

          {/* Structured JSON */}
          <button
            onClick={handleDownloadJson}
            className="w-full p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 flex items-center gap-3 text-left transition-all"
          >
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Code className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-xs text-slate-900">Esporta Dati JSON (.json)</h4>
              <p className="text-[11px] text-slate-500">Struttura dati tecnica completa in formato JSON.</p>
            </div>
          </button>

        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
          >
            Chiudi
          </button>
        </div>

      </div>
    </div>
  );
};

