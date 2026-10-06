import React, { useState, useEffect, useRef } from "react";
import {
  FileCode,
  Upload,
  Clipboard,
  Check,
  LayoutDashboard,
  FolderTree,
  TableProperties,
  Sparkles,
  RefreshCw,
  Cpu,
  Info,
  FolderOpen,
  Save,
  FileText,
  Files,
} from "lucide-react";
import { validateXML, formatXML, analyzeXML } from "./utils/xmlParser";
import { XMLNodeSummary, XMLValidationResult, XMLAnalysisStats, XMLTreeVisualNode } from "./types";
import { MetricCard } from "./components/MetricCard";
import { ValidationBanner } from "./components/ValidationBanner";
import { StatsDashboard } from "./components/StatsDashboard";
import { FieldTable } from "./components/FieldTable";
import { TreeViewer } from "./components/TreeViewer";
import { DocumentationViewer } from "./components/DocumentationViewer";
import { OutputPanel } from "./components/OutputPanel";
import { generateXmlReport } from "./engine/documenter";

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<CatalogoProdotto versione="1.0">
  <Produttore>
    <Id>12345</Id>
    <Nome>Acme S.p.A.</Nome>
    <Sede>
      <Indirizzo>Via Roma 1</Indirizzo>
      <Citta>Milano</Citta>
      <Provincia>MI</Provincia>
      <CAP>20100</CAP>
    </Sede>
  </Produttore>
  <Prodotti>
    <Prodotto id="P-100" categoria="software">
      <Nome>Analizzatore XML Pro</Nome>
      <Prezzo valuta="EUR">99.90</Prezzo>
      <Disponibile>true</Disponibile>
      <DataRilascio>2026-07-16</DataRilascio>
      <Tag>xml</Tag>
      <Tag>analisi</Tag>
    </Prodotto>
    <Prodotto id="P-200" categoria="hardware">
      <Nome>Server Rack 1U</Nome>
      <Prezzo valuta="EUR">1299.00</Prezzo>
      <Disponibile>false</Disponibile>
      <DataRilascio>2025-11-02</DataRilascio>
    </Prodotto>
  </Prodotti>
