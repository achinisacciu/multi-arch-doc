import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { OracleEcosystem } from './types/jca';
import { buildOracleEcosystem } from './services/ecosystemParser';
import { getSampleOracleEcosystem } from './data/sampleEcosystem';
import { generateHighLevelArchitectureDoc } from './services/masterDocGenerator';
import { FileDropzone } from './components/FileDropzone';
import { HighLevelDashboard } from './components/HighLevelDashboard';
import { MasterDocGeneratorViewer } from './components/MasterDocGeneratorViewer';
import { CompositeScaViewer } from './components/CompositeScaViewer';
import { ProcessOrchestrationViewer } from './components/ProcessOrchestrationViewer';
import { JcaAdapterSuiteViewer } from './components/JcaAdapterSuiteViewer';
import { ContractsTransformsViewer } from './components/ContractsTransformsViewer';
import { DevOpsAutomationViewer } from './components/DevOpsAutomationViewer';
import { PlatformRegistryViewer } from './components/PlatformRegistryViewer';
import { GlobalGraphViewer } from './components/GlobalGraphViewer';
import { TraceImpactViewer } from './components/TraceImpactViewer';
import { DEFAULT_BASE, fetchHealth } from './services/platformApi';

/* ---------- Fallback locale: deriva Registry/Graph da ecosystem quando backend non disponibile ---------- */
function deriveRegistryFromEcosystem(eco: OracleEcosystem): any {
  const artifacts: any[] = [];
  const by_type: Record<string, number> = {};
  const add = (type: string, rel: string, name: string, detected: string) => {
    const id = `local_${type}_${rel.replace(/[^a-z0-9]/gi,'_').slice(0,40)}_${artifacts.length}`;
    artifacts.push({ id, type, path: rel, relativePath: rel, detected_by: detected, size: 0 });
    by_type[type] = (by_type[type]||0)+1;
  };
  eco.composites.forEach(c=> add('sca_composite', c.relativePath, c.name, 'local+extension+namespace'));
  eco.bpelProcesses.forEach(b=> add('bpel', b.relativePath, b.name, 'local+extension'));
  eco.bpmnProcesses.forEach(b=> add('bpmn', b.relativePath, b.name, 'local+extension'));
  eco.wsdlContracts.forEach(w=> add('wsdl', w.relativePath, w.name, 'local+extension+namespace'));
  eco.xsdSchemas.forEach(x=> add('xsd', x.relativePath, x.name, 'local+extension+namespace'));
  eco.xsltTransforms.forEach(x=> add('xslt', x.relativePath, x.name, 'local+extension'));
  eco.jcaAdapters.forEach(j=> add('jca', j.relativePath, j.name, 'local+extension'));
  eco.mediators.forEach(m=> add('mplan', m.relativePath, m.name, 'local+extension'));
  eco.humanTasks.forEach(h=> add('task', h.relativePath, h.name, 'local+extension'));
  eco.componentTypes.forEach(c=> add('componentType', c.relativePath, c.name, 'local+extension'));
  eco.dvms.forEach(d=> add('dvm', d.relativePath, d.name, 'local+extension'));
  eco.scripts.forEach(s=> add(s.type==='py'?'py': s.type==='sh'?'sh': s.type==='sql'?'sql':'other', s.relativePath, s.name, 'local+extension'));
  // rawFiles not yet parsed -> conteggia residui
  const knownPaths = new Set(artifacts.map(a=>a.relativePath));
  eco.rawFiles.forEach(r=>{
    if(!knownPaths.has(r.relativePath)){
      const ext = r.extension.replace('.','') || 'other';
      const t = ext==='componenttype' ? 'componentType' : ext.length<10? ext : 'other';
      add(t, r.relativePath, r.name, 'local+fallback');
    }
  });
  return { root: 'local://ecosystem', total: artifacts.length, by_type, artifacts, source: 'local-ecosystem' };
}
function deriveGraphFromEcosystem(eco: OracleEcosystem): any {
  const nodes: any[] = [];
  const edges: any[] = [];
  const pushNode = (id: string, type: string, label: string, rel: string)=> nodes.push({ id, type, label, relativePath: rel });
  eco.composites.forEach(c=>{
    pushNode(c.id, 'sca_composite', c.name, c.relativePath);
    c.wires.forEach(w=> edges.push({ source: w.source, target: w.target, type: 'wires', evidence: {artifact: c.relativePath}}));
    c.services.forEach(s=> pushNode(`svc_${s.name}`, 'sca_service', s.name, c.relativePath));
    c.references.forEach(r=> pushNode(`ref_${r.name}`, 'sca_reference', r.name, c.relativePath));
  });
  eco.bpelProcesses.forEach(b=>{
    pushNode(b.id, 'bpel', b.name, b.relativePath);
    b.invokes.forEach(inv=> edges.push({ source: b.name, target: inv.partnerLink, type: 'invokes', operation: inv.operation }));
    b.partnerLinks.forEach(pl=> pushNode(`pl_${pl.name}`, 'partnerLink', pl.name, b.relativePath));
  });
  eco.bpmnProcesses.forEach(b=>{
    pushNode(b.id, 'bpmn', b.name, b.relativePath);
    b.serviceTasks.forEach(t=> edges.push({ source: b.name, target: t.name, type: 'serviceTask'}));
  });
  eco.wsdlContracts.forEach(w=>{
    pushNode(w.id, 'wsdl', w.name, w.relativePath);
    w.imports.forEach(imp=> edges.push({ source: w.name, target: imp, type: 'imports'}));
    w.portTypes.forEach(pt=> pt.operations.forEach(op=> edges.push({ source: w.name, target: op.name, type: 'operation'})));
  });
  eco.xsdSchemas.forEach(x=>{
    pushNode(x.id, 'xsd', x.name, x.relativePath);
    x.imports.forEach(imp=> edges.push({ source: x.name, target: imp, type: 'xsd_imports'}));
  });
  eco.xsltTransforms.forEach(x=>{
    pushNode(x.id, 'xslt', x.name, x.relativePath);
    x.templateMatches.forEach(tm=> edges.push({ source: x.name, target: tm, type: 'xslt_template'}));
  });
  eco.mediators.forEach(m=>{
    pushNode(m.id, 'mediator', m.name, m.relativePath);
    m.operations.forEach(op=> op.routingRules.forEach(r=> { if(r.targetService) edges.push({ source: m.name, target: r.targetService, type: 'mediator_route'}); }));
  });
  return { nodes, edges, stats: { nodes: nodes.length, edges: edges.length, density: nodes.length? edges.length/(nodes.length*(nodes.length-1)) : 0 } };
}
function deriveLineageFromEcosystem(eco: OracleEcosystem): any {
  const edges: any[] = [];
  eco.xsltTransforms.forEach(x=> edges.push({ source: x.name, target: x.templateMatches[0]||'target', type: 'xslt_transform', via: x.relativePath, confidence: 0.7 }));
  return { edges, stats: { total: edges.length } };
}
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
  GitBranch,
  Search,
  Network,
} from 'lucide-react';

