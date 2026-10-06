import React, { useState } from 'react';
import { JCAAdapterConfig, JCAProperty } from '../types/jca';
import { Search, Filter, Shield, Zap, Database, Repeat, Layers, Check, Copy } from 'lucide-react';

interface EndpointsViewerProps {
  config: JCAAdapterConfig;
}

export const EndpointsViewer: React.FC<EndpointsViewerProps> = ({ config }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedPropName, setCopiedPropName] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
    setCopiedPropName(id);
    setTimeout(() => setCopiedPropName(null), 2000);
  };

  const getCategoryIcon = (category: JCAProperty['category']) => {
    switch (category) {
      case 'sql':
        return <Database className="w-3.5 h-3.5 text-blue-400" />;
      case 'transaction':
        return <Repeat className="w-3.5 h-3.5 text-purple-400" />;
      case 'performance':
        return <Zap className="w-3.5 h-3.5 text-amber-400" />;
      case 'security':
        return <Shield className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <Layers className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const getCategoryBadgeClass = (category: JCAProperty['category']) => {
    switch (category) {
      case 'sql':
        return 'bg-blue-950/70 border-blue-800 text-blue-300';
      case 'transaction':
        return 'bg-purple-950/70 border-purple-800 text-purple-300';
      case 'performance':
        return 'bg-amber-950/70 border-amber-800 text-amber-300';
      case 'security':
        return 'bg-emerald-950/70 border-emerald-800 text-emerald-300';
      case 'path':
        return 'bg-cyan-950/70 border-cyan-800 text-cyan-300';
      default:
        return 'bg-slate-800 border-slate-700 text-slate-300';
    }
  };

  return (
    <div id="endpoints-viewer-container" className="space-y-6">
      {/* Controls Bar: Search & Category Filter */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cerca proprietà o valore..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          {[
            { id: 'all', label: 'Tutte' },
            { id: 'core', label: 'Core' },
            { id: 'sql', label: 'SQL / DML' },
            { id: 'transaction', label: 'Transazioni' },
            { id: 'performance', label: 'Performance' },
            { id: 'security', label: 'Sicurezza' },
            { id: 'path', label: 'Path / File' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition whitespace-nowrap ${
                selectedCategory === cat.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Endpoints List */}
      {config.endpoints.map((ep, epIdx) => {
        const filteredProps = ep.properties.filter((p) => {
          const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
          const matchesSearch =
            !searchQuery ||
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.value.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.description.toLowerCase().includes(searchQuery.toLowerCase());
          return matchesCategory && matchesSearch;
        });

        return (
          <div key={ep.id || epIdx} className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            {/* Endpoint Header */}
            <div className="bg-slate-950/80 px-6 py-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${
                      ep.type === 'interaction'
                        ? 'bg-indigo-950/60 border-indigo-800 text-indigo-300'
                        : 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                    }`}
                  >
                    {ep.type === 'interaction' ? 'Endpoint Interaction' : 'Endpoint Activation'}
                  </span>
                  <h3 className="text-base font-bold text-slate-100">
                    Operazione: <code className="text-indigo-300">{ep.operation}</code>
                  </h3>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-400 mt-1 flex-wrap">
                  <span>PortType: <code className="text-slate-300">{ep.portType}</code></span>
                  <span>•</span>
                  <span>Spec: <code className="text-amber-300">{ep.specCategory}</code></span>
                </div>
              </div>

              <div className="text-xs bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400">
                <span className="font-mono text-slate-200">{filteredProps.length}</span> di {ep.properties.length} parametri
              </div>
            </div>

            {/* Spec Class Subheader */}
            <div className="px-6 py-2.5 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <div className="truncate">
                <span className="font-semibold text-slate-400">Java Spec Class: </span>
                <code className="font-mono text-slate-300">{ep.specClassName || 'DefaultSpec'}</code>
              </div>
              <button
                onClick={() => handleCopy(ep.specClassName, `spec-${epIdx}`)}
                className="text-[11px] text-slate-400 hover:text-indigo-300 flex items-center gap-1 shrink-0 ml-2"
              >
                {copiedPropName === `spec-${epIdx}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>Copia classe</span>
              </button>
            </div>

            {/* Properties Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
                    <th className="py-3 px-6 w-1/4">Nome Proprietà</th>
                    <th className="py-3 px-4 w-1/3">Valore Configurato</th>
                    <th className="py-3 px-4 w-28">Categoria</th>
                    <th className="py-3 px-6">Descrizione Tecnica & Impatto</th>
                    <th className="py-3 px-4 w-12 text-center">Copia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {filteredProps.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500 font-sans">
                        Nessuna proprietà corrisponde ai criteri di ricerca selezionati.
                      </td>
                    </tr>
                  ) : (
                    filteredProps.map((prop, pIdx) => {
                      const propKey = `${ep.id}-${prop.name}-${pIdx}`;
                      const isCopied = copiedPropName === propKey;

                      return (
                        <tr
                          key={propKey}
                          className="hover:bg-slate-800/40 transition group"
                        >
                          <td className="py-3 px-6 align-top">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-100">{prop.name}</span>
                              {prop.isCritical && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold bg-rose-950/70 border border-rose-800 text-rose-300">
                                  Critico
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 align-top">
                            <div className="bg-slate-950/80 border border-slate-800 rounded p-1.5 text-[11px] text-emerald-300 break-all max-h-24 overflow-y-auto">
                              {prop.value || <span className="text-slate-600 italic font-sans">(stringa vuota)</span>}
                            </div>
                          </td>
                          <td className="py-3 px-4 align-top">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-sans font-medium border ${getCategoryBadgeClass(prop.category)}`}>
                              {getCategoryIcon(prop.category)}
                              <span className="capitalize">{prop.category}</span>
                            </span>
                          </td>
                          <td className="py-3 px-6 font-sans text-slate-300 align-top leading-relaxed text-[11px]">
                            {prop.description}
                          </td>
                          <td className="py-3 px-4 text-center align-top">
                            <button
                              onClick={() => handleCopy(prop.value, propKey)}
                              title="Copia valore"
                              className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-200 transition"
                            >
                              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
};
