import React from 'react';
import {
  Layers,
  FileCode,
  GitBranch,
  Database,
  Terminal,
  Cpu,
  Workflow,
  Sparkles,
  Server,
  FolderTree,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { OracleEcosystem } from '../types/jca';

interface HighLevelDashboardProps {
  ecosystem: OracleEcosystem;
  onNavigateToTab: (tab: string) => void;
  onDownloadMasterDoc: () => void;
}

export const HighLevelDashboard: React.FC<HighLevelDashboardProps> = ({
  ecosystem,
  onNavigateToTab,
  onDownloadMasterDoc,
}) => {
  const extensionEntries = React.useMemo(() => Object.entries(ecosystem.fileCountByExtension).sort((a, b) => b[1] - a[1]), [ecosystem.fileCountByExtension]);
  const totalArtifacts = ecosystem.totalFiles;

  const uniqueJndis = React.useMemo(() => Array.from(
    new Set(
      ecosystem.jcaAdapters
        .map((j) => j.connectionFactory.location)
        .filter(Boolean)
    )
  ), [ecosystem.jcaAdapters]);

  return (
    <div className="space-y-6 animate-fadeIn" id="high-level-dashboard">
      {/* Executive Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-800/40 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-1/3 -top-10 w-60 h-60 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-semibold tracking-wide uppercase">
              <Layers className="w-3.5 h-3.5" />
              Oracle Fusion Middleware • SOA Suite & ADF Ecosystem
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Visione Architetturale di Alto Livello
            </h1>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Analisi unificata dell'ecosistema di integrazione: mapping automatico tra <strong className="text-white">Compositi SCA</strong>, <strong className="text-white">Orchestrazioni BPMN/BPEL</strong>, <strong className="text-white">Adapter JCA</strong>, <strong className="text-white">Contratti WSDL/XSD</strong> e <strong className="text-white">Script DevOps WLST</strong>.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 self-start lg:self-center shrink-0">
            <button
              onClick={onDownloadMasterDoc}
              id="btn-download-master-doc-hero"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-medium text-sm shadow-lg shadow-indigo-500/25 transition-all active:scale-95"
            >
              <Sparkles className="w-4 h-4" />
              Scarica ZIP docs-as-code
            </button>
            <button
              onClick={() => onNavigateToTab('doc')}
              id="btn-view-master-doc-hero"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium text-sm transition-all"
            >
              <FileCode className="w-4 h-4" />
              Generatore & Markdown
            </button>
          </div>
        </div>

        {/* Global Key Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-6 mt-6 border-t border-indigo-800/40">
          <div className="bg-slate-800/50 backdrop-blur rounded-xl p-3.5 border border-slate-700/50">
            <div className="text-xs font-medium text-slate-400">File Totali</div>
            <div className="text-xl sm:text-2xl font-bold text-white mt-1">{totalArtifacts}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Analizzati</div>
          </div>
          <div className="bg-slate-800/50 backdrop-blur rounded-xl p-3.5 border border-slate-700/50">
            <div className="text-xs font-medium text-indigo-300">Compositi SCA</div>
            <div className="text-xl sm:text-2xl font-bold text-indigo-100 mt-1">{ecosystem.composites.length}</div>
            <div className="text-[11px] text-indigo-300/70 mt-0.5">composite.xml</div>
          </div>
          <div className="bg-slate-800/50 backdrop-blur rounded-xl p-3.5 border border-slate-700/50">
            <div className="text-xs font-medium text-amber-300">Processi BPM/BPEL</div>
            <div className="text-xl sm:text-2xl font-bold text-amber-100 mt-1">
              {ecosystem.bpmnProcesses.length + ecosystem.bpelProcesses.length}
            </div>
            <div className="text-[11px] text-amber-300/70 mt-0.5">{ecosystem.bpmnProcesses.length} bpmn / {ecosystem.bpelProcesses.length} bpel</div>
          </div>
          <div className="bg-slate-800/50 backdrop-blur rounded-xl p-3.5 border border-slate-700/50">
            <div className="text-xs font-medium text-emerald-300">Adapter JCA</div>
            <div className="text-xl sm:text-2xl font-bold text-emerald-100 mt-1">{ecosystem.jcaAdapters.length}</div>
            <div className="text-[11px] text-emerald-300/70 mt-0.5">DB, JMS, File, AQ</div>
          </div>
          <div className="bg-slate-800/50 backdrop-blur rounded-xl p-3.5 border border-slate-700/50">
            <div className="text-xs font-medium text-cyan-300">Contratti WSDL/XSD</div>
            <div className="text-xl sm:text-2xl font-bold text-cyan-100 mt-1">
              {ecosystem.wsdlContracts.length + ecosystem.xsdSchemas.length}
            </div>
            <div className="text-[11px] text-cyan-300/70 mt-0.5">{ecosystem.wsdlContracts.length} wsdl / {ecosystem.xsdSchemas.length} xsd</div>
          </div>
          <div className="bg-slate-800/50 backdrop-blur rounded-xl p-3.5 border border-slate-700/50">
            <div className="text-xs font-medium text-purple-300">Script DevOps</div>
            <div className="text-xl sm:text-2xl font-bold text-purple-100 mt-1">{ecosystem.scripts.length}</div>
            <div className="text-[11px] text-purple-300/70 mt-0.5">WLST py, shell sh</div>
          </div>
        </div>
      </div>

      {/* Layer Architecture & Flow Mapping */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Layer 1: Inbound & Routing */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 text-sm">1. Esposizione & Mediazione</h3>
                <p className="text-xs text-slate-500">Inbound Services & Mediators</p>
              </div>
            </div>
            <button
              onClick={() => onNavigateToTab('composites')}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"
            >
              Dettagli <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex justify-between items-center py-1.5 px-2.5 bg-slate-50 rounded-lg">
              <span>Servizi Inbound SOAP/REST:</span>
              <span className="font-semibold text-slate-900">
                {ecosystem.composites.reduce((acc, c) => acc + c.services.length, 0)}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 px-2.5 bg-slate-50 rounded-lg">
              <span>Oracle Mediators (.mplan):</span>
              <span className="font-semibold text-slate-900">{ecosystem.mediators.length}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 px-2.5 bg-slate-50 rounded-lg">
              <span>Trasformazioni XSLT (.xsl):</span>
              <span className="font-semibold text-slate-900">{ecosystem.xsltTransforms.length}</span>
            </div>
          </div>
        </div>

        {/* Layer 2: Business Logic & Orchestration */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <Workflow className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 text-sm">2. Orchestrazione & Processi</h3>
                <p className="text-xs text-slate-500">BPMN 2.0, BPEL & Human Tasks</p>
              </div>
            </div>
            <button
              onClick={() => onNavigateToTab('orchestration')}
              className="text-xs text-amber-600 hover:text-amber-700 font-medium inline-flex items-center gap-1"
            >
              Dettagli <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex justify-between items-center py-1.5 px-2.5 bg-slate-50 rounded-lg">
              <span>Processi BPMN 2.0 (.bpmn):</span>
              <span className="font-semibold text-slate-900">{ecosystem.bpmnProcesses.length}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 px-2.5 bg-slate-50 rounded-lg">
              <span>Processi BPEL (.bpel):</span>
              <span className="font-semibold text-slate-900">{ecosystem.bpelProcesses.length}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 px-2.5 bg-slate-50 rounded-lg">
              <span>Human Approval Tasks (.task):</span>
              <span className="font-semibold text-slate-900">{ecosystem.humanTasks.length}</span>
            </div>
          </div>
        </div>

        {/* Layer 3: Integration & Backend */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 text-sm">3. Connettori & Risorse</h3>
                <p className="text-xs text-slate-500">JCA Adapters & JNDI Matrix</p>
              </div>
            </div>
            <button
              onClick={() => onNavigateToTab('jca')}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium inline-flex items-center gap-1"
            >
              Dettagli <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex justify-between items-center py-1.5 px-2.5 bg-slate-50 rounded-lg">
              <span>Adapter Database (DB JCA):</span>
              <span className="font-semibold text-slate-900">
                {ecosystem.jcaAdapters.filter((j) => j.adapter === 'db').length}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 px-2.5 bg-slate-50 rounded-lg">
              <span>Adapter JMS / MQ:</span>
              <span className="font-semibold text-slate-900">
                {ecosystem.jcaAdapters.filter((j) => j.adapter === 'jms' || j.adapter === 'mq').length}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 px-2.5 bg-slate-50 rounded-lg">
              <span>JNDI Locations Uniche:</span>
              <span className="font-semibold text-slate-900">{uniqueJndis.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Breakdown by Extension Table & Inventory Matrix */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-800">
              Inventario Completo delle Estensioni & Ruolo Architetturale
            </h2>
            <p className="text-xs text-slate-500">
              Mappatura di tutti i file rilevati nell'ecosistema Oracle SOA / ADF
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
            {extensionEntries.length} Estensioni Rilevate
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <th className="py-2.5 px-3">Estensione</th>
                <th className="py-2.5 px-3">Conteggio</th>
                <th className="py-2.5 px-3">% su Totale</th>
                <th className="py-2.5 px-3">Ambito Funzionale</th>
                <th className="py-2.5 px-3">Ruolo nell'Infrastruttura</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {extensionEntries.map(([ext, count]) => {
                const percentage = totalArtifacts > 0 ? ((count / totalArtifacts) * 100).toFixed(1) : '0';
                let scope = 'Configurazione / Altro';
                let role = 'File di supporto generale';
                let badgeColor = 'bg-slate-100 text-slate-700';

                if (ext === '.xml') {
                  scope = 'SCA & Descrittori';
                  role = 'composite.xml, deployment plans, Spring context';
                  badgeColor = 'bg-blue-100 text-blue-800';
                } else if (ext === '.wsdl') {
                  scope = 'Interfacce di Servizio';
                  role = 'Definizione contratti SOAP, PortTypes e messaggi';
                  badgeColor = 'bg-cyan-100 text-cyan-800';
                } else if (ext === '.xsd') {
                  scope = 'Dati & Schemi XML';
                  role = 'Strutture dati complesse (complexType) e validazione';
                  badgeColor = 'bg-teal-100 text-teal-800';
                } else if (ext === '.jca') {
                  scope = 'Integrazione JCA';
                  role = 'Connessioni a DB, Code JMS, FTP e adapter di risorsa';
                  badgeColor = 'bg-emerald-100 text-emerald-800';
                } else if (ext === '.bpmn') {
                  scope = 'Business Process (BPMN)';
                  role = 'Processi grafici BPMN 2.0, swimlanes e user tasks';
                  badgeColor = 'bg-amber-100 text-amber-800';
                } else if (ext === '.bpel') {
                  scope = 'Orchestrazione (BPEL)';
                  role = 'Flussi di esecuzione WS-BPEL, partner links, invoke/reply';
                  badgeColor = 'bg-orange-100 text-orange-800';
                } else if (ext === '.mplan') {
                  scope = 'Mediazione & Routing';
                  role = 'Oracle Mediator routing rules, filtri condizionali, echo';
                  badgeColor = 'bg-indigo-100 text-indigo-800';
                } else if (ext === '.task') {
                  scope = 'Human Workflow';
                  role = 'Task interattivi di approvazione e gestione partecipanti';
                  badgeColor = 'bg-rose-100 text-rose-800';
                } else if (ext === '.xsl' || ext === '.xslt') {
                  scope = 'Data Transformation';
                  role = 'Fogli di stile XSLT per conversione schemi XML';
                  badgeColor = 'bg-purple-100 text-purple-800';
                } else if (ext === '.dcx' || ext === '.cpx') {
                  scope = 'ADF Data Bindings';
                  role = 'Definizioni Data Control e Page Binding ADF';
                  badgeColor = 'bg-violet-100 text-violet-800';
                } else if (ext === '.py' || ext === '.sh') {
                  scope = 'DevOps & Automazione';
                  role = 'Script WLST (WebLogic) e Shell per build/deploy/packaging';
                  badgeColor = 'bg-fuchsia-100 text-fuchsia-800';
                } else if (ext === '.sql') {
                  scope = 'Database Relazionale';
                  role = 'Script SQL, DDL tabelle, viste o package PL/SQL';
                  badgeColor = 'bg-emerald-100 text-emerald-800';
                }

                return (
                  <tr key={ext} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-mono ${badgeColor}`}>
                        {ext || '(senza estensione)'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{count}</td>
                    <td className="py-2.5 px-3 text-slate-500">{percentage}%</td>
                    <td className="py-2.5 px-3 font-medium text-slate-700">{scope}</td>
                    <td className="py-2.5 px-3 text-slate-600">{role}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* JNDI Resources & Infrastructure Dependencies */}
      {uniqueJndis.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-semibold text-slate-800">
              Matrice Dipendenze Infrastrutturali & JNDI Location
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            Elenco delle risorse WebLogic (JDBC Data Sources, JMS Connection Factories) censite nei file JCA:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {uniqueJndis.map((jndi) => {
              const usingAdapters = ecosystem.jcaAdapters.filter((j) => j.connectionFactory.location === jndi);
              return (
                <div key={jndi} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/70 space-y-2">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-slate-600" />
                    <span className="font-mono text-xs font-bold text-slate-900 break-all">{jndi}</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Utilizzato da <strong className="text-slate-800">{usingAdapters.length}</strong> adapter:
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {usingAdapters.map((j) => (
                      <span key={j.id} className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-mono text-slate-700">
                        {j.name} ({j.adapter})
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