export default function App() {
  const [ecosystem, setEcosystem] = useState<OracleEcosystem>(() =>
    getSampleOracleEcosystem()
  );
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [showUploadPanel, setShowUploadPanel] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  // Platform — unified single entry (npm run dev → Vite 3000 proxy + Python 8000)
  // DEFAULT_BASE = "" in dev (proxied) or same-origin in prod; override via VITE_API_BASE
  const [platformBase, setPlatformBase] = useState<string>(DEFAULT_BASE);
  const [showAdvancedBackend, setShowAdvancedBackend] = useState(false);
  const [platformJob, setPlatformJob] = useState<string | null>(null);
  const [platformRegistry, setPlatformRegistry] = useState<any>(null);
  const [platformGraph, setPlatformGraph] = useState<any>(null);
  const [platformLineage, setPlatformLineage] = useState<any>(null);
  const [platformStatus, setPlatformStatus] = useState<string>("verifica...");

  const apiBaseResolved = platformBase || DEFAULT_BASE;
  const apiTarget = apiBaseResolved || "/api (proxy)";

  // Fallback locale sempre disponibile
  const fallbackRegistry = deriveRegistryFromEcosystem(ecosystem);
  const fallbackGraph = deriveGraphFromEcosystem(ecosystem);
  const fallbackLineage = deriveLineageFromEcosystem(ecosystem);
  const displayRegistry = platformRegistry || (ecosystem.totalFiles>0 ? fallbackRegistry : null);
  const displayGraph = platformGraph || (ecosystem.totalFiles>0 ? fallbackGraph : null);
  const displayLineage = platformLineage || (ecosystem.totalFiles>0 ? fallbackLineage : null);
  const isLocalFallback = !platformRegistry && !!displayRegistry;

  useEffect(() => {
    const base = apiBaseResolved;
    fetchHealth(base).then(()=>setPlatformStatus("connesso")).catch(()=>setPlatformStatus("disconnesso"));
    // prova a recuperare ultimo registry backend se disponibile
    const mkUrl = (p: string) => base ? `${base}${p}` : p;
    fetch(mkUrl(`/api/registry`)).then(r=>r.json()).then(j=>{
      if(j && j.artifacts && j.total) { setPlatformRegistry(j); setPlatformStatus("connesso"); }
    }).catch(()=>{});
    fetch(mkUrl(`/api/graph`)).then(r=>r.json()).then(g=>{ if(g && g.nodes) setPlatformGraph(g); }).catch(()=>{});
    fetch(mkUrl(`/api/lineage`)).then(r=>r.json()).then(l=>{ if(l && l.edges) setPlatformLineage(l); }).catch(()=>{});
  }, [apiBaseResolved]);

  const handlePlatformConnect = async (projectPath?: string) => {
    const base = apiBaseResolved;
    const mkUrl = (p: string) => base ? `${base}${p}` : p;
    try {
      if (projectPath) {
        const r = await fetch(mkUrl(`/api/analyze`), { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ project_path: projectPath }) });
        if (!r.ok) throw new Error(await r.text());
        const j = await r.json();
        if (j.job_id) setPlatformJob(j.job_id);
        const reg = await fetch(mkUrl(`/api/registry?job=${j.job_id}`)).then(r=>r.json()).catch(()=>null);
        if (reg) setPlatformRegistry(reg);
        const g = await fetch(mkUrl(`/api/graph?job=${j.job_id}`)).then(r=>r.json()).catch(()=>null);
        if (g) setPlatformGraph(g);
        const lin = await fetch(mkUrl(`/api/lineage?job=${j.job_id}`)).then(r=>r.json()).catch(()=>null);
        if (lin) setPlatformLineage(lin);
        setPlatformStatus("connesso");
        setActiveTab('registry');
      } else {
        const r = await fetch(mkUrl(`/api/registry`)).then(r=>r.json()).catch(()=>null);
        if (r && r.artifacts) { setPlatformRegistry(r); setPlatformStatus("connesso"); }
        else { setPlatformStatus("disconnesso"); }
      }
    } catch(e){ setPlatformStatus("errore"); }
  };

  // Ingest newly loaded files into the ecosystem state + tentativo sync backend (unified ingest)
  const handleFilesLoaded = (
    newFiles: Array<{ content: string; name: string; relativePath: string }>
  ) => {
    setEcosystem((prev) => {
      const lowerNew = new Set(newFiles.map((n) => n.relativePath.toLowerCase()));
      const existing = prev.rawFiles.filter(
        (f) => !lowerNew.has(f.relativePath.toLowerCase())
      );
      const combined = [...existing, ...newFiles];
      return buildOracleEcosystem(combined);
    });
    setActiveTab('overview');
    setShowUploadPanel(false);
    // Fire-and-forget sync con backend se connesso: invia files[] per popolare canonical/registry/graph
    (async()=>{
      const base = apiBaseResolved;
      const mkUrl = (p: string) => base ? `${base}${p}` : p;
      try{
        const health = await fetch(mkUrl(`/api/health`)).then(r=>r.ok).catch(()=>false);
        if(!health) return;
        const payload = { files: newFiles.map(f=>({ name: f.relativePath, content: f.content })), options: {} };
        const r = await fetch(mkUrl(`/api/analyze`), { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload) });
        if(!r.ok) return;
        const j = await r.json();
        if(j.job_id) setPlatformJob(j.job_id);
        if(j.registry) setPlatformRegistry(j.registry);
        else {
          const reg = await fetch(mkUrl(`/api/registry?job=${j.job_id}`)).then(r=>r.json()).catch(()=>null);
          if(reg?.artifacts) setPlatformRegistry(reg);
        }
        const g = await fetch(mkUrl(`/api/graph?job=${j.job_id}`)).then(r=>r.json()).catch(()=>null);
        if(g?.nodes) setPlatformGraph(g);
        const lin = await fetch(mkUrl(`/api/lineage?job=${j.job_id}`)).then(r=>r.json()).catch(()=>null);
        if(lin?.edges) setPlatformLineage(lin);
      }catch(e){ console.warn("sync backend fallito (uso fallback locale)", e); }
    })();
  };

  const handleLoadSample = () => {
    const sample = getSampleOracleEcosystem();
    setEcosystem(sample);
    setActiveTab('overview');
    setShowUploadPanel(false);
  };

  const handleClearAll = () => {
    setEcosystem(buildOracleEcosystem([]));
    setShowUploadPanel(true);
  };

  const handleDownloadFullMarkdown = () => {
    const md = generateHighLevelArchitectureDoc(ecosystem, {
      language: 'it',
      docTitle: 'Documentazione Tecnica Completa & Architettura di Sistema (Oracle SOA Suite & ADF)',
      sections: {
        includeSummary: true,
        includeArchitectureTopology: true,
        includeCompositesMatrix: true,
        includeProcessesBpmnBpel: true,
        includeMediatorsCatalog: true,
        includeHumanTasksCatalog: true,
        includeJcaMatrix: true,
        includeWsdlXsdCatalog: true,
        includeXsltCatalog: true,
        includeAdfBindings: true,
        includeDevOpsChecklist: true,
        includeMermaidDiagrams: true,
      },
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DOCUMENTAZIONE_ARCHITETTURALE_COMPLETA_SOA_ADF_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);

    setDownloadSuccess(true);
    setTimeout(() => {
      setDownloadSuccess(false);
    }, 4000);
  };

  // Unico pulsante "Scarica tutto" — un unico ZIP in un unico posto (browser Downloads)
  // Se backend canonical disponibile → scarica ZIP backend (canonical.json + registry + docs + bpmn analisi)
  // Altrimenti → genera ZIP locale (registry + graph + lineage + docs) — tutto analizzato al drop
  const handleDownloadAll = async () => {
    if (ecosystem.totalFiles === 0 && !displayRegistry) return;
    setIsDownloading(true);
    const date = new Date().toISOString().slice(0,10);
    const base = apiBaseResolved;
    const mkUrl = (p: string) => base ? `${base}${p}` : p;
    // 1) Prova backend se job disponibile
    if (platformJob) {
      try {
        const url = mkUrl(`/api/download/${platformJob}`);
        const r = await fetch(url);
        if (r.ok) {
          const blob = await r.blob();
          const a = document.createElement('a');
          const blobUrl = URL.createObjectURL(blob);
          a.href = blobUrl;
          a.download = `SOA_Platform_CANONICAL_${platformJob.slice(0,8)}_${date}.zip`;
          document.body.appendChild(a);
          a.click();
          setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(blobUrl); }, 1000);
          setDownloadSuccess(true); setTimeout(()=>setDownloadSuccess(false),4000);
          setIsDownloading(false);
          return;
        }
      } catch(e){ console.warn("download backend fallito, fallback locale", e); }
    }
    // 2) Fallback: ZIP locale unificato — tutto in un unico posto
    try {
      const zip = new JSZip();
      const md = generateHighLevelArchitectureDoc(ecosystem, {
        language: 'it',
        docTitle: 'Documentazione Tecnica Completa & Architettura di Sistema (Oracle SOA Suite & ADF) — Pacchetto Unificato',
        sections: {
          includeSummary: true,
          includeArchitectureTopology: true,
          includeCompositesMatrix: true,
          includeProcessesBpmnBpel: true,
          includeMediatorsCatalog: true,
          includeHumanTasksCatalog: true,
          includeJcaMatrix: true,
          includeWsdlXsdCatalog: true,
          includeXsltCatalog: true,
          includeAdfBindings: true,
          includeDevOpsChecklist: true,
          includeMermaidDiagrams: true,
        },
      });
      zip.file(`01_DOCUMENTAZIONE/HIGH_LEVEL_ARCHITECTURE.md`, md);
      // Canonical locale
      zip.file(`00_CANONICAL/registry.json`, JSON.stringify(displayRegistry, null, 2));
      zip.file(`00_CANONICAL/graph.json`, JSON.stringify(displayGraph, null, 2));
      zip.file(`00_CANONICAL/lineage.json`, JSON.stringify(displayLineage, null, 2));
      // Prova anche canonical backend se recuperabile senza job
      if (!platformJob && platformStatus==="connesso") {
        try{
          const c = await fetch(mkUrl(`/api/canonical`)).then(r=>r.ok?r.json():null).catch(()=>null);
          if(c) zip.file(`00_CANONICAL/canonical.json`, JSON.stringify(c, null, 2));
        }catch{}
      }
      zip.file(`README.txt`, `Pacchetto Unificato SOA Platform — ${date}\nSorgente: ${isLocalFallback ? 'LOCALE (ecosystemParser frontend)' : 'CANONICAL backend (soa-reverse-engineer)'}\nTotale artifact: ${displayRegistry?.total || ecosystem.totalFiles}\nBackend: ${platformStatus} ${apiTarget} ${platformJob?`(job ${platformJob.slice(0,8)})`:''}\n\nContenuto:\n- 00_CANONICAL/ registry+graph+lineage (+canonical.json se backend)\n- 01_DOCUMENTAZIONE/ HIGH_LEVEL_ARCHITECTURE.md\n\nOutput salvato in un unico ZIP — estrailo in una cartella a scelta (es. ./output).\n`);
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SOA_Platform_UNIFIED_${date}.zip`;
      document.body.appendChild(a);
      a.click();
      setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
      setDownloadSuccess(true); setTimeout(()=>setDownloadSuccess(false),4000);
    } catch(e){
      console.error("zip locale fallito", e);
      // ultimo fallback: solo md
      handleDownloadFullMarkdown();
    } finally { setIsDownloading(false); }
  };

  const navTabs = [
    { id: 'overview', label: 'Visione Alto Livello', icon: Layers, count: ecosystem.totalFiles },
    { id: 'registry', label: 'Registry', icon: Database, count: displayRegistry?.total ?? ecosystem.totalFiles },
    { id: 'graph', label: 'Graph', icon: Network, count: displayGraph?.nodes?.length ?? 0 },
    { id: 'trace', label: 'Trace & Impact', icon: Search, count: undefined },
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
    <div className="min-h-screen bg-[#000000] text-[#D9D9D9] flex flex-col font-sans selection:bg-[#fc0000] selection:text-white">
      {/* Top Navbar — palette #0E2841 / #fc0000 */}
      <header className="bg-[#0E2841]/95 border-b border-[#0E2841] sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#fc0000] flex items-center justify-center text-white shadow-lg shadow-[#fc0000]/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-bold text-white tracking-tight">
                  SOA Platform
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#fc0000]/20 border border-[#fc0000]/30 text-[#D9D9D9] text-[10px] font-mono font-semibold uppercase">
                  Single Port 8000
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${platformStatus==="connesso" ? "bg-[#fc0000] text-white border-[#fc0000]" : "bg-[#D9D9D9] text-[#0E2841] border-[#D9D9D9]"}`}>
                  {platformStatus}
                </span>
              </div>
              <p className="text-[11px] text-[#D9D9D9]/70">
                Canonical • Graph • Trace • Impact • Docs — locale
              </p>
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-2.5">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#D9D9D9]/10 border border-[#D9D9D9]/20">
              <span className="text-[11px] font-mono text-[#D9D9D9]">Porta singola</span>
              <span className="text-xs font-bold text-[#fc0000]">8000</span>
              <span className="text-[10px] text-[#D9D9D9]/60">locale</span>
            </div>
            <button
              onClick={() => setShowUploadPanel(!showUploadPanel)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                showUploadPanel
                  ? 'bg-[#fc0000] border-[#fc0000] text-white'
                  : 'bg-[#0E2841] border-[#D9D9D9]/30 text-[#D9D9D9] hover:bg-[#000000]'
              }`}
            >
              <UploadCloud className="w-4 h-4" />
              <span className="hidden md:inline">{showUploadPanel ? 'Nascondi Upload' : 'Carica File'}</span>
            </button>

            <button
              id="top-right-download-all-md"
              onClick={handleDownloadAll}
              disabled={isDownloading || (ecosystem.totalFiles===0 && !displayRegistry)}
              title={platformJob ? `ZIP canonical da backend (job ${platformJob.slice(0,8)}) → Downloads` : "ZIP unificato locale (registry+graph+docs) → Downloads"}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-lg cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                downloadSuccess
                  ? 'bg-[#0E2841] shadow-[#0E2841]/30'
                  : 'bg-[#fc0000] hover:bg-[#d00000] shadow-[#fc0000]/30'
              }`}
            >
              {isDownloading ? (
                <>
                  <Download className="w-4 h-4 animate-spin" />
                  <span>Creo ZIP...</span>
                </>
              ) : downloadSuccess ? (
                <>
                  <Check className="w-4 h-4 text-white animate-bounce" />
                  <span>Scaricato!</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  <span>Scarica Tutto (ZIP)</span>
                </>
              )}
            </button>

            {ecosystem.totalFiles > 0 && (
              <button
                onClick={handleClearAll}
                title="Svuota progetto"
                className="p-2 rounded-xl text-[#D9D9D9] hover:text-[#fc0000] hover:bg-[#0E2841] transition-colors cursor-pointer border border-[#D9D9D9]/20"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl bg-[#0E2841] text-[#D9D9D9] border border-[#D9D9D9]/20"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Desktop Tab Navigation — palette */}
        <div className="hidden lg:block border-t border-[#0E2841] bg-[#000000]/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1 overflow-x-auto py-1">
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap cursor-pointer border ${
                    isActive
                      ? 'bg-[#fc0000] text-white border-[#fc0000] shadow-sm font-semibold'
                      : 'text-[#D9D9D9] hover:text-white hover:bg-[#0E2841] border-transparent'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono border ${
                        isActive ? 'bg-white text-[#fc0000] border-white' : 'bg-[#0E2841] text-[#D9D9D9] border-[#D9D9D9]/30'
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
          <div className="lg:hidden border-t border-[#0E2841] bg-[#000000] p-3 space-y-1">
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
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
                    isActive ? 'bg-[#fc0000] text-white border-[#fc0000] font-semibold' : 'text-[#D9D9D9] hover:bg-[#0E2841] border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </div>
                  {tab.count !== undefined && (
                    <span className="px-2 py-0.5 rounded-full bg-[#0E2841] text-[10px] font-mono border border-[#D9D9D9]/20">
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Platform bar — unified dev */}
      <div className="bg-[#D9D9D9]/10 border-b border-[#D9D9D9]/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col md:flex-row items-start md:items-center gap-3">
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className="px-2 py-1 rounded-full bg-[#0E2841] text-white font-mono border border-[#D9D9D9]/20">UNIFIED</span>
            <code className="px-2 py-1 rounded bg-black text-[#D9D9D9] font-mono text-xs border border-[#D9D9D9]/20">npm run dev</code>
            <span className="hidden md:inline text-[#D9D9D9]/50">→</span>
            <span className="px-2 py-1 rounded bg-[#0E2841] text-white font-mono text-xs">Vite :3000</span>
            <span className="text-[#D9D9D9]/50">+</span>
            <span className="px-2 py-1 rounded bg-[#fc0000] text-white font-mono text-xs">API :8000</span>
            <span className="hidden md:inline text-[#D9D9D9]/50 text-[10px]">proxy /api</span>
            <span className={`px-2 py-1 rounded-full text-[10px] font-mono border ${platformStatus==="connesso" ? "bg-[#fc0000] text-white border-[#fc0000]" : platformStatus==="verifica..." ? "bg-amber-500 text-white border-amber-500" : "bg-[#D9D9D9] text-[#0E2841] border-[#D9D9D9]"}`}>{platformStatus} · {apiTarget}</span>
          </div>
          <div className="flex items-center gap-2 ml-auto w-full md:w-auto">
            <button onClick={()=>handlePlatformConnect()} className="px-3 py-1.5 rounded-xl bg-[#0E2841] text-white text-xs font-semibold border border-[#0E2841] hover:bg-black">Refresh</button>
            <button onClick={()=>handlePlatformConnect()} className="hidden md:inline px-3 py-1.5 rounded-xl bg-[#fc0000] text-white text-xs font-bold">Analizza progetto locale</button>
            <button onClick={()=>setShowAdvancedBackend(v=>!v)} className="px-2 py-1.5 rounded-xl bg-white text-[#0E2841] text-[10px] font-mono border border-[#D9D9D9]">{showAdvancedBackend ? "Nascondi" : "Avanzate"}</button>
          </div>
        </div>
        {showAdvancedBackend && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-3 flex items-center gap-2">
            <span className="text-[11px] text-[#D9D9D9]/70">Override backend (vuoto = proxy/auto, es. http://127.0.0.1:8000):</span>
            <input value={platformBase} onChange={e=>setPlatformBase(e.target.value)} placeholder="(auto — proxy)" className="flex-1 md:w-72 px-3 py-1.5 rounded-xl border border-[#D9D9D9] bg-white text-xs font-mono text-[#0E2841] focus:border-[#fc0000] outline-none" />
            <span className="text-[10px] text-[#D9D9D9]/50 font-mono">VITE_API_BASE</span>
          </div>
        )}
      </div>

      {/* Cartella analizzata — output unificato */}
      {ecosystem.totalFiles>0 && (
        <div className="bg-[#0E2841] border-y border-[#D9D9D9]/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center gap-3 text-xs">
            <span className="px-2 py-1 rounded-full bg-[#fc0000] text-white font-bold text-[11px]">ANALIZZATO</span>
            <span className="text-[#D9D9D9]">{ecosystem.totalFiles} file • {displayRegistry?.total||0} artifact • {displayGraph?.nodes?.length||0} nodi graph</span>
            <span className="hidden md:inline text-[#D9D9D9]/50">→</span>
            <span className="text-[#D9D9D9]/80">Output in <b className="text-white">un unico ZIP</b> in <code className="bg-black px-1.5 py-0.5 rounded text-[#D9D9D9]">Downloads</code></span>
            <span className={`px-2 py-1 rounded-full text-[10px] font-mono ${platformJob ? "bg-emerald-600 text-white" : "bg-amber-500 text-white"}`}>{platformJob ? `canonical job ${platformJob.slice(0,8)}` : "ZIP locale"}</span>
            <button onClick={handleDownloadAll} disabled={isDownloading} className="ml-auto px-3 py-1.5 rounded-xl bg-[#fc0000] text-white font-bold hover:bg-[#d00000] disabled:opacity-50 flex items-center gap-1.5">
              {isDownloading ? <Download className="w-3.5 h-3.5 animate-spin"/> : <FileDown className="w-3.5 h-3.5"/>}
              {isDownloading ? "Creo ZIP..." : "Scarica Tutto (ZIP) → Downloads"}
            </button>
          </div>
        </div>
      )}

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
        {ecosystem.totalFiles === 0 && !showUploadPanel && !platformRegistry ? (
          <div className="bg-white rounded-2xl border border-[#D9D9D9] p-12 text-center space-y-3">
            <Layers className="w-12 h-12 text-[#0E2841]/30 mx-auto" />
            <h3 className="text-base font-bold text-[#0E2841]">Nessun File Caricato</h3>
            <p className="text-xs text-[#0E2841]/60 max-w-md mx-auto">
              Trascina una <b>cartella intera</b> → viene analizzato <b>tutto automaticamente</b> (registry + graph + docs). Output in <b>un unico ZIP</b> via <code>Scarica Tutto (ZIP)</code> in <code>Downloads</code>.
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <button
                onClick={() => setShowUploadPanel(true)}
                className="px-4 py-2 rounded-xl bg-[#fc0000] text-white text-xs font-semibold"
              >
                Apri Pannello Upload
              </button>
              <button
                onClick={handleLoadSample}
                className="px-4 py-2 rounded-xl bg-[#0E2841] text-white text-xs font-semibold border border-[#0E2841]"
              >
                Carica Esempio Helios
              </button>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <HighLevelDashboard
                ecosystem={ecosystem}
                onNavigateToTab={(tab) => setActiveTab(tab)}
                onDownloadMasterDoc={handleDownloadAll}
              />
            )}

            {activeTab === 'registry' && (
              displayRegistry ? (
                <div className="space-y-3">
                  {isLocalFallback && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-xs text-amber-800 flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">LOCALE</span>
                      Vista derivata da <b>ecosystemParser</b> (frontend) — backend canonical non connesso o non sincronizzato.
                      {platformStatus==="connesso" ? " Drop riproverà il sync automatico." : " Avvia backend (npm run dev:backend) o clicca Refresh/Analizza progetto locale per canonical."}
                    </div>
                  )}
                  {!isLocalFallback && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 text-xs text-emerald-800 flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">CANONICAL</span>
                      Registry da backend <code>soa-reverse-engineer</code> — fonte dati ufficiale (Evidence/Provenance).
                    </div>
                  )}
                  <PlatformRegistryViewer registry={displayRegistry} />
                </div>
              ) : <div className="bg-white border border-[#D9D9D9] rounded-2xl p-8 text-center text-sm text-[#0E2841]/60">Nessun file — carica via drag&drop o <code>npm run dev</code> + Analizza progetto locale.</div>
            )}

            {activeTab === 'graph' && (
              <div className="space-y-3">
                {isLocalFallback && displayGraph && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-xs text-amber-700">Graph locale derivato da ecosystem — per lineage/trace completi connetti backend.</div>
                )}
                <GlobalGraphViewer graph={displayGraph} lineage={displayLineage} />
              </div>
            )}

            {activeTab === 'trace' && (
              <TraceImpactViewer baseUrl={apiBaseResolved} jobId={platformJob} fallbackGraph={displayGraph} />
            )}

            {activeTab === 'doc' && <MasterDocGeneratorViewer ecosystem={ecosystem} />}

            {activeTab === 'composites' && (
              <CompositeScaViewer composites={ecosystem.composites} />
            )}

            {activeTab === 'orchestration' && (
              <ProcessOrchestrationViewer
                bpmnProcesses={ecosystem.bpmnProcesses}
                bpelProcesses={ecosystem.bpelProcesses}
                mediators={ecosystem.mediators}
                humanTasks={ecosystem.humanTasks}
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
      <footer className="border-t border-[#0E2841] bg-[#000000] py-4 text-center text-xs text-[#D9D9D9]/60">
        <p>
          SOA Platform • Single Port 8000 • Locale • Canonical JSON come fonte dati • Documentazione via web
        </p>
      </footer>
    </div>
  );
}
