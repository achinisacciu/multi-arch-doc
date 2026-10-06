import React from 'react';
import { FileCode2, Download, RefreshCw, MessageSquareText, Layers, Globe, Sliders, FileText, Folder, Network } from 'lucide-react';
import { LanguageOption, LoadedBpmnFile } from '../types';

interface HeaderProps {
  fileName?: string;
  onReanalyze: () => void;
  onNewFile: () => void;
  onOpenExport: () => void;
  onOpenChat: () => void;
  language: LanguageOption;
  onLanguageChange: (lang: LanguageOption) => void;
  detailLevel: 'high' | 'medium' | 'executive';
  onDetailLevelChange: (level: 'high' | 'medium' | 'executive') => void;
  activeTab: 'doc' | 'diagram' | 'elements' | 'folder';
  onTabChange: (tab: 'doc' | 'diagram' | 'elements' | 'folder') => void;
  hasDoc: boolean;
  loadedFiles?: LoadedBpmnFile[];
  activeFileId?: string;
  onSelectFile?: (fileId: string) => void;
  isFolderMode?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  fileName,
  onReanalyze,
  onNewFile,
  onOpenExport,
  onOpenChat,
  language,
  onLanguageChange,
  detailLevel,
  onDetailLevelChange,
  activeTab,
  onTabChange,
  hasDoc,
  loadedFiles,
  activeFileId,
  onSelectFile,
  isFolderMode,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 font-bold">
              <FileCode2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-white">DocuBPMN</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {isFolderMode ? 'Multi-Processo' : 'BPMN 2.0'}
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                {isFolderMode ? 'Documentazione Incrociata Portafoglio' : 'Generatore Documentazione Processi'}
              </p>
            </div>
          </div>

          {/* Navigation View Tabs (if file/folder loaded) */}
          {fileName && (
            <div className="hidden md:flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 gap-1">
              {isFolderMode && (
                <button
                  onClick={() => onTabChange('folder')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                    activeTab === 'folder'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-amber-300 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  <Folder className="w-3.5 h-3.5" />
                  Cartella Multi-Processo
                </button>
              )}
              <button
                onClick={() => onTabChange('doc')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'doc'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Documentazione Processo
              </button>
              <button
                onClick={() => onTabChange('diagram')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'diagram'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Diagramma BPMN
              </button>
            </div>
          )}

          {/* Actions & Settings Controls */}
          <div className="flex items-center gap-2.5">
            {fileName && (
              <>
                {/* File selector dropdown if folder mode */}
                {isFolderMode && loadedFiles && loadedFiles.length > 0 && onSelectFile && (
                  <div className="flex items-center gap-1 bg-slate-800 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700">
                    <Network className="w-3.5 h-3.5 text-indigo-400" />
                    <select
                      value={activeFileId}
                      onChange={(e) => onSelectFile(e.target.value)}
                      className="bg-transparent text-xs font-semibold text-slate-200 outline-none cursor-pointer max-w-[140px] truncate"
                    >
                      {loadedFiles.map((f) => (
                        <option key={f.id} value={f.id} className="bg-slate-800 text-white">
                          📄 {f.parsed.processName || f.fileName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Language Selector */}
                <div className="flex items-center gap-1 bg-slate-800 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700">
                  <Globe className="w-3.5 h-3.5 text-blue-400" />
                  <select
                    value={language}
                    onChange={(e) => onLanguageChange(e.target.value as LanguageOption)}
                    className="bg-transparent text-xs font-medium text-slate-200 outline-none cursor-pointer"
                  >
                    <option value="it" className="bg-slate-800 text-white">Italiano 🇮🇹</option>
                    <option value="en" className="bg-slate-800 text-white">English 🇬🇧</option>
                    <option value="de" className="bg-slate-800 text-white">Deutsch 🇩🇪</option>
                    <option value="fr" className="bg-slate-800 text-white">Français 🇫🇷</option>
                    <option value="es" className="bg-slate-800 text-white">Español 🇪🇸</option>
                  </select>
                </div>

                {/* Detail level selector */}
                <div className="hidden lg:flex items-center gap-1 bg-slate-800 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700">
                  <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                  <select
                    value={detailLevel}
                    onChange={(e) => onDetailLevelChange(e.target.value as any)}
                    className="bg-transparent text-xs font-medium text-slate-200 outline-none cursor-pointer"
                  >
                    <option value="high" className="bg-slate-800 text-white">Dettaglio Completo</option>
                    <option value="medium" className="bg-slate-800 text-white">Dettaglio Medio</option>
                    <option value="executive" className="bg-slate-800 text-white">Sintesi Executive</option>
                  </select>
                </div>

                {/* Regenerate Doc Button */}
                <button
                  onClick={onReanalyze}
                  title="Aggiorna documentazione"
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Aggiorna</span>
                </button>

                {/* Assistant Chat Button */}
                <button
                  onClick={onOpenChat}
                  title="Apri Assistente Processo"
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <MessageSquareText className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Assistente</span>
                </button>

                {/* Export / Print Button */}
                {hasDoc && (
                  <button
                    onClick={onOpenExport}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Esporta</span>
                  </button>
                )}

                {/* Change File Button */}
                <button
                  onClick={onNewFile}
                  className="px-2.5 py-1.5 text-slate-400 hover:text-slate-200 text-xs font-medium border border-slate-800 hover:border-slate-700 rounded-lg transition-colors"
                  title="Carica un altro file o cartella .bpmn"
                >
                  Nuovo
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