</CatalogoProdotto>`;

interface LoadedFolderFile {
  name: string;
  content: string;
}

export default function App() {
  const [xmlInput, setXmlInput] = useState(SAMPLE_XML);
  const [sourceName, setSourceName] = useState("esempio-catalogo.xml");
  const [validation, setValidation] = useState<XMLValidationResult | null>(null);
  const [nodes, setNodes] = useState<XMLNodeSummary[]>([]);
  const [stats, setStats] = useState<XMLAnalysisStats | null>(null);
  const [visualTree, setVisualTree] = useState<XMLTreeVisualNode | null>(null);

  // Documentation (rule-based, no AI)
  const [documentation, setDocumentation] = useState("");
  const [docLanguage, setDocLanguage] = useState<"it" | "en">("it");

  // Folder loading
  const [folderFiles, setFolderFiles] = useState<LoadedFolderFile[]>([]);
  const [folderPath, setFolderPath] = useState("");

  const [activeTab, setActiveTab] = useState<"dashboard" | "tree" | "fields" | "docs" | "output">("dashboard");
  const [copiedXML, setCopiedXML] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Trigger analysis automatically on input change or mount
  useEffect(() => {
    handleAnalyze(xmlInput);
  }, [xmlInput]);

  const handleAnalyze = (xml: string) => {
    const valResult = validateXML(xml);
    setValidation(valResult);

    if (valResult.isValid) {
      const { nodes: flatNodes, stats: computedStats, visualTree: tree } = analyzeXML(xml);
      setNodes(flatNodes);
      setStats(computedStats);
      setVisualTree(tree);
      setDocumentation("");
    } else {
      setNodes([]);
      setStats(null);
      setVisualTree(null);
      setDocumentation("");
    }
  };

  const handleBeautify = () => {
    const formatted = formatXML(xmlInput);
    setXmlInput(formatted);
  };

  const copyInputToClipboard = () => {
    navigator.clipboard.writeText(xmlInput);
    setCopiedXML(true);
    setTimeout(() => setCopiedXML(false), 2000);
  };

  const loadFile = (content: string, name: string) => {
    setSourceName(name);
    setXmlInput(content);
    setDocumentation("");
  };

  // Drag and Drop single file
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          loadFile(event.target.result as string, file.name);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          loadFile(event.target.result as string, file.name);
        }
      };
      reader.readAsText(file);
    }
    e.target.value = "";
  };

  // Folder picker: reads all .xml/.bpmn files inside the chosen folder
  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList: FileList = e.target.files;
    const files: File[] = Array.from(fileList);
    if (!files || files.length === 0) return;

    const list: LoadedFolderFile[] = [];
    const readers: Promise<void>[] = [];

    for (const file of files) {
      if (!/\.(xml|bpmn|bpel)$/i.test(file.name)) continue;
      readers.push(
        new Promise<void>((resolve) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              list.push({ name: file.name, content: event.target.result as string });
            }
            resolve();
          };
          reader.onerror = () => resolve();
          reader.readAsText(file);
        })
      );
    }

    Promise.all(readers).then(() => {
      if (list.length === 0) return;
      list.sort((a, b) => a.name.localeCompare(b.name));
      setFolderFiles(list);
      const rel = ((e.target as HTMLInputElement) as any).webkitRelativePath || "";
      const base = rel.split("/")[0] || "cartella selezionata";
      setFolderPath(base);
      loadFile(list[0].content, list[0].name);
    });
    e.target.value = "";
  };

  // Rule-based documentation generation (no AI)
  const handleGenerateDoc = (lang: "it" | "en") => {
    if (!stats || nodes.length === 0) return;
    const report = generateXmlReport(sourceName, nodes, stats, { language: lang });
    setDocLanguage(lang);
    setDocumentation(report);
  };

  const schemaJson = stats && nodes.length > 0
    ? {
        fileName: sourceName,
        analyzedAt: new Date().toISOString(),
        stats,
        nodes,
      }
    : null;

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900 font-sans flex flex-col antialiased">
      {/* Top Professional Header */}
      <header className="border-b border-gray-200/60 bg-white/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-tr from-blue-600 to-violet-600 rounded-xl text-white shadow-sm shadow-blue-500/20">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-display font-bold tracking-tight text-gray-950 flex items-center gap-1.5">
              XML Analyzer &amp; Documenter
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Strumento generalista di parsing, analisi gerarchica e generazione documentale .MD
            </p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-150 rounded-xl px-3 py-1.5 text-gray-500">
            <Info className="w-4 h-4 text-blue-500" />
            <span>Supporta file singoli, drag&amp;drop o intere cartelle</span>
          </div>
        </div>
      </header>

      {/* Main Grid Workspace */}
      <main className="flex-1 p-6 grid grid-cols-1 xl:grid-cols-12 gap-6 max-w-7xl mx-auto w-full">
        {/* Left Column: XML Code Editor */}
        <section className="xl:col-span-5 flex flex-col gap-4">
          <div className="glass-panel rounded-2xl border border-gray-100 overflow-hidden shadow-xs flex flex-col flex-1 h-full min-h-[450px]">
            {/* Editor Header */}
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-2">
              <span className="text-xs font-display font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                <FileCode className="w-4 h-4 text-blue-500" />
                Sorgente XML
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={copyInputToClipboard}
                  className="p-1.5 border border-gray-200 hover:bg-gray-50 text-gray-500 rounded-lg text-xs font-semibold bg-white shadow-2xs transition-all cursor-pointer"
                  title="Copia sorgente XML"
                >
                  {copiedXML ? <Check className="w-4 h-4 text-emerald-500" /> : <Clipboard className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => {
                    setXmlInput("");
                    setDocumentation("");
                  }}
                  className="p-1.5 border border-gray-200 hover:bg-red-50 hover:text-red-600 text-gray-500 rounded-lg text-xs font-semibold bg-white shadow-2xs transition-all cursor-pointer"
                  title="Pulisci Editor"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Drag and Drop Zone / Editor Box */}
            <div
              className={`flex-1 flex flex-col relative transition-all duration-300 ${
                isDragging ? "bg-blue-50/30 border-2 border-dashed border-blue-400" : ""
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {isDragging && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-blue-50/80 backdrop-blur-xs text-blue-800 font-medium">
                  <Upload className="w-10 h-10 mb-2 animate-bounce text-blue-600" />
                  <p>Trascina il file XML qui per caricarlo...</p>
                </div>
              )}

              <textarea
                value={xmlInput}
                onChange={(e) => setXmlInput(e.target.value)}
                placeholder="Incolla il tuo codice XML qui, trascina un file o seleziona un'intera cartella..."
                className="w-full flex-1 p-5 font-mono text-xs bg-slate-900 text-slate-100 border-none resize-none focus:outline-hidden min-h-[300px]"
                spellCheck="false"
              />

              {/* Upload triggers */}
              <div className="p-4 border-t border-gray-150 bg-gray-50/70 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept=".xml,text/xml,.bpmn"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <input
                    type="file"
                    ref={folderInputRef}
                    onChange={handleFolderSelect}
                    className="hidden"
                    // @ts-ignore webkitdirectory is not in standard TS types
                    webkitdirectory=""
                    directory=""
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 hover:bg-gray-100 text-gray-600 rounded-xl text-xs font-semibold transition-colors bg-white shadow-2xs cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" /> File XML
                  </button>
                  <button
                    onClick={() => folderInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 hover:bg-gray-100 text-gray-600 rounded-xl text-xs font-semibold transition-colors bg-white shadow-2xs cursor-pointer"
                    title="Seleziona un'intera cartella: verranno caricati tutti i file .xml/.bpmn"
                  >
                    <FolderOpen className="w-3.5 h-3.5" /> Cartella
                  </button>
                </div>
                <span className="text-[10px] text-gray-400 italic">
                  {sourceName} · Drag &amp; Drop o Seleziona
                </span>
              </div>
            </div>
          </div>

          {/* Folder file list */}
          {folderFiles.length > 0 && (
            <div className="glass-panel rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
                <Files className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-display font-bold text-gray-800 uppercase tracking-wider truncate">
                  {folderPath} · {folderFiles.length} file
                </span>
              </div>
              <div className="max-h-40 overflow-y-auto divide-y divide-gray-50">
                {folderFiles.map((f) => (
                  <button
                    key={f.name}
                    onClick={() => loadFile(f.content, f.name)}
                    className={`w-full px-5 py-2.5 flex items-center gap-2 text-left hover:bg-gray-50/70 transition-colors cursor-pointer ${
                      f.name === sourceName ? "bg-blue-50/40" : ""
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="text-xs font-mono text-gray-700 truncate">{f.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <ValidationBanner
            validation={validation}
            onBeautify={handleBeautify}
            canBeautify={validation?.isValid || false}
          />
        </section>

        {/* Right Column: Dynamic Analysis Panels */}
        <section className="xl:col-span-7 flex flex-col gap-6">
          {/* Navigation Tabs */}
          <div className="flex border-b border-gray-200 gap-1 overflow-x-auto">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`flex items-center gap-1.5 px-4 py-2.5 font-display text-xs font-bold border-b-2 transition-all shrink-0 cursor-pointer ${
                activeTab === "dashboard"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </button>
            <button
              onClick={() => setActiveTab("tree")}
              className={`flex items-center gap-1.5 px-4 py-2.5 font-display text-xs font-bold border-b-2 transition-all shrink-0 cursor-pointer ${
                activeTab === "tree"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              <FolderTree className="w-4 h-4" /> Albero Gerarchico
            </button>
            <button
              onClick={() => setActiveTab("fields")}
              className={`flex items-center gap-1.5 px-4 py-2.5 font-display text-xs font-bold border-b-2 transition-all shrink-0 cursor-pointer ${
                activeTab === "fields"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              <TableProperties className="w-4 h-4" /> Tabella dei Campi
            </button>
            <button
              onClick={() => setActiveTab("docs")}
              className={`flex items-center gap-1.5 px-4 py-2.5 font-display text-xs font-bold border-b-2 transition-all shrink-0 cursor-pointer ${
                activeTab === "docs"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              <Sparkles className="w-4 h-4 text-violet-500" /> Documentazione (.MD)
            </button>
            <button
              onClick={() => setActiveTab("output")}
              className={`flex items-center gap-1.5 px-4 py-2.5 font-display text-xs font-bold border-b-2 transition-all shrink-0 cursor-pointer ${
                activeTab === "output"
                  ? "border-emerald-600 text-emerald-600 font-bold"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              <Save className="w-4 h-4 text-emerald-500" /> Output
            </button>
          </div>

          {/* Active Tab Panel Body */}
          <div className="flex-1">
            {!validation?.isValid ? (
              <div className="glass-panel p-10 rounded-2xl text-center border-dashed border-gray-200 flex flex-col items-center justify-center min-h-[300px]">
                <FileCode className="w-12 h-12 text-gray-300 mb-3" />
                <h3 className="text-sm font-semibold text-gray-700">Analisi non disponibile</h3>
                <p className="text-xs text-gray-400 mt-1 max-w-sm">
                  Risolvi gli errori di sintassi visualizzati nell'editor per avviare il parser gerarchico
                  ed abilitare i moduli di statistica e documentazione.
                </p>
              </div>
            ) : (
              <>
                {activeTab === "dashboard" && stats && (
                  <div className="flex flex-col gap-6 animate-fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <MetricCard
                        title="Elementi Totali"
                        value={stats.totalElements}
                        subtitle="Occorrenze dei tag totali"
                        icon={FileCode}
                        colorClass="bg-blue-50 text-blue-600"
                      />
                      <MetricCard
                        title="Tag Unici / Percorsi"
                        value={stats.uniqueElements}
                        subtitle="Struttura dello schema"
                        icon={TableProperties}
                        colorClass="bg-violet-50 text-violet-600"
                      />
                      <MetricCard
                        title="Profondità Massima"
                        value={stats.maxDepth}
                        subtitle="Livello massimo di annidamento"
                        icon={FolderTree}
                        colorClass="bg-emerald-50 text-emerald-600"
                      />
                    </div>
                    <StatsDashboard stats={stats} />
                  </div>
                )}

                {activeTab === "tree" && (
                  <div className="animate-fade-in">
                    <TreeViewer rootNode={visualTree} />
                  </div>
                )}

                {activeTab === "fields" && (
                  <div className="animate-fade-in">
                    <FieldTable nodes={nodes} />
                  </div>
                )}

                {activeTab === "docs" && (
                  <div className="animate-fade-in">
                    <DocumentationViewer
                      documentation={documentation}
                      docLanguage={docLanguage}
                      onLanguageChange={setDocLanguage}
                      onGenerate={handleGenerateDoc}
                      onUpdateDocumentation={(doc) => setDocumentation(doc)}
                    />
                  </div>
                )}

                {activeTab === "output" && (
                  <div className="animate-fade-in">
                    <OutputPanel
                      reportMd={documentation || generateXmlReport(sourceName, nodes, stats!, { language: docLanguage })}
                      schemaJson={schemaJson}
                      sourceName={sourceName}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
