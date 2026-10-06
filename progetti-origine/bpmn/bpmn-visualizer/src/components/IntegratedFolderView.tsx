import { IntegratedFolderDoc, ParsedBpmn } from '../types';
import { BarChart3, GitBranch, Users, Table, Activity, AlertTriangle, Book, ChevronRight, Network, FolderOpen } from 'lucide-react';
import { useState } from 'react';

interface Props {
  doc: IntegratedFolderDoc;
  parsedFiles: Record<string, ParsedBpmn>;
}

export function IntegratedFolderView({ doc, parsedFiles }: Props) {
  const [tab, setTab] = useState('summary');

  const tabs = [
    { id: 'summary', label: 'Sintesi', icon: FolderOpen },
    { id: 'ranking', label: 'Complessità', icon: BarChart3 },
    { id: 'deps', label: 'Dipendenze', icon: GitBranch },
    { id: 'raci', label: 'RACI', icon: Table },
    { id: 'roles', label: 'Ruoli', icon: Users },
    { id: 'value', label: 'Value Stream', icon: Activity },
    { id: 'risks', label: 'Rischi', icon: AlertTriangle },
    { id: 'guide', label: 'Guida', icon: Book },
  ];

  return (
    <div className="flex-1 flex min-h-0 bg-slate-50">
      <nav className="w-52 bg-white border-r border-slate-200 p-2 space-y-0.5 shrink-0 overflow-y-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${tab === t.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}>
            <t.icon className="w-3.5 h-3.5 shrink-0" />{t.label}<ChevronRight className={`w-3 h-3 ml-auto transition-transform ${tab === t.id ? 'rotate-90' : ''}`} />
          </button>
        ))}
      </nav>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl space-y-6 animate-fadeIn">
          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 text-white">
            <h1 className="text-lg font-bold">Portafoglio Processi</h1>
            <p className="text-sm text-indigo-200 mt-1">{doc.totalFiles} processi · Complessità media: {doc.averageComplexity}</p>
            <div className="flex gap-4 mt-4">
              <div><p className="text-2xl font-bold">{doc.totalFiles}</p><p className="text-[10px] text-indigo-200">Processi</p></div>
              <div><p className="text-2xl font-bold">{doc.crossLinks.length}</p><p className="text-[10px] text-indigo-200">Dipendenze</p></div>
              <div><p className="text-2xl font-bold">{doc.sharedRoles.length}</p><p className="text-[10px] text-indigo-200">Ruoli Condivisi</p></div>
              <div><p className="text-2xl font-bold">{doc.averageComplexity}</p><p className="text-[10px] text-indigo-200">Compl. Media</p></div>
            </div>
            <p className="text-xs text-indigo-200 mt-4">{doc.executiveSummary}</p>
          </div>

          {tab === 'summary' && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-slate-800">Rete di Processi</h2>
              <div className="grid grid-cols-2 gap-3">
                {doc.processSummaries.map(p => (
                  <div key={p.fileName} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow">
                    <h4 className="text-sm font-semibold text-slate-800">{p.processName}</h4>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{p.fileName}</p>
                    <div className="flex gap-3 mt-3 text-xs text-slate-500">
                      <span>{p.tasksCount} attività</span>
                      <span>{p.gatewaysCount} gateway</span>
                      <span>{p.lanesCount} corsie</span>
                    </div>
                    {p.cyclomaticRating && (
                      <span className="inline-block mt-2 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        Compl. {p.cyclomaticScore}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'ranking' && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-slate-800">Classifica Complessità</h2>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead><tr className="bg-slate-50 border-b border-slate-200"><th className="text-left p-3 font-semibold text-slate-600">Processo</th><th className="text-left p-3 font-semibold text-slate-600">Punteggio</th><th className="text-left p-3 font-semibold text-slate-600">Valutazione</th></tr></thead>
                  <tbody>{doc.processComplexityRanking.map((p, i) => <tr key={p.fileName} className="border-b border-slate-100 hover:bg-slate-50"><td className="p-3 text-slate-700 font-medium">{p.processName}</td><td className="p-3"><span className="font-bold text-slate-800">{p.score}</span></td><td className="p-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${p.score <= 5 ? 'bg-emerald-100 text-emerald-700' : p.score <= 10 ? 'bg-amber-100 text-amber-700' : p.score <= 20 ? 'bg-orange-100 text-orange-700' : 'bg-rose-100 text-rose-700'}`}>{p.ratingLabel}</span></td></tr>)}</tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'deps' && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-slate-800">Dipendenze Incrociate</h2>
              {doc.crossLinks.length === 0 ? <p className="text-sm text-slate-400">Nessuna dipendenza incrociata rilevata tra i processi.</p> : doc.crossLinks.map((l, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3">
                  <Network className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                  <div><p className="text-sm font-semibold text-slate-800">{l.sourceProcessName} <span className="text-slate-400">→</span> {l.targetProcessName || l.sourceElementName}</p><p className="text-xs text-slate-500 mt-0.5">{l.description}</p><span className="inline-block mt-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{l.linkType}</span></div>
                </div>
              ))}
            </div>
          )}

          {tab === 'raci' && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-slate-800">RACI Consolidata</h2>
              <div className="bg-white rounded-xl border border-slate-200 overflow-auto max-h-96">
                <table className="w-full text-xs">
                  <thead><tr className="bg-slate-50 border-b border-slate-200 sticky top-0"><th className="text-left p-3 font-semibold text-slate-600">Processo / Attività</th><th className="text-left p-3 font-semibold text-slate-600">R</th><th className="text-left p-3 font-semibold text-slate-600">A</th></tr></thead>
                  <tbody>{doc.consolidatedRaci.map(r => <tr key={r.elementId} className="border-b border-slate-100 hover:bg-slate-50"><td className="p-3 text-slate-700">{r.taskName}</td><td className="p-3 text-slate-600">{r.responsible}</td><td className="p-3 text-slate-600">{r.accountable}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'roles' && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-slate-800">Ruoli Condivisi tra Processi</h2>
              {doc.sharedRoles.length === 0 ? <p className="text-sm text-slate-400">Nessun ruolo condiviso tra processi.</p> : doc.sharedRoles.map(r => <div key={r.roleName} className="bg-white rounded-xl border border-slate-200 p-4"><h4 className="text-sm font-semibold text-slate-800">{r.roleName}</h4><p className="text-xs text-slate-500 mt-1">Presente in: {r.participatingProcesses.join(', ')}</p><p className="text-xs text-slate-500">{r.totalTasksAcrossFolder} attività totali</p></div>)}
            </div>
          )}

          {tab === 'value' && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-slate-800">Catena del Valore End-to-End</h2>
              <div className="space-y-2">{doc.endToEndValueStream.map((v, i) => <div key={i} className="bg-white rounded-xl border border-slate-200 p-4"><div className="flex items-center gap-3"><span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">{v.stepNumber}</span><div><h4 className="text-sm font-semibold text-slate-800">{v.phaseName}</h4><p className="text-[10px] text-slate-400">{v.processId}</p></div>{v.handoverTo && <span className="ml-auto text-xs text-slate-400">→ {v.handoverTo}</span>}</div></div>)}</div>
            </div>
          )}

          {tab === 'risks' && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-slate-800">Rischi di Integrazione</h2>
              {doc.crossProcessRisks.map((r, i) => <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 border-l-4 border-l-rose-400"><h4 className="text-sm font-semibold text-slate-800">{r.risk}</h4><p className="text-xs text-slate-500 mt-1"><span className="font-medium">Impatto:</span> {r.impact}</p><p className="text-xs text-slate-600 mt-1"><span className="font-medium">Mitigazione:</span> {r.mitigation}</p><p className="text-xs text-slate-400 mt-1">Coinvolti: {r.involvedProcesses.join(', ')}</p></div>)}
            </div>
          )}

          {tab === 'guide' && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-slate-800">Guida Operativa Integrata</h2>
              <div className="bg-white rounded-xl border border-slate-200 p-6"><pre className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-mono">{doc.integratedOperationalGuide}</pre></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
