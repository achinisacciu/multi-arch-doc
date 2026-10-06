import React, { useState } from 'react';
import { JCAAdapterConfig } from '../types/jca';
import { Workflow, Copy, Check, GitCommit, ArrowRight, Share2, Layers } from 'lucide-react';

interface ArchitectureDiagramViewerProps {
  config: JCAAdapterConfig;
}

export const ArchitectureDiagramViewer: React.FC<ArchitectureDiagramViewerProps> = ({ config }) => {
  const [activeDiagramType, setActiveDiagramType] = useState<'flowchart' | 'sequence'>('flowchart');
  const [copiedMermaid, setCopiedMermaid] = useState(false);

  const primaryEp = config.endpoints[0];
  const isOutbound = primaryEp?.type === 'interaction';
  const adapterTypeLabel = config.adapter.toUpperCase();
  const targetResource = config.connectionFactory.location ? config.connectionFactory.location.split('/').pop() || config.connectionFactory.location : 'TargetResource';

  const generateFlowchartMermaid = () => {
    let chart = '```mermaid\nflowchart LR\n';
    if (isOutbound) {
      chart += `    ClientSOA[SOA / OSB Composite] -->|WSDL Invoke: ${primaryEp?.operation || 'op'}| JCAAdapter[JCA Adapter: ${config.name}\\n(${adapterTypeLabel})]\n`;
      chart += `    JCAAdapter -->|JNDI: ${config.connectionFactory.location || 'eis/...'}| TargetSys[(Target: ${targetResource})]\n`;
    } else {
      chart += `    TargetSys[(Source: ${targetResource})] -->|Poll / Event| JCAAdapter[JCA Adapter: ${config.name}\\n(${adapterTypeLabel})]\n`;
      chart += `    JCAAdapter -->|Deliver Payload: ${primaryEp?.operation || 'consume'}| ClientSOA[SOA / OSB Consumer]\n`;
    }
    chart += '```';
    return chart;
  };

  const generateSequenceMermaid = () => {
    let chart = '```mermaid\nsequenceDiagram\n    autonumber\n';
    chart += `    actor Caller as Servizio SOA / OSB\n`;
    chart += `    participant JCA as ${config.name} (${adapterTypeLabel})\n`;
    chart += `    participant Target as ${targetResource}\n\n`;
    if (isOutbound) {
      chart += `    Caller->>+JCA: ${primaryEp?.operation || 'execute'}(payload)\n`;
      chart += `    JCA->>+Target: Invocazione JNDI [${config.connectionFactory.location || 'EIS'}]\n`;
      chart += `    Target-->>-JCA: Risultato / Conferma\n`;
      chart += `    JCA-->>-Caller: Risposta Elaborata\n`;
    } else {
      chart += `    Target->>+JCA: Nuovo Messaggio / Record / File\n`;
      chart += `    JCA->>+Caller: ${primaryEp?.operation || 'onMessage'}(payload)\n`;
      chart += `    Caller-->>-JCA: Conferma Ricezione (Ack)\n`;
      chart += `    JCA-->>-Target: Commit / Cancellazione Sorgente\n`;
    }
    chart += '```';
    return chart;
  };

  const currentMermaid = activeDiagramType === 'flowchart' ? generateFlowchartMermaid() : generateSequenceMermaid();

  const handleCopyMermaid = () => {
    navigator.clipboard.writeText(currentMermaid).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = currentMermaid;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
    setCopiedMermaid(true);
    setTimeout(() => setCopiedMermaid(false), 2000);
  };

  return (
    <div id="diagram-viewer-container" className="space-y-6">
      {/* Visual Graphical Node Preview */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <Workflow className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-100">Rappresentazione Visiva Interattiva</h3>
              <p className="text-xs text-slate-400">Flusso dati in tempo reale estratto dalla specifica JCA</p>
            </div>
          </div>

          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-950/60 border border-indigo-800 text-indigo-300">
            {isOutbound ? 'Flusso Outbound' : 'Flusso Inbound'}
          </span>
        </div>

        {/* Node Diagram SVG/Card Layout */}
        <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-8 overflow-x-auto">
          <div className="min-w-[650px] flex items-center justify-between relative">
            {/* Connection Line */}
            <div className="absolute top-1/2 left-12 right-12 -translate-y-1/2 h-0.5 bg-gradient-to-r from-slate-700 via-indigo-600 to-slate-700 -z-0" />

            {/* Node 1 */}
            <div className="relative z-10 bg-slate-900 border-2 border-slate-700 rounded-xl p-4 w-48 text-center shadow-lg hover:border-indigo-500 transition">
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 mx-auto mb-2">
                <Layers className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold text-slate-100">SOA / OSB Composite</div>
              <div className="text-[10px] font-mono text-slate-400 mt-1">
                Port: {primaryEp?.portType || 'ptt'}
              </div>
            </div>

            {/* Middle Badge / Action */}
            <div className="relative z-10 bg-slate-900 border border-indigo-500/50 rounded-lg px-3 py-1.5 text-center shadow-md">
              <span className="text-[10px] font-mono font-semibold text-indigo-300 block">
                {isOutbound ? `Invocazione -> ${primaryEp?.operation}` : `Event Polling <- ${primaryEp?.operation}`}
              </span>
            </div>

            {/* Node 2: Adapter */}
            <div className="relative z-10 bg-indigo-950/80 border-2 border-indigo-600 rounded-xl p-4 w-52 text-center shadow-xl">
              <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 mx-auto mb-2">
                <GitCommit className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold text-white truncate" title={config.name}>{config.name}</div>
              <div className="text-[10px] font-mono text-indigo-300 mt-1 bg-indigo-950 px-2 py-0.5 rounded inline-block">
                {adapterTypeLabel} Adapter
              </div>
            </div>

            {/* Middle Badge / JNDI */}
            <div className="relative z-10 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-center shadow-md">
              <span className="text-[10px] font-mono font-semibold text-amber-300 block truncate max-w-[130px]" title={config.connectionFactory.location}>
                {config.connectionFactory.location || 'eis/...'}
              </span>
            </div>

            {/* Node 3: Target System */}
            <div className="relative z-10 bg-slate-900 border-2 border-slate-700 rounded-xl p-4 w-48 text-center shadow-lg hover:border-emerald-500 transition">
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-emerald-400 mx-auto mb-2">
                <Share2 className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold text-slate-100">
                {config.adapter === 'db' && 'Database Schema'}
                {config.adapter === 'jms' && 'JMS Broker / Queue'}
                {config.adapter === 'file' && 'File Share Directory'}
                {config.adapter === 'ftp' && 'Remote SFTP Server'}
                {config.adapter === 'aq' && 'Oracle AQ'}
                {!['db', 'jms', 'file', 'ftp', 'aq'].includes(config.adapter) && 'Sistema Target'}
              </div>
              <div className="text-[10px] font-mono text-slate-400 mt-1 truncate">
                {targetResource}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mermaid Code Generator & Viewer */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="bg-slate-950/80 px-6 py-4 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Sintassi Mermaid:</span>
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setActiveDiagramType('flowchart')}
                className={`px-3 py-1 rounded text-xs font-semibold transition ${
                  activeDiagramType === 'flowchart'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Flowchart LR
              </button>
              <button
                onClick={() => setActiveDiagramType('sequence')}
                className={`px-3 py-1 rounded text-xs font-semibold transition ${
                  activeDiagramType === 'sequence'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Sequence Diagram
              </button>
            </div>
          </div>

          <button
            id="copy-mermaid-btn"
            onClick={handleCopyMermaid}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm transition"
          >
            {copiedMermaid ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedMermaid ? 'Copiato!' : 'Copia Codice Mermaid'}</span>
          </button>
        </div>

        <div className="p-6">
          <p className="text-xs text-slate-400 mb-3">
            Incolla questo blocco direttamente in GitHub, GitLab, Obsidian, Notion, Azure DevOps Wiki o editor Markdown compatibili:
          </p>
          <pre className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-xs text-emerald-300 leading-relaxed overflow-x-auto whitespace-pre">
            {currentMermaid}
          </pre>
        </div>
      </div>
    </div>
  );
};
