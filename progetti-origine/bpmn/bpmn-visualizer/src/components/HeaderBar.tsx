import { BpmnFileItem, ViewMode, AppView, Language, DetailLevel } from '../types';
import { Eye, Edit3, Play, FileText, FolderTree, FileDown, ChevronDown, SlidersHorizontal, Braces, Boxes } from 'lucide-react';
import { useState } from 'react';

interface Props {
  activeFile: BpmnFileItem | null;
  viewMode: ViewMode;
  activeView: AppView;
  language: Language;
  detailLevel: DetailLevel;
  onViewModeChange: (m: ViewMode) => void;
  onActiveViewChange: (v: AppView) => void;
  onLanguageChange: (l: Language) => void;
  onDetailLevelChange: (d: DetailLevel) => void;
  onExportSvg: () => void;
  onExportPng: () => void;
  onExportMermaidSvg?: () => void;
  onExportMermaidPng?: () => void;
  onExportDrawio?: () => void;
  onOpenExportModal: () => void;
}

export function HeaderBar({ activeFile, viewMode, activeView, language, detailLevel, onViewModeChange, onActiveViewChange, onLanguageChange, onDetailLevelChange, onExportSvg, onExportPng, onExportMermaidSvg, onExportMermaidPng, onExportDrawio, onOpenExportModal }: Props) {
  const [exportOpen, setExportOpen] = useState(false);
  const validFile = activeFile?.isValid !== false;

  return (
    <header className="h-12 bg-white border-b border-slate-200 flex items-center px-4 gap-3 shrink-0 no-print">
      <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg p-0.5">
        <button onClick={() => onActiveViewChange('diagram')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeView === 'diagram' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <Eye className="w-3.5 h-3.5 inline mr-1" />Diagramma
        </button>
        <button onClick={() => onActiveViewChange('documentation')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeView === 'documentation' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <FileText className="w-3.5 h-3.5 inline mr-1" />Documentazione
        </button>
        <button onClick={() => onActiveViewChange('folder')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeView === 'folder' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <FolderTree className="w-3.5 h-3.5 inline mr-1" />Portafoglio
        </button>
        <button onClick={() => onActiveViewChange('mermaid')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeView === 'mermaid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <Braces className="w-3.5 h-3.5 inline mr-1" />Mermaid
        </button>
        <button onClick={() => onActiveViewChange('lineage')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeView === 'lineage' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <SlidersHorizontal className="w-3.5 h-3.5 inline mr-1" />Lineage
        </button>
        <button onClick={() => onActiveViewChange('reconstruction')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeView === 'reconstruction' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <Boxes className="w-3.5 h-3.5 inline mr-1" />Composite
        </button>
      </div>

      {activeView === 'diagram' && (
        <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg p-0.5">
          <button onClick={() => onViewModeChange('viewer')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'viewer' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Eye className="w-3 h-3 inline mr-1" />Visore</button>
          <button onClick={() => onViewModeChange('editor')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'editor' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Edit3 className="w-3 h-3 inline mr-1" />Editor</button>
          <button onClick={() => onViewModeChange('simulation')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'simulation' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Play className="w-3 h-3 inline mr-1" />Simula</button>
        </div>
      )}

      {activeView === 'documentation' && (
        <div className="flex items-center gap-2">
          <select value={language} onChange={e => onLanguageChange(e.target.value as Language)} className="text-xs bg-slate-100 border-0 rounded-lg px-3 py-1.5 text-slate-600 font-medium cursor-pointer">
            <option value="it">Italiano</option><option value="en">English</option><option value="de">Deutsch</option><option value="fr">Français</option><option value="es">Español</option>
          </select>
          <select value={detailLevel} onChange={e => onDetailLevelChange(e.target.value as DetailLevel)} className="text-xs bg-slate-100 border-0 rounded-lg px-3 py-1.5 text-slate-600 font-medium cursor-pointer">
            <option value="high">Dettaglio Alto</option><option value="medium">Dettaglio Medio</option><option value="executive">Esecutivo</option>
          </select>
        </div>
      )}

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        {activeFile && validFile && (
          <div className="relative">
            <button onClick={() => setExportOpen(!exportOpen)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors">
              <FileDown className="w-3.5 h-3.5" /> Esporta <ChevronDown className="w-3 h-3" />
            </button>
            {exportOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-200 z-20 py-1 overflow-hidden">
                  {activeView !== 'mermaid' ? (
                    <>
                      <button onClick={() => { onExportSvg(); setExportOpen(false); }} className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 font-medium">Esporta SVG</button>
                      <button onClick={() => { onExportPng(); setExportOpen(false); }} className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 font-medium">Esporta PNG</button>
                      <div className="border-t border-slate-100 my-1" />
                      <button onClick={() => { onExportDrawio?.(); setExportOpen(false); }} className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 font-medium">Esporta draw.io</button>
                      <button onClick={() => { onOpenExportModal(); setExportOpen(false); }} className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 font-medium">PDF con opzioni</button>
                      <button onClick={() => { onOpenExportModal(); setExportOpen(false); }} className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 font-medium">Markdown / JSON</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { onExportMermaidSvg?.(); setExportOpen(false); }} className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 font-medium">Esporta Mermaid SVG</button>
                      <button onClick={() => { onExportMermaidPng?.(); setExportOpen(false); }} className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 font-medium">Esporta Mermaid PNG</button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}
        {activeFile && <span className="text-xs text-slate-400 truncate max-w-[200px]">{activeFile.name}</span>}
      </div>
    </header>
  );
}
