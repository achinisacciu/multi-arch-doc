import React, { useState } from 'react';
import { BpmnFileItem } from '../types';
import { processFileList } from '../utils/bpmnParser';
import { isStubBpmnFile } from '../utils/compositeAssociation';
import { FolderTree, File, Upload, Search, CheckCircle2, AlertCircle, ChevronRight, ChevronDown, FolderOpen, FileType, PanelLeftClose, PanelLeft } from 'lucide-react';

interface Props {
  files: BpmnFileItem[];
  selectedFileId: string | null;
  onSelectFile: (file: BpmnFileItem) => void;
  onFilesLoaded: (files: BpmnFileItem[]) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface FileItemProps {
  key?: string;
  file: BpmnFileItem;
  selectedFileId: string | null;
  onSelectFile: (f: BpmnFileItem) => void;
}

export function Sidebar({ files, selectedFileId, onSelectFile, onFilesLoaded, collapsed, onToggleCollapse }: Props) {
  const [search, setSearch] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['root']));

  const filteredFiles = search
    ? files.filter(f => f.name.toLowerCase().includes(search.toLowerCase()) || f.folderPath.toLowerCase().includes(search.toLowerCase()))
    : files;

  const grouped = groupByFolder(filteredFiles);

  const handleFolderSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    (input as any).webkitdirectory = true;
    input.multiple = true;
    input.onchange = async () => {
      if (input.files && input.files.length > 0) {
        const loaded = await processFileList(input.files);
        if (loaded.length > 0) onFilesLoaded(loaded);
      }
    };
    input.click();
  };

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  if (collapsed) {
    return (
      <aside className="w-10 bg-slate-900 text-slate-300 flex flex-col h-full shrink-0 items-center border-r border-slate-700/50 py-2">
        <button onClick={onToggleCollapse} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors" title="Espandi sidebar">
          <PanelLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 flex flex-col items-center gap-2 mt-4">
          <button onClick={handleFolderSelect} className="p-1.5 rounded-lg hover:bg-slate-800 text-blue-400 transition-colors" title="Carica cartella">
            <Upload className="w-4 h-4" />
          </button>
        </div>
        <span className="text-[9px] text-slate-600 rotate-180 [writing-mode:vertical-rl] mb-2">{files.length} file</span>
      </aside>
    );
  }

  return (
    <aside className="w-72 bg-slate-900 text-slate-300 flex flex-col h-full shrink-0 border-r border-slate-700/50 transition-all duration-200">
      <div className="flex items-center p-3 border-b border-slate-700/30">
        <h1 className="text-sm font-bold text-white flex items-center gap-2 flex-1 min-w-0">
          <FileType className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="truncate">BPMN Visualizer</span>
        </h1>
        <button onClick={onToggleCollapse} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors shrink-0" title="Comprimi sidebar">
          <PanelLeftClose className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="p-3 border-b border-slate-700/30">
        <button onClick={handleFolderSelect} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors">
          <Upload className="w-3.5 h-3.5" /> Carica Cartella
        </button>
      </div>
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca file..." className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-0.5">
        <FolderTreeComponent node={grouped} depth={0} selectedFileId={selectedFileId} onSelectFile={onSelectFile} expandedFolders={expandedFolders} onToggle={toggleFolder} search={search} />
      </div>
      <div className="p-3 border-t border-slate-700/30 text-xs text-slate-500 flex items-center justify-between">
        <span>{files.length} file</span>
        <span className="flex items-center gap-2">
          {files.some(f => !f.isValid) && <span className="text-amber-400">{files.filter(f => !f.isValid).length} non validi</span>}
          {files.some(f => f.name.toLowerCase().endsWith('.bpmn') && isStubBpmnFile(f)) && <span className="text-slate-600">{files.filter(f => f.name.toLowerCase().endsWith('.bpmn') && isStubBpmnFile(f)).length} stub</span>}
        </span>
      </div>
    </aside>
  );
}

function groupByFolder(files: BpmnFileItem[]): { name: string; path: string; files: BpmnFileItem[]; subfolders: Record<string, any> } {
  const root: any = { name: 'root', path: '', files: [], subfolders: {} };
  for (const file of files) {
    const parts = file.relativePath.split('/').filter(Boolean);
    let current = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const folderName = parts[i];
      if (!current.subfolders[folderName]) {
        current.subfolders[folderName] = { name: folderName, path: parts.slice(0, i + 1).join('/'), files: [], subfolders: {} };
      }
      current = current.subfolders[folderName];
    }
    current.files.push(file);
  }
  return root;
}

function FolderTreeComponent({ node, depth, selectedFileId, onSelectFile, expandedFolders, onToggle, search }: any) {
  const folders = Object.values(node.subfolders || {}) as any[];
  const hasFolders = folders.length > 0;
  const hasFiles = node.files?.length > 0;

  if (depth > 0 && !search) {
    const isExpanded = expandedFolders.has(node.path);
    return (
      <div>
        <button onClick={() => onToggle(node.path)} className="flex items-center gap-1.5 w-full py-1 px-2 rounded hover:bg-slate-800 text-xs text-slate-400 hover:text-slate-200 transition-colors">
          {isExpanded ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
          <FolderOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="truncate">{node.name}</span>
        </button>
        {isExpanded && (
          <div className="ml-3 space-y-0.5 mt-0.5">
            {node.files?.map((file: BpmnFileItem) => <FileItem key={file.id} file={file} selectedFileId={selectedFileId} onSelectFile={onSelectFile} />)}
            {folders.map((sub: any) => <FolderTreeComponent key={sub.path} node={sub} depth={depth + 1} selectedFileId={selectedFileId} onSelectFile={onSelectFile} expandedFolders={expandedFolders} onToggle={onToggle} search={search} />)}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {(depth === 0 || search) && (
        <>
          {node.files?.map((file: BpmnFileItem) => <FileItem key={file.id} file={file} selectedFileId={selectedFileId} onSelectFile={onSelectFile} />)}
          {folders.map((sub: any) => <FolderTreeComponent key={sub.path} node={sub} depth={depth + 1} selectedFileId={selectedFileId} onSelectFile={onSelectFile} expandedFolders={expandedFolders} onToggle={onToggle} search={search} />)}
        </>
      )}
    </>
  );
}

function FileItem({ file, selectedFileId, onSelectFile }: FileItemProps) {
  const isSelected = file.id === selectedFileId;
  const isStub = file.name.toLowerCase().endsWith('.bpmn') && isStubBpmnFile(file);
  return (
    <button onClick={() => onSelectFile(file)} className={`flex items-center gap-1.5 w-full py-1 px-2 rounded text-xs transition-colors ${isSelected ? 'bg-blue-600/20 text-blue-300' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
      {file.isValid === false ? <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" /> : <File className={`w-3 h-3 ${isStub ? 'text-slate-700' : 'text-slate-500'} shrink-0`} />}
      <span className={`truncate ${isStub ? 'text-slate-600' : ''}`}>{file.name}</span>
      {isStub && <span className="ml-auto shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[8px] font-semibold uppercase text-slate-500" title="default.bpmn generato da JDeveloper, senza elementi di flusso">stub</span>}
      {!isStub && file.stats && <span className="ml-auto text-[10px] text-slate-600">{file.stats.tasksCount}t</span>}
    </button>
  );
}
