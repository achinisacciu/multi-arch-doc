import React, { useState, Suspense } from 'react';
import JSZip from 'jszip';
import { OracleEcosystem } from './types/jca';
import { buildOracleEcosystem } from './services/ecosystemParser';
import { buildEcosystemAsync, InputFile } from './services/ecosystemWorkerClient';
import { getSampleOracleEcosystem } from './data/sampleEcosystem';
import { buildDocsPackage } from './services/docsPackageGenerator';
import { FileDropzone } from './components/FileDropzone';
import { HighLevelDashboard } from './components/HighLevelDashboard';

// Code-split Fase G: viewer pesante (react-markdown + jszip) fuori dal chunk iniziale
const MasterDocGeneratorViewer = React.lazy(() =>
  import('./components/MasterDocGeneratorViewer').then((m) => ({ default: m.MasterDocGeneratorViewer }))
);
import { CompositeScaViewer } from './components/CompositeScaViewer';
import { ProcessOrchestrationViewer } from './components/ProcessOrchestrationViewer';
import { JcaAdapterSuiteViewer } from './components/JcaAdapterSuiteViewer';
import { ContractsTransformsViewer } from './components/ContractsTransformsViewer';
import { DevOpsAutomationViewer } from './components/DevOpsAutomationViewer';
import {
  Layers,
  FileText,
  Workflow,
  Database,
  FileCode,
  Terminal,
  Sparkles,
  UploadCloud,
  Trash2,
  Download,
  CheckCircle2,
  Menu,
  X,
  Server,
  FileDown,
  Check,
} from 'lucide-react';

