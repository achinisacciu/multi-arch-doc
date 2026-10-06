import React, { useState } from 'react';
import { BpmnDocumentation, DetailLevel, ProcessStepDoc } from '../types';
import { FileText, GitBranch, List, Users, GitFork, AlertTriangle, Beaker, Book, BarChart3, ChevronRight } from 'lucide-react';

interface Props {
  doc: BpmnDocumentation;
  detailLevel: DetailLevel;
}

export function DocumentationView({ doc, detailLevel }: Props) {
  const [section, setSection] = useState('summary');

  const sections = [
    { id: 'summary', label: 'Sintesi', icon: FileText },
    { id: 'complexity', label: 'Complessità', icon: BarChart3 },
    { id: 'steps', label: 'Fasi', icon: List },
    { id: 'raci', label: 'RACI', icon: Users },
    { id: 'roles', label: 'Ruoli', icon: Users },
    { id: 'gateways', label: 'Gateway', icon: GitFork },
    { id: 'risks', label: 'Rischi', icon: AlertTriangle },
    { id: 'tests', label: 'Test', icon: Beaker },
    { id: 'guide', label: 'Guida', icon: Book },
  ];

  return (
    <div className="flex-1 flex min-h-0 bg-slate-50">
      <nav className="w-52 bg-white border-r border-slate-200 p-2 space-y-0.5 shrink-0 overflow-y-auto">
        {sections.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${section === s.id ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}>
            <s.icon className="w-3.5 h-3.5 shrink-0" />{s.label}<ChevronRight className={`w-3 h-3 ml-auto transition-transform ${section === s.id ? 'rotate-90' : ''}`} />
          </button>
        ))}
      </nav>
      <div className="flex-1 overflow-y-auto p-6">
        {section === 'summary' && <SummarySection doc={doc} />}
        {section === 'complexity' && <ComplexitySection doc={doc} detailLevel={detailLevel} />}
        {section === 'steps' && <StepsSection doc={doc} />}
        {section === 'raci' && <RaciSection doc={doc} />}
        {section === 'roles' && <RolesSection doc={doc} />}
        {section === 'gateways' && <GatewaysSection doc={doc} />}
        {section === 'risks' && <RisksSection doc={doc} />}
        {section === 'tests' && <TestsSection doc={doc} />}
        {section === 'guide' && <GuideSection doc={doc} />}
      </div>
    </div>
  );
}

function SummarySection({ doc }: { doc: BpmnDocumentation }) {
  return (
    <div className="max-w-3xl space-y-6 animate-fadeIn">
      <div><h1 className="text-xl font-bold text-slate-900">{doc.processName}</h1><p className="text-xs text-slate-400 font-mono mt-0.5">ID: {doc.processId}</p></div>
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4"><h2 className="text-xs font-semibold text-blue-800 uppercase tracking-wider mb-1">Sintesi Esecutiva</h2><p className="text-sm text-blue-900 leading-relaxed">{doc.executiveSummary}</p></div>
      <div><h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Destinatari</h2><p className="text-sm text-slate-700">{doc.targetAudience}</p></div>
      <div><h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Obiettivi di Business</h2><ul className="space-y-1">{doc.businessObjectives.map((o, i) => <li key={i} className="flex items-start gap-2 text-sm text-slate-700"><span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</span>{o}</li>)}</ul></div>
      <div className="grid grid-cols-4 gap-3">
        <MetricBox label="Attività" value={doc.processSteps.filter(s => !['Evento di Avvio', 'Evento di Fine'].includes(s.type)).length} color="text-blue-600 bg-blue-50" />
        <MetricBox label="Gateway" value={doc.gateways.length} color="text-amber-600 bg-amber-50" />
        <MetricBox label="Ruoli" value={doc.rolesAndParticipants.length} color="text-purple-600 bg-purple-50" />
        <MetricBox label="Complessità" value={doc.cyclomaticComplexity.score} color={doc.cyclomaticComplexity.ratingColor.replace('#', 'text-')} />
      </div>
    </div>
  );
}

