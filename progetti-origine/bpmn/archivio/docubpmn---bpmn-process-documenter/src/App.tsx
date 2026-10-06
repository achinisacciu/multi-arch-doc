import React, { useState, useCallback } from 'react';
import { Header } from './components/Header';
import { FileUploader } from './components/FileUploader';
import { BpmnDiagramViewer } from './components/BpmnDiagramViewer';
import { DocumentationView } from './components/DocumentationView';
import { IntegratedFolderView } from './components/IntegratedFolderView';
import { BpmnChatAssistant } from './components/BpmnChatAssistant';
import { ExportModal } from './components/ExportModal';
import { parseBpmnXml } from './utils/bpmnParser';
import { generateBpmnDocumentation } from './utils/documentationGenerator';
import { generateIntegratedFolderDoc } from './utils/crossProcessAnalyzer';
import { ParsedBpmn, BpmnDocumentation, LanguageOption, LoadedBpmnFile, IntegratedFolderDoc } from './types';
import { 
  FileText, Layers, BarChart2, ShieldAlert, CheckCircle2, Folder
} from 'lucide-react';

export default function App() {
  const [loadedFiles, setLoadedFiles] = useState<LoadedBpmnFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [integratedDoc, setIntegratedDoc] = useState<IntegratedFolderDoc | null>(null);
  const [folderName, setFolderName] = useState<string>('Cartella Processi Aziendali');

  const [language, setLanguage] = useState<LanguageOption>('it');
  const [detailLevel, setDetailLevel] = useState<'high' | 'medium' | 'executive'>('high');
  const [activeTab, setActiveTab] = useState<'doc' | 'diagram' | 'elements' | 'folder'>('doc');
  const [selectedElementId, setSelectedElementId] = useState<string | undefined>(undefined);

  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);

  // Active single file details
  const activeFile = loadedFiles.find((f) => f.id === activeFileId) || loadedFiles[0] || null;
  const rawXml = activeFile?.rawXml || null;
  const parsedBpmn = activeFile?.parsed || null;
  const documentation = activeFile?.documentation || null;

  // Process single file
  const handleFileSelect = (xmlString: string, fileName: string, fileSize: number) => {
    try {
      const parsed = parseBpmnXml(xmlString, fileName, fileSize);
      const doc = generateBpmnDocumentation(parsed, language, detailLevel);
      const newFile: LoadedBpmnFile = {
        id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        fileName,
        fileSize,
        rawXml: xmlString,
        parsed,
        documentation: doc,
      };

      setLoadedFiles([newFile]);
      setActiveFileId(newFile.id);
      setIntegratedDoc(null);
      setSelectedElementId(undefined);
      setActiveTab('doc');
    } catch (err: any) {
      alert(`Impossibile leggere il file BPMN: ${err.message}`);
    }
  };

  // Process folder / multiple files
  const handleFolderSelect = (
    filesData: Array<{ xml: string; fileName: string; fileSize: number }>,
    nameOfFolder?: string
  ) => {
    try {
      const parsedList: LoadedBpmnFile[] = [];

      filesData.forEach((item, index) => {
        const parsed = parseBpmnXml(item.xml, item.fileName, item.fileSize);
        const doc = generateBpmnDocumentation(parsed, language, detailLevel);
        parsedList.push({
          id: `folder-file-${index}-${Date.now()}`,
          fileName: item.fileName,
          fileSize: item.fileSize,
          rawXml: item.xml,
          parsed,
          documentation: doc,
        });
      });

      if (parsedList.length === 0) return;

      const title = nameOfFolder || 'Portafoglio Processi Aziendali';
      const crossDoc = generateIntegratedFolderDoc(parsedList, title, language);

      setLoadedFiles(parsedList);
      setFolderName(title);
      setIntegratedDoc(crossDoc);
      setActiveFileId(parsedList[0].id);
      setSelectedElementId(undefined);
      setActiveTab('folder');
    } catch (err: any) {
      alert(`Errore nell'elaborazione della cartella BPMN: ${err.message}`);
    }
  };

  // Re-analyze doc when language or detail level changes
  const updateDocumentations = (lang: LanguageOption, level: 'high' | 'medium' | 'executive') => {
    if (loadedFiles.length === 0) return;

    const updatedFiles = loadedFiles.map((file) => ({
      ...file,
      documentation: generateBpmnDocumentation(file.parsed, lang, level),
    }));

    setLoadedFiles(updatedFiles);

    if (updatedFiles.length > 1) {
      const crossDoc = generateIntegratedFolderDoc(updatedFiles, folderName, lang);
      setIntegratedDoc(crossDoc);
    }
  };

  const handleReanalyze = () => {
    updateDocumentations(language, detailLevel);
  };

  const handleLanguageChange = (newLang: LanguageOption) => {
    setLanguage(newLang);
    updateDocumentations(newLang, detailLevel);
  };

  const handleDetailLevelChange = (newLevel: 'high' | 'medium' | 'executive') => {
    setDetailLevel(newLevel);
    updateDocumentations(language, newLevel);
  };

  const handleNewFile = () => {
    setLoadedFiles([]);
    setActiveFileId(null);
    setIntegratedDoc(null);
  };

  const handleSelectStepElement = (elementId: string) => {
    setSelectedElementId(elementId);
    setActiveTab('diagram');
  };

  const handleSelectProcessFile = (fileId: string) => {
    setActiveFileId(fileId);
    setActiveTab('doc');
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900 flex flex-col antialiased">
      
      {/* App Navigation Header */}
      <Header
        fileName={parsedBpmn?.fileName || (integratedDoc ? integratedDoc.folderName : undefined)}
        onReanalyze={handleReanalyze}
        onNewFile={handleNewFile}
        onOpenExport={() => setIsExportOpen(true)}
        onOpenChat={() => setIsChatOpen(true)}
        language={language}
        onLanguageChange={handleLanguageChange}
        detailLevel={detailLevel}
        onDetailLevelChange={handleDetailLevelChange}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        hasDoc={!!documentation || !!integratedDoc}
        loadedFiles={loadedFiles}
        activeFileId={activeFileId || undefined}
        onSelectFile={setActiveFileId}
        isFolderMode={loadedFiles.length > 1}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {loadedFiles.length === 0 ? (
          <FileUploader
            onFileSelect={handleFileSelect}
            onFolderSelect={handleFolderSelect}
          />
        ) : (
          <div className="space-y-6">
            
            {/* Top Process Header Summary Banner for Single File */}
            {loadedFiles.length === 1 && parsedBpmn && (
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                      Processo BPMN 2.0
                    </span>
                    <span className="text-xs font-mono text-slate-500">
                      ID: {parsedBpmn.processId}
                    </span>
                  </div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                    {parsedBpmn.processName}
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    File: <strong className="text-slate-700">{parsedBpmn.fileName}</strong> ({(parsedBpmn.fileSize / 1024).toFixed(1)} KB)
                  </p>
                </div>

                {/* Statistics Pill Badges */}
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                  <div className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center gap-1.5">
                    <BarChart2 className="w-4 h-4 text-indigo-600" />
                    <span>Nodi: <strong>{parsedBpmn.stats.totalElements}</strong></span>
                  </div>
                  <div className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-100 text-blue-900 flex items-center gap-1.5">
                    <span>Task: <strong>{parsedBpmn.stats.tasksCount}</strong></span>
                  </div>
                  <div className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-900 flex items-center gap-1.5">
                    <span>Gateway: <strong>{parsedBpmn.stats.gatewaysCount}</strong></span>
                  </div>
                  <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-900 flex items-center gap-1.5">
                    <span>Corsie (Lanes): <strong>{parsedBpmn.stats.lanesCount}</strong></span>
                  </div>
                </div>
              </div>
            )}

            {/* Folder Mode Switcher Banner */}
            {loadedFiles.length > 1 && (
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold shrink-0">
                    <Folder className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Cartella Processi: <span className="text-indigo-600">{folderName}</span> ({loadedFiles.length} file)
                    </h2>
                    <p className="text-xs text-slate-500">
                      Stai visualizzando: <strong className="text-slate-800">{activeTab === 'folder' ? 'Vista Integrata Cartella' : parsedBpmn?.processName}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('folder')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                      activeTab === 'folder'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                    }`}
                  >
                    <Folder className="w-3.5 h-3.5" />
                    Vista Integrata Cartella
                  </button>

                  <select
                    value={activeFileId || ''}
                    onChange={(e) => handleSelectProcessFile(e.target.value)}
                    className="bg-slate-50 text-slate-800 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold outline-none cursor-pointer"
                  >
                    {loadedFiles.map((f) => (
                      <option key={f.id} value={f.id}>
                        📄 {f.parsed.processName || f.fileName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* View Tabs Selector for Single Process */}
            {activeTab !== 'folder' && (
              <div className="flex border-b border-slate-200 bg-white rounded-2xl p-1.5 shadow-sm">
                <button
                  onClick={() => setActiveTab('doc')}
                  className={`flex-1 py-2.5 px-4 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                    activeTab === 'doc'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  Documentazione Processo Completa
                </button>
                <button
                  onClick={() => setActiveTab('diagram')}
                  className={`flex-1 py-2.5 px-4 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                    activeTab === 'diagram'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  Diagramma Grafico Interattivo
                </button>
              </div>
            )}

            {/* View Mode 1: Integrated Folder View */}
            {activeTab === 'folder' && integratedDoc && (
              <IntegratedFolderView
                integratedDoc={integratedDoc}
                files={loadedFiles}
                onSelectProcessFile={handleSelectProcessFile}
              />
            )}

            {/* View Mode 2: Individual Documentation View */}
            {activeTab === 'doc' && documentation && (
              <DocumentationView
                doc={documentation}
                onSelectStepElement={handleSelectStepElement}
              />
            )}

            {/* View Mode 3: Interactive BPMN Diagram Canvas Viewer */}
            {activeTab === 'diagram' && rawXml && parsedBpmn && (
              <BpmnDiagramViewer
                xml={rawXml}
                parsedBpmn={parsedBpmn}
                selectedElementId={selectedElementId}
                onSelectElement={(el) => setSelectedElementId(el?.id)}
              />
            )}

          </div>
        )}

      </main>

      {/* Floating Process Assistant Drawer */}
      {parsedBpmn && (
        <BpmnChatAssistant
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          parsedBpmn={parsedBpmn}
          documentation={documentation}
        />
      )}

      {/* Export Modal */}
      {(documentation || integratedDoc) && (
        <ExportModal
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          doc={documentation || undefined}
          integratedDoc={integratedDoc || undefined}
        />
      )}

    </div>
  );
}