export default function App() {
  const [initialEcosystem] = useState<OracleEcosystem>(() => getSampleOracleEcosystem());
  const [ecosystem, setEcosystem] = useState<OracleEcosystem>(initialEcosystem);
  const [sourceFiles, setSourceFiles] = useState<InputFile[]>(() =>
    initialEcosystem.rawFiles.map((f) => ({ content: f.content, name: f.name, relativePath: f.relativePath }))
  );
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [showUploadPanel, setShowUploadPanel] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);
  const downloadTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ingest newly loaded files; parsing nel Web Worker oltre soglia (Fase G)
  const handleFilesLoaded = async (
    newFiles: Array<{ content: string; name: string; relativePath: string }>
  ) => {
    const lowerNew = new Set(newFiles.map((n) => n.relativePath.toLowerCase()));
    const combined = [...sourceFiles.filter((f) => !lowerNew.has(f.relativePath.toLowerCase())), ...newFiles];
    setSourceFiles(combined);
    setIsParsing(true);
    try {
      setEcosystem(await buildEcosystemAsync(combined));
    } finally {
      setIsParsing(false);
    }
    setActiveTab('overview');
    // Chiudi pannello sempre dopo caricamento riuscito (fix magic number C-01/M-01)
    setShowUploadPanel(false);
  };

  const handleLoadSample = () => {
    const sample = getSampleOracleEcosystem();
    setEcosystem(sample);
    setSourceFiles(sample.rawFiles.map((f) => ({ content: f.content, name: f.name, relativePath: f.relativePath })));
    setActiveTab('overview');
    setShowUploadPanel(false);
  };

  const handleClearAll = () => {
    setEcosystem(buildOracleEcosystem([]));
    setSourceFiles([]);
    setShowUploadPanel(true);
  };

  const handleDownloadFullMarkdown = async () => {
    // Stesso pacchetto dello ZIP nel tab Documentazione (pacchetto completo, non filtrato
    // dai toggle di anteprima che valgono solo per il .md singolo del viewer).
    const docsPkg = buildDocsPackage(ecosystem, {
      language: 'it',
      applicationName: 'Oracle Fusion Middleware - SOA Suite & ADF Ecosystem',
    });
    const zip = new JSZip();
    Object.entries(docsPkg).forEach(([path, content]) => {
      zip.file(path, content);
    });
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Oracle_SOA_docs-as-code_${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);

    setDownloadSuccess(true);
    if (downloadTimer.current) clearTimeout(downloadTimer.current);
    downloadTimer.current = setTimeout(() => {
      setDownloadSuccess(false);
    }, 4000);
  };
  React.useEffect(() => () => { if (downloadTimer.current) clearTimeout(downloadTimer.current); }, []);

  const navTabs = [
    { id: 'overview', label: 'Visione Alto Livello', icon: Layers, count: ecosystem.totalFiles },
    { id: 'doc', label: 'Documentazione & Export', icon: FileText, highlight: true },
    { id: 'composites', label: 'Compositi SCA', icon: Server, count: ecosystem.composites.length },
    {
      id: 'orchestration',
      label: 'Orchestrazione & Processi',
      icon: Workflow,
      count: ecosystem.bpmnProcesses.length + ecosystem.bpelProcesses.length + ecosystem.mediators.length,
    },
    { id: 'jca', label: 'Adapter JCA & JNDI', icon: Database, count: ecosystem.jcaAdapters.length },
    {
      id: 'contracts',
      label: 'WSDL, XSD & XSLT',
      icon: FileCode,
      count: ecosystem.wsdlContracts.length + ecosystem.xsdSchemas.length + ecosystem.xsltTransforms.length,
    },
    { id: 'devops', label: 'DevOps & WLST', icon: Terminal, count: ecosystem.scripts.length },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <header className="bg-slate-900/95 border-b border-slate-800 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Oracle SOA & ADF Suite
                </span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-[10px] font-mono font-semibold uppercase">
                  Architecture Studio
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Documentazione di Alto Livello & SCA Topology Engine
              </p>
            </div>
          </div>

          {/* Top Actions: Top-right download button */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowUploadPanel(!showUploadPanel)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                showUploadPanel
                  ? 'bg-slate-800 border-slate-700 text-indigo-300'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <UploadCloud className="w-4 h-4 text-indigo-400" />
              <span className="hidden md:inline">{showUploadPanel ? 'Nascondi Upload' : 'Carica File'}</span>
            </button>

            {/* PUSLANTE PRINCIPALE IN ALTO A DESTRA: SCARICA TUTTO (.MD) */}
            <button
              id="top-right-download-all-md"
              onClick={handleDownloadFullMarkdown}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-lg cursor-pointer active:scale-95 ${
                downloadSuccess
                  ? 'bg-emerald-600 shadow-emerald-600/30'
                  : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 shadow-emerald-900/30 hover:shadow-indigo-600/40'
              }`}
              title="Scarica il pacchetto ZIP docs-as-code a strati (README + docs/ + CSV/YAML)"
            >
              {downloadSuccess ? (
                <>
                  <Check className="w-4 h-4 text-white animate-bounce" />
                  <span>Scaricato con Successo!</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  <span>Scarica ZIP docs</span>
                </>
              )}
            </button>

            {ecosystem.totalFiles > 0 && (
              <button
                onClick={handleClearAll}
                title="Svuota progetto"
                className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl bg-slate-800 text-slate-300"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Desktop Tab Navigation */}
        <div className="hidden lg:block border-t border-slate-800/80 bg-slate-900/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1 overflow-x-auto py-1">
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        isActive ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Mobile Tab Navigation */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-800 bg-slate-900 p-3 space-y-1">
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    isActive ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </div>
                  {tab.count !== undefined && (
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] font-mono">
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Collapsible Dropzone Upload Section */}
        {showUploadPanel && (
          <FileDropzone
            onFilesLoaded={handleFilesLoaded}
            totalLoaded={ecosystem.totalFiles}
            onLoadSample={handleLoadSample}
          />
        )}

        {/* Tab Views */}
        {isParsing && (
          <div className="bg-indigo-950/60 border border-indigo-800 rounded-2xl p-4 text-center text-xs text-indigo-200 animate-pulse">
            Analisi della repository in corso{ecosystem.totalFiles > 0 ? ' (parsing nel Web Worker, interfaccia libera)' : ''}…
          </div>
        )}
        {ecosystem.totalFiles === 0 && !showUploadPanel ? (
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-12 text-center space-y-3">
            <Layers className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-200">Nessun File Caricato</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Trascina una cartella di progetto Oracle SOA Suite o carica l'esempio per iniziare.
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <button
                onClick={() => setShowUploadPanel(true)}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold"
              >
                Apri Pannello Upload
              </button>
              <button
                onClick={handleLoadSample}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-700"
              >
                Carica Esempio Completo
              </button>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <HighLevelDashboard
                ecosystem={ecosystem}
                onNavigateToTab={(tab) => setActiveTab(tab)}
                onDownloadMasterDoc={handleDownloadFullMarkdown}
              />
            )}

            {activeTab === 'doc' && (
              <Suspense fallback={<div className="bg-slate-900 rounded-2xl border border-slate-800 p-12 text-center text-xs text-slate-400">Caricamento generatore documentazione…</div>}>
                <MasterDocGeneratorViewer ecosystem={ecosystem} />
              </Suspense>
            )}

            {activeTab === 'composites' && (
              <CompositeScaViewer composites={ecosystem.composites} />
            )}

            {activeTab === 'orchestration' && (
              <ProcessOrchestrationViewer
                bpmnProcesses={ecosystem.bpmnProcesses}
                bpelProcesses={ecosystem.bpelProcesses}
                mediators={ecosystem.mediators}
                humanTasks={ecosystem.humanTasks}
                ecosystem={ecosystem}
              />
            )}

            {activeTab === 'jca' && (
              <JcaAdapterSuiteViewer adapters={ecosystem.jcaAdapters} />
            )}

            {activeTab === 'contracts' && (
              <ContractsTransformsViewer
                wsdlContracts={ecosystem.wsdlContracts}
                xsdSchemas={ecosystem.xsdSchemas}
                xsltTransforms={ecosystem.xsltTransforms}
              />
            )}

            {activeTab === 'devops' && (
              <DevOpsAutomationViewer scripts={ecosystem.scripts} />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <p>
          Oracle SOA Suite & ADF Technical Architecture Generator • 100% Deterministico • Generazione Documentazione Markdown & SCA Topology
        </p>
      </footer>
    </div>
  );
}
