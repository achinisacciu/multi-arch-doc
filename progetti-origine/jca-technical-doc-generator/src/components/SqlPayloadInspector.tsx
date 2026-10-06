import React, { useState } from 'react';
import { JCAAdapterConfig } from '../types/jca';
import { Database, Code, Tag, Table2, Check, Copy, Radio, FolderTree, FileCode, CheckCircle2 } from 'lucide-react';

interface SqlPayloadInspectorProps {
  config: JCAAdapterConfig;
}

export const SqlPayloadInspector: React.FC<SqlPayloadInspectorProps> = ({ config }) => {
  const [copiedSql, setCopiedSql] = useState<string | null>(null);

  const handleCopySql = (sql: string, id: string) => {
    navigator.clipboard.writeText(sql).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = sql;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
    setCopiedSql(id);
    setTimeout(() => setCopiedSql(null), 2000);
  };

  const formatSqlDisplay = (sql: string) => {
    if (!sql) return '';
    return sql
      .replace(/--.*$/gm, ' ')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\b(SELECT|FROM|WHERE|AND|OR|INSERT INTO|VALUES|UPDATE|SET|DELETE FROM|MERGE INTO|USING|ON|GROUP BY|ORDER BY|HAVING|LEFT JOIN|RIGHT JOIN|INNER JOIN)\b/gi, '\n$1')
      .trim();
  };

  return (
    <div id="payload-inspector-container" className="space-y-6">
      {config.endpoints.map((ep, epIdx) => {
        const sqlAnalysis = ep.sqlAnalysis;
        const messagingAnalysis = ep.messagingAnalysis;
        const fileAnalysis = ep.fileAnalysis;
        const isDb = config.adapter === 'db' || !!sqlAnalysis?.sqlString || !!sqlAnalysis?.procedureName;
        const isJms = config.adapter === 'jms' || !!messagingAnalysis?.destinationName;
        const isFile = config.adapter === 'file' || config.adapter === 'ftp' || !!fileAnalysis?.physicalDirectory;
        return (
          <div key={ep.id} className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${ep.type==='interaction'?'bg-indigo-950/60 border-indigo-800 text-indigo-300':'bg-emerald-950/60 border-emerald-800 text-emerald-300'}`}>{ep.type}</span>
              <span className="font-bold text-slate-200">{ep.operation || `endpoint-${epIdx+1}`}</span>
              <span>• {ep.portType}</span>
            </div>

      {isDb && (
        <>
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            <div className="bg-slate-950/80 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Database className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-bold text-slate-100">
                  {sqlAnalysis?.procedureName ? 'Firma Procedura PL/SQL & Parametri' : 'Istruzione SQL & Query PureSQL'}
                  <span className="ml-2 text-[11px] font-mono text-slate-500">{ep.operation}</span>
                </h3>
              </div>

              {sqlAnalysis?.sqlString && (
                <button
                  id={`copy-sql-btn-${epIdx}`}
                  onClick={() => handleCopySql(sqlAnalysis.sqlString!, ep.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 transition"
                >
                  {copiedSql===ep.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSql===ep.id ? 'Copiato!' : 'Copia SQL'}</span>
                </button>
              )}
            </div>

            <div className="p-6 space-y-5">
              {sqlAnalysis?.sqlString ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Code className="w-3.5 h-3.5 text-indigo-400" />
                      SQL Formattato
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded font-mono bg-blue-950/60 border border-blue-800 text-blue-300">
                      Tipo: {sqlAnalysis.sqlType || 'DML'}
                    </span>
                  </div>
                  <div className="relative">
                    <pre className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto leading-relaxed whitespace-pre-wrap">
                      {formatSqlDisplay(sqlAnalysis.sqlString)}
                    </pre>
                  </div>
                </div>
              ) : sqlAnalysis?.procedureName ? (
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div>
                      <span className="text-slate-400 block mb-1">Schema DB:</span>
                      <span className="font-mono text-amber-300 font-bold">{sqlAnalysis.schemaName || 'DEFAULT_SCHEMA'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-1">Package PL/SQL:</span>
                      <span className="font-mono text-amber-300 font-bold">{sqlAnalysis.packageName || '(Standalone)'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-1">Nome Procedura/Funzione:</span>
                      <span className="font-mono text-emerald-300 font-bold">{sqlAnalysis.procedureName}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-950 rounded-lg text-xs text-slate-400">
                  Operazione TopLink OR-Mapping: <code className="text-slate-200">{sqlAnalysis?.descriptorName || 'Vedi XML Mappings'}</code>
                </div>
              )}

              {sqlAnalysis?.parameters && sqlAnalysis.parameters.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-indigo-400" />
                    Parametri di Bind Rilevati ({sqlAnalysis.parameters.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {sqlAnalysis.parameters.map((param, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-indigo-950/40 border border-indigo-800 text-indigo-200 text-xs font-mono"
                      >
                        <span className="text-indigo-400 font-bold">#</span>
                        <span>{param}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Questi parametri devono corrispondere esattamente agli elementi dell'XSD / WSDL associati al payload di input.
                  </p>
                </div>
              )}

              {sqlAnalysis?.tables && sqlAnalysis.tables.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Table2 className="w-3.5 h-3.5 text-emerald-400" />
                    Tabelle Referenziate ({sqlAnalysis.tables.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {sqlAnalysis.tables.map((table, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-950 border border-slate-700 text-slate-200 text-xs font-mono"
                      >
                        <Table2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{table}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {isJms && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
          <div className="bg-slate-950/80 px-6 py-4 border-b border-slate-800 flex items-center gap-2.5">
            <Radio className="w-5 h-5 text-purple-400" />
            <h3 className="text-sm font-bold text-slate-100">Specifiche JMS Destination & Message Broker <span className="ml-2 text-[11px] font-mono text-slate-500">{ep.operation}</span></h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">Destinazione (Queue / Topic):</span>
                <span className="font-mono text-sm text-indigo-300 font-bold break-all">
                  {messagingAnalysis?.destinationName || 'Non configurata'}
                </span>
                <div className="mt-2 text-xs text-slate-400">
                  Tipo: <span className="text-slate-200 font-semibold">{messagingAnalysis?.destinationType || 'Queue'}</span>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">Formato Payload JMS:</span>
                <span className="font-mono text-sm text-emerald-300 font-bold">
                  {messagingAnalysis?.payloadType || 'TextMessage'}
                </span>
                <div className="mt-2 text-xs text-slate-400">
                  Delivery Mode: <span className="text-slate-200 font-semibold">{messagingAnalysis?.deliveryMode || 'Default'}</span>
                </div>
              </div>
            </div>

            {messagingAnalysis?.messageSelector && (
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Message Selector (Filtro SQL-92):
                </span>
                <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-amber-300">
                  {messagingAnalysis.messageSelector}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {isFile && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
          <div className="bg-slate-950/80 px-6 py-4 border-b border-slate-800 flex items-center gap-2.5">
            <FolderTree className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-100">Specifiche File System & Directory <span className="ml-2 text-[11px] font-mono text-slate-500">{ep.operation}</span></h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">Directory Fisica / Percorso:</span>
                <span className="font-mono text-xs text-emerald-300 font-bold break-all">
                  {fileAnalysis?.physicalDirectory || 'Non impostata'}
                </span>
              </div>
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">Nome File o Pattern Regex:</span>
                <span className="font-mono text-xs text-amber-300 font-bold break-all">
                  {fileAnalysis?.fileName || fileAnalysis?.fileNamingConvention || '*.*'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <span className="text-slate-400 block">Frequenza Polling:</span>
                <span className="font-semibold text-slate-200">{fileAnalysis?.pollingFrequency ? `${fileAnalysis.pollingFrequency}s` : 'N/D'}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <span className="text-slate-400 block">Delete After Read:</span>
                <span className="font-semibold text-slate-200">{fileAnalysis?.deleteAfterRead ? 'Sì (Elimina)' : 'No'}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <span className="text-slate-400 block">Host / Server:</span>
                <span className="font-semibold text-slate-200">{fileAnalysis?.host || 'Locale'}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <span className="text-slate-400 block">Porta:</span>
                <span className="font-semibold text-slate-200">{fileAnalysis?.port || (config.adapter === 'ftp' ? '22' : 'N/D')}</span>
              </div>
            </div>
          </div>
        </div>
      )}
          </div>
        );
      })}

      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 text-xs text-slate-400 flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-200">Analisi Automatica di Conformità ({config.endpoints.length} endpoint):</span>
          <p className="mt-1 leading-relaxed">
            I parametri sopra estratti derivano dalla scansione AST di tutti gli endpoint e sono pronti per essere mappati nella documentazione Markdown o nei diagrammi.
          </p>
        </div>
      </div>
    </div>
  );
};
