import React, { useState } from 'react';
import { JCAAdapterConfig } from '../types/jca';
import {
  Database,
  Radio,
  FolderTree,
  Send,
  Layers,
  ArrowRight,
  Copy,
  Check,
  Server,
  FileCode2,
  Workflow,
  AlertTriangle,
} from 'lucide-react';

interface OverviewDashboardProps {
  config: JCAAdapterConfig;
  onNavigateTab: (tab: string) => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({ config, onNavigateTab }) => {
  const [copiedJndi, setCopiedJndi] = useState(false);
  const primaryEp = config.endpoints[0];
  const isOutbound = primaryEp?.type === 'interaction';

  const handleCopyJndi = () => {
    if (config.connectionFactory.location) {
      navigator.clipboard.writeText(config.connectionFactory.location);
      setCopiedJndi(true);
      setTimeout(() => setCopiedJndi(false), 2000);
    }
  };

  const getAdapterIcon = () => {
    switch (config.adapter) {
      case 'db':
        return <Database className="w-5 h-5 text-blue-400" />;
      case 'jms':
        return <Radio className="w-5 h-5 text-purple-400" />;
      case 'file':
      case 'ftp':
        return <FolderTree className="w-5 h-5 text-emerald-400" />;
      case 'aq':
        return <Layers className="w-5 h-5 text-amber-400" />;
      default:
        return <Server className="w-5 h-5 text-slate-400" />;
    }
  };

  const getAdapterColor = () => {
    switch (config.adapter) {
      case 'db':
        return 'bg-blue-950/50 border-blue-800 text-blue-300';
      case 'jms':
        return 'bg-purple-950/50 border-purple-800 text-purple-300';
      case 'file':
      case 'ftp':
        return 'bg-emerald-950/50 border-emerald-800 text-emerald-300';
      case 'aq':
        return 'bg-amber-950/50 border-amber-800 text-amber-300';
      default:
        return 'bg-slate-900 border-slate-700 text-slate-300';
    }
  };

  return (
    <div id="overview-dashboard-container" className="space-y-6">
      {/* Warning notices if any */}
      {config.validationWarnings.length > 0 && (
        <div id="warnings-banner" className="bg-amber-950/40 border border-amber-800/80 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200 space-y-1">
            <span className="font-semibold">Note di Analisi XML:</span>
            {config.validationWarnings.map((warn, i) => (
              <p key={i} className="text-amber-300/90">{warn}</p>
            ))}
          </div>
        </div>
      )}

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Adapter Type */}
        <div id="kpi-adapter-type" className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tipo Adapter</span>
            <div className="p-2 rounded-lg bg-slate-800/80">{getAdapterIcon()}</div>
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border uppercase ${getAdapterColor()}`}>
                {config.adapter}
              </span>
              <span className="text-sm font-semibold text-slate-100 truncate">{config.name}</span>
            </div>
            <p className="text-xs text-slate-400 mt-1 truncate">{config.adapterRaw || config.adapter}</p>
          </div>
        </div>

        {/* Card 2: Direction & Flow */}
        <div id="kpi-direction" className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Direzione Flusso</span>
            <div className="p-2 rounded-lg bg-slate-800/80">
              <Workflow className="w-5 h-5 text-indigo-400" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold border uppercase ${
                  isOutbound
                    ? 'bg-indigo-950/60 border-indigo-800 text-indigo-300'
                    : 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                }`}
              >
                {isOutbound ? 'Outbound' : 'Inbound'}
              </span>
              <span className="text-xs font-medium text-slate-300">
                {isOutbound ? 'Interaction (Invoke)' : 'Activation (Polling)'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {config.endpoints.length} Endpoint{config.endpoints.length > 1 ? 's' : ''} configurati
            </p>
          </div>
        </div>

        {/* Card 3: JNDI Location */}
        <div id="kpi-jndi" className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">JNDI Connection</span>
            <button
              id="copy-jndi-kpi-btn"
              onClick={handleCopyJndi}
              title="Copia percorso JNDI"
              className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
            >
              {copiedJndi ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <div className="mt-3">
            <div className="font-mono text-xs text-indigo-300 font-semibold truncate" title={config.connectionFactory.location}>
              {config.connectionFactory.location || 'Nessun JNDI specificato'}
            </div>
            <p className="text-xs text-slate-400 mt-1 truncate">
              {config.connectionFactory.uiConnectionName ? `Alias: ${config.connectionFactory.uiConnectionName}` : 'Risorsa WebLogic / Application Server'}
            </p>
          </div>
        </div>

        {/* Card 4: WSDL Contract */}
        <div id="kpi-wsdl" className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Contratto WSDL</span>
            <div className="p-2 rounded-lg bg-slate-800/80">
              <FileCode2 className="w-5 h-5 text-amber-400" />
            </div>
          </div>
          <div className="mt-3">
            <div className="font-mono text-xs text-amber-300 font-semibold truncate" title={config.wsdlLocation}>
              {config.wsdlLocation || `${config.name}.wsdl`}
            </div>
            <p className="text-xs text-slate-400 mt-1 truncate">
              PortType: {primaryEp?.portType || 'Non specificato'}
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Visual Flow Diagram */}
      <div id="visual-flow-panel" className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 shadow-md">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Workflow className="w-4 h-4 text-indigo-400" />
              Mappatura Flusso di Integrazione
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Topologia architetturale estratta dai metadati del file JCA
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('diagram')}
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition"
          >
            Vedi Diagramma Mermaid Completo <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-5">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Step 1: SOA / OSB Composite */}
            <div className="flex-1 w-full bg-slate-900 border border-slate-700/80 rounded-lg p-4 text-center">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                {isOutbound ? 'Client / Chiamante' : 'Destinatario / Consumatore'}
              </div>
              <div className="font-bold text-sm text-slate-100">SOA / OSB Composite</div>
              <div className="text-xs font-mono text-indigo-300 mt-1 bg-slate-950 px-2 py-0.5 rounded inline-block">
                {primaryEp?.portType || 'PortType'}
              </div>
            </div>