function ComplexitySection({ doc, detailLevel }: { doc: BpmnDocumentation; detailLevel: string }) {
  const c = doc.cyclomaticComplexity;
  const gaugePercent = Math.min(100, (c.score / 30) * 100);
  return (
    <div className="max-w-3xl space-y-6 animate-fadeIn">
      <h2 className="text-lg font-bold text-slate-900">Complessità Ciclomatica</h2>
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-6">
          <div className="relative w-28 h-28"><svg className="w-28 h-28 -rotate-90" viewBox="0 0 120 120"><circle cx="60" cy="60" r="54" fill="none" stroke="#e2e8f0" strokeWidth="8" /><circle cx="60" cy="60" r="54" fill="none" stroke={c.ratingColor} strokeWidth="8" strokeDasharray={`${gaugePercent * 3.39} 339}`} strokeLinecap="round" /></svg><div className="absolute inset-0 flex items-center justify-center"><div className="text-center"><p className="text-2xl font-bold" style={{ color: c.ratingColor }}>{c.score}</p><p className="text-[10px] text-slate-500">v(G)</p></div></div></div>
          <div><p className="text-sm font-semibold text-slate-800">Valutazione: <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: c.ratingColor + '20', color: c.ratingColor }}>{c.ratingLabel}</span></p><p className="text-xs text-slate-500 mt-1">{c.explanation}</p></div>
        </div>
        {detailLevel !== 'executive' && (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3 text-xs">
              <FormulaRow label="Archi (flussi)" value={c.edgesCount} />
              <FormulaRow label="Nodi (elementi)" value={c.nodesCount} />
              <FormulaRow label="Gateway decisionali" value={c.gatewayDecisionPoints} />
              <FormulaRow label="Componenti connesse" value={c.connectedComponents} />
              <FormulaRow label="Fattore di ramificazione max" value={c.maxBranchingFactor} />
              <FormulaRow label="Densità gateway" value={`${c.gatewayDensityRatio}%`} />
            </div>
            {c.recommendations.length > 0 && (
              <div className="mt-4"><h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Raccomandazioni</h3><ul className="space-y-1">{c.recommendations.map((r, i) => <li key={i} className="text-xs text-slate-600 flex items-start gap-2"><span className="w-4 h-4 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">!</span>{r}</li>)}</ul></div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StepsSection({ doc }: { doc: BpmnDocumentation }) {
  const [stepSearch, setStepSearch] = useState('');
  const steps = doc.processSteps.filter(s => !stepSearch || s.name.toLowerCase().includes(stepSearch.toLowerCase()) || s.actorRole.toLowerCase().includes(stepSearch.toLowerCase()));
  return (
    <div className="max-w-4xl space-y-4 animate-fadeIn">
      <h2 className="text-lg font-bold text-slate-900">Fasi del Processo</h2>
      <input value={stepSearch} onChange={e => setStepSearch(e.target.value)} placeholder="Cerca fase..." className="w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
      <div className="space-y-2">{steps.map(s => <StepCard key={s.elementId} step={s} />)}</div>
    </div>
  );
}

function StepCard({ step }: { key?: string; step: any }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3">
        <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">{step.stepNumber}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap"><h4 className="text-sm font-semibold text-slate-800">{step.name}</h4><span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{step.type}</span></div>
          <p className="text-xs text-slate-500 mt-1"><span className="font-medium">Attore:</span> {step.actorRole}</p>
          <p className="text-xs text-slate-600 mt-1">{step.description}</p>
          {step.decisionRules && <p className="text-xs text-amber-600 mt-1"><span className="font-medium">Regola:</span> {step.decisionRules}</p>}
          {step.triggerOrTimer && <p className="text-xs text-purple-600 mt-1"><span className="font-medium">Timer:</span> {step.triggerOrTimer}</p>}
        </div>
      </div>
    </div>
  );
}

function RaciSection({ doc }: { doc: BpmnDocumentation }) {
  return (
    <div className="max-w-4xl space-y-4 animate-fadeIn">
      <h2 className="text-lg font-bold text-slate-900">Matrice RACI</h2>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-xs">
          <thead><tr className="bg-slate-50 border-b border-slate-200"><th className="text-left p-3 font-semibold text-slate-600">Attività</th><th className="text-left p-3 font-semibold text-slate-600">R</th><th className="text-left p-3 font-semibold text-slate-600">A</th><th className="text-left p-3 font-semibold text-slate-600">C</th><th className="text-left p-3 font-semibold text-slate-600">I</th></tr></thead>
          <tbody>{doc.raciMatrix.map(r => <tr key={r.elementId} className="border-b border-slate-100 hover:bg-slate-50"><td className="p-3 text-slate-700 font-medium">{r.taskName}</td><td className="p-3 text-slate-600">{r.responsible}</td><td className="p-3 text-slate-600">{r.accountable}</td><td className="p-3 text-slate-400">{r.consulted}</td><td className="p-3 text-slate-400">{r.informed}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

function RolesSection({ doc }: { doc: BpmnDocumentation }) {
  return (
    <div className="max-w-3xl space-y-4 animate-fadeIn">
      <h2 className="text-lg font-bold text-slate-900">Ruoli e Partecipanti</h2>
      <div className="grid grid-cols-2 gap-3">{doc.rolesAndParticipants.map(r => <div key={r.name} className="bg-white rounded-xl border border-slate-200 p-4"><h4 className="text-sm font-semibold text-slate-800">{r.name}</h4><p className="text-[10px] font-medium text-slate-400 uppercase mt-0.5">{r.type}</p><p className="text-xs text-slate-500 mt-2">{r.assignedTasksCount} attività assegnate</p></div>)}</div>
    </div>
  );
}

function GatewaysSection({ doc }: { doc: BpmnDocumentation }) {
  return (
    <div className="max-w-3xl space-y-4 animate-fadeIn">
      <h2 className="text-lg font-bold text-slate-900">Gateway di Decisione</h2>
      {doc.gateways.length === 0 ? <p className="text-sm text-slate-400">Nessun gateway presente nel processo.</p> : doc.gateways.map(g => <div key={g.id} className="bg-white rounded-xl border border-slate-200 p-4"><h4 className="text-sm font-semibold text-slate-800">{g.name || g.id}</h4><p className="text-[10px] font-medium text-slate-400 uppercase mt-0.5">{g.type}</p><ul className="mt-3 space-y-1">{g.branches.map((b, i) => <li key={i} className="flex items-start gap-2 text-xs text-slate-600"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" /><span><span className="font-medium">Condizione:</span> {b.condition} → <span className="text-slate-500">{b.target}</span></span></li>)}</ul></div>)}
    </div>
  );
}

function RisksSection({ doc }: { doc: BpmnDocumentation }) {
  return (
    <div className="max-w-3xl space-y-4 animate-fadeIn">
      <h2 className="text-lg font-bold text-slate-900">Rischi e Mitigazioni</h2>
      {doc.risksAndExceptions.map((r, i) => <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 border-l-4 border-l-rose-400"><h4 className="text-sm font-semibold text-slate-800">{r.risk}</h4><p className="text-xs text-slate-400 mt-0.5">Localizzazione: {r.location}</p><p className="text-xs text-slate-600 mt-2"><span className="font-medium">Mitigazione:</span> {r.mitigation}</p></div>)}
      <h3 className="text-sm font-semibold text-slate-700 pt-2">Suggerimenti di Ottimizzazione</h3>
      <ul className="space-y-1">{doc.optimizationSuggestions.map((o, i) => <li key={i} className="flex items-start gap-2 text-xs text-slate-600"><span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[9px] shrink-0 mt-0.5">+</span>{o}</li>)}</ul>
    </div>
  );
}

function TestsSection({ doc }: { doc: BpmnDocumentation }) {
  return (
    <div className="max-w-3xl space-y-4 animate-fadeIn">
      <h2 className="text-lg font-bold text-slate-900">Casi di Test</h2>
      {doc.testScenarios.map(tc => <div key={tc.id} className="bg-white rounded-xl border border-slate-200 p-4"><div className="flex items-center gap-2 mb-2"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{tc.id}</span><h4 className="text-sm font-semibold text-slate-800">{tc.title}</h4></div><p className="text-xs text-slate-500"><span className="font-medium">Precondizioni:</span> {tc.preconditions}</p><p className="text-xs text-slate-500 mt-1"><span className="font-medium">Percorso:</span> {tc.pathSteps.join(' → ')}</p><p className="text-xs text-slate-500 mt-1"><span className="font-medium">Risultato atteso:</span> {tc.expectedResult}</p></div>)}
    </div>
  );
}

function GuideSection({ doc }: { doc: BpmnDocumentation }) {
  return (
    <div className="max-w-3xl space-y-4 animate-fadeIn">
      <h2 className="text-lg font-bold text-slate-900">Guida Operativa</h2>
      <div className="bg-white rounded-xl border border-slate-200 p-6"><pre className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-mono">{doc.userManualGuide}</pre></div>
    </div>
  );
}

function MetricBox({ label, value, color }: { label: string; value: number | string; color: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-lg font-bold text-slate-800">{value}</p><p className="text-[10px] text-slate-500">{label}</p></div>;
}

function FormulaRow({ label, value }: { label: string; value: string | number }) {
  return <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50"><span className="text-slate-500">{label}</span><span className="font-medium text-slate-700">{value}</span></div>;
}
