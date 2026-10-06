import React, { useState } from 'react';
import {
  Database,
  Radio,
  FileCode,
  Layers,
  Code2,
  Workflow,
  ShieldCheck,
  Search,
  Filter,
} from 'lucide-react';
import { JCAAdapterConfig } from '../types/jca';
import { EndpointsViewer } from './EndpointsViewer';
import { SqlPayloadInspector } from './SqlPayloadInspector';
import { ArchitectureDiagramViewer } from './ArchitectureDiagramViewer';
import { DevOpsChecklist } from './DevOpsChecklist';
import { RawXmlViewer } from './RawXmlViewer';

interface JcaAdapterSuiteViewerProps {
  adapters: JCAAdapterConfig[];
}

export const JcaAdapterSuiteViewer: React.FC<JcaAdapterSuiteViewerProps> = ({ adapters }) => {
  const [selectedAdapterId, setSelectedAdapterId] = useState<string | null>(adapters[0]?.id || null);
  const [activeSubTab, setActiveSubTab] = useState<'endpoints' | 'sql' | 'diagram' | 'devops' | 'xml'>('endpoints');
  const [searchFilter, setSearchFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const filteredAdapters = adapters.filter((a) => {
    const matchType = typeFilter === 'all' || a.adapter === typeFilter;
    const matchSearch =
      !searchFilter ||
      a.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      a.connectionFactory.location.toLowerCase().includes(searchFilter.toLowerCase()) ||
      a.relativePath.toLowerCase().includes(searchFilter.toLowerCase());
    return matchType && matchSearch;
  });

  // Se filtro nasconde selected, riallinea a primo visibile
  const selectedAdapter = (() => {
    const byId = adapters.find((a) => a.id === selectedAdapterId);
    if (byId && filteredAdapters.some((f) => f.id === byId.id)) return byId;
    return filteredAdapters[0] || adapters[0];
  })();

  // Reset sub-tab se adapter cambia tipo (evita sql su jms senza sqlAnalysis)
  React.useEffect(() => {
    if (selectedAdapter && selectedAdapter.adapter !== 'db' && activeSubTab === 'sql') {
      // mantieni sql per jms/file ma evita stato inconsistente
    }
  }, [selectedAdapter?.id]);

  if (adapters.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center text-xs text-slate-400">
        Nessun adapter JCA rilevato nel set di file analizzati.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fadeIn" id="jca-suite-viewer">
      {/* Left Sidebar: Adapter Explorer */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-3 lg:col-span-1">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-emerald-600" />
            Adapter JCA ({adapters.length})
          </h3>
          <span className="text-[11px] font-mono text-slate-400">
            {filteredAdapters.length}/{adapters.length}
          </span>
        </div>

        {/* Search & Filter */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cerca adapter, JNDI..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex gap-1 overflow-x-auto pb-1">
            {['all', 'db', 'jms', 'file', 'ftp', 'aq'].map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold transition-all ${
                  typeFilter === t
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Adapter List */}
        <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
          {filteredAdapters.map((adapter) => {
            const isSelected = selectedAdapter?.id === adapter.id;
            return (
              <button
                key={adapter.id}
                onClick={() => setSelectedAdapterId(adapter.id)}
                className={`w-full text-left p-2.5 rounded-xl border transition-all text-xs ${
                  isSelected
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-semibold shadow-sm'
                    : 'bg-slate-50 border-slate-200/60 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs truncate max-w-[170px]">{adapter.name}</span>
                  <span className="px-1.5 py-0.5 rounded bg-white border text-[10px] uppercase font-bold font-mono text-emerald-700">
                    {adapter.adapter}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-1 truncate">
                  {adapter.connectionFactory.location || 'No JNDI'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="lg:col-span-3 space-y-4">
        {selectedAdapter ? (
          <>
            {/* Adapter Header Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold font-mono uppercase">
                      JCA ADAPTER ({selectedAdapter.adapter})
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs font-mono text-slate-600">
                      JNDI: <strong className="text-slate-900">{selectedAdapter.connectionFactory.location}</strong>
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 mt-1">{selectedAdapter.name}</h2>
                  <p className="text-xs font-mono text-slate-400">{selectedAdapter.relativePath}</p>
                </div>

                {/* Sub-tab Switcher */}
                <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200 text-xs self-start sm:self-center">
                  <button
                    onClick={() => setActiveSubTab('endpoints')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                      activeSubTab === 'endpoints' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    Endpoints ({selectedAdapter.endpoints.length})
                  </button>
                  <button
                    onClick={() => setActiveSubTab('sql')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                      activeSubTab === 'sql' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    SQL / Payload
                  </button>
                  <button
                    onClick={() => setActiveSubTab('diagram')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                      activeSubTab === 'diagram' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    Mermaid
                  </button>
                  <button
                    onClick={() => setActiveSubTab('devops')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                      activeSubTab === 'devops' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    DevOps
                  </button>
                  <button
                    onClick={() => setActiveSubTab('xml')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                      activeSubTab === 'xml' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    XML
                  </button>
                </div>
              </div>
            </div>

            {/* Sub-tab Contents */}
            {activeSubTab === 'endpoints' && <EndpointsViewer config={selectedAdapter} />}
            {activeSubTab === 'sql' && <SqlPayloadInspector config={selectedAdapter} />}
            {activeSubTab === 'diagram' && <ArchitectureDiagramViewer config={selectedAdapter} />}
            {activeSubTab === 'devops' && <DevOpsChecklist config={selectedAdapter} />}
            {activeSubTab === 'xml' && <RawXmlViewer xmlContent={selectedAdapter.rawXml} fileName={selectedAdapter.fileName} />}
          </>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center text-xs text-slate-400">
            Seleziona un adapter per visualizzarne i dettagli.
          </div>
        )}
      </div>
    </div>
  );
};
