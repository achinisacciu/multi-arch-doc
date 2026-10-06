import React, { useState } from 'react';
import { JCAAdapterConfig } from '../types/jca';
import { CheckSquare, Square, ShieldCheck, AlertCircle, Copy, Check, Server } from 'lucide-react';

interface DevOpsChecklistProps {
  config: JCAAdapterConfig;
}

interface ChecklistItem {
  id: string;
  title: string;
  category: string;
  description: string;
  impact: 'High' | 'Medium' | 'Low';
}

export const DevOpsChecklist: React.FC<DevOpsChecklistProps> = ({ config }) => {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [copiedPlanXml, setCopiedPlanXml] = useState(false);

  const jndiLocation = config.connectionFactory.location || 'eis/DB/MyDataSource';

  const defaultChecklist: ChecklistItem[] = [
    {
      id: 'chk-jndi',
      title: 'Creazione & Verifica JNDI Outbound Connection Pool',
      category: 'WebLogic / Server Admin',
      description: `Verificare che la Connection Factory JNDI "${jndiLocation}" sia configurata e attiva nella console dell'Application Server (es. WebLogic Deployment -> DbAdapter / JmsAdapter -> Configuration -> Outbound Connection Pools).`,
      impact: 'High',
    },
    {
      id: 'chk-ds',
      title: 'Verifica Data Source JDBC o JMS Server',
      category: 'Infrastruttura',
      description: 'Accertarsi che il Data Source o il JMS Server a cui punta l\'adapter sia in stato "Running" e superi i test di connettività (Test Data Source Pool).',
      impact: 'High',
    },
    {
      id: 'chk-plan',
      title: 'Configurazione File Plan.xml di Deploy',
      category: 'Deployment & CI/CD',
      description: 'Includere nel piano di deployment le sostituzioni per gli ambienti di Sviluppo, Test, Staging e Produzione per puntare ai rispettivi endpoint.',
      impact: 'Medium',
    },
    {
      id: 'chk-auth',
      title: 'Verifica Privilegi Utente & Credenziali di Servizio',
      category: 'Sicurezza & DB',
      description: 'Assicurarsi che l\'utente database / broker possieda i permessi necessari (SELECT, INSERT, UPDATE, EXECUTE sulla procedura, o permessi di lettura/scrittura sulla cartella).',
      impact: 'High',
    },
    {
      id: 'chk-xa',
      title: 'Validazione Supporto Transazioni XA / 2-Phase Commit',
      description: 'Se l\'adapter partecipa a transazioni globali coordinate (Unit of Work), verificare che il driver JDBC sia conforme XA (es. Oracle XA Driver).',
      category: 'Transazionalità',
      impact: 'Medium',
    },
    {
      id: 'chk-wsdl',
      title: 'Allineamento WSDL & Namespace XSD',
      category: 'Sviluppo & Composite',
      description: `Verificare che il file "${config.wsdlLocation}" e i relativi schemi XSD importati siano inclusi nell'archivio SAR/WAR/JAR del composite.`,
      impact: 'High',
    },
  ];

  const toggleItem = (id: string) => {
    setCheckedItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const samplePlanXml = `<!-- Esempio di personalizzazione SOA / OSB Plan.xml per ${config.name} -->
<deploymentPlan xmlns="http://xmlns.oracle.com/weblogic/deployment-plan">
  <variable-assignment>
    <name>JCA_${config.name}_Location</name>
    <xpath>/adapter-config/connection-factory/@location</xpath>
    <origin>planbased</origin>
  </variable-assignment>
  <variable-definition>
    <variable>
      <name>JCA_${config.name}_Location</name>
      <value>${jndiLocation}</value>
    </variable>
  </variable-definition>
</deploymentPlan>`;

  const handleCopyPlan = () => {
    navigator.clipboard.writeText(samplePlanXml).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = samplePlanXml;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
    setCopiedPlanXml(true);
    setTimeout(() => setCopiedPlanXml(false), 2000);
  };

  const total = defaultChecklist.length;
  const completed = Object.values(checkedItems).filter(Boolean).length;
  const progressPercent = Math.round((completed / total) * 100);

  return (
    <div id="devops-checklist-container" className="space-y-6">
      {/* Top Status Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-100">Checklist di Rilascio & Configurazione Runtime</h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Guida operativa per amministratori WebLogic, DevOps e ingegneri di integrazione.
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-full md:w-64 bg-slate-950 p-3 rounded-lg border border-slate-800">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-400">Progresso Verifica:</span>
            <span className="font-bold text-indigo-300">{completed}/{total} ({progressPercent}%)</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Checklist items */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-lg divide-y divide-slate-800/80">
        {defaultChecklist.map((item) => {
          const isDone = !!checkedItems[item.id];
          return (
            <div
              key={item.id}
              onClick={() => toggleItem(item.id)}
              className={`p-5 flex items-start gap-4 cursor-pointer transition ${
                isDone ? 'bg-indigo-950/20 text-slate-400' : 'hover:bg-slate-800/40 text-slate-200'
              }`}
            >
              <button
                type="button"
                className="mt-0.5 text-slate-400 hover:text-indigo-400 transition"
              >
                {isDone ? (
                  <CheckSquare className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Square className="w-5 h-5 text-slate-600" />
                )}
              </button>

              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`text-sm font-bold ${isDone ? 'line-through text-slate-400' : 'text-slate-100'}`}>
                    {item.title}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-medium">
                    {item.category}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-medium border ${
                      item.impact === 'High'
                        ? 'bg-rose-950/60 border-rose-800 text-rose-300'
                        : 'bg-amber-950/60 border-amber-800 text-amber-300'
                    }`}
                  >
                    Impatto {item.impact}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{item.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Plan.xml Template Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="bg-slate-950/80 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
              Template Personalizzazione Plan.xml di Deployment
            </h4>
          </div>
          <button
            onClick={handleCopyPlan}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 transition"
          >
            {copiedPlanXml ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedPlanXml ? 'Copiato!' : 'Copia XML'}</span>
          </button>
        </div>
        <div className="p-6">
          <pre className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-xs text-indigo-300 leading-relaxed overflow-x-auto whitespace-pre">
            {samplePlanXml}
          </pre>
        </div>
      </div>
    </div>
  );
};
