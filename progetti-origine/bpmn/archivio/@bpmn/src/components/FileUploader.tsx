import React, { useState, useRef } from 'react';
import type { BpmnFileItem, ParsedBpmn } from '../types';
import { processFileList } from '../utils/bpmnParser';
import { Folder, FolderOpen, Loader2 } from 'lucide-react';

interface Props {
  onFilesLoaded: (files: BpmnFileItem[], parsed: Record<string, ParsedBpmn>) => void;
  language: string;
}

export function FileUploader({ onFilesLoaded }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFolderSelect = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    (input as any).webkitdirectory = true;
    input.multiple = true;
    input.onchange = async () => {
      if (input.files && input.files.length > 0) {
        setIsProcessing(true);
        const loaded = await processFileList(input.files);
        const parsedMap: Record<string, ParsedBpmn> = {};
        const { parseBpmnXml } = await import('../utils/bpmnParser');
        for (const f of loaded) {
          if (f.isValid && f.content) { try { parsedMap[f.id] = parseBpmnXml(f.content, f.name); } catch {} }
        }
        onFilesLoaded(loaded, parsedMap);
        setIsProcessing(false);
      }
    };
    input.click();
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsProcessing(true);
      const { processDroppedItems, parseBpmnXml } = await import('../utils/bpmnParser');
      const droppedFiles = await processDroppedItems(e.dataTransfer.items);
      const parsedMap: Record<string, ParsedBpmn> = {};
      for (const f of droppedFiles) {
        if (f.isValid && f.content) { try { parsedMap[f.id] = parseBpmnXml(f.content, f.name); } catch {} }
      }
      onFilesLoaded(droppedFiles, parsedMap);
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 font-sans">
      <div className="flex-1 flex items-center justify-center p-6">
        <div
          className={`relative w-full max-w-md p-8 border-2 border-dashed rounded-2xl text-center transition-all ${
            isDragging
              ? 'border-blue-600 bg-blue-50/50 scale-105'
              : 'border-slate-300 hover:border-slate-400'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center gap-4 text-slate-600">
            <div className="p-3 bg-slate-100 rounded-full">
              <FolderOpen className="w-8 h-8 text-slate-400" />
            </div>
            <div>
              <h2 className="font-black text-xl text-slate-800 mb-1">Carica Cartella BPMN</h2>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">Trascina la cartella con i tuoi file BPMN o clicca per selezionarla</p>
            </div>
            <button onClick={handleFolderSelect} disabled={isProcessing} className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition disabled:opacity-50">
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Elaborazione...
                </>
              ) : (
                <>
                  <Folder className="w-4 h-4" /> Seleziona Cartella
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 text-center text-xs text-slate-400">
        @bpmn Cross-Process Analyzer • Trascina una cartella o usa il pulsante
      </div>
    </div>
  );
}