            {/* Connection Arrow */}
            <div className="flex flex-col items-center justify-center text-slate-500 px-2">
              <span className="text-[11px] font-mono text-slate-400 mb-1">
                {isOutbound ? `Invocazione: ${primaryEp?.operation || 'op'}` : `Callback: ${primaryEp?.operation || 'op'}`}
              </span>
              <div className="flex items-center gap-1">
                <div className="h-0.5 w-12 bg-indigo-500/60" />
                <ArrowRight className="w-4 h-4 text-indigo-400 shrink-0" />
              </div>
            </div>

            {/* Step 2: JCA Resource Adapter */}
            <div className="flex-1 w-full bg-indigo-950/40 border border-indigo-700/60 rounded-lg p-4 text-center shadow-inner">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-indigo-300 mb-1">
                JCA Adapter Runtime
              </div>
              <div className="font-bold text-sm text-white flex items-center justify-center gap-1.5">
                {getAdapterIcon()}
                <span>{config.name}</span>
              </div>
              <div className="text-xs text-indigo-200 mt-1 truncate">
                {primaryEp?.specCategory || 'JCA Resource Adapter'}
              </div>
            </div>

            {/* Connection Arrow */}
            <div className="flex flex-col items-center justify-center text-slate-500 px-2">
              <span className="text-[11px] font-mono text-slate-400 mb-1 truncate max-w-[120px]">
                {config.connectionFactory.location ? config.connectionFactory.location.split('/').pop() : 'JNDI'}
              </span>
              <div className="flex items-center gap-1">
                <div className="h-0.5 w-12 bg-indigo-500/60" />
                <ArrowRight className="w-4 h-4 text-indigo-400 shrink-0" />
              </div>
            </div>

