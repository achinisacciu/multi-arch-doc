import React, { useState, useMemo } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { JCAAdapterConfig, MarkdownGenOptions, JcaDocSectionOptions } from '../types/jca';
import { generateJcaMarkdown, DEFAULT_DOC_SECTIONS } from '../services/markdownGenerator';
import {
  FileText,
  Copy,
  Check,
  Download,
  Eye,
  Code,
  Globe,
  Settings2,
  FileCode,
  Printer,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface MarkdownDocViewerProps {
  config: JCAAdapterConfig;
}

export const MarkdownDocViewer: React.FC<MarkdownDocViewerProps> = ({ config }) => {
  const [viewMode, setViewMode] = useState<'rendered' | 'raw'>('rendered');
  const [showSectionConfig, setShowSectionConfig] = useState(false);
  const [sections, setSections] = useState<JcaDocSectionOptions>(DEFAULT_DOC_SECTIONS);
  const [language, setLanguage] = useState<'it' | 'en'>('it');
  const [copied, setCopied] = useState(false);

  const docOptions: MarkdownGenOptions = useMemo(() => ({
    language,
    sections,
  }), [language, sections]);

  // Generate markdown dynamically based on user options
  const generatedMarkdown = useMemo(() => {
    return generateJcaMarkdown(config, docOptions);
  }, [config, docOptions]);

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMd = () => {
    const blob = new Blob([generatedMarkdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${config.name}_Technical_Documentation.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadHtml = () => {
    const htmlContent = `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <title>${config.name} - Technical Documentation</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; max-width: 960px; margin: 40px auto; padding: 0 20px; color: #1e293b; background: #f8fafc; }
    h1, h2, h3, h4 { color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
    code { background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.9em; }
    pre { background: #0f172a; color: #38bdf8; padding: 16px; border-radius: 8px; overflow-x: auto; }
    pre code { background: none; padding: 0; color: inherit; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; background: #ffffff; }
    th, td { border: 1px solid #cbd5e1; padding: 10px 14px; text-align: left; font-size: 0.9em; }
    th { background: #f1f5f9; font-weight: 600; }
    blockquote { border-left: 4px solid #6366f1; padding-left: 16px; color: #475569; margin: 16px 0; background: #eef2ff; padding: 12px 16px; border-radius: 4px; }
    ul, ol { padding-left: 24px; }
  </style>
</head>
<body>
  <div style="background: #eef2ff; padding: 16px; border-radius: 8px; margin-bottom: 24px; border: 1px solid #c7d2fe;">
    <strong>JCA Adapter:</strong> ${config.name} (${config.adapter.toUpperCase()}) | <strong>File:</strong> ${config.relativePath || config.fileName}
  </div>
  <pre style="white-space: pre-wrap; font-family: inherit; background: none; color: inherit; padding: 0;">${generatedMarkdown.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
</body>
</html>`;
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${config.name}_Documentation.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div id="markdown-doc-viewer-container" className="space-y-6">
      {/* Options & Action Bar */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        {/* Left: View Mode & Language Selector */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Rendered vs Raw Toggle */}
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              id="view-rendered-btn"
              onClick={() => setViewMode('rendered')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                viewMode === 'rendered'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Anteprima Formattata</span>
            </button>
            <button
              id="view-raw-btn"
              onClick={() => setViewMode('raw')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                viewMode === 'raw'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>Markdown Sorgente (.md)</span>
            </button>
          </div>

          {/* Language Toggle */}
          <div className="flex items-center bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-xs">
            <Globe className="w-3.5 h-3.5 text-slate-400 mr-2" />
            <button
              id="lang-it-btn"
              onClick={() => setLanguage('it')}
              className={`px-2 py-0.5 rounded font-medium transition ${
                language === 'it' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Italiano
            </button>
            <button
              id="lang-en-btn"
              onClick={() => setLanguage('en')}
              className={`px-2 py-0.5 rounded font-medium transition ml-1 ${
                language === 'en' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              English
            </button>
          </div>

          {/* Filter Sections Dropdown Toggle */}
          <button
            onClick={() => setShowSectionConfig(!showSectionConfig)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-medium text-slate-300 hover:text-white"
          >
            <Settings2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Filtra Sezioni Doc</span>
            {showSectionConfig ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Right: Export Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            id="copy-markdown-btn"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 transition shadow-sm"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copiato!' : 'Copia Markdown'}</span>
          </button>

          <button
            id="download-md-btn"
            onClick={handleDownloadMd}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500 transition shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>Scarica .md</span>
          </button>

          <button
            id="download-html-btn"
            onClick={handleDownloadHtml}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 transition shadow-sm"
          >
            <FileCode className="w-4 h-4 text-amber-400" />
            <span>Esporta HTML</span>
          </button>

          <button
            onClick={handlePrint}
            title="Stampa / Salva in PDF"
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700 transition"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Collapsible Sections Inclusion Bar */}
      {showSectionConfig && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-md">
          <div className="flex items-center justify-between mb-3 text-xs font-semibold text-slate-300">
            <span>Configura sezioni da includere nel documento Markdown:</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-xs text-slate-300">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sections.includeSummary}
                onChange={(e) => setSections({ ...sections, includeSummary: e.target.checked })}
                className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Sintesi & Obiettivo</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sections.includeJndiSpecs}
                onChange={(e) => setSections({ ...sections, includeJndiSpecs: e.target.checked })}
                className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Specifiche JNDI (Punto 2)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sections.includeEndpoints}
                onChange={(e) => setSections({ ...sections, includeEndpoints: e.target.checked })}
                className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Endpoint & Operazioni</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sections.includeSqlAnalysis}
                onChange={(e) => setSections({ ...sections, includeSqlAnalysis: e.target.checked })}
                className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Analisi SQL / Payload</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sections.includePropertiesCatalog}
                onChange={(e) => setSections({ ...sections, includePropertiesCatalog: e.target.checked })}
                className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Catalogo Proprietà</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sections.includeTransactionProfile}
                onChange={(e) => setSections({ ...sections, includeTransactionProfile: e.target.checked })}
                className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Profilo Transazioni XA</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sections.includeMermaid}
                onChange={(e) => setSections({ ...sections, includeMermaid: e.target.checked })}
                className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Diagrammi Mermaid</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sections.includeDevOpsChecklist}
                onChange={(e) => setSections({ ...sections, includeDevOpsChecklist: e.target.checked })}
                className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Checklist DevOps</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sections.includeRawSnippet}
                onChange={(e) => setSections({ ...sections, includeRawSnippet: e.target.checked })}
                className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Appendice XML Sorgente</span>
            </label>
          </div>
        </div>
      )}

      {/* Main Document Content Area */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
        {viewMode === 'rendered' ? (
          <div className="p-8 sm:p-12 text-slate-200">
            {/* Styled Rendered Markdown Container with remarkGfm for Table Parsing */}
            <div className="prose prose-invert max-w-none space-y-6 text-sm leading-relaxed">
              <Markdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => (
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-white pb-3 border-b border-slate-800 tracking-tight">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-xl font-bold text-slate-100 mt-8 mb-4 pb-2 border-b border-slate-800/80 flex items-center gap-2">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-base font-bold text-indigo-300 mt-6 mb-3">{children}</h3>
                  ),
                  h4: ({ children }) => (
                    <h4 className="text-sm font-semibold text-slate-300 mt-4 mb-2">{children}</h4>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="bg-indigo-950/40 border-l-4 border-indigo-500 px-4 py-3 rounded-r-lg text-slate-300 text-xs my-4 shadow-sm">
                      {children}
                    </blockquote>
                  ),
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-5 rounded-lg border border-slate-700/80 shadow-md">
                      <table className="w-full text-left text-xs border-collapse bg-slate-950/90">{children}</table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead className="bg-slate-800/90 text-slate-200 font-bold border-b border-slate-700">
                      {children}
                    </thead>
                  ),
                  th: ({ children }) => (
                    <th className="p-3.5 text-slate-200 font-bold tracking-wide uppercase text-[11px] bg-slate-900 border-r border-slate-800 last:border-r-0">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="p-3.5 border-b border-slate-800/80 border-r border-slate-800/50 last:border-r-0 text-slate-300 align-top">
                      {children}
                    </td>
                  ),
                  ul: ({ children }) => <ul className="list-disc pl-5 space-y-2 my-3 text-slate-300">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-5 space-y-2 my-3 text-slate-300">{children}</ol>,
                  li: ({ children }) => <li className="text-slate-300">{children}</li>,
                  code: ({ children, className }) => {
                    const isBlock = className?.includes('language-');
                    return isBlock ? (
                      <pre className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto leading-relaxed my-3">
                        <code>{children}</code>
                      </pre>
                    ) : (
                      <code className="bg-slate-950 px-1.5 py-0.5 rounded text-indigo-300 font-mono text-[11px] border border-slate-800">
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {generatedMarkdown}
              </Markdown>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <div className="flex items-center justify-between mb-3 text-xs text-slate-400">
              <span className="font-mono">Documento Markdown Grezzo ({generatedMarkdown.split('\n').length} righe)</span>
              <span className="font-mono">{new Blob([generatedMarkdown]).size} byte</span>
            </div>
            <textarea
              readOnly
              rows={30}
              value={generatedMarkdown}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs text-slate-200 leading-relaxed focus:outline-none resize-y"
            />
          </div>
        )}
      </div>
    </div>
  );
};
