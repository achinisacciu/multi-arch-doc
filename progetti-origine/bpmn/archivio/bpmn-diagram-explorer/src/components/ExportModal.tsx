import React, { useState } from 'react';
import {
  FileText,
  FileCode,
  X,
  Check,
  Download,
  Copy,
  Layout,
  Maximize2,
  Sparkles,
} from 'lucide-react';
import { PdfExportOptions } from '../types';

interface ExportModalProps {
  isOpen: boolean;
  diagramTitle: string;
  bpmnViewerInstance: any;
  onClose: () => void;
  onConfirmPdfExport: (options: PdfExportOptions) => void;
  onConfirmSvgExport: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  diagramTitle,
  bpmnViewerInstance,
  onClose,
  onConfirmPdfExport,
  onConfirmSvgExport,
}) => {
  const [activeTab, setActiveTab] = useState<'pdf' | 'svg'>('pdf');
  const [copiedSvg, setCopiedSvg] = useState(false);
  const [svgPreviewText, setSvgPreviewText] = useState('');

  // PDF options
  const [pdfOptions, setPdfOptions] = useState<PdfExportOptions>({
    pageSize: 'a4',
    orientation: 'landscape',
    includeHeader: true,
    includeStats: true,
    highQuality: true,
    backgroundColor: '#ffffff',
  });

  if (!isOpen) return null;

  const handleCopySvgCode = async () => {
    if (!bpmnViewerInstance) return;
    try {
      const { svg } = await bpmnViewerInstance.saveSVG({ format: true });
      await navigator.clipboard.writeText(svg);
      setCopiedSvg(true);
      setTimeout(() => setCopiedSvg(false), 2000);
    } catch (e) {
      console.error('Copy SVG error', e);
    }
  };

  const handlePreviewSvg = async () => {
    if (!bpmnViewerInstance) return;
    try {
      const { svg } = await bpmnViewerInstance.saveSVG({ format: true });
      setSvgPreviewText(svg);
      setActiveTab('svg');
    } catch (e) {
      console.error('Preview SVG error', e);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Opzioni Esportazione Diagramma</h3>
              <p className="text-[11px] text-slate-500 truncate max-w-xs">{diagramTitle}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 bg-slate-100/70 px-4 pt-2">
          <button
            onClick={() => setActiveTab('pdf')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 font-bold text-xs transition-colors ${
              activeTab === 'pdf'
                ? 'border-rose-600 text-rose-600 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4 text-rose-600" />
            <span>Documento PDF (.pdf)</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('svg');
              handlePreviewSvg();
            }}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 font-bold text-xs transition-colors ${
              activeTab === 'svg'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCode className="w-4 h-4 text-blue-600" />
            <span>Vettoriale SVG (.svg)</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {activeTab === 'pdf' ? (
            <div className="space-y-4">
              {/* Formato Pagina */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Formato Foglio
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'a4', label: 'A4' },
                    { id: 'a3', label: 'A3' },
                    { id: 'a2', label: 'A2' },
                    { id: 'fit', label: 'Adatta (Fit)' },
                  ].map((size) => (
                    <button
                      key={size.id}
                      onClick={() =>
                        setPdfOptions({ ...pdfOptions, pageSize: size.id as any })
                      }
                      className={`py-2 px-3 border text-xs font-semibold rounded-xl transition-all ${
                        pdfOptions.pageSize === size.id
                          ? 'border-rose-600 bg-rose-50 text-rose-700 font-bold shadow-2xs'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      {size.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Orientamento */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Orientamento Foglio
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPdfOptions({ ...pdfOptions, orientation: 'landscape' })}
                    className={`py-2 px-3 border text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all ${
                      pdfOptions.orientation === 'landscape'
                        ? 'border-rose-600 bg-rose-50 text-rose-700 font-bold shadow-2xs'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Layout className="w-4 h-4 rotate-90" />
                    <span>Orizzontale (Landscape)</span>
                  </button>

                  <button
                    onClick={() => setPdfOptions({ ...pdfOptions, orientation: 'portrait' })}
                    className={`py-2 px-3 border text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all ${
                      pdfOptions.orientation === 'portrait'
                        ? 'border-rose-600 bg-rose-50 text-rose-700 font-bold shadow-2xs'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Layout className="w-4 h-4" />
                    <span>Verticale (Portrait)</span>
                  </button>
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pdfOptions.includeHeader}
                    onChange={(e) =>
                      setPdfOptions({ ...pdfOptions, includeHeader: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span>Includi Intestazione con Titolo e Data di Esportazione</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pdfOptions.highQuality}
                    onChange={(e) =>
                      setPdfOptions({ ...pdfOptions, highQuality: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span>Rendering Alta Risoluzione (300 DPI per Stampa)</span>
                </label>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-700">Codice Vettoriale SVG</p>
                <button
                  onClick={handleCopySvgCode}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200"
                >
                  {copiedSvg ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600">Copiato!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copia Codice SVG</span>
                    </>
                  )}
                </button>
              </div>

              <textarea
                readOnly
                value={svgPreviewText}
                rows={10}
                className="w-full p-3 bg-slate-900 text-slate-200 font-mono text-[11px] rounded-xl border border-slate-700 focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
          >
            Annulla
          </button>

          {activeTab === 'pdf' ? (
            <button
              onClick={() => {
                onConfirmPdfExport(pdfOptions);
                onClose();
              }}
              className="flex items-center gap-2 px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              <FileText className="w-4 h-4" />
              <span>Scarica PDF</span>
            </button>
          ) : (
            <button
              onClick={() => {
                onConfirmSvgExport();
                onClose();
              }}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Scarica SVG</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