            {/* Step 3: Target Physical Resource */}
            <div className="flex-1 w-full bg-slate-900 border border-slate-700/80 rounded-lg p-4 text-center">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Risorsa Esterna Target
              </div>
              <div className="font-bold text-sm text-slate-100">
                {config.adapter === 'db' && 'Database (Oracle/SQL)'}
                {config.adapter === 'jms' && 'JMS Queue / Topic'}
                {config.adapter === 'file' && 'File System Share'}
                {config.adapter === 'ftp' && 'Server FTP / SFTP'}
                {config.adapter === 'aq' && 'Oracle AQ Queue'}
                {!['db', 'jms', 'file', 'ftp', 'aq'].includes(config.adapter) && 'Sistema Esterno'}
              </div>
              <div className="text-xs font-mono text-amber-300 mt-1 bg-slate-950 px-2 py-0.5 rounded inline-block truncate max-w-full">
                {config.connectionFactory.location || 'eis/...'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Summary Highlights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Highlight 1: Core Specifications */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
            <span>Dettagli Operativi Principali</span>
            <button onClick={() => onNavigateTab('endpoints')} className="text-indigo-400 hover:underline text-[11px]">
              Tutte le proprietà &rarr;
            </button>
          </h4>
          <dl className="divide-y divide-slate-800/80 text-xs">
            <div className="py-2 flex justify-between">
              <dt className="text-slate-400">Spec Class:</dt>
              <dd className="font-mono text-slate-200 truncate max-w-[240px]" title={primaryEp?.specClassName}>
                {primaryEp?.specClassName || 'Non specificato'}
              </dd>
            </div>
            <div className="py-2 flex justify-between">
              <dt className="text-slate-400">Operazione:</dt>
              <dd className="font-semibold text-slate-200">{primaryEp?.operation || 'default'}</dd>
            </div>
            <div className="py-2 flex justify-between">
              <dt className="text-slate-400">Port Type:</dt>
              <dd className="font-mono text-slate-200">{primaryEp?.portType || 'default'}</dd>
            </div>
            <div className="py-2 flex justify-between">
              <dt className="text-slate-400">Proprietà Configurate:</dt>
              <dd className="font-semibold text-indigo-300">{primaryEp?.properties.length || 0} parametri</dd>
            </div>
          </dl>
        </div>

        {/* Highlight 2: Technical Payload Preview */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
            <span>
              {config.adapter === 'db' && 'Dettagli Query SQL / Stored Procedure'}
              {config.adapter === 'jms' && 'Dettagli Destinazione JMS'}
              {(config.adapter === 'file' || config.adapter === 'ftp') && 'Dettagli Directory & File'}
              {!['db', 'jms', 'file', 'ftp'].includes(config.adapter) && 'Specifiche Tecniche Risorsa'}
            </span>
            <button onClick={() => onNavigateTab('sql-payload')} className="text-indigo-400 hover:underline text-[11px]">
              Dettaglio completo &rarr;
            </button>
          </h4>

          {config.adapter === 'db' && primaryEp?.sqlAnalysis && (
            <div className="space-y-2 text-xs">
              {primaryEp.sqlAnalysis.sqlString ? (
                <div>
                  <span className="text-slate-400">Query SQL (estratto):</span>
                  <pre className="mt-1 bg-slate-950 p-2.5 rounded border border-slate-800 font-mono text-[11px] text-emerald-300 overflow-x-auto whitespace-pre-wrap max-h-24">
                    {primaryEp.sqlAnalysis.sqlString}
                  </pre>
                </div>
              ) : primaryEp.sqlAnalysis.procedureName ? (
                <div>
                  <span className="text-slate-400">Procedura PL/SQL:</span>
                  <div className="mt-1 p-2 bg-slate-950 rounded border border-slate-800 font-mono text-amber-300">
                    {primaryEp.sqlAnalysis.packageName ? `${primaryEp.sqlAnalysis.packageName}.` : ''}{primaryEp.sqlAnalysis.procedureName}
                  </div>
                </div>
              ) : (
                <p className="text-slate-400 italic">Mappatura TopLink/EclipseLink DML: {primaryEp.sqlAnalysis.descriptorName || 'Definita in or-mappings.xml'}</p>
              )}
            </div>
          )}

          {config.adapter === 'jms' && primaryEp?.messagingAnalysis && (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Coda/Topic JNDI:</span>
                <span className="font-mono text-indigo-300">{primaryEp.messagingAnalysis.destinationName || 'N/D'}</span>
              </div>
              {primaryEp.messagingAnalysis.messageSelector && (
                <div>
                  <span className="text-slate-400">Message Selector:</span>
                  <pre className="mt-1 bg-slate-950 p-2 rounded font-mono text-[11px] text-amber-300">
                    {primaryEp.messagingAnalysis.messageSelector}
                  </pre>
                </div>
              )}
            </div>
          )}

          {(config.adapter === 'file' || config.adapter === 'ftp') && primaryEp?.fileAnalysis && (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Directory:</span>
                <span className="font-mono text-emerald-300 truncate max-w-[200px]">
                  {primaryEp.fileAnalysis.physicalDirectory || primaryEp.fileAnalysis.logicalDirectory || 'N/D'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">File Pattern:</span>
                <span className="font-mono text-slate-200">{primaryEp.fileAnalysis.fileName || primaryEp.fileAnalysis.fileNamingConvention || '*.*'}</span>
              </div>
            </div>
          )}

          {!['db', 'jms', 'file', 'ftp'].includes(config.adapter) && (
            <div className="text-xs text-slate-400 space-y-1">
              <p>Adapter generico con {primaryEp?.properties.length || 0} proprietà configurate.</p>
              <p>Consulta la sezione <strong className="text-slate-200">Endpoint & Proprietà</strong> per visualizzare i dettagli completi.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
