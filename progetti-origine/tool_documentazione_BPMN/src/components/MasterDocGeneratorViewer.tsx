import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Download,
  Copy,
  Check,
  FileText,
  Settings2,
  Sparkles,
  Eye,
  Code2,
  FileDown,
  Archive,
  RefreshCw,
} from 'lucide-react';
import JSZip from 'jszip';
import { DocSectionOptions, MasterDocGenOptions, OracleEcosystem } from '../types/jca';
import { generateHighLevelArchitectureDoc } from '../services/masterDocGenerator';
import { generateJcaMarkdown } from '../services/markdownGenerator';

interface MasterDocGeneratorViewerProps {
  ecosystem: OracleEcosystem;
}

export const MasterDocGeneratorViewer: React.FC<MasterDocGeneratorViewerProps> = ({ ecosystem }) => {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'raw'>('preview');
  const [language, setLanguage] = useState<'it' | 'en'>('it');
  const [isExportingZip, setIsExportingZip] = useState(false);

  const [sections, setSections] = useState<DocSectionOptions>({
    includeSummary: true,
    includeArchitectureTopology: true,
    includeCompositesMatrix: true,
    includeProcessesBpmnBpel: true,
    includeMediatorsCatalog: true,
    includeHumanTasksCatalog: true,
    includeJcaMatrix: true,
    includeWsdlXsdCatalog: true,
    includeXsltCatalog: true,
    includeComponentTypeCatalog: true,
    includeDvmCatalog: true,
    includeAdfBindings: true,
    includeDevOpsChecklist: true,
    includeMermaidDiagrams: true,
  });

  const toggleSection = (key: keyof DocSectionOptions) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectAllSections = (val: boolean) => {
    setSections({
      includeSummary: val,
      includeArchitectureTopology: val,
      includeCompositesMatrix: val,
      includeProcessesBpmnBpel: val,
      includeMediatorsCatalog: val,
      includeHumanTasksCatalog: val,
      includeJcaMatrix: val,
      includeWsdlXsdCatalog: val,
      includeXsltCatalog: val,
      includeComponentTypeCatalog: val,
      includeDvmCatalog: val,
      includeAdfBindings: val,
      includeDevOpsChecklist: val,
      includeMermaidDiagrams: val,
    });
  };

  const markdownContent = useMemo(() => {
    const options: MasterDocGenOptions = {
      language,
      sections,
      docTitle: language === 'it' ? 'Documento di Architettura di Alto Livello & Specifiche Tecniche' : 'High-Level Architecture & Technical Specification Document',
      applicationName: 'Oracle Fusion Middleware - SOA Suite & ADF Ecosystem',
    };
    return generateHighLevelArchitectureDoc(ecosystem, options);
  }, [ecosystem, language, sections]);

  const handleCopy = () => {
    navigator.clipboard.writeText(markdownContent).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = markdownContent;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  };

  const handleDownloadMd = () => {
    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
    triggerDownload(blob, `HIGH_LEVEL_ARCHITECTURE_DOC_${new Date().toISOString().slice(0, 10)}.md`);
  };

  const handleDownloadHtml = () => {
    const htmlTemplate = `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <title>Oracle SOA & ADF Architecture Master Document</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    .markdown-body table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; font-size: 0.875rem; }
    .markdown-body th, .markdown-body td { border: 1px solid #e2e8f0; padding: 0.75rem 1rem; text-align: left; }
    .markdown-body th { background-color: #f8fafc; font-weight: 600; }
    .markdown-body tr:nth-child(even) { background-color: #fcfdfe; }
    .markdown-body code { background-color: #f1f5f9; padding: 0.2rem 0.4rem; border-radius: 0.25rem; font-size: 0.85em; font-family: monospace; }
    .markdown-body pre code { background-color: transparent; padding: 0; }
    .markdown-body pre { background-color: #0f172a; color: #f8fafc; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; }
    .markdown-body h1 { font-size: 2rem; font-weight: 800; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; margin-top: 2rem; margin-bottom: 1rem; }
    .markdown-body h2 { font-size: 1.5rem; font-weight: 700; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.3rem; margin-top: 1.75rem; margin-bottom: 0.75rem; }
    .markdown-body h3 { font-size: 1.25rem; font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.5rem; }
    .markdown-body blockquote { border-left: 4px solid #6366f1; padding-left: 1rem; color: #475569; margin: 1rem 0; font-style: italic; }
  </style>
</head>
<body class="bg-slate-50 text-slate-900 min-h-screen py-10 px-4 sm:px-6 lg:px-8">
  <div class="max-w-5xl mx-auto bg-white p-8 sm:p-12 rounded-2xl shadow-xl border border-slate-200 markdown-body" id="content"></div>
  <script>
    const markdown = ${JSON.stringify(markdownContent)};
    document.getElementById('content').innerHTML = marked.parse(markdown);
  </script>
</body>
</html>`;

    const blob = new Blob([htmlTemplate], { type: 'text/html;charset=utf-8' });
    triggerDownload(blob, `HIGH_LEVEL_ARCHITECTURE_DOC_${new Date().toISOString().slice(0, 10)}.html`);
  };

  const handleExportZip = async () => {
    setIsExportingZip(true);
    try {
      const zip = new JSZip();

      // 1. Master High-Level Architecture Document
      zip.file('HIGH_LEVEL_SYSTEM_ARCHITECTURE.md', markdownContent);

      // 2. Folder for Composites
      const compositesFolder = zip.folder('01_SCA_Composites');
      if (compositesFolder) {
        ecosystem.composites.forEach((comp) => {
          let compDoc = `# Composito SCA: ${comp.name}\n\n`;
          compDoc += `- Revisione: ${comp.revision || '1.0'}\n- Namespace: ${comp.targetNamespace}\n\n`;
          compDoc += `## Servizi Inbound\n` + comp.services.map((s) => `- ${s.name} (${s.bindingType})`).join('\n') + '\n\n';
          compDoc += `## Componenti Interni\n` + comp.components.map((c) => `- ${c.name} [${c.type}]`).join('\n') + '\n\n';
          compDoc += `## Riferimenti Outbound\n` + comp.references.map((r) => `- ${r.name} (${r.bindingType})`).join('\n');
          compositesFolder.file(`${comp.name}.md`, compDoc);
        });
      }

      // 3. Folder for JCA Adapters
      const jcaFolder = zip.folder('02_JCA_Adapters');
      if (jcaFolder) {
        ecosystem.jcaAdapters.forEach((jca) => {
          const jcaMd = generateJcaMarkdown(jca, { language, includeRawXml: true });
          jcaFolder.file(`${jca.name}.md`, jcaMd);
        });
      }

      // 4. Folder for Orchestrations (BPMN / BPEL / Mediators / Tasks) – dettaglio completo M-07
      const orchFolder = zip.folder('03_Orchestrations_and_Processes');
      if (orchFolder) {
        ecosystem.bpmnProcesses.forEach((p) => {
          let md = `# Processo BPMN: ${p.name}\n\n- File: ${p.relativePath}\n- Swimlanes: ${p.swimlanes.join(', ') || 'N/D'}\n\n`;
          md += `## User Tasks (${p.userTasks.length})\n` + p.userTasks.map((ut) => `- ${ut.name} (${ut.id})`).join('\n') + '\n\n';
          md += `## Service Tasks (${p.serviceTasks.length})\n` + p.serviceTasks.map((st) => `- ${st.name} (${st.id}) impl: ${st.implementation || 'N/D'}`).join('\n') + '\n\n';
          md += `## Gateways (${p.gateways.length})\n` + p.gateways.map((g) => `- ${g.name} [${g.type}]`).join('\n') + '\n\n';
          md += `## Events (${p.events.length})\n` + p.events.map((e) => `- ${e.name} [${e.type}]`).join('\n');
          orchFolder.file(`BPMN_${p.name}.md`, md);
        });
        ecosystem.bpelProcesses.forEach((p) => {
          let md = `# Processo BPEL: ${p.name}\n\n- File: ${p.relativePath}\n\n`;
          md += `## Partner Links\n` + p.partnerLinks.map((pl) => `- ${pl.name} (${pl.partnerLinkType})`).join('\n') + '\n\n';
          md += `## Invokes (${p.invokes.length})\n` + p.invokes.map((inv) => `- ${inv.partnerLink}.${inv.operation} in:${inv.inputVariable||'-'} out:${inv.outputVariable||'-'}`).join('\n') + '\n\n';
          md += `## Receives (${p.receives.length})\n` + p.receives.map((r) => `- ${r.partnerLink}.${r.operation}`).join('\n') + '\n\n';
          md += `## Fault Handlers\n` + p.faultHandlers.join(', ');
          orchFolder.file(`BPEL_${p.name}.md`, md);
        });
        ecosystem.mediators.forEach((m) => {
          let md = `# Mediator: ${m.name}\n\n- File: ${m.relativePath}\n\n`;
          m.operations.forEach((op) => {
            md += `## Operazione: ${op.name}\n`;
            op.routingRules.forEach((rr, idx) => {
              md += `- Regola #${idx + 1}: ${rr.actionType} -> ${rr.targetService||'Self'} filter:${rr.filterExpression||'none'} xslt:${rr.transformations.join(',')||'none'}\n`;
            });
          });
          orchFolder.file(`Mediator_${m.name}.md`, md);
        });
        ecosystem.humanTasks.forEach((t) => {
          let md = `# Human Task: ${t.name}\n\n- File: ${t.relativePath}\n- Priorità: ${t.priority}\n- Titolo: ${t.title||'N/D'}\n\n`;
          md += `## Outcomes\n` + t.outcomes.join(', ') + '\n\n';
          md += `## Participants\n` + t.participants.join(', ') + '\n\n';
          md += `## Payload Elements\n` + t.payloadElements.join(', ');
          orchFolder.file(`Task_${t.name}.md`, md);
        });
      }

      const content = await zip.generateAsync({ type: 'blob' });
      triggerDownload(content, `Oracle_SOA_Architecture_Documentation_Package_${new Date().toISOString().slice(0, 10)}.zip`);
    } catch (err) {
      console.error('Failed to export ZIP package', err);
    } finally {
      setIsExportingZip(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn" id="master-doc-generator-viewer">
      {/* Control Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              Generatore Documentazione Architetturale & Tecnica
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Genera istantaneamente il documento unificato in formato Markdown standard o esporta l'intero archivio strutturato
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Language Toggle */}
            <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200 text-xs">
              <button
                onClick={() => setLanguage('it')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  language === 'it' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🇮🇹 Italiano
              </button>
              <button
                onClick={() => setLanguage('en')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  language === 'en' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🇬🇧 English
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200 text-xs">
              <button
                onClick={() => setViewMode('preview')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium transition-all ${
                  viewMode === 'preview' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Anteprima
              </button>
              <button
                onClick={() => setViewMode('raw')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium transition-all ${
                  viewMode === 'raw' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                Sorgente (.md)
              </button>
            </div>

            {/* Action Buttons */}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copiato!' : 'Copia'}
            </button>

            <button
              onClick={handleDownloadMd}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs shadow-sm transition-all active:scale-95"
            >
              <Download className="w-4 h-4" />
              Scarica (.md)
            </button>

            <button
              onClick={handleDownloadHtml}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs transition-all"
            >
              <FileDown className="w-4 h-4" />
              HTML
            </button>

            <button
              onClick={handleExportZip}
              disabled={isExportingZip}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-medium text-xs shadow-sm transition-all"
            >
              <Archive className="w-4 h-4" />
              {isExportingZip ? 'Creazione ZIP...' : 'Esporta ZIP Completo'}
            </button>
          </div>
        </div>

        {/* Section Filters */}
        <div className="pt-3 border-t border-slate-100 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
            <span className="flex items-center gap-1.5">
              <Settings2 className="w-3.5 h-3.5 text-slate-500" />
              Sezioni incluse nel documento:
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => selectAllSections(true)}
                className="text-indigo-600 hover:underline text-[11px]"
              >
                Seleziona Tutte
              </button>
              <span>•</span>
              <button
                onClick={() => selectAllSections(false)}
                className="text-slate-500 hover:underline text-[11px]"
              >
                Deseleziona Tutte
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {[
              { key: 'includeSummary', label: '1. Sintesi & Inventario' },
              { key: 'includeArchitectureTopology', label: '2. Topologia SCA' },
              { key: 'includeProcessesBpmnBpel', label: '3. BPMN & BPEL' },
              { key: 'includeMediatorsCatalog', label: '3.3 Mediators (.mplan)' },
              { key: 'includeHumanTasksCatalog', label: '3.4 Human Tasks (.task)' },
              { key: 'includeJcaMatrix', label: '4. Adapter JCA & JNDI' },
              { key: 'includeWsdlXsdCatalog', label: '5. WSDL & XSD' },
              { key: 'includeComponentTypeCatalog', label: '5.3 ComponentType' },
              { key: 'includeDvmCatalog', label: '5.4 DVM' },
              { key: 'includeXsltCatalog', label: '6. XSLT Trasformazioni' },
              { key: 'includeAdfBindings', label: '7. ADF Data Controls' },
              { key: 'includeDevOpsChecklist', label: '8. DevOps & WLST' },
              { key: 'includeMermaidDiagrams', label: '9. Diagrammi Mermaid' },
            ].map(({ key, label }) => {
              const active = sections[key as keyof DocSectionOptions];
              return (
                <button
                  key={key}
                  onClick={() => toggleSection(key as keyof DocSectionOptions)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                    active
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                      : 'bg-slate-50 border-slate-200 text-slate-400 line-through'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Document Content View */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-10 shadow-sm">
        {viewMode === 'preview' ? (
          <div className="prose prose-slate max-w-none prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-table:w-full prose-table:border-collapse prose-th:bg-slate-50 prose-th:p-2.5 prose-th:border prose-th:border-slate-200 prose-td:p-2.5 prose-td:border prose-td:border-slate-200 prose-code:bg-slate-100 prose-code:p-1 prose-code:rounded prose-code:text-xs">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {markdownContent}
            </ReactMarkdown>
          </div>
        ) : (
          <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl overflow-x-auto text-xs font-mono leading-relaxed max-h-[700px]">
            {markdownContent}
          </pre>
        )}
      </div>
    </div>
  );
};
