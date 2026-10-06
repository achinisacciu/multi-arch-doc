import React, { useState } from 'react';
import JSZip from 'jszip';
import { JCAAdapterConfig, JcaDocSectionOptions, MarkdownGenOptions } from '../types/jca';
import { generateJcaMarkdown, generateMasterBatchMarkdown, DEFAULT_DOC_SECTIONS } from '../services/markdownGenerator';
import {
  Download,
  FolderArchive,
  FileText,
  FileCode,
  CheckSquare,
  Square,
  Globe,
  Settings2,
  X,
  Layers,
  Database,
  Radio,
  FolderTree,
  Check,
} from 'lucide-react';

interface BatchManagerModalProps {
  configs: JCAAdapterConfig[];
  onToggleSelect: (id: string) => void;
  onSelectAll: (select: boolean) => void;
  onClose: () => void;
}

export const BatchManagerModal: React.FC<BatchManagerModalProps> = ({
  configs,
  onToggleSelect,
  onSelectAll,
  onClose,
}) => {
  const [sections, setSections] = useState<JcaDocSectionOptions>(DEFAULT_DOC_SECTIONS);
  const [language, setLanguage] = useState<'it' | 'en'>('it');
  const [isZipping, setIsZipping] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  const selectedConfigs = configs.filter((c) => c.selectedForExport);
  const allSelected = configs.length > 0 && selectedConfigs.length === configs.length;

  const docOptions: MarkdownGenOptions = {
    language,
    sections,
  };

  const handleDownloadZip = async (format: 'md' | 'html') => {
    if (selectedConfigs.length === 0) return;
    setIsZipping(true);

    try {
      const zip = new JSZip();
      const folder = zip.folder('JCA_Technical_Documentation');

      for (const config of selectedConfigs) {
        const mdContent = generateJcaMarkdown(config, docOptions);
        const folderPath = config.relativePath ? config.relativePath.replace(/\/[^/]+$/, '') : '';
        const baseName = config.name || config.fileName.replace(/\.jca$/i, '');

        let targetFolder = folder;
        if (folderPath && folderPath !== config.fileName) {
          targetFolder = folder?.folder(folderPath) || folder;
        }

        if (format === 'md') {
          targetFolder?.file(`${baseName}_Doc.md`, mdContent);
        } else {
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
    table { width: 100%; border-collapse: collapse; margin: 16px 0; background: #ffffff; }
    th, td { border: 1px solid #cbd5e1; padding: 10px 14px; text-align: left; font-size: 0.9em; }
    th { background: #f1f5f9; font-weight: 600; }
    blockquote { border-left: 4px solid #6366f1; background: #eef2ff; padding: 12px 16px; border-radius: 4px; color: #475569; }
  </style>
</head>
<body>
  <pre style="white-space: pre-wrap; font-family: inherit; background: none; color: inherit; padding: 0;">${mdContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
</body>
</html>`;
          targetFolder?.file(`${baseName}_Doc.html`, htmlContent);
        }
      }

      // Also add master index file
      const masterIndexMd = generateMasterBatchMarkdown(selectedConfigs, docOptions);
      folder?.file('00_MASTER_INDEX_DOCUMENTATION.md', masterIndexMd);

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `JCA_Documentation_Batch_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setDownloadSuccess('Archivio ZIP generato con successo!');
      setTimeout(() => setDownloadSuccess(null), 3000);
    } catch (err) {
      console.error('Error creating zip:', err);
    } finally {
      setIsZipping(false);
    }
  };

  const handleDownloadMasterMd = () => {
    if (selectedConfigs.length === 0) return;
    const masterMd = generateMasterBatchMarkdown(selectedConfigs, docOptions);
    const blob = new Blob([masterMd], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `MASTER_JCA_DOCUMENTATION_${selectedConfigs.length}_ADAPTERS.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadSuccess('Documento cumulativo scaricato!');
    setTimeout(() => setDownloadSuccess(null), 3000);
  };

  const getAdapterIcon = (adapter: string) => {
    switch (adapter) {
      case 'db':
        return <Database className="w-3.5 h-3.5 text-blue-400" />;
      case 'jms':
        return <Radio className="w-3.5 h-3.5 text-purple-400" />;
      case 'file':
      case 'ftp':
        return <FolderTree className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <Layers className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <FolderArchive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                Esportazione Batch & Configurazione Documentazione
              </h3>
              <p className="text-xs text-slate-400">
                Scegli i file da includere, personalizza le sezioni tecniche e scarica in archivio ZIP o file master cumulativo.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
          {/* Success Banner */}
          {downloadSuccess && (
            <div className="p-3 bg-emerald-950/70 border border-emerald-800 rounded-lg text-emerald-300 flex items-center gap-2 font-semibold">
              <Check className="w-4 h-4" />
              <span>{downloadSuccess}</span>
            </div>
          )}

          {/* Section 1: File Selection Matrix */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-400" />
                Seleziona File JCA ({selectedConfigs.length} di {configs.length} selezionati)
              </span>
              <button
                type="button"
                onClick={() => onSelectAll(!allSelected)}
                className="text-indigo-400 hover:underline font-semibold"
              >
                {allSelected ? 'Deseleziona tutti' : 'Seleziona tutti'}
              </button>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-slate-800/60">
              {configs.map((cfg) => (
                <div
                  key={cfg.id}
                  onClick={() => onToggleSelect(cfg.id)}
                  className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-900/80 cursor-pointer transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button type="button" className="text-slate-400">
                      {cfg.selectedForExport ? (
                        <CheckSquare className="w-4 h-4 text-indigo-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-600" />
                      )}
                    </button>
                    <div className="flex items-center gap-2 truncate">
                      {getAdapterIcon(cfg.adapter)}
                      <span className="font-mono font-bold text-slate-200 truncate">{cfg.name}</span>
                      <span className="text-[11px] font-mono text-slate-500 truncate">({cfg.relativePath})</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-slate-900 border border-slate-700 text-slate-300 uppercase">
                      {cfg.adapter}
                    </span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      {(cfg.fileSize / 1024).toFixed(1)} KB
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Sections Inclusion Checklist */}
          <div>
            <h4 className="font-bold text-slate-200 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Settings2 className="w-4 h-4 text-amber-400" />
              Cosa Includere nella Documentazione Generata
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {[
                { key: 'includeSummary', label: '1. Sintesi Architetturale & WSDL' },
                { key: 'includeJndiSpecs', label: '2. Specifiche Connection JNDI' },
                { key: 'includeEndpoints', label: '3. Endpoints & Operazioni' },
                { key: 'includeSqlAnalysis', label: '4. Dettaglio SQL / Broker / File' },
                { key: 'includePropertiesCatalog', label: '5. Catalogo Proprietà Completo' },
                { key: 'includeTransactionProfile', label: '6. Profilo Transazionale XA' },
                { key: 'includeMermaid', label: '7. Diagrammi di Flusso Mermaid' },
                { key: 'includeDevOpsChecklist', label: '8. Checklist DevOps & Plan.xml' },
                { key: 'includeRawSnippet', label: '9. Sorgente XML Originale (.jca)' },
              ].map((item) => {
                const k = item.key as keyof JcaDocSectionOptions;
                const isChecked = sections[k];
                return (
                  <label
                    key={item.key}
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition ${
                      isChecked
                        ? 'bg-slate-950 border-indigo-600/50 text-slate-200'
                        : 'bg-slate-950/40 border-slate-800 text-slate-500'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => setSections({ ...sections, [k]: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-medium">{item.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Section 3: Language Preference */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-indigo-400" />
              <span className="font-semibold text-slate-200">Lingua Documentazione:</span>
            </div>
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setLanguage('it')}
                className={`px-3 py-1 rounded font-semibold transition ${
                  language === 'it' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Italiano
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-3 py-1 rounded font-semibold transition ${
                  language === 'en' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                English
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer / Download Action Buttons */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="text-slate-400 text-xs">
            Pronto per esportare <strong>{selectedConfigs.length}</strong> file documentati.
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-end">
            <button
              type="button"
              onClick={handleDownloadMasterMd}
              disabled={selectedConfigs.length === 0 || isZipping}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 transition disabled:opacity-50"
            >
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>Scarica File Unico Cumulativo (.md)</span>
            </button>

            <button
              type="button"
              onClick={() => handleDownloadZip('md')}
              disabled={selectedConfigs.length === 0 || isZipping}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500 transition shadow-md shadow-indigo-600/30 disabled:opacity-50"
            >
              <FolderArchive className="w-4 h-4" />
              <span>{isZipping ? 'Creazione ZIP...' : 'Scarica Archivio ZIP (.md)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
