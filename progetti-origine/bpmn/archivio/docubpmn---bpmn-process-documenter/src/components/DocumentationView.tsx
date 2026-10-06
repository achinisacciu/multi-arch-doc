import React, { useState } from 'react';
import { 
  FileText, Users, ListOrdered, GitMerge, AlertTriangle, 
  CheckCircle2, Target, BookOpen, ShieldCheck, 
  Lightbulb, Search, ArrowRight, Layers, Copy, Check,
  Activity, Gauge, Cpu, Zap, Info, Sliders
} from 'lucide-react';
import { BpmnDocumentation } from '../types';
import { getFriendlyTypeName } from '../utils/bpmnParser';

interface DocumentationViewProps {
  doc: BpmnDocumentation;
  onSelectStepElement?: (elementId: string) => void;
}

export const DocumentationView: React.FC<DocumentationViewProps> = ({ doc, onSelectStepElement }) => {
  const [activeSection, setActiveSection] = useState<'summary' | 'complexity' | 'steps' | 'raci' | 'roles' | 'gateways' | 'risks' | 'tests' | 'guide'>('summary');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedGuide, setCopiedGuide] = useState(false);

  const complexity = doc.cyclomaticComplexity;

  const handleCopyGuide = () => {
    navigator.clipboard.writeText(doc.userManualGuide);
    setCopiedGuide(true);
    setTimeout(() => setCopiedGuide(false), 2000);
  };

  const filteredSteps = doc.processSteps.filter(step =>
    step.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    step.actorRole.toLowerCase().includes(searchQuery.toLowerCase()) ||
    step.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    step.elementId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRatingBadgeClass = (rating: string) => {
    switch (rating) {
      case 'low':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'moderate':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'very_high':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-300';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Section Navigation Tabs */}
      <div className="bg-white rounded-2xl p-2 border border-slate-200 shadow-sm flex flex-wrap gap-1.5 sticky top-16 z-20">
        <button
          onClick={() => setActiveSection('summary')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 ${
            activeSection === 'summary'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Target className="w-3.5 h-3.5" />
          Sintesi e obiettivi
        </button>

        <button
          onClick={() => setActiveSection('complexity')}
          className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
            activeSection === 'complexity'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
              : 'text-slate-700 hover:text-indigo-600 hover:bg-indigo-50'
          }`}
        >
          <Activity className="w-3.5 h-3.5 text-indigo-400" />
          Complessità Ciclomatica ({complexity.score})
        </button>

        <button
          onClick={() => setActiveSection('steps')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 ${
            activeSection === 'steps'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <ListOrdered className="w-3.5 h-3.5" />
          Fasi del processo ({doc.processSteps.length})
        </button>

        <button
          onClick={() => setActiveSection('raci')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 ${
            activeSection === 'raci'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Matrice RACI
        </button>

        <button
          onClick={() => setActiveSection('roles')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 ${
            activeSection === 'roles'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Ruoli ({doc.rolesAndParticipants.length})
        </button>

        <button
          onClick={() => setActiveSection('gateways')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 ${
            activeSection === 'gateways'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <GitMerge className="w-3.5 h-3.5" />
          Gateway ({doc.gateways.length})
        </button>

        <button
          onClick={() => setActiveSection('risks')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 ${
            activeSection === 'risks'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Rischi e ottimizzazioni
        </button>

        <button
          onClick={() => setActiveSection('tests')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 ${
            activeSection === 'tests'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          Casi di test ({doc.testScenarios.length})
        </button>

        <button
          onClick={() => setActiveSection('guide')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 ${
            activeSection === 'guide'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          Guida utente operativa
        </button>
      </div>

      {/* SECTION 1: SINTESI E OBIETTIVI */}
      {activeSection === 'summary' && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* Executive Summary Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-bold text-slate-900">Sintesi Esecutiva</h2>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200">
              {doc.executiveSummary}
            </p>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-700 block mb-1">Target Audience</span>
                <p className="text-xs text-slate-700 font-medium">{doc.targetAudience}</p>
              </div>
              <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 block mb-1">Identificativo Processo</span>
                <p className="text-xs font-mono text-slate-700 font-semibold">{doc.processName} ({doc.processId})</p>
              </div>
            </div>
          </div>

          {/* Cyclomatic Complexity Preview Banner */}
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-5 border border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 flex items-center justify-center shrink-0">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    McCabe Complexity Metric
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getRatingBadgeClass(complexity.rating)}`}>
                    {complexity.ratingLabel}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white">
                  Indice Complessità Ciclomatica: <span className="text-indigo-400 font-black">{complexity.score}</span>
                </h3>
                <p className="text-xs text-slate-300 mt-0.5 max-w-xl">
                  {complexity.explanation}
                </p>
              </div>
            </div>

            <button
              onClick={() => setActiveSection('complexity')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-1.5 shrink-0"
            >
              Calcolo Completo & Analysis &rarr;
            </button>
          </div>

          {/* Business Objectives */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-600" />
              Obiettivi Strategici & Risultati Attesi
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {doc.businessObjectives.map((obj, i) => (
                <div key={i} className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span className="text-xs font-medium text-slate-800 leading-relaxed">{obj}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* SECTION: COMPLESSITA' CICLOMATICA */}
      {activeSection === 'complexity' && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* Main Hero Score Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800">
                    McCabe Graph Index
                  </span>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${getRatingBadgeClass(complexity.rating)}`}>
                    {complexity.ratingLabel}
                  </span>
                </div>
                <h2 className="text-2xl font-black text-slate-900">
                  Calcolo della Complessità Ciclomatica BPMN
                </h2>
                <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                  L'indice misura il numero di percorsi indipendenti ed algebricamente distinti attraverso il diagramma di flusso del processo.
                </p>
              </div>

              {/* Big Gauge Metric Display */}
              <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 flex flex-col items-center justify-center min-w-[160px] shadow-lg shrink-0">
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Score v(G)</span>
                <span className="text-4xl font-black text-indigo-400 my-1">{complexity.score}</span>
                <span className="text-[11px] font-semibold text-slate-300">{complexity.edgesCount} Archi / {complexity.nodesCount} Nodi</span>
              </div>
            </div>

            {/* Assessment Explanation & Visual Scale */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Gauge className="w-4 h-4 text-indigo-600" />
                Valutazione del Livello di Rischio Decisionale
              </h3>
              <p className="text-xs text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200 leading-relaxed">
                {complexity.explanation}
              </p>

              {/* Scale Progress Bar */}
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-[11px] font-bold text-slate-500">
                  <span>1 (Lineare)</span>
                  <span>10 (Bassa)</span>
                  <span>20 (Moderata)</span>
                  <span>50 (Elevata)</span>
                  <span>50+ (Critica)</span>
                </div>
                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex p-0.5 border border-slate-200">
                  <div className="h-full bg-emerald-500 rounded-l-full w-1/4" title="1-10 Bassa"></div>
                  <div className="h-full bg-amber-400 w-1/4" title="11-20 Moderata"></div>
                  <div className="h-full bg-orange-500 w-1/4" title="21-50 Elevata"></div>
                  <div className="h-full bg-rose-600 rounded-r-full w-1/4" title=">50 Critica"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Mathematical Formula Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-indigo-600" />
              Formula Matematica e Parametri di Grafo
            </h3>

            <div className="p-4 bg-slate-900 text-slate-100 rounded-xl font-mono text-xs sm:text-sm border border-slate-800 space-y-2">
              <div className="text-indigo-300 font-bold">
                v(G) = E - N + 2P
              </div>
              <div className="text-slate-300 text-xs leading-relaxed">
                v(G) = {complexity.edgesCount} (Sequence Flows) - {complexity.nodesCount} (Nodi/Task) + 2 × {complexity.connectedComponents} (Pools) = <strong className="text-indigo-400 text-sm font-bold">{complexity.score}</strong>
              </div>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Sequence Flows (E)</span>
                <strong className="text-lg font-black text-slate-900">{complexity.edgesCount}</strong>
                <span className="text-[10px] text-slate-500 block">Connessioni tra nodi</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Nodi Totali (N)</span>
                <strong className="text-lg font-black text-slate-900">{complexity.nodesCount}</strong>
                <span className="text-[10px] text-slate-500 block">Task, Gateway ed Eventi</span>
              </div>
              <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-100">
                <span className="text-[10px] font-bold uppercase text-indigo-700 block">Punti Decisionali</span>
                <strong className="text-lg font-black text-indigo-900">{complexity.gatewayDecisionPoints}</strong>
                <span className="text-[10px] text-indigo-700 block">Rami alternativi gateway</span>
              </div>
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-100">
                <span className="text-[10px] font-bold uppercase text-amber-800 block">Densità Gateway</span>
                <strong className="text-lg font-black text-amber-900">{complexity.gatewayDensityRatio}%</strong>
                <span className="text-[10px] text-amber-800 block">Rapporto gateway/nodi</span>
              </div>
            </div>

            {complexity.maxBranchingElement && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-900">Gateway con Massima Ramificazione:</span>
                  <p className="text-slate-600 font-mono">{complexity.maxBranchingElement.name} (ID: {complexity.maxBranchingElement.id})</p>
                </div>
                <span className="px-3 py-1 bg-amber-100 text-amber-900 font-bold rounded-lg border border-amber-300">
                  {complexity.maxBranchingElement.branchesCount} Rami Uscenti
                </span>
              </div>
            )}
          </div>

          {/* Breakdown Table */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-600" />
              Dettaglio Contributivo alla Complessità
            </h3>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-left text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-900 uppercase font-bold">
                  <tr>
                    <th className="py-3 px-4">Componente del Grafo</th>
                    <th className="py-3 px-4 text-center">Conteggio</th>
                    <th className="py-3 px-4 text-center">Impatto su v(G)</th>
                    <th className="py-3 px-4">Descrizione Funzionale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {complexity.breakdown.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{row.category}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">{row.count}</td>
                      <td className={`py-3 px-4 text-center font-mono font-bold ${row.contribution > 0 ? 'text-indigo-600' : 'text-slate-500'}`}>
                        {row.contribution > 0 ? `+${row.contribution}` : row.contribution}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{row.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actionable Recommendations */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-indigo-600" />
              Raccomandazioni di Semplificazione & Refactoring BPMN
            </h3>

            <div className="space-y-2.5">
              {complexity.recommendations.map((rec, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3.5 rounded-xl bg-indigo-50/50 border border-indigo-100 text-xs text-slate-800 font-medium">
                  <Zap className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* SECTION 2: FASI DEL PROCESSO */}
      {activeSection === 'steps' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Fasi del Processo Sequenziali</h2>
              <p className="text-xs text-slate-500">Mappatura di ciascun passaggio con ruoli, input, output e regole di esecuzione.</p>
            </div>

            {/* Search Filter */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Cerca fase, ruolo, ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="py-3 px-3 w-12 text-center">#</th>
                  <th className="py-3 px-3">Fase / Attività</th>
                  <th className="py-3 px-3">Tipo BPMN</th>
                  <th className="py-3 px-3">Attore Responsabile</th>
                  <th className="py-3 px-3 min-w-[280px]">Descrizione Dettagliata</th>
                  <th className="py-3 px-3">Input / Output</th>
                  <th className="py-3 px-3">Azione</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredSteps.map((step) => (
                  <tr key={step.stepNumber} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-3 text-center font-bold text-slate-500">
                      <span className="w-6 h-6 rounded-full bg-slate-200 inline-flex items-center justify-center text-[11px] text-slate-800">
                        {step.stepNumber}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <p className="font-bold text-slate-900">{step.name}</p>
                      <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        {step.elementId}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        {getFriendlyTypeName(step.type)}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-indigo-700">
                      {step.actorRole}
                    </td>
                    <td className="py-3.5 px-3 text-slate-600 leading-relaxed">
                      {step.description}
                      {step.decisionRules && (
                        <div className="mt-1 text-[11px] text-amber-700 bg-amber-50 p-1.5 rounded border border-amber-200">
                          <strong>Regola:</strong> {step.decisionRules}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-3 space-y-1">
                      {step.inputs && step.inputs.length > 0 && (
                        <div className="text-[10px]">
                          <span className="font-bold text-slate-500 block">IN:</span>
                          {step.inputs.map((inItem, idx) => (
                            <span key={idx} className="inline-block mr-1 mb-0.5 px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded">
                              {inItem}
                            </span>
                          ))}
                        </div>
                      )}
                      {step.outputs && step.outputs.length > 0 && (
                        <div className="text-[10px]">
                          <span className="font-bold text-slate-500 block">OUT:</span>
                          {step.outputs.map((outItem, idx) => (
                            <span key={idx} className="inline-block mr-1 mb-0.5 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded">
                              {outItem}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-3">
                      {onSelectStepElement && (
                        <button
                          onClick={() => onSelectStepElement(step.elementId)}
                          className="px-2 py-1 bg-slate-100 hover:bg-blue-50 text-blue-600 rounded text-[11px] font-medium border border-slate-200 hover:border-blue-200 flex items-center gap-1 transition-colors"
                        >
                          Vedi Diagramma &rarr;
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 3: MATRICE RACI */}
      {activeSection === 'raci' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Matrice RACI delle Responsabilità</h2>
            <p className="text-xs text-slate-500 mt-1">
              Definizione dei ruoli per ogni attività: <strong>R</strong> (Responsabile), <strong>A</strong> (Accountable/Approvatore), <strong>C</strong> (Consultato), <strong>I</strong> (Informato).
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white font-bold">
                  <th className="py-3 px-4 rounded-tl-xl">Attività del Processo</th>
                  <th className="py-3 px-3 text-center bg-blue-600">Responsible (R)</th>
                  <th className="py-3 px-3 text-center bg-indigo-600">Accountable (A)</th>
                  <th className="py-3 px-3 text-center bg-emerald-600">Consulted (C)</th>
                  <th className="py-3 px-3 text-center bg-amber-600 rounded-tr-xl">Informed (I)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {doc.raciMatrix.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {item.taskName}
                      <span className="block font-mono text-[10px] text-slate-400 font-normal">
                        ID: {item.elementId}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-semibold text-blue-700 bg-blue-50/50">
                      {item.responsible || '-'}
                    </td>
                    <td className="py-3 px-3 text-center font-semibold text-indigo-700 bg-indigo-50/50">
                      {item.accountable || '-'}
                    </td>
                    <td className="py-3 px-3 text-center font-semibold text-emerald-700 bg-emerald-50/50">
                      {item.consulted || '-'}
                    </td>
                    <td className="py-3 px-3 text-center font-semibold text-amber-700 bg-amber-50/50">
                      {item.informed || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 4: RUOLI */}
      {activeSection === 'roles' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-xl font-bold text-slate-900">Ruoli & Corsie (Lanes/Pools)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {doc.rolesAndParticipants.map((role, idx) => (
              <div key={idx} className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-700">
                    {role.type}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    Task Assegnati: <strong className="text-slate-900">{role.assignedTasksCount}</strong>
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900">{role.name}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{role.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 5: GATEWAY */}
      {activeSection === 'gateways' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-xl font-bold text-slate-900">Gateway & Flussi Decisionali</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {doc.gateways.map((gw) => (
              <div key={gw.id} className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-bold">
                    {gw.id}
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {getFriendlyTypeName(gw.type)}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900">{gw.name}</h3>
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Diramazioni & Condizioni:</span>
                  {gw.branches.map((b, bIdx) => (
                    <div key={bIdx} className="flex items-start gap-2 text-xs bg-white p-2.5 rounded-xl border border-slate-200">
                      <ArrowRight className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-slate-900">{b.condition}</strong>
                        <span className="block text-slate-500 text-[11px]">Raggiunge nodo: <span className="font-mono text-blue-600">{b.target}</span></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 6: RISCHI E OTTIMIZZAZIONI */}
      {activeSection === 'risks' && (
        <div className="space-y-6">
          {/* Risks */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Rischi, Eccezioni & Punti Critici
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {doc.risksAndExceptions.map((risk, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-amber-50/50 border border-amber-200 space-y-2">
                  <span className="text-[10px] font-bold uppercase text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                    Posizione: {risk.location}
                  </span>
                  <h4 className="text-sm font-bold text-slate-900">{risk.risk}</h4>
                  <p className="text-xs text-slate-700">
                    <strong>Mitigazione:</strong> {risk.mitigation}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Optimizations */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-blue-600" />
              Raccomandazioni di Ottimizzazione
            </h2>
            <ul className="space-y-2.5">
              {doc.optimizationSuggestions.map((opt, idx) => (
                <li key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-blue-50/40 border border-blue-100 text-xs text-slate-800 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>{opt}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* SECTION 7: CASI DI TEST */}
      {activeSection === 'tests' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-xl font-bold text-slate-900">Scenari di Test Funzionali</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {doc.testScenarios.map((tc) => (
              <div key={tc.id} className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                    {tc.id}
                  </span>
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Test Passato Atteso
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900">{tc.title}</h3>
                <p className="text-xs text-slate-600"><strong>Pre-condizioni:</strong> {tc.preconditions}</p>
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Sequenza Fasi:</span>
                  <ol className="list-decimal list-inside text-xs text-slate-700 mt-1 space-y-0.5">
                    {tc.pathSteps.map((stepItem, sIdx) => (
                      <li key={sIdx}>{stepItem}</li>
                    ))}
                  </ol>
                </div>
                <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900">
                  <strong>Risultato Atteso:</strong> {tc.expectedResult}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 8: GUIDA UTENTE OPERATIVA */}
      {activeSection === 'guide' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Guida Utente Operativa</h2>
              <p className="text-xs text-slate-500">Istruzioni operative passo-passo formattate per il personale aziendale.</p>
            </div>
            <button
              onClick={handleCopyGuide}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              {copiedGuide ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedGuide ? 'Copiato!' : 'Copia Guida'}
            </button>
          </div>

          <div className="p-6 bg-slate-900 text-slate-200 rounded-xl font-sans text-xs sm:text-sm leading-relaxed whitespace-pre-line border border-slate-800 shadow-inner overflow-x-auto">
            {doc.userManualGuide}
          </div>
        </div>
      )}

    </div>
  );
};
