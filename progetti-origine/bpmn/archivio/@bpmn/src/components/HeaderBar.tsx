import type { BpmnFileItem, ViewMode, AppView } from '../types';
import { Eye, Edit3, Play, FileDown, ChevronDown, BarChart3, List, Braces } from 'lucide-react';
import { useState } from 'react';

interface Props {
  activeFile: BpmnFileItem | null;
  viewMode: ViewMode;
  activeView: AppView;
  onViewModeChange: (m: ViewMode) => void;
  onActiveViewChange: (v: AppView) => void;
  onExportSvg: () => void;
  onExportPng: () => void;
  onExportMermaidSvg: () => void;
  onExportMermaidPng: () => void;
  onOpenAnalysisModal: () => void;
}

export function HeaderBar({ activeFile, viewMode, activeView, onViewModeChange, onActiveViewChange, onExportSvg, onExportPng, onExportMermaidSvg, onExportMermaidPng, onOpenAnalysisModal }: Props) {
  const [exportOpen, setExportOpen] = useState(false);
  const validFile = activeFile?.isValid !== false;

  return (
    <header className="h-12 bg-white border-b border-slate-200 flex items-center px-4 gap-3 shrink-0">
      <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg p-0.5">
        <button onClick={() => onActiveViewChange('diagram')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeView === 'diagram' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <Eye className="w-3.5 h-3.5 inline mr-1" />Diagramma
        </button>
        <button onClick={() => onActiveViewChange('analysis')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeView === 'analysis' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <BarChart3 className="w-3.5 h-3.5 inline mr-1" />Analisi
        </button>
        <button onClick={() => onActiveViewChange('stepbystep')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeView === 'stepbystep' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <List className="w-3.5 h-3.5 inline mr-1" />Step by Step
        </button>
        <button onClick={() => onActiveViewChange('mermaid')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeView === 'mermaid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <Braces className="w-3.5 h-3.5 inline mr-1" />Mermaid
        </button>
      </div>

      {activeView === 'diagram' && (
        <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg p-0.5">
          <button onClick={() => onViewModeChange('viewer')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'viewer' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Eye className="w-3 h-3 inline mr-1" />Visore</button>
          <button onClick={() => onViewModeChange('editor')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'editor' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Edit3 className="w-3 h-3 inline mr-1" />Editor</button>
          <button onClick={() => onViewModeChange('simulation')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'simulation' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Play className="w-3 h-3 inline mr-1" />Simula</button>
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
                  {activeView === 'mermaid' ? (
                    <>
                      <button onClick={() => { onExportMermaidSvg(); setExportOpen(false); }} className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 font-medium">Esporta Mermaid SVG</button>
                      <button onClick={() => { onExportMermaidPng(); setExportOpen(false); }} className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 font-medium">Esporta Mermaid PNG</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { onExportSvg(); setExportOpen(false); }} className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 font-medium">Esporta SVG</button>
                      <button onClick={() => { onExportPng(); setExportOpen(false); }} className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 font-medium">Esporta PNG</button>
                      <div className="border-t border-slate-100 my-1"></div>
                      <button onClick={() => { onOpenAnalysisModal(); setExportOpen(false); }} className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 font-medium">JSON Analisi</button>
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
