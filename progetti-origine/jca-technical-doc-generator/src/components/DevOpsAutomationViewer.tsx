import React, { useState } from 'react';
import {
  Terminal,
  FileCode,
  CheckSquare,
  Server,
  ShieldAlert,
  Play,
  Cpu,
} from 'lucide-react';
import { ScriptInfo } from '../types/jca';

interface DevOpsAutomationViewerProps {
  scripts: ScriptInfo[];
}

export const DevOpsAutomationViewer: React.FC<DevOpsAutomationViewerProps> = ({ scripts }) => {
  const [selectedScript, setSelectedScript] = useState<ScriptInfo | null>(scripts[0] || null);

  return (
    <div className="space-y-6 animate-fadeIn" id="devops-automation-viewer">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <div className="text-xs text-slate-500 font-medium">Script WLST (Python)</div>
          <div className="text-2xl font-bold text-indigo-600 mt-1">
            {scripts.filter((s) => s.type === 'py').length}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Automazione WebLogic Server</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <div className="text-xs text-slate-500 font-medium">Shell Scripts (.sh)</div>
          <div className="text-2xl font-bold text-purple-600 mt-1">
            {scripts.filter((s) => s.type === 'sh').length}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Ant, Build & Packaging SAR</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <div className="text-xs text-slate-500 font-medium">Script SQL / Config / TCL / Java</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {scripts.filter((s) => ['sql', 'properties', 'tcl', 'ctl', 'java', 'other'].includes(s.type)).length}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">DDL / Props / TCL / Java / Other</p>
        </div>
      </div>

      {/* Script Explorer & Code Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Script List */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-indigo-600" />
            Script di Automazione Rilevati ({scripts.length})
          </h3>

          {scripts.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">Nessuno script rilevato.</p>
          ) : (
            <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
              {scripts.map((script) => (
                <button
                  key={script.id}
                  onClick={() => setSelectedScript(script)}
                  className={`w-full text-left p-3 rounded-xl transition-all border text-xs ${
                    selectedScript?.id === script.id
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-950 font-semibold shadow-sm'
                      : 'bg-slate-50 border-slate-200/60 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono">{script.name}</span>
                    <span className="px-1.5 py-0.5 rounded bg-white text-[10px] uppercase font-bold font-mono border text-slate-600">
                      {script.type}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 truncate">{script.purpose}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Script Code Inspector */}
        <div className="lg:col-span-2 bg-slate-900 rounded-2xl p-6 shadow-sm flex flex-col">
          {selectedScript ? (
            <>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                <div>
                  <h4 className="text-slate-100 font-mono text-xs font-bold">{selectedScript.name}</h4>
                  <p className="text-[11px] text-slate-400">{selectedScript.relativePath}</p>
                </div>
                <span className="text-[11px] font-mono text-slate-400">{selectedScript.linesCount} righe</span>
              </div>
              <pre className="text-slate-200 font-mono text-xs overflow-x-auto leading-relaxed flex-1 max-h-[440px]">
                {selectedScript.rawContent}
              </pre>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
              Seleziona uno script dall'elenco per ispezionarne il sorgente
            </div>
          )}
        </div>
      </div>

      {/* Deployment & Environment Promotion Checklist */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-emerald-600" />
          Checklist di Rilascio & Promozione Ambienti (DEV ➔ TEST ➔ PROD)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
            <h4 className="font-bold text-slate-900">1. Configurazione WebLogic Server (WLS)</h4>
            <ul className="space-y-1 text-slate-600">
              <li>• Creazione e collaudo dei <strong>JDBC Data Sources</strong> con JNDI corrispondenti ai file .jca</li>
              <li>• Creazione dei <strong>JMS Module</strong>, Connection Factories e Code Fisiche/Uniformi</li>
              <li>• Verifica del dimensionamento del connection pool e timeout delle transazioni XA</li>
            </ul>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
            <h4 className="font-bold text-slate-900">2. SOA Config Plan (Plan.xml)</h4>
            <ul className="space-y-1 text-slate-600">
              <li>• Sostituzione delle URL degli endpoint WSDL esterni per ciascun ambiente</li>
              <li>• Configurazione delle chiavi CSF (Credential Store Framework) per le credenziali sicure</li>
              <li>• Sostituzione dei percorsi di directory per gli adapter File/FTP</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
