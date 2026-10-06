import React, { useState } from 'react';
import {
  Workflow,
  GitBranch,
  CheckCircle2,
  Users,
  Layers,
  ArrowRight,
  Shield,
  Activity,
  FileCode,
  Sliders,
} from 'lucide-react';
import {
  BpelProcessInfo,
  BpmnProcessInfo,
  HumanTaskInfo,
  MediatorInfo,
  OracleEcosystem,
} from '../types/jca';
import { buildProjectTree } from '../services/bpmnFlowGraph';
import { BpmnNativeViewer } from './BpmnNativeViewer';

interface ProcessOrchestrationViewerProps {
  bpmnProcesses: BpmnProcessInfo[];
  bpelProcesses: BpelProcessInfo[];
  mediators: MediatorInfo[];
  humanTasks: HumanTaskInfo[];
  ecosystem?: OracleEcosystem;
}

const BPMN_PAGE = 10;

export const ProcessOrchestrationViewer: React.FC<ProcessOrchestrationViewerProps> = ({
  bpmnProcesses,
  bpelProcesses,
  mediators,
  humanTasks,
  ecosystem,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'bpmn' | 'bpel' | 'mediators' | 'tasks'>('bpmn');
  // Drill-down grande→piccolo: progetto .jpr → composite → processo (default: tutto)
  const [filterProject, setFilterProject] = useState<string>('');
  const [filterComposite, setFilterComposite] = useState<string>('');
  const [bpmnPage, setBpmnPage] = useState(0);
  const [openFlowId, setOpenFlowId] = useState<string | null>(null);

  const projectTree = buildProjectTree(ecosystem ?? {
    projects: [], composites: [], jcaAdapters: [], wsdlContracts: [], humanTasks: [],
  } as unknown as OracleEcosystem);
  const dirOf = (p: string): string => {
    const i = (p || '').replace(/\\/g, '/').lastIndexOf('/');
    return i >= 0 ? p.slice(0, i).toLowerCase() : '';
  };
  const base = (p?: string): string => (p || '').replace(/\\/g, '/').split('/').pop()?.toLowerCase() || '';
  const filteredBpmn = bpmnProcesses.filter((b) => {
    if (filterComposite) {
      const comp = ecosystem?.composites.find((c) => c.name === filterComposite);
      if (comp) {
        const impls = comp.components.map((x) => base(x.implementationSource));
        if (impls.includes(base(b.relativePath)) || impls.includes(base(b.fileName))) return true;
        const cd = dirOf(comp.relativePath);
        const bd = dirOf(b.relativePath);
        if (cd && bd && (bd === cd || bd.startsWith(cd + '/') || cd.startsWith(bd + '/'))) return true;
        return false;
      }
    }
    if (filterProject && ecosystem) {
      const node = projectTree.find((t) => t.projectName === filterProject);
      if (node) {
        const names = new Set(node.composites.map((c) => c.name));
        const hit = ecosystem.composites.some((c) => {
          if (!names.has(c.name)) return false;
          const impls = c.components.map((x) => base(x.implementationSource));
          return impls.includes(base(b.relativePath)) || impls.includes(base(b.fileName));
        });
        if (!hit) {
          // fallback: stessa directory del progetto
          const proj = ecosystem.projects.find((p) => p.name === filterProject);
          if (proj) {
            const pd = dirOf(proj.relativePath);
            const bd = dirOf(b.relativePath);
            if (!(pd && bd && (bd === pd || bd.startsWith(pd + '/') || pd.startsWith(bd + '/')))) return false;
          } else return false;
        }
      }
    }
    return true;
  });
  const bpmnPages = Math.max(1, Math.ceil(filteredBpmn.length / BPMN_PAGE));
  const bpmnVisible = filteredBpmn.slice(bpmnPage * BPMN_PAGE, bpmnPage * BPMN_PAGE + BPMN_PAGE);

  return (
    <div className="space-y-6 animate-fadeIn" id="process-orchestration-viewer">
      {/* Sub-tab Navigation */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200/80 shadow-sm">
        <button
          onClick={() => setActiveSubTab('bpmn')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeSubTab === 'bpmn'
              ? 'bg-amber-500 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Workflow className="w-3.5 h-3.5" />
          BPMN 2.0 Processes ({bpmnProcesses.length})
        </button>

        <button
          onClick={() => setActiveSubTab('bpel')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeSubTab === 'bpel'
              ? 'bg-orange-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <GitBranch className="w-3.5 h-3.5" />
          BPEL Flows ({bpelProcesses.length})
        </button>

        <button
          onClick={() => setActiveSubTab('mediators')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeSubTab === 'mediators'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          Oracle Mediators ({mediators.length})
        </button>

        <button
          onClick={() => setActiveSubTab('tasks')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeSubTab === 'tasks'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Human Tasks ({humanTasks.length})
        </button>
      </div>

      {/* BPMN 2.0 Tab */}
      {activeSubTab === 'bpmn' && (
        <div className="space-y-4">
          {/* Drill-down + paginazione (regge anche 500+ processi) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-slate-600">Drill-down:</span>
            <select
              value={filterProject}
              onChange={(e) => { setFilterProject(e.target.value); setFilterComposite(''); setBpmnPage(0); }}
              className="px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 max-w-[220px]"
              title="Filtra per progetto .jpr"
            >
              <option value="">Tutti i progetti ({projectTree.length})</option>
              {projectTree.map((t) => (
                <option key={t.projectName} value={t.projectName}>{t.projectName} ({t.composites.length})</option>
              ))}
            </select>
            <select
              value={filterComposite}
              onChange={(e) => { setFilterComposite(e.target.value); setBpmnPage(0); }}
              className="px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 max-w-[240px]"
              title="Filtra per composite"
            >
              <option value="">Tutti i composite</option>
              {(filterProject
                ? projectTree.find((t) => t.projectName === filterProject)?.composites || []
                : (ecosystem?.composites || []).map((c) => ({ name: c.name, path: c.relativePath, bpmnCount: 0 }))
              ).map((c) => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
            <span className="ml-auto text-slate-500">
              {filteredBpmn.length} processi (pag. {bpmnPage + 1}/{bpmnPages})
            </span>
            <button
              disabled={bpmnPage === 0}
              onClick={() => setBpmnPage((p) => Math.max(0, p - 1))}
              className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40"
            >
              ←
            </button>
            <button
              disabled={bpmnPage + 1 >= bpmnPages}
              onClick={() => setBpmnPage((p) => Math.min(bpmnPages - 1, p + 1))}
              className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40"
            >
              →
            </button>
          </div>
          {filteredBpmn.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center text-xs text-slate-400">
              Nessun file di processo BPMN 2.0 (.bpmn) rilevato{filterProject || filterComposite ? ' per questo filtro.' : '.'}
            </div>
          ) : (
            bpmnVisible.map((bpmn) => (
              <div key={bpmn.id} className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-mono text-[11px] font-bold">
                      BPMN 2.0 PROCESS
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-1">{bpmn.name}</h3>
                    <p className="text-xs font-mono text-slate-400">{bpmn.relativePath || bpmn.fileName}</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-700">
                      <strong>{bpmn.userTasks.length}</strong> User Tasks
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-700">
                      <strong>{bpmn.serviceTasks.length}</strong> Service Tasks
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-700">
                      <strong>{bpmn.gateways.length}</strong> Gateways
                    </span>
                  </div>
                </div>

                {bpmn.swimlanes.length > 0 && (
                  <div>
                    <span className="text-xs font-semibold text-slate-600 block mb-1">Swimlanes / Corsie Operative:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {bpmn.swimlanes.map((lane, idx) => (
                        <span key={idx} className="px-2.5 py-1 rounded-md bg-amber-50/80 border border-amber-200/60 text-xs font-medium text-amber-900">
                          👤 {lane}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Activities Matrix */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-2">
                    <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-amber-600" />
                      User Tasks ({bpmn.userTasks.length})
                    </h4>
                    {bpmn.userTasks.length === 0 ? (
                      <p className="text-[11px] text-slate-400">Nessun task utente interattivo.</p>
                    ) : (
                      <ul className="space-y-1 text-xs">
                        {bpmn.userTasks.map((ut) => (
                          <li key={ut.id} className="font-medium text-slate-800 bg-white p-1.5 rounded border border-slate-200/50">
                            • {ut.name} <span className="text-[10px] font-mono text-slate-400">({ut.id})</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-2">
                    <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-blue-600" />
                      Service Tasks ({bpmn.serviceTasks.length})
                    </h4>
                    {bpmn.serviceTasks.length === 0 ? (
                      <p className="text-[11px] text-slate-400">Nessun service task automatico.</p>
                    ) : (
                      <ul className="space-y-1 text-xs">
                        {bpmn.serviceTasks.map((st) => (
                          <li key={st.id} className="font-medium text-slate-800 bg-white p-1.5 rounded border border-slate-200/50">
                            • {st.name} <span className="text-[10px] font-mono text-slate-400">({st.id})</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Diagramma flusso interno (SVG + Mermaid) */}
                <button
                  onClick={() => setOpenFlowId(openFlowId === bpmn.id ? null : bpmn.id)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-semibold bg-amber-500 text-white hover:bg-amber-600 transition"
                >
                  {openFlowId === bpmn.id ? '▾ Chiudi flusso interno' : '▸ Apri flusso interno (diagramma + tooltip)'}
                </button>
                {openFlowId === bpmn.id && (
                  <BpmnNativeViewer proc={bpmn} ecosystem={ecosystem} />
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* BPEL Tab */}
      {activeSubTab === 'bpel' && (
        <div className="space-y-4">
          {bpelProcesses.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center text-xs text-slate-400">
              Nessun processo BPEL (.bpel) rilevato.
            </div>
          ) : (
            bpelProcesses.map((bpel) => (
              <div key={bpel.id} className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <span className="px-2 py-0.5 rounded bg-orange-50 text-orange-700 font-mono text-[11px] font-bold">
                      WS-BPEL PROCESS
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-1">{bpel.name}</h3>
                    <p className="text-xs font-mono text-slate-400">{bpel.relativePath || bpel.fileName}</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-700">
                      <strong>{bpel.partnerLinks.length}</strong> Partner Links
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-700">
                      <strong>{bpel.invokes.length}</strong> Invokes
                    </span>
                  </div>
                </div>

                {/* Partner Links */}
                <div>
                  <span className="text-xs font-semibold text-slate-600 block mb-1.5">Partner Links Collegati:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {bpel.partnerLinks.map((pl) => (
                      <div key={pl.name} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/60 text-xs">
                        <strong className="text-slate-900">{pl.name}</strong>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">Type: {pl.partnerLinkType}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Invokes Table */}
                {bpel.invokes.length > 0 && (
                  <div>
                    <span className="text-xs font-semibold text-slate-600 block mb-1.5">Chiamate di Servizio (Invokes):</span>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 font-semibold">
                            <th className="py-2 px-3">Partner Link</th>
                            <th className="py-2 px-3">Operazione</th>
                            <th className="py-2 px-3">Input Var</th>
                            <th className="py-2 px-3">Output Var</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {bpel.invokes.map((inv, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="py-2 px-3 font-semibold text-slate-800">{inv.partnerLink}</td>
                              <td className="py-2 px-3 font-mono text-indigo-600">{inv.operation}</td>
                              <td className="py-2 px-3 font-mono text-slate-500">{inv.inputVariable || '-'}</td>
                              <td className="py-2 px-3 font-mono text-slate-500">{inv.outputVariable || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Mediators Tab */}
      {activeSubTab === 'mediators' && (
        <div className="space-y-4">
          {mediators.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center text-xs text-slate-400">
              Nessun componente Mediator (.mplan) rilevato.
            </div>
          ) : (
            mediators.map((med) => (
              <div key={med.id} className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono text-[11px] font-bold">
                    ORACLE MEDIATOR
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-1">{med.name}</h3>
                  <p className="text-xs font-mono text-slate-400">{med.relativePath || med.fileName}</p>
                </div>

                <div className="space-y-3">
                  {med.operations.map((op) => (
                    <div key={op.name} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                      <h4 className="text-xs font-bold text-slate-800">
                        Operazione Gestita: <span className="font-mono text-indigo-600">{op.name}</span>
                      </h4>
                      <div className="space-y-2">
                        {op.routingRules.map((rr, idx) => (
                          <div key={idx} className="p-3 bg-white rounded-lg border border-slate-200/80 text-xs space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-900">
                                Regola #{idx + 1}: Inoltro a <code className="font-mono text-indigo-700">{rr.targetService || 'Target'}</code>
                              </span>
                              <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[10px] uppercase font-bold text-slate-600">
                                {rr.actionType}
                              </span>
                            </div>
                            {rr.filterExpression && (
                              <div className="text-[11px] text-amber-800 bg-amber-50 p-1.5 rounded border border-amber-100 font-mono">
                                ⚡ Filtro: {rr.filterExpression}
                              </div>
                            )}
                            {rr.transformations.length > 0 && (
                              <div className="text-[11px] text-slate-500 font-mono">
                                🔀 Trasformazioni XSL: {rr.transformations.join(', ')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Human Tasks Tab */}
      {activeSubTab === 'tasks' && (
        <div className="space-y-4">
          {humanTasks.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center text-xs text-slate-400">
              Nessun Human Workflow Task (.task) rilevato.
            </div>
          ) : (
            humanTasks.map((ht) => (
              <div key={ht.id} className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-mono text-[11px] font-bold">
                      HUMAN WORKFLOW TASK
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-1">{ht.name}</h3>
                    <p className="text-xs text-slate-500">{ht.title || 'Nessun titolo descrittivo'}</p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-mono text-xs font-semibold">
                    Priorità: {ht.priority || '3'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 text-xs">
                    <strong className="text-slate-700 block mb-1">Esiti di Decisione (Outcomes):</strong>
                    <div className="flex flex-wrap gap-1.5">
                      {ht.outcomes.map((out) => (
                        <span key={out} className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold font-mono text-[11px]">
                          ✓ {out}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 text-xs">
                    <strong className="text-slate-700 block mb-1">Gruppi / Partecipanti Assegnati:</strong>
                    <div className="flex flex-wrap gap-1.5">
                      {ht.participants.length > 0 ? (
                        ht.participants.map((part) => (
                          <span key={part} className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-medium text-[11px]">
                            👤 {part}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400 text-xs">Assegnazione dinamica da processo</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
