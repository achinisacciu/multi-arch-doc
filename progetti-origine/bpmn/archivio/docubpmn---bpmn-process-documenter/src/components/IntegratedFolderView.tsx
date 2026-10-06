import React, { useState } from 'react';
import { IntegratedFolderDoc, LoadedBpmnFile } from '../types';
import { 
  Folder, Layers, ArrowRight, Share2, ShieldAlert, FileText, CheckCircle2, 
  BarChart2, Users, GitMerge, Network, Eye, ExternalLink, HelpCircle, Activity, Gauge
} from 'lucide-react';

interface IntegratedFolderViewProps {
  integratedDoc: IntegratedFolderDoc;
  files: LoadedBpmnFile[];
  onSelectProcessFile: (fileId: string) => void;
}

export const IntegratedFolderView: React.FC<IntegratedFolderViewProps> = ({
  integratedDoc,
  files,
  onSelectProcessFile,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'links' | 'raci' | 'valuestream' | 'risks' | 'guide'>('overview');

  const totalTasks = integratedDoc.processSummaries.reduce((sum, p) => sum + p.tasksCount, 0);
  const totalGateways = integratedDoc.processSummaries.reduce((sum, p) => sum + p.gatewaysCount, 0);
  const totalCallActivities = integratedDoc.processSummaries.reduce((sum, p) => sum + p.callActivitiesCount, 0);

  return (
    <div className="space-y-6">

      {/* Hero Portfolio Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-lg border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5" />
                Documentazione Incrociata Multi-Processo
              </span>
              <span className="text-xs font-mono text-slate-400">
                {integratedDoc.totalFiles} File BPMN Caricati
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {integratedDoc.folderName}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              {integratedDoc.executiveSummary}
            </p>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-2 lg:grid-cols-5 gap-2 shrink-0">
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 text-center">
              <span className="text-[10px] text-slate-400 font-medium block uppercase">File Processo</span>
              <strong className="text-lg font-black text-indigo-400">{integratedDoc.totalFiles}</strong>
            </div>
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 text-center">
              <span className="text-[10px] text-slate-400 font-medium block uppercase">Media Complessità</span>
              <strong className="text-lg font-black text-indigo-300">{integratedDoc.averageComplexity || 0}</strong>
            </div>
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 text-center">
              <span className="text-[10px] text-slate-400 font-medium block uppercase">Totale Task</span>
              <strong className="text-lg font-black text-blue-400">{totalTasks}</strong>
            </div>
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 text-center">
              <span className="text-[10px] text-slate-400 font-medium block uppercase">Call Activities</span>
              <strong className="text-lg font-black text-amber-400">{totalCallActivities}</strong>
            </div>
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 text-center">
              <span className="text-[10px] text-slate-400 font-medium block uppercase">Ruoli Condivisi</span>
              <strong className="text-lg font-black text-emerald-400">{integratedDoc.sharedRoles.length}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Inter-Process Network Topology Map */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Network className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">
              Mappa Grafica Interconnessioni e Sottoprocessi (Enterprise Blueprint)
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Clicca su un processo per aprire il relativo diagramma BPMN
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
          {files.map((file, index) => {
            const processSummary = integratedDoc.processSummaries.find(p => p.processId === file.parsed.processId);
            const callsOut = integratedDoc.crossLinks.filter(l => l.sourceProcessId === file.parsed.processId);

            return (
              <div
                key={file.id}
                className="bg-slate-50 border-2 border-slate-200 hover:border-indigo-500 rounded-xl p-4 transition-all relative group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                      Modulo {index + 1}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">
                      {file.fileName}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                    {file.parsed.processName}
                  </h3>

                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-medium text-slate-600">
                    <span className="bg-white px-2 py-1 rounded border border-slate-200">
                      Task: <strong>{file.parsed.stats.tasksCount}</strong>
                    </span>
                    <span className="bg-white px-2 py-1 rounded border border-slate-200">
                      Gateway: <strong>{file.parsed.stats.gatewaysCount}</strong>
                    </span>
                    <span className="bg-white px-2 py-1 rounded border border-slate-200">
                      Lanes: <strong>{file.parsed.stats.lanesCount}</strong>
                    </span>
                  </div>

                  {/* Outgoing Cross Links Badge */}
                  {callsOut.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-slate-200/80 text-[11px] text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200">
                      <strong className="block font-semibold mb-0.5 flex items-center gap-1">
                        <GitMerge className="w-3.5 h-3.5 text-amber-600" /> Calls / Subprocesses:
                      </strong>
                      {callsOut.map((link, i) => (
                        <div key={i} className="text-[10px] text-amber-900 truncate">
                          &rarr; {link.sourceElementName} ({link.targetProcessName || 'Esterno'})
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => onSelectProcessFile(file.id)}
                  className="mt-4 w-full py-2 bg-white hover:bg-indigo-600 hover:text-white border border-slate-300 hover:border-indigo-600 text-slate-700 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Apri Diagramma e Documentazione
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sub-Tabs for Integrated Sections */}
      <div className="flex border-b border-slate-200 bg-white rounded-2xl p-1.5 shadow-sm overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('overview')}
          className={`py-2.5 px-4 text-xs font-bold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeSubTab === 'overview'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          1. Sintesi Portafoglio Processi
        </button>
        <button
          onClick={() => setActiveSubTab('links')}
          className={`py-2.5 px-4 text-xs font-bold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeSubTab === 'links'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <GitMerge className="w-4 h-4" />
          2. Dipendenze e Call Activity ({integratedDoc.crossLinks.length})
        </button>
        <button
          onClick={() => setActiveSubTab('raci')}
          className={`py-2.5 px-4 text-xs font-bold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeSubTab === 'raci'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4 h-4" />
          3. RACI Consolidata & Ruoli
        </button>
        <button
          onClick={() => setActiveSubTab('valuestream')}
          className={`py-2.5 px-4 text-xs font-bold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeSubTab === 'valuestream'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Layers className="w-4 h-4" />
          4. Catena del Valore End-to-End
        </button>
        <button
          onClick={() => setActiveSubTab('risks')}
          className={`py-2.5 px-4 text-xs font-bold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeSubTab === 'risks'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          5. Rischi di Integrazione
        </button>
        <button
          onClick={() => setActiveSubTab('guide')}
          className={`py-2.5 px-4 text-xs font-bold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeSubTab === 'guide'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <FileText className="w-4 h-4" />
          6. Guida Operativa Portafoglio
        </button>
      </div>

      {/* SUB-TAB 1: Overview */}
      {activeSubTab === 'overview' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Tabella Comparativa dei Processi nella Cartella
            </h3>
            <p className="text-xs text-slate-500">
              Panoramica sintetica dei file BPMN 2.0 caricati ed analizzati nel portafoglio.
            </p>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-900 uppercase font-bold">
                <tr>
                  <th className="py-3 px-4">Nome Processo</th>
                  <th className="py-3 px-4">Nome File</th>
                  <th className="py-3 px-4 text-center">Score Complessità</th>
                  <th className="py-3 px-4 text-center">Task</th>
                  <th className="py-3 px-4 text-center">Gateway</th>
                  <th className="py-3 px-4 text-center">Lanes (Corsie)</th>
                  <th className="py-3 px-4 text-center">Call Activity</th>
                  <th className="py-3 px-4 text-right">Azione</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {integratedDoc.processSummaries.map((proc, idx) => {
                  const matchingFile = files.find(f => f.parsed.processId === proc.processId);
                  return (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {proc.processName}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {proc.fileName}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2.5 py-1 rounded-full font-mono font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                          v(G) = {proc.cyclomaticScore || 1}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-blue-700">
                        {proc.tasksCount}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-indigo-700">
                        {proc.gatewaysCount}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-emerald-700">
                        {proc.lanesCount}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-amber-700">
                        {proc.callActivitiesCount}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {matchingFile && (
                          <button
                            onClick={() => onSelectProcessFile(matchingFile.id)}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg transition-colors flex items-center gap-1 ml-auto"
                          >
                            Dettagli <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Cyclomatic Complexity Ranking Heatmap Card */}
          {integratedDoc.processComplexityRanking && integratedDoc.processComplexityRanking.length > 0 && (
            <div className="p-5 rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/70 via-white to-indigo-50/70 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-sm font-bold text-slate-900">
                    Classifica Complessità Ciclomatica Portafoglio (McCabe Heatmap)
                  </h4>
                </div>
                <span className="text-xs font-mono font-bold text-indigo-900">
                  Media Portafoglio: v(G) = {integratedDoc.averageComplexity}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {integratedDoc.processComplexityRanking.map((item, i) => (
                  <div key={i} className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between shadow-2xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Rank #{i + 1}</span>
                      <strong className="text-xs font-bold text-slate-900 block truncate max-w-[150px]">{item.processName}</strong>
                      <span className="text-[10px] text-slate-500 font-mono">{item.fileName}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-black text-indigo-600 block">v(G) = {item.score}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {item.ratingLabel.split(' ')[0]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: Cross Links / Call Activity */}
      {activeSubTab === 'links' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Dipendenze, Invocazioni e Chiamate Incrociate (Call Activities)
            </h3>
            <p className="text-xs text-slate-500">
              Analisi dei punti di passaggio e delle chiamate a sottoprocessi tra i vari file BPMN.
            </p>
          </div>

          {integratedDoc.crossLinks.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-xs">
              Nessuna Call Activity esplicita trovata tra i file. I processi comunicano tramite i ruoli condividi e la sequenza delle fasi aziendali.
            </div>
          ) : (
            <div className="space-y-3">
              {integratedDoc.crossLinks.map((link, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold uppercase">
                        {link.linkType}
                      </span>
                      <strong className="text-xs font-bold text-slate-900">
                        {link.sourceElementName}
                      </strong>
                    </div>
                    <p className="text-xs text-slate-600">
                      {link.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-xs font-mono">
                    <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-slate-800">
                      Origine: <strong>{link.sourceProcessName}</strong>
                    </div>
                    <ArrowRight className="w-4 h-4 text-indigo-600" />
                    <div className="bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-900">
                      Destinazione: <strong>{link.targetProcessName || 'Sottoprocesso Esterno'}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: Consolidated RACI & Shared Roles */}
      {activeSubTab === 'raci' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Ruoli Condivisi e Matrice RACI Consolidata
            </h3>
            <p className="text-xs text-slate-500">
              Mappatura globale delle responsabilità (Responsible, Accountable, Consulted, Informed) su tutti i processi della cartella.
            </p>
          </div>

          {/* Shared Roles Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {integratedDoc.sharedRoles.map((role, idx) => (
              <div key={idx} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-slate-900">{role.roleName}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                    {role.participatingProcesses.length} Processi
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 mt-2 space-y-1">
                  <div>Totale task incaricati: <strong>{role.totalTasksAcrossFolder}</strong></div>
                  <div className="text-[10px] text-slate-500">
                    Processi: {role.participatingProcesses.join(', ')}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* RACI Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-900 uppercase font-bold">
                <tr>
                  <th className="py-3 px-4">Attività [Processo]</th>
                  <th className="py-3 px-4">Responsible (R)</th>
                  <th className="py-3 px-4">Accountable (A)</th>
                  <th className="py-3 px-4">Consulted (C)</th>
                  <th className="py-3 px-4">Informed (I)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {integratedDoc.consolidatedRaci.slice(0, 20).map((raci, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-semibold text-slate-900">{raci.taskName}</td>
                    <td className="py-2.5 px-4 font-bold text-blue-700">{raci.responsible}</td>
                    <td className="py-2.5 px-4 font-bold text-purple-700">{raci.accountable}</td>
                    <td className="py-2.5 px-4 text-slate-600">{raci.consulted}</td>
                    <td className="py-2.5 px-4 text-slate-600">{raci.informed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: End-to-End Value Stream */}
      {activeSubTab === 'valuestream' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Catena del Valore Enterprise End-to-End (Value Stream)
            </h3>
            <p className="text-xs text-slate-500">
              Sequenza logica macro-aziendale che attraversa i file della cartella per completare la catena del valore.
            </p>
          </div>

          <div className="space-y-4">
            {integratedDoc.endToEndValueStream.map((phase) => (
              <div key={phase.stepNumber} className="p-4 rounded-xl border border-slate-200 bg-slate-50/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0 text-xs shadow-md">
                    {phase.stepNumber}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">{phase.phaseName}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">ID Processo: <code className="font-mono">{phase.processId}</code></p>
                    
                    <div className="mt-2 flex flex-wrap gap-4 text-xs">
                      <div>
                        <span className="text-slate-500 font-medium">Input Chiave: </span>
                        <strong className="text-slate-700">{phase.keyInputs.join(', ')}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 font-medium">Output Prodotti: </span>
                        <strong className="text-slate-700">{phase.keyOutputs.join(', ')}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {phase.handoverTo && (
                  <div className="shrink-0 text-xs font-semibold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200 flex items-center gap-1.5">
                    <span>Handover &rarr; {phase.handoverTo}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 5: Cross-Process Risks */}
      {activeSubTab === 'risks' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Rischi di Integrazione e Bottleneck tra Processi
            </h3>
            <p className="text-xs text-slate-500">
              Identificazione automatica dei punti critici di raccordo e passaggio consegne.
            </p>
          </div>

          <div className="space-y-3">
            {integratedDoc.crossProcessRisks.map((risk, idx) => (
              <div key={idx} className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 space-y-2">
                <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  Rischio: {risk.risk}
                </div>
                <p className="text-xs text-slate-700">
                  <strong>Impatto:</strong> {risk.impact}
                </p>
                <div className="text-xs text-emerald-900 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 font-medium">
                  <strong>Mitigazione Consigliata:</strong> {risk.mitigation}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 6: Integrated Operational Guide */}
      {activeSubTab === 'guide' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Guida Utente Operativa del Portafoglio Processi
            </h3>
            <p className="text-xs text-slate-500">
              Manuale operativo unificato per la gestione della cartella di processi aziendali.
            </p>
          </div>

          <div className="prose prose-slate max-w-none text-xs leading-relaxed whitespace-pre-line bg-slate-50 p-5 rounded-xl border border-slate-200 font-mono text-slate-800">
            {integratedDoc.integratedOperationalGuide}
          </div>
        </div>
      )}

    </div>
  );
};
