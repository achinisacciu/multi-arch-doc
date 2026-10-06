import { useState } from 'react';
import { PdfExportOptions } from '../types';
import { X, FileDown, Copy, Check, FileText, Printer } from 'lucide-react';

interface Props {
  isOpen: boolean;
  diagramTitle: string;
  bpmnViewerInstance: any;
  onClose: () => void;
  onConfirmPdfExport: (options: PdfExportOptions) => Promise<void>;
  onConfirmSvgExport: () => void;
  markdownContent?: string;
  jsonContent?: string;
  onMarkdownExport?: () => void;
  onJsonExport?: () => void;
}

export function ExportModal({ isOpen, diagramTitle, bpmnViewerInstance, onClose, onConfirmPdfExport, onConfirmSvgExport, markdownContent, jsonContent, onMarkdownExport, onJsonExport }: Props) {
  const [tab, setTab] = useState<'pdf' | 'markdown'>('pdf');
  const [pdfOptions, setPdfOptions] = useState<PdfExportOptions>({ pageSize: 'a4', orientation: 'landscape', includeHeader: true, includeStats: true, highQuality: true, backgroundColor: '#ffffff' });
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (markdownContent) {
      navigator.clipboard.writeText(markdownContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[80vh] flex flex-col animate-scaleUp">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-800">Esporta Documentazione</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex items-center border-b border-slate-100 px-4">
          <button onClick={() => setTab('pdf')} className={`py-3 px-4 text-xs font-medium border-b-2 transition-colors ${tab === 'pdf' ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}><FileText className="w-3.5 h-3.5 inline mr-1.5" />PDF / SVG / PNG</button>
          <button onClick={() => setTab('markdown')} className={`py-3 px-4 text-xs font-medium border-b-2 transition-colors ${tab === 'markdown' ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}><FileDown className="w-3.5 h-3.5 inline mr-1.5" />Markdown / JSON</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'pdf' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-medium text-slate-600 block mb-1">Formato Pagina</label>
                  <select value={pdfOptions.pageSize} onChange={e => setPdfOptions({ ...pdfOptions, pageSize: e.target.value as any })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs bg-white">
                    <option value="a4">A4</option><option value="a3">A3</option><option value="a2">A2</option><option value="fit">Adatta</option>
                  </select></div>
                <div><label className="text-xs font-medium text-slate-600 block mb-1">Orientamento</label>
                  <select value={pdfOptions.orientation} onChange={e => setPdfOptions({ ...pdfOptions, orientation: e.target.value as any })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs bg-white">
                    <option value="landscape">Orizzontale</option><option value="portrait">Verticale</option>
                  </select></div>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={pdfOptions.includeHeader} onChange={e => setPdfOptions({ ...pdfOptions, includeHeader: e.target.checked })} className="rounded border-slate-300" /><span className="text-xs text-slate-600">Includi intestazione</span></label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={pdfOptions.includeStats} onChange={e => setPdfOptions({ ...pdfOptions, includeStats: e.target.checked })} className="rounded border-slate-300" /><span className="text-xs text-slate-600">Includi statistiche</span></label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={pdfOptions.highQuality} onChange={e => setPdfOptions({ ...pdfOptions, highQuality: e.target.checked })} className="rounded border-slate-300" /><span className="text-xs text-slate-600">Alta qualità</span></label>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => { onConfirmSvgExport(); onClose(); }} className="flex-1 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 transition-colors">Scarica SVG</button>
                <button onClick={() => { onConfirmPdfExport(pdfOptions); onClose(); }} className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white transition-colors">Scarica PDF</button>
              </div>
            </div>
          )}

          {tab === 'markdown' && (
            <div className="space-y-4 animate-fadeIn">
              <p className="text-xs text-slate-500">Esporta la documentazione in formato Markdown (.md) o JSON strutturato.</p>
              <div className="flex gap-2">
                <button onClick={() => { onMarkdownExport?.(); onClose(); }} className="flex-1 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 transition-colors"><FileDown className="w-3.5 h-3.5 inline mr-1" />Scarica .md</button>
                <button onClick={() => { onJsonExport?.(); onClose(); }} className="flex-1 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 transition-colors"><FileDown className="w-3.5 h-3.5 inline mr-1" />Scarica JSON</button>
                <button onClick={handlePrint} className="flex-1 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 transition-colors"><Printer className="w-3.5 h-3.5 inline mr-1" />Stampa</button>
              </div>
              {markdownContent && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Anteprima Markdown</h4>
                    <button onClick={handleCopy} className="flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs text-slate-600 transition-colors">
                      {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}{copied ? 'Copiato' : 'Copia'}
                    </button>
                  </div>
                  <pre className="text-[11px] text-slate-600 bg-slate-50 rounded-xl p-4 max-h-64 overflow-auto border border-slate-100 leading-relaxed whitespace-pre-wrap font-mono">{markdownContent}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
