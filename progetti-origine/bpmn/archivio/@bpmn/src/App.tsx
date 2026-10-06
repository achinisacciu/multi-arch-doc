import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { HeaderBar } from './components/HeaderBar';
import { BpmnCanvas } from './components/BpmnCanvas';
import { StepByStepView } from './components/StepByStepView';
import { MermaidView } from './components/MermaidView';
import { AnalysisView } from './components/AnalysisView';
import { FileUploader } from './components/FileUploader';
import { Upload, CheckCircle2, AlertCircle, Download, X, Copy } from 'lucide-react';
import type { BpmnFileItem, ParsedBpmn, AppView, ViewMode, CrossProcessAnalysis } from './types';
import { processFileList, processDroppedItems, parseBpmnXml } from './utils/bpmnParser';
import { ensureBpmnDiagramDI } from './utils/bpmnDiGenerator';
import { analyzeCrossProcess } from './utils/crossProcessAnalyzer';

export default function App() {
  const [files, setFiles] = useState<BpmnFileItem[]>([]);
  const [parsed, setParsed] = useState<Record<string, ParsedBpmn>>({});
  const [selectedFile, setSelectedFile] = useState<BpmnFileItem | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('viewer');
  const [activeView, setActiveView] = useState<AppView>('diagram');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeStepElementId, setActiveStepElementId] = useState<string | null>(null);
  const [bpmnViewerInstance, setBpmnViewerInstance] = useState<any>(null);
  const [analysis, setAnalysis] = useState<CrossProcessAnalysis | null>(null);
  const [mermaidSvgHtml, setMermaidSvgHtml] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleFilesLoaded = (newFiles: BpmnFileItem[], parsedMap: Record<string, ParsedBpmn>) => {
    setFiles(newFiles);
    setParsed(parsedMap);
    setActiveView('diagram');
    if (newFiles.length > 0) setSelectedFile(newFiles[0]);
    setAnalysis(analyzeCrossProcess(newFiles, parsedMap));
    showToast(`Caricati ${newFiles.length} file BPMN`);
  };

  const handleSelectFile = (file: BpmnFileItem) => {
    setSelectedFile(file);
    setActiveStepElementId(null);
    setViewMode('viewer');
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingOver(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingOver(false); };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setIsDraggingOver(false);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      const droppedFiles = await processDroppedItems(e.dataTransfer.items);
      if (droppedFiles.length > 0) {
        const parsedMap: Record<string, ParsedBpmn> = {};
        for (const f of droppedFiles) {
          if (f.isValid && f.content) { try { parsedMap[f.id] = parseBpmnXml(f.content, f.name); } catch {} }
        }
        handleFilesLoaded(droppedFiles, parsedMap);
      } else {
        showToast('Nessun file BPMN valido trovato', 'error');
      }
    }
  };

  const handleExportSvg = async () => {
    if (!bpmnViewerInstance || !selectedFile) return;
    try {
      const { exportToSvg } = await import('./utils/exportUtils');
      const { download } = await exportToSvg(bpmnViewerInstance, selectedFile.name);
      download();
      showToast('SVG esportato!');
    } catch (err: any) { showToast(err?.message || 'Errore SVG', 'error'); }
  };

  const handleExportPng = async () => {
    if (!bpmnViewerInstance || !selectedFile) return;
    try {
      const { exportToPng } = await import('./utils/exportUtils');
      await exportToPng(bpmnViewerInstance, selectedFile.name);
      showToast('PNG esportato!');
    } catch (err: any) { showToast(err?.message || 'Errore PNG', 'error'); }
  };

  const handleExportMermaidSvg = () => {
    if (!mermaidSvgHtml || !selectedFile) return;
    const blob = new Blob([mermaidSvgHtml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${selectedFile.name.replace(/\.(bpmn|xml)$/i, '')}-mermaid.svg`; a.click();
    URL.revokeObjectURL(url);
    showToast('Mermaid SVG esportato!');
  };

  const handleExportMermaidPng = async () => {
    if (!mermaidSvgHtml || !selectedFile) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    const blob = new Blob([mermaidSvgHtml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      ctx.scale(2, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((pngBlob) => {
        if (pngBlob) {
          const pngUrl = URL.createObjectURL(pngBlob);
          const a = document.createElement('a'); a.href = pngUrl; a.download = `${selectedFile.name.replace(/\.(bpmn|xml)$/i, '')}-mermaid.png`; a.click();
          URL.revokeObjectURL(pngUrl);
          showToast('Mermaid PNG esportato!');
        }
      }, 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); showToast('Errore PNG', 'error'); };
    img.src = url;
  };

  const handleExportAnalysis = () => {
    if (!analysis) return;
    const json = JSON.stringify(analysis, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'analisi-processi.json'; a.click();
    URL.revokeObjectURL(url);
    showToast('JSON analisi esportato!');
  };

  const currentParsed = selectedFile ? parsed[selectedFile.id] : null;

  if (files.length === 0) {
    return <FileUploader onFilesLoaded={handleFilesLoaded} language="it" />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 relative font-sans"
      onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      <Sidebar files={files} parsed={parsed} selectedFileId={selectedFile?.id || null}
        onSelectFile={handleSelectFile} onFilesLoaded={handleFilesLoaded} />
      <div className="flex-1 flex flex-col h-full min-w-0 relative">
        <HeaderBar activeFile={selectedFile} viewMode={viewMode} activeView={activeView}
          onViewModeChange={setViewMode} onActiveViewChange={setActiveView}
          onExportSvg={handleExportSvg} onExportPng={handleExportPng}
          onExportMermaidSvg={handleExportMermaidSvg} onExportMermaidPng={handleExportMermaidPng}
          onOpenAnalysisModal={handleExportAnalysis} />
        <div className="flex-1 flex min-h-0 relative">
          {activeView === 'diagram' && currentParsed && (
            <>
              <BpmnCanvas xmlContent={selectedFile?.content || ''} viewMode={viewMode}
                searchQuery={searchQuery} activeStepElementId={activeStepElementId}
                onElementSelect={() => {}} onViewerReady={setBpmnViewerInstance}
                onError={(msg) => showToast(msg, 'error')} />
            </>
          )}
          {activeView === 'analysis' && analysis && (
            <AnalysisView files={files} parsed={parsed} analysis={analysis} />
          )}
          {activeView === 'stepbystep' && currentParsed && (
            <StepByStepView parsed={currentParsed} onStepChange={setActiveStepElementId} />
          )}
          {activeView === 'mermaid' && currentParsed && (
            <MermaidView parsed={currentParsed} onSvgReady={setMermaidSvgHtml} />
          )}
        </div>
      </div>

      {isDraggingOver && (
        <div className="fixed inset-0 bg-blue-600/90 backdrop-blur-md z-50 flex flex-col items-center justify-center text-white p-8 text-center border-4 border-dashed border-white/60">
          <Upload className="w-16 h-16 animate-bounce mb-4" />
          <h2 className="text-2xl font-black tracking-tight">Rilascia qui la tua cartella BPMN</h2>
          <p className="text-sm text-blue-100 max-w-md mt-2">Scansione automatica di tutti i file .bpmn e .xml</p>
        </div>
      )}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-xs font-semibold ${toast.type === 'error' ? 'bg-rose-600 text-white border-rose-500' : 'bg-slate-900 text-white border-slate-700'}`}>
            {toast.type === 'error' ? <AlertCircle className="w-4 h-4 text-rose-200 shrink-0" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 text-slate-400 hover:text-white"><X className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      )}
    </div>
  );
}
