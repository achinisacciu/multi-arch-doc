import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { HeaderBar } from './components/HeaderBar';
import { BpmnCanvas } from './components/BpmnCanvas';
import { InspectorPanel } from './components/InspectorPanel';
import { ExportModal } from './components/ExportModal';
import { SimulationControls } from './components/SimulationControls';
import { SAMPLE_DIAGRAMS } from './data/sampleDiagrams';
import { BpmnFileItem, ViewMode, CanvasTheme, SelectedElementInfo, PdfExportOptions } from './types';
import { exportToSvg, exportToPdf, exportToPng } from './utils/exportUtils';
import { processDroppedItems } from './utils/bpmnParser';
import { Upload, CheckCircle2, AlertCircle, X } from 'lucide-react';

export default function App() {
  const [files, setFiles] = useState<BpmnFileItem[]>(SAMPLE_DIAGRAMS);
  const [selectedFile, setSelectedFile] = useState<BpmnFileItem | null>(SAMPLE_DIAGRAMS[0]);
  const [viewMode, setViewMode] = useState<ViewMode>('viewer');
  const [canvasTheme, setCanvasTheme] = useState<CanvasTheme>('default');
  const [selectedElement, setSelectedElement] = useState<SelectedElementInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSimulationElementId, setActiveSimulationElementId] = useState<string | null>(null);
  const [bpmnViewerInstance, setBpmnViewerInstance] = useState<any>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Drag & drop state for entire application
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const handleSelectFile = (file: BpmnFileItem) => {
    setSelectedFile(file);
    setSelectedElement(null);
    setActiveSimulationElementId(null);
  };

  const handleFilesLoaded = (newFiles: BpmnFileItem[]) => {
    setFiles(newFiles);
    if (newFiles.length > 0) {
      setSelectedFile(newFiles[0]);
      showToast(`Caricati ${newFiles.length} diagrammi BPMN dalla cartella!`);
    }
  };

  const handleResetToSamples = () => {
    setFiles(SAMPLE_DIAGRAMS);
    setSelectedFile(SAMPLE_DIAGRAMS[0]);
    showToast('Ripristinati i diagrammi BPMN di esempio.');
  };

  // Drag & drop event handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      const droppedFiles = await processDroppedItems(e.dataTransfer.items);
      if (droppedFiles.length > 0) {
        setFiles(droppedFiles);
        setSelectedFile(droppedFiles[0]);
        showToast(`Importata cartella con ${droppedFiles.length} file BPMN!`);
      } else {
        showToast('Nessun file .bpmn o .xml valido trovato nella cartella rilasciata.', 'error');
      }
    }
  };

  // Export handlers
  const handleExportSvg = async () => {
    if (!bpmnViewerInstance || !selectedFile) return;
    try {
      const { download } = await exportToSvg(bpmnViewerInstance, selectedFile.name);
      download();
      showToast('Diagramma esportato in formato SVG con successo!');
    } catch (err: any) {
      showToast(err?.message || 'Errore durante l\'esportazione SVG', 'error');
    }
  };

  const handleConfirmPdfExport = async (options: PdfExportOptions) => {
    if (!bpmnViewerInstance || !selectedFile) return;
    try {
      await exportToPdf(bpmnViewerInstance, selectedFile.name, options);
      showToast('Documento PDF esportato con successo!');
    } catch (err: any) {
      showToast(err?.message || 'Errore durante la creazione del PDF', 'error');
    }
  };

  const handleExportPng = async () => {
    if (!bpmnViewerInstance || !selectedFile) return;
    try {
      await exportToPng(bpmnViewerInstance, selectedFile.name);
      showToast('Immagine PNG esportata con successo!');
    } catch (err: any) {
      showToast(err?.message || 'Errore durante l\'esportazione PNG', 'error');
    }
  };

  return (
    <div
      className="flex h-screen w-screen overflow-hidden bg-slate-100 relative font-sans"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Sidebar: Folder & File Explorer */}
      <Sidebar
        files={files}
        selectedFileId={selectedFile?.id || null}
        onSelectFile={handleSelectFile}
        onFilesLoaded={handleFilesLoaded}
        onResetToSamples={handleResetToSamples}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 relative">
        {/* Top Header Bar */}
        <HeaderBar
          activeFile={selectedFile}
          viewMode={viewMode}
          canvasTheme={canvasTheme}
          onViewModeChange={setViewMode}
          onCanvasThemeChange={setCanvasTheme}
          onExportSvg={handleExportSvg}
          onOpenPdfModal={() => setIsExportModalOpen(true)}
          onExportPng={handleExportPng}
        />

        {/* Canvas & Overlay Controls Container */}
        <div className="flex-1 flex min-h-0 relative">
          {/* Main Interactive BPMN Canvas */}
          <BpmnCanvas
            xmlContent={selectedFile?.content || ''}
            viewMode={viewMode}
            canvasTheme={canvasTheme}
            searchQuery={searchQuery}
            activeSimulationElementId={activeSimulationElementId}
            onElementSelect={setSelectedElement}
            onViewerReady={setBpmnViewerInstance}
            onError={(msg) => showToast(msg, 'error')}
          />

          {/* Simulation Overlay Bar */}
          {viewMode === 'simulation' && (
            <SimulationControls
              bpmnViewerInstance={bpmnViewerInstance}
              onActiveElementChange={setActiveSimulationElementId}
              onCloseSimulation={() => setViewMode('viewer')}
            />
          )}

          {/* Right Inspector Panel */}
          <InspectorPanel
            selectedElement={selectedElement}
            activeFile={selectedFile}
            bpmnViewerInstance={bpmnViewerInstance}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            onClose={() => setSelectedElement(null)}
          />
        </div>
      </div>

      {/* Drag & Drop Fullscreen Backdrop Overlay */}
      {isDraggingOver && (
        <div className="fixed inset-0 bg-blue-600/90 backdrop-blur-md z-50 flex flex-col items-center justify-center text-white p-8 text-center border-4 border-dashed border-white/60">
          <Upload className="w-16 h-16 animate-bounce mb-4" />
          <h2 className="text-2xl font-black tracking-tight">Rilascia qui la tua cartella BPMN</h2>
          <p className="text-sm text-blue-100 max-w-md mt-2">
            L'applicazione scansionerà automaticamente tutti i file .bpmn e .xml contenuti nella cartella per creare la struttura di esplorazione.
          </p>
        </div>
      )}

      {/* Export Options Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        diagramTitle={selectedFile?.name || 'diagramma_bpmn'}
        bpmnViewerInstance={bpmnViewerInstance}
        onClose={() => setIsExportModalOpen(false)}
        onConfirmPdfExport={handleConfirmPdfExport}
        onConfirmSvgExport={handleExportSvg}
      />

      {/* Notification Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-slideUp">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-xs font-semibold ${
              toast.type === 'error'
                ? 'bg-rose-600 text-white border-rose-500'
                : 'bg-slate-900 text-white border-slate-700'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-200 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
