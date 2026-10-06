import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { HeaderBar } from './components/HeaderBar';
import { BpmnCanvas } from './components/BpmnCanvas';
import { InspectorPanel } from './components/InspectorPanel';
import { SimulationControls } from './components/SimulationControls';
import { ExportModal } from './components/ExportModal';
import { DocumentationView } from './components/DocumentationView';
import { IntegratedFolderView } from './components/IntegratedFolderView';
import { MermaidView } from './components/MermaidView';
import { LineageView } from './components/LineageView';
import { ReconstructionView } from './components/ReconstructionView';
import { FileUploader } from './components/FileUploader';
import { BpmnFileItem, ViewMode, SelectedElementInfo, PdfExportOptions, AppView, Language, DetailLevel, ParsedBpmn, BpmnDocumentation, IntegratedFolderDoc } from './types';
import { exportToSvg, exportToPdf, exportToPng, generateMarkdownDoc } from './utils/exportUtils';
import { parseBpmnXml, processDroppedItems } from './utils/bpmnParser';
import { generateBpmnDocumentation } from './utils/documentationGenerator';
import { generateIntegratedFolderDoc } from './utils/crossProcessAnalyzer';
import { generateLineageMermaid, extractLineage } from './utils/lineageExtractor';
import { isStubBpmnFile } from './utils/compositeAssociation';
import { bpmnXmlToDrawio, lineageToDrawio, downloadDrawio } from './utils/drawioGenerator';
import { Upload, CheckCircle2, AlertCircle, X } from 'lucide-react';

