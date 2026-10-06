import React, { useState } from 'react';
import { BpmnFileItem, Language } from '../types';
import { processDroppedItems, processFileList } from '../utils/bpmnParser';
import { Upload, FileType, Code, FolderOpen, CheckCircle2, ArrowRight } from 'lucide-react';

interface Props {
  onFilesLoaded: (files: BpmnFileItem[]) => void;
  language: Language;
}

export function FileUploader({ onFilesLoaded, language }: Props) {
  const [dragging, setDragging] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [xmlInput, setXmlInput] = useState('');

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      const files = await processDroppedItems(e.dataTransfer.items);
      if (files.length > 0) onFilesLoaded(files);
    }
  };

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

  const handleFileSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.bpmn,.xml,.bpel,.sql,.pls,.pkb';
    input.multiple = true;
    input.onchange = async () => {
      if (input.files && input.files.length > 0) {
        const loaded = await processFileList(input.files);
        if (loaded.length > 0) onFilesLoaded(loaded);
      }
    };
    input.click();
  };

  const handlePasteSubmit = () => {
    if (!xmlInput.trim()) return;
    const content = xmlInput.trim();
    const name = `incolla_${Date.now()}.bpmn`;
    const stats = parseBpmnStatsSimple(content);
    const file: BpmnFileItem = {
      id: `paste_${Date.now()}`, name, relativePath: name, folderPath: '', content, size: content.length,
      ...stats,
    };
    onFilesLoaded([file]);
    setXmlInput('');
    setPasteMode(false);
  };

  return (
    <div className="flex-1 flex items-center justify-center bg-slate-50 p-8">
      <div className="max-w-2xl w-full space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-4"><FileType className="w-8 h-8 text-blue-600" /></div>
          <h1 className="text-xl font-bold text-slate-900">BPMN Visualizer</h1>
          <p className="text-sm text-slate-500 mt-1">Carica uno o più file BPMN per visualizzare, documentare e analizzare i tuoi processi</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button onClick={handleFolderSelect} className="flex flex-col items-center gap-3 p-8 rounded-2xl border-2 border-dashed border-slate-300 hover:border-blue-400 bg-white hover:bg-blue-50/50 transition-all group">
            <FolderOpen className="w-8 h-8 text-slate-400 group-hover:text-blue-500 transition-colors" />
            <div className="text-center"><p className="text-sm font-semibold text-slate-700 group-hover:text-blue-700">Carica Cartella</p><p className="text-[11px] text-slate-400 mt-0.5">Scansiona ricorsivamente .bpmn e .xml</p></div>
          </button>
          <button onClick={handleFileSelect} className="flex flex-col items-center gap-3 p-8 rounded-2xl border-2 border-dashed border-slate-300 hover:border-emerald-400 bg-white hover:bg-emerald-50/50 transition-all group">
            <Upload className="w-8 h-8 text-slate-400 group-hover:text-emerald-500 transition-colors" />
            <div className="text-center"><p className="text-sm font-semibold text-slate-700 group-hover:text-emerald-700">Seleziona File</p><p className="text-[11px] text-slate-400 mt-0.5">Scegli uno o più file .bpmn</p></div>
          </button>
        </div>

        <div
          onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
          className={`p-8 rounded-2xl border-2 border-dashed text-center transition-all ${dragging ? 'border-blue-500 bg-blue-50 scale-[1.02]' : 'border-slate-300 bg-white hover:border-slate-400'}`}
        >
          {dragging ? (
            <div className="flex flex-col items-center gap-2"><Upload className="w-8 h-8 text-blue-500 animate-bounce" /><p className="text-sm font-semibold text-blue-700">Rilascia i file qui</p></div>
          ) : (
            <div className="flex flex-col items-center gap-2"><Upload className="w-8 h-8 text-slate-300" /><p className="text-sm text-slate-500">Trascina e rilascia file o cartelle BPMN qui</p></div>
          )}
        </div>

        <div className="text-center">
          <button onClick={() => setPasteMode(!pasteMode)} className="text-xs text-slate-400 hover:text-slate-600 underline transition-colors">Oppure incolla codice XML BPMN</button>
        </div>

        {pasteMode && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 animate-fadeIn">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Incolla XML BPMN</h3>
            <textarea value={xmlInput} onChange={e => setXmlInput(e.target.value)} rows={8} className="w-full rounded-xl border border-slate-200 p-3 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" placeholder="&lt;?xml version=&quot;1.0&quot; encoding=&quot;UTF-8&quot;?&gt;&#10;&lt;definitions ...&gt;" />
            <div className="flex gap-2">
              <button onClick={handlePasteSubmit} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"><Code className="w-3.5 h-3.5" />Carica XML</button>
              <button onClick={() => setPasteMode(false)} className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs text-slate-600 transition-colors">Annulla</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          {highlights.map(h => <div key={h.label} className="bg-white rounded-xl border border-slate-200 p-3"><h4 className="text-xs font-semibold text-slate-800">{h.label}</h4><p className="text-[10px] text-slate-400 mt-0.5">{h.desc}</p></div>)}
        </div>
      </div>
    </div>
  );
}

const highlights = [
  { label: 'Diagrammi Interattivi', desc: 'Zoom, pan, click per dettagli' },
  { label: 'Documentazione', desc: 'Report automatici multi-lingua' },
  { label: 'Analisi Cross-Process', desc: 'Dipendenze e Call Activity' },
  { label: 'Esportazione', desc: 'SVG, PDF, Markdown, JSON' },
];

function parseBpmnStatsSimple(xml: string) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const tasks = doc.querySelectorAll('task, userTask, serviceTask, sendTask, receiveTask, manualTask, scriptTask, businessRuleTask');
    const gateways = doc.querySelectorAll('gateway, exclusiveGateway, parallelGateway, inclusiveGateway, eventBasedGateway, complexGateway');
    const events = doc.querySelectorAll('startEvent, endEvent, intermediateCatchEvent, intermediateThrowEvent, boundaryEvent');
    const subprocesses = doc.querySelectorAll('subProcess, transaction, adHocSubProcess');
    return { isValid: true, error: undefined, stats: { tasksCount: tasks.length, gatewaysCount: gateways.length, eventsCount: events.length, subprocessesCount: subprocesses.length } };
  } catch { return { isValid: false, error: 'XML non valido', stats: { tasksCount: 0, gatewaysCount: 0, eventsCount: 0, subprocessesCount: 0 } }; }
}
