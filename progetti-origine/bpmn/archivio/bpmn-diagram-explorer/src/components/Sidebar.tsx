import React, { useRef, useState } from 'react';
import {
  FolderUp,
  FileCode,
  Folder,
  FolderOpen,
  FileText,
  Search,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Info,
} from 'lucide-react';
import { BpmnFileItem, BpmnFolderNode } from '../types';
import { buildFolderTree, processFileInputs, processDroppedItems } from '../utils/bpmnParser';
import { SAMPLE_DIAGRAMS } from '../data/sampleDiagrams';

interface SidebarProps {
  files: BpmnFileItem[];
  selectedFileId: string | null;
  onSelectFile: (file: BpmnFileItem) => void;
  onFilesLoaded: (newFiles: BpmnFileItem[]) => void;
  onResetToSamples: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  files,
  selectedFileId,
  onSelectFile,
  onFilesLoaded,
  onResetToSamples,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    'Cartella Radice': true,
    'Ordini_e_Vendite': true,
    'Risorse_Umane': true,
    'Sistemi_IT': true,
    'Amministrazione': true,
  });

  const folderInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFolderUploadClick = () => {
    folderInputRef.current?.click();
  };

  const handleFileUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFolderInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const loaded = await processFileInputs(e.target.files);
      if (loaded.length > 0) {
        onFilesLoaded(loaded);
      }
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const loaded = await processFileInputs(e.target.files);
      if (loaded.length > 0) {
        onFilesLoaded(loaded);
      }
    }
  };

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderPath]: !prev[folderPath],
    }));
  };

  const filteredFiles = files.filter(
    (f) =>
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.relativePath.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const folderTree = buildFolderTree(filteredFiles);

  const renderFolderNode = (node: BpmnFolderNode, depth = 0) => {
    const isExpanded = expandedFolders[node.path || 'Cartella Radice'] ?? true;
    const subfolderKeys = Object.keys(node.subfolders);
    const hasContent = subfolderKeys.length > 0 || node.files.length > 0;

    if (!hasContent && depth > 0) return null;

    return (
      <div key={node.path || 'root'} className="select-none">
        {depth > 0 && (
          <button
            onClick={() => toggleFolder(node.path)}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            className="w-full flex items-center gap-2 py-1.5 px-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-200/70 transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            )}
            {isExpanded ? (
              <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
            ) : (
              <Folder className="w-4 h-4 text-amber-500 shrink-0" />
            )}
            <span className="truncate">{node.name}</span>
            <span className="ml-auto text-[10px] font-medium bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">
              {node.files.length}
            </span>
          </button>
        )}

        {(isExpanded || depth === 0) && (
          <div className="space-y-0.5 mt-0.5">
            {subfolderKeys.map((key) => renderFolderNode(node.subfolders[key], depth + 1))}

            {node.files.map((file) => {
              const isSelected = file.id === selectedFileId;
              return (
                <button
                  key={file.id}
                  onClick={() => onSelectFile(file)}
                  style={{ paddingLeft: `${(depth + (depth > 0 ? 1 : 0)) * 12 + 10}px` }}
                  className={`w-full flex items-center justify-between py-2 px-2.5 rounded-lg text-xs transition-all text-left group ${
                    isSelected
                      ? 'bg-blue-600 text-white font-medium shadow-sm'
                      : 'text-slate-700 hover:bg-slate-200/80 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 pr-1">
                    <FileCode
                      className={`w-4 h-4 shrink-0 ${
                        isSelected ? 'text-blue-100' : 'text-blue-600 group-hover:scale-105 transition-transform'
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium leading-tight">{file.name}</p>
                      {file.stats && (
                        <p
                          className={`text-[10px] truncate mt-0.5 ${
                            isSelected ? 'text-blue-100' : 'text-slate-500'
                          }`}
                        >
                          {file.stats.tasksCount} task • {file.stats.gatewaysCount} gateway
                        </p>
                      )}
                    </div>
                  </div>

                  {file.isValid ? (
                    <CheckCircle2
                      className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-blue-200' : 'text-emerald-500'}`}
                    />
                  ) : (
                    <AlertCircle
                      className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-rose-200' : 'text-rose-500'}`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-80 h-full bg-slate-100 border-r border-slate-200 flex flex-col shrink-0 select-none">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm">
              <FolderOpen className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-bold text-sm text-slate-900 leading-none">BPMN Explorer</h1>
              <p className="text-[11px] text-slate-500 mt-0.5">Esploratore da Cartella</p>
            </div>
          </div>

          <button
            onClick={onResetToSamples}
            title="Ripristina diagrammi di esempio"
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Upload Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          {/* Native HTML Folder input */}
          <input
            ref={folderInputRef}
            type="file"
            {...({ webkitdirectory: '', directory: '' } as any)}
            multiple
            className="hidden"
            onChange={handleFolderInputChange}
          />
          <button
            onClick={handleFolderUploadClick}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            <FolderUp className="w-3.5 h-3.5" />
            Carica Cartella
          </button>

          {/* Multiple File input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".bpmn,.xml,.bpmn20.xml"
            multiple
            className="hidden"
            onChange={handleFileInputChange}
          />
          <button
            onClick={handleFileUploadClick}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            Seleziona File
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-3 border-b border-slate-200 bg-slate-50">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Cerca diagramma BPMN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
      </div>

      {/* File & Folder Tree */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {files.length === 0 ? (
          <div className="text-center py-8 px-4">
            <Folder className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-medium text-slate-600">Nessun file BPMN trovato</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Carica una cartella dal computer o trascina i file .bpmn qui.
            </p>
          </div>
        ) : (
          renderFolderNode(folderTree)
        )}
      </div>

      {/* Footer info banner */}
      <div className="p-3 border-t border-slate-200 bg-white text-[11px] text-slate-500 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Total File: <strong>{files.length}</strong></span>
        </div>
        <span className="text-[10px] text-slate-400">BPMN 2.0 Standard</span>
      </div>
    </div>
  );
};
