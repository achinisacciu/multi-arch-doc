import React from 'react';
import type { CrossProcessAnalysis, BpmnFileItem, ParsedBpmn } from '../types';
import { BarChart3, Network, Users, GitBranch, FileText } from 'lucide-react';

interface Props {
  files: BpmnFileItem[];
  parsed: Record<string, ParsedBpmn>;
  analysis: CrossProcessAnalysis;
}

export function AnalysisView({ files, parsed, analysis }: Props) {
  return (
    <div className="flex-1 overflow-auto bg-white">
      <div className="p-6 max-w-6xl mx-auto">
        <h2 className="text-lg font-bold text-slate-800 mb-1">Analisi Incrociata Processi</h2>
        <p className="text-sm text-slate-500 mb-6">{analysis.totalProcesses} processi analizzati, {analysis.totalElements} elementi totali</p>

        <div className="grid grid-cols-4 gap-3 mb-6">
          <StatCard icon={<BarChart3 className="w-5 h-5" />} label="Processi" value={analysis.totalProcesses} />
          <StatCard icon={<FileText className="w-5 h-5" />} label="Elementi" value={analysis.totalElements} />
          <StatCard icon={<GitBranch className="w-5 h-5" />} label="Call Activities" value={analysis.callActivityRefs.length} />
          <StatCard icon={<Network className="w-5 h-5" />} label="Flussi Messaggio" value={analysis.messageFlows.length} />
        </div>

        {analysis.callActivityRefs.length > 0 && (
          <Section title="Call Activities (Inter-Process)" icon={<GitBranch className="w-4 h-4" />}>
            <table className="text-xs width-full">
              <thead><tr><th className="text-left py-2 text-slate-500">Fonte</th><th className="text-left py-2 text-slate-500">Elemento</th><th className="text-left py-2 text-slate-500">Processo Chiamato</th></tr></thead>
              <tbody>
                {analysis.callActivityRefs.map((ref, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-2 text-slate-600">{ref.sourceFile}</td>
                    <td className="py-2 font-medium text-slate-800">{ref.sourceName || ref.sourceId}</td>
                    <td className="py-2 text-blue-600">{ref.targetProcessName || ref.targetProcessId || 'Sconosciuto'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {analysis.sharedRoles.length > 0 && (
          <Section title="Ruoli Condivisi" icon={<Users className="w-4 h-4" />}>
            <table className="text-xs w-full">
              <thead><tr><th className="text-left py-2 text-slate-500">Ruolo</th><th className="text-left py-2 text-slate-500">Processi</th><th className="text-left py-2 text-slate-500">Task Totali</th></tr></thead>
              <tbody>
                {analysis.sharedRoles.map((role, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-2 font-medium text-slate-800">{role.roleName}</td>
                    <td className="py-2 text-slate-600">{role.participatingProcesses.join(', ')}</td>
                    <td className="py-2 text-slate-600">{role.totalTasks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {analysis.processInteractions.length > 0 && (
          <Section title="Interazioni tra Processi" icon={<Network className="w-4 h-4" />}>
            <div className="space-y-2">
              {analysis.processInteractions.map((inter, i) => (
                <div key={i} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-xs text-slate-600">{inter.description}</p>
                  <p className="text-[10px] text-slate-400 mt-1">Da: {inter.fromFileName} → A: {inter.toFileName || 'processo esterno'}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        <div className="mt-6 space-y-4">
          {files.map(f => {
            const p = parsed[f.id];
            if (!p) return null;
            return (
              <div key={f.id} className="border border-slate-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-slate-800 mb-2">{f.name}</h3>
                <div className="grid grid-cols-5 gap-3 text-center">
                  <StatSmall label="Elementi" value={p.stats.totalElements} />
                  <StatSmall label="Task" value={p.stats.tasksCount} />
                  <StatSmall label="Gateway" value={p.stats.gatewaysCount} />
                  <StatSmall label="Eventi" value={p.stats.eventsCount} />
                  <StatSmall label="Pools" value={p.stats.poolsCount} />
                </div>
                {p.crossRefs.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[10px] text-slate-400">Cross-refs: {p.crossRefs.length}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 text-center shadow-sm">
      <div className="flex justify-center mb-1">{icon}</div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <p className="text-[10px] text-slate-500">{label}</p>
    </div>
  );
}

function StatSmall({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-slate-50 rounded-lg p-2">
      <p className="text-lg font-bold text-slate-800">{value}</p>
      <p className="text-[10px] text-slate-400">{label}</p>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">{icon}{title}</h3>
      {children}
    </div>
  );
}