export default function App() {
  const [files, setFiles] = useState<BpmnFileItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<BpmnFileItem | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('viewer');
  const [selectedElement, setSelectedElement] = useState<SelectedElementInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSimulationElementId, setActiveSimulationElementId] = useState<string | null>(null);
  const [bpmnViewerInstance, setBpmnViewerInstance] = useState<any>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [activeView, setActiveView] = useState<AppView>('diagram');
  const [language, setLanguage] = useState<Language>('it');
  const [detailLevel, setDetailLevel] = useState<DetailLevel>('high');

  const [parsedFiles, setParsedFiles] = useState<Record<string, ParsedBpmn>>({});
  const [documentations, setDocumentations] = useState<Record<string, BpmnDocumentation>>({});
  const [integratedDoc, setIntegratedDoc] = useState<IntegratedFolderDoc | null>(null);
  const [lineageMermaidCode, setLineageMermaidCode] = useState<string>('');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const parsed: Record<string, ParsedBpmn> = {};
    for (const f of files) {
      try { parsed[f.id] = parseBpmnXml(f.content, f.name); } catch { /* skip */ }
    }
    setParsedFiles(parsed);

    const docs: Record<string, BpmnDocumentation> = {};
    for (const [id, p] of Object.entries(parsed)) {
      docs[id] = generateBpmnDocumentation(p, language, detailLevel);
    }
    setDocumentations(docs);

    if (files.length > 1) {
      const folderFiles = Object.entries(parsed).map(([id, p]) => ({ fileName: files.find(f => f.id === id)?.name || p.fileName, parsed: p }));
      setIntegratedDoc(generateIntegratedFolderDoc(folderFiles, language));
    } else {
      setIntegratedDoc(null);
    }

    setLineageMermaidCode(generateLineageMermaid(files));
  }, [files, language, detailLevel]);

  const handleSelectFile = (file: BpmnFileItem) => {
    setSelectedFile(file);
    setSelectedElement(null);
    setActiveSimulationElementId(null);
  };

  const handleNavigateToElement = (elementId: string) => {
    if (!bpmnViewerInstance) return;
    try {
      const canvas = bpmnViewerInstance.get('canvas');
      const registry = bpmnViewerInstance.get('elementRegistry');
      const el = registry.get(elementId);
      if (!el) return;
      canvas.scrollToElement(elementId);
      canvas.addMarker(elementId, 'bpmn-search-highlight');
      setTimeout(() => canvas.removeMarker(elementId, 'bpmn-search-highlight'), 3000);
      if (el.type !== 'bpmn:SequenceFlow') {
        const info: SelectedElementInfo = {
          id: el.id, type: el.type?.replace('bpmn:', '') || '', name: el.businessObject?.name || el.id,
          incoming: [], outgoing: [],
        };
        if (el.incoming) info.incoming = el.incoming.map((f: any) => ({ id: f.id, name: f.businessObject?.name, sourceId: f.source?.id }));
        if (el.outgoing) info.outgoing = el.outgoing.map((f: any) => ({ id: f.id, name: f.businessObject?.name, targetId: f.target?.id }));
        setSelectedElement(info);
      }
    } catch {}
  };

  const handleFilesLoaded = (newFiles: BpmnFileItem[]) => {
    setFiles(newFiles);
    setActiveView('diagram');
    const firstBpmn =
      newFiles.find((f) => f.name.toLowerCase().endsWith('.bpmn') && !isStubBpmnFile(f)) ||
      newFiles.find((f) => f.name.toLowerCase().endsWith('.bpmn')) ||
      newFiles.find((f) => f.name.toLowerCase().endsWith('.xml')) ||
      newFiles[0] || null;
    setSelectedFile(firstBpmn);
    showToast(`Caricati ${newFiles.length} file!`);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingOver(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingOver(false); };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setIsDraggingOver(false);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      const droppedFiles = await processDroppedItems(e.dataTransfer.items);
      if (droppedFiles.length > 0) {
        handleFilesLoaded(droppedFiles);
      } else {
        showToast('Nessun file .bpmn valido trovato.', 'error');
      }
    }
  };

  const handleExportSvg = async () => {
    if (!bpmnViewerInstance || !selectedFile) return;
    try { const { download } = await exportToSvg(bpmnViewerInstance, selectedFile.name); download(); showToast('SVG esportato!'); }
    catch (err: any) { showToast(err?.message || 'Errore SVG', 'error'); }
  };

  const handleExportDrawio = () => {
    if (!selectedFile) return;
    try {
      const isCompositeXml = selectedFile.name.toLowerCase().endsWith('.xml') &&
        (selectedFile.content.includes('<composite') || selectedFile.content.includes('sca:component'));
      if (isCompositeXml || selectedFile.name.toLowerCase().endsWith('.bpel') ||
          selectedFile.name.toLowerCase().endsWith('.sql') ||
          selectedFile.name.toLowerCase().endsWith('.pls')) {
        const { edges } = extractLineage([selectedFile]);
        const drawio = lineageToDrawio(edges, selectedFile.name.replace(/\.(xml|bpel|sql|pls|pkb)$/i, ''));
        downloadDrawio(drawio, selectedFile.name);
        showToast('draw.io esportato!');
      } else {
        const drawio = bpmnXmlToDrawio(selectedFile.content, selectedFile.name);
        downloadDrawio(drawio, selectedFile.name);
        showToast('draw.io esportato!');
      }
    } catch (err: any) {
      showToast(err?.message || 'Errore draw.io', 'error');
    }
  };

  const handleExportPng = async () => {
    if (!bpmnViewerInstance || !selectedFile) return;
    try { await exportToPng(bpmnViewerInstance, selectedFile.name); showToast('PNG esportato!'); }
    catch (err: any) { showToast(err?.message || 'Errore PNG', 'error'); }
  };

  const handleConfirmPdfExport = async (options: PdfExportOptions) => {
    if (!bpmnViewerInstance || !selectedFile) return;
    try { await exportToPdf(bpmnViewerInstance, selectedFile.name, options); showToast('PDF esportato!'); }
    catch (err: any) { showToast(err?.message || 'Errore PDF', 'error'); }
  };

  const handleMarkdownExport = () => {
    const doc = selectedFile ? documentations[selectedFile.id] : null;
    const parsed = selectedFile ? parsedFiles[selectedFile.id] : null;
    if (!doc || !parsed) return;
    const md = generateMarkdownDoc(doc, parsed, integratedDoc || undefined);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${(selectedFile?.name || 'documentazione').replace(/\.(bpmn|xml)$/i, '')}.md`; a.click();
    URL.revokeObjectURL(url);
    showToast('Markdown esportato!');
  };

  const handleJsonExport = () => {
    const doc = selectedFile ? documentations[selectedFile.id] : null;
    if (!doc) return;
    const json = JSON.stringify(doc, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${(selectedFile?.name || 'documentazione').replace(/\.(bpmn|xml)$/i, '')}.json`; a.click();
    URL.revokeObjectURL(url);
    showToast('JSON esportato!');
  };

  const [mermaidSvgHtml, setMermaidSvgHtml] = useState<string | null>(null);
  const currentDoc = selectedFile ? documentations[selectedFile.id] : null;
  const currentParsed = selectedFile ? parsedFiles[selectedFile.id] : null;
  const markdownContent = currentDoc && currentParsed ? generateMarkdownDoc(currentDoc, currentParsed, integratedDoc || undefined) : undefined;

  const handleExportMermaidSvg = () => {
    if (!mermaidSvgHtml) return;
    const blob = new Blob([mermaidSvgHtml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${selectedFile?.name?.replace(/\.(bpmn|xml)$/i, '') || 'diagramma'}-mermaid.svg`; a.click();
    URL.revokeObjectURL(url);
    showToast('Mermaid SVG esportato!');
  };

  const handleExportMermaidPng = async () => {
    if (!mermaidSvgHtml) return;
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
          const a = document.createElement('a'); a.href = pngUrl; a.download = `${selectedFile?.name?.replace(/\.(bpmn|xml)$/i, '') || 'diagramma'}-mermaid.png`; a.click();
          URL.revokeObjectURL(pngUrl);
          showToast('Mermaid PNG esportato!');
        }
      }, 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); showToast('Errore PNG', 'error'); };
    img.src = url;
  };

  if (files.length === 0) {
    return <FileUploader onFilesLoaded={handleFilesLoaded} language={language} />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 relative font-sans"
      onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      <Sidebar files={files} selectedFileId={selectedFile?.id || null} onSelectFile={handleSelectFile}
        onFilesLoaded={handleFilesLoaded} collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <div className="flex-1 flex flex-col h-full min-w-0 relative">
        <HeaderBar activeFile={selectedFile} viewMode={viewMode}
          activeView={activeView} language={language} detailLevel={detailLevel}
          onViewModeChange={setViewMode}
          onActiveViewChange={setActiveView} onLanguageChange={setLanguage}
          onDetailLevelChange={setDetailLevel}
          onExportSvg={handleExportSvg} onExportPng={handleExportPng}
          onExportMermaidSvg={handleExportMermaidSvg} onExportMermaidPng={handleExportMermaidPng}
          onExportDrawio={handleExportDrawio}
          onOpenExportModal={() => setIsExportModalOpen(true)} />
        <div className="flex-1 flex min-h-0 relative">
          {activeView === 'diagram' && (
            <>
              <BpmnCanvas xmlContent={selectedFile?.content || ''} viewMode={viewMode}
                searchQuery={searchQuery}
                activeSimulationElementId={activeSimulationElementId}
                onElementSelect={setSelectedElement} onViewerReady={setBpmnViewerInstance}
                onError={(msg) => showToast(msg, 'error')} />
              {viewMode === 'simulation' && (
                <SimulationControls bpmnViewerInstance={bpmnViewerInstance}
                  onActiveElementChange={setActiveSimulationElementId}
                  onCloseSimulation={() => setViewMode('viewer')} />
              )}
              <InspectorPanel selectedElement={selectedElement} activeFile={selectedFile}
                bpmnViewerInstance={bpmnViewerInstance} searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery} onClose={() => setSelectedElement(null)}
                onNavigateToElement={handleNavigateToElement} />
            </>
          )}
          {activeView === 'documentation' && currentDoc && (
            <DocumentationView doc={currentDoc} detailLevel={detailLevel} />
          )}
          {activeView === 'folder' && integratedDoc && (
            <IntegratedFolderView doc={integratedDoc} parsedFiles={parsedFiles} />
          )}
          {activeView === 'mermaid' && currentParsed && (
            <MermaidView parsed={currentParsed} onSvgReady={setMermaidSvgHtml} />
          )}
          {activeView === 'lineage' && (
            <LineageView mermaidCode={lineageMermaidCode || 'flowchart LR\n  no_data["Nessun dato di lineage trovato"]'} />
          )}
          {activeView === 'reconstruction' && (
            <ReconstructionView files={files} />
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
      <ExportModal isOpen={isExportModalOpen} diagramTitle={selectedFile?.name || 'diagramma'}
        bpmnViewerInstance={bpmnViewerInstance} onClose={() => setIsExportModalOpen(false)}
        onConfirmPdfExport={handleConfirmPdfExport} onConfirmSvgExport={handleExportSvg}
        markdownContent={markdownContent} jsonContent={currentDoc ? JSON.stringify(currentDoc, null, 2) : undefined}
        onMarkdownExport={handleMarkdownExport} onJsonExport={handleJsonExport} />
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-slideLeft">
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
