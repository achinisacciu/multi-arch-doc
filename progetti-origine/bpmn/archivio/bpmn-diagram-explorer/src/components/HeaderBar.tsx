import React, { useState } from 'react';
import {
  FileCode,
  Download,
  FileImage,
  FileText,
  Eye,
  PenTool,
  PlayCircle,
  Palette,
  Check,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { BpmnFileItem, ViewMode, CanvasTheme } from '../types';

interface HeaderBarProps {
  activeFile: BpmnFileItem | null;
  viewMode: ViewMode;
  canvasTheme: CanvasTheme;
  onViewModeChange: (mode: ViewMode) => void;
  onCanvasThemeChange: (theme: CanvasTheme) => void;
  onExportSvg: () => void;
  onOpenPdfModal: () => void;
  onExportPng: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  activeFile,
  viewMode,
  canvasTheme,
  onViewModeChange,
  onCanvasThemeChange,
  onExportSvg,
  onOpenPdfModal,
  onExportPng,
}) => {
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);

  return (
    <div className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between shrink-0 shadow-2xs z-10">
      {/* File Info */}
      <div className="flex items-center gap-3 min-w-0 pr-4">
        <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
          <FileCode className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-sm text-slate-900 truncate">
              {activeFile?.name || 'Seleziona un diagramma BPMN'}
            </h2>
            {activeFile?.isSample && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                Esempio
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 truncate">
            {activeFile?.relativePath || 'Nessun file aperto'}
          </p>
        </div>
      </div>

      {/* Center View Mode Switcher */}
      <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
        <button
          onClick={() => onViewModeChange('viewer')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            viewMode === 'viewer'
              ? 'bg-white text-blue-600 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Visualizzatore</span>
        </button>

        <button
          onClick={() => onViewModeChange('editor')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            viewMode === 'editor'
              ? 'bg-white text-blue-600 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <PenTool className="w-3.5 h-3.5" />
          <span>Editor</span>
        </button>

        <button
          onClick={() => onViewModeChange('simulation')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            viewMode === 'simulation'
              ? 'bg-emerald-600 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <PlayCircle className="w-3.5 h-3.5" />
          <span>Simulazione</span>
        </button>
      </div>

      {/* Right Action Menu (Theme & Exports) */}
      <div className="flex items-center gap-2">
        {/* Theme Dropdown */}
        <div className="relative">
          <button
            onClick={() => setThemeDropdownOpen(!themeDropdownOpen)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200/70 text-slate-700 text-xs font-semibold rounded-lg transition-colors border border-slate-200"
          >
            <Palette className="w-3.5 h-3.5 text-slate-500" />
            <span className="capitalize">{canvasTheme}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {themeDropdownOpen && (
            <div
              className="absolute right-0 mt-1 w-40 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-30"
              onMouseLeave={() => setThemeDropdownOpen(false)}
            >
              {[
                { id: 'default', label: 'Chiaro Standard' },
                { id: 'blueprint', label: 'Blueprint Blu' },
                { id: 'dark', label: 'Scuro Notte' },
                { id: 'contrast', label: 'Alto Contrasto' },
              ].map((th) => (
                <button
                  key={th.id}
                  onClick={() => {
                    onCanvasThemeChange(th.id as CanvasTheme);
                    setThemeDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <span>{th.label}</span>
                  {canvasTheme === th.id && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Export Button Dropdown */}
        <div className="relative">
          <div className="inline-flex rounded-lg shadow-xs">
            {/* Primary SVG Export Button */}
            <button
              onClick={onExportSvg}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-l-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Esporta SVG</span>
            </button>

            {/* Dropdown Toggle */}
            <button
              onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
              className="px-2 py-2 bg-blue-700 hover:bg-blue-800 text-white border-l border-blue-500 rounded-r-lg transition-colors"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {exportDropdownOpen && (
            <div
              className="absolute right-0 mt-1.5 w-52 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-30"
              onMouseLeave={() => setExportDropdownOpen(false)}
            >
              <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Formati di Esportazione
              </div>

              <button
                onClick={() => {
                  onExportSvg();
                  setExportDropdownOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <FileCode className="w-4 h-4 text-blue-600" />
                <div className="text-left">
                  <p className="font-semibold text-slate-800">Vettoriale SVG (.svg)</p>
                  <p className="text-[10px] text-slate-400">Qualità scalabile senza perdite</p>
                </div>
              </button>

              <button
                onClick={() => {
                  onOpenPdfModal();
                  setExportDropdownOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <FileText className="w-4 h-4 text-rose-600" />
                <div className="text-left">
                  <p className="font-semibold text-slate-800">Documento PDF (.pdf)</p>
                  <p className="text-[10px] text-slate-400">Layout di stampa personalizzabile</p>
                </div>
              </button>

              <button
                onClick={() => {
                  onExportPng();
                  setExportDropdownOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <FileImage className="w-4 h-4 text-emerald-600" />
                <div className="text-left">
                  <p className="font-semibold text-slate-800">Immagine PNG (.png)</p>
                  <p className="text-[10px] text-slate-400">Alta risoluzione per report</p>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
