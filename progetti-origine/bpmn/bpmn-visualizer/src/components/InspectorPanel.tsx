import React, { useState } from 'react';
import { SelectedElementInfo, BpmnFileItem } from '../types';
import { X, Search, Info, List, BarChart3, ArrowRight, ArrowLeft, Tag, FileType, User, FileText, ExternalLink, Circle, Diamond, Box, Play, Square } from 'lucide-react';

interface Props {
  selectedElement: SelectedElementInfo | null;
  activeFile: BpmnFileItem | null;
  bpmnViewerInstance: any;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  onClose: () => void;
  onNavigateToElement: (elementId: string) => void;
}

export function InspectorPanel({ selectedElement, activeFile, bpmnViewerInstance, searchQuery, onSearchQueryChange, onClose, onNavigateToElement }: Props) {
  const [tab, setTab] = useState<'inspector' | 'elements' | 'stats'>('inspector');

  const stats = activeFile?.stats;
  const parsedElements = activeFile?.content ? getElements(activeFile.content) : [];

  const elementTypeIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('task') || t.includes('service')) return <Box className="w-3 h-3" />;
    if (t.includes('gateway') || t.includes('exclusive') || t.includes('parallel') || t.includes('inclusive')) return <Diamond className="w-3 h-3" />;
    if (t.includes('event') || t.includes('start') || t.includes('end') || t.includes('intermediate')) return <Circle className="w-3 h-3" />;
    if (t.includes('subprocess') || t.includes('call')) return <Square className="w-3 h-3" />;
    return <Play className="w-3 h-3" />;
  };

  const typeColor = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('task') || t.includes('service')) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (t.includes('gateway') || t.includes('exclusive') || t.includes('parallel') || t.includes('inclusive')) return 'text-amber-600 bg-amber-50 border-amber-200';
    if (t.includes('event') || t.includes('start') || t.includes('end')) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (t.includes('subprocess') || t.includes('call')) return 'text-purple-600 bg-purple-50 border-purple-200';
    return 'text-slate-600 bg-slate-50 border-slate-200';
  };

  return (
    <div className="w-80 bg-white border-l border-slate-200 flex flex-col h-full shrink-0">
      <div className="flex items-center border-b border-slate-100">
        <button onClick={() => setTab('inspector')} className={`flex-1 py-2.5 text-xs font-medium text-center transition-colors ${tab === 'inspector' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'}`}><Info className="w-3 h-3 inline mr-1" />Dettagli</button>
        <button onClick={() => setTab('elements')} className={`flex-1 py-2.5 text-xs font-medium text-center transition-colors ${tab === 'elements' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'}`}><List className="w-3 h-3 inline mr-1" />Elenco</button>
        <button onClick={() => setTab('stats')} className={`flex-1 py-2.5 text-xs font-medium text-center transition-colors ${tab === 'stats' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'}`}><BarChart3 className="w-3 h-3 inline mr-1" />Stat</button>
        <button onClick={onClose} className="p-2.5 text-slate-400 hover:text-slate-600 transition-colors"><X className="w-3.5 h-3.5" /></button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'inspector' && (
          selectedElement ? (
            <div className="p-4 space-y-4 animate-fadeIn">
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Elemento Selezionato</h3>
                <p className="text-sm font-bold text-slate-800">{selectedElement.name || selectedElement.id}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${typeColor(selectedElement.type)}`}>{selectedElement.type}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{selectedElement.id}</span>
                </div>
              </div>
              {selectedElement.documentation && (
                <div><h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Documentazione</h4><p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg">{selectedElement.documentation}</p></div>
              )}
              {selectedElement.incoming.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Flussi in Entrata ({selectedElement.incoming.length})</h4>
                  <div className="space-y-1">
                    {selectedElement.incoming.map(f => (
                      <button key={f.id} onClick={() => f.sourceId && onNavigateToElement(f.sourceId)}
                        className="w-full flex items-center gap-2 text-xs text-slate-600 bg-slate-50 hover:bg-blue-50 p-2 rounded-lg transition-colors text-left group">
                        <ArrowLeft className="w-3 h-3 text-blue-400 shrink-0" />
                        <span className="truncate flex-1">{f.name || f.id}</span>
                        <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-blue-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {selectedElement.outgoing.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Flussi in Uscita ({selectedElement.outgoing.length})</h4>
                  <div className="space-y-1">
                    {selectedElement.outgoing.map(f => (
                      <button key={f.id} onClick={() => f.targetId && onNavigateToElement(f.targetId)}
                        className="w-full flex items-center gap-2 text-xs text-slate-600 bg-slate-50 hover:bg-emerald-50 p-2 rounded-lg transition-colors text-left group">
                        <ArrowRight className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span className="truncate flex-1">{f.name || f.id}</span>
                        <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-emerald-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-slate-400 p-6 text-center">Clicca su un elemento del diagramma per vedere i dettagli</div>
          )
        )}

        {tab === 'elements' && (
          <div className="p-3 space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
              <input value={searchQuery} onChange={e => onSearchQueryChange(e.target.value)} placeholder="Cerca elemento..." className="w-full pl-7 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div className="space-y-0.5">
              {parsedElements
                .filter((el: any) => !searchQuery || el.name?.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((el: any) => (
                  <button key={el.id} onClick={() => onNavigateToElement(el.id)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 text-xs transition-colors group">
                    <div className="flex items-center gap-2">
                      <span className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border ${typeColor(el.type)}`}>
                        {elementTypeIcon(el.type)} {el.type}
                      </span>
                      <span className="truncate text-slate-700 flex-1">{el.name || el.id}</span>
                      <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-blue-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
              ))}
              {parsedElements.filter((el: any) => !searchQuery || el.name?.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                <p className="text-xs text-slate-400 text-center py-6">Nessun elemento trovato</p>
              )}
            </div>
          </div>
        )}

        {tab === 'stats' && (
          <div className="p-4 space-y-4 animate-fadeIn">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Statistiche Processo</h3>
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={<Tag className="w-4 h-4" />} label="Attività" value={stats?.tasksCount || 0} color="text-blue-600 bg-blue-50" />
              <StatCard icon={<FileType className="w-4 h-4" />} label="Gateway" value={stats?.gatewaysCount || 0} color="text-amber-600 bg-amber-50" />
              <StatCard icon={<FileText className="w-4 h-4" />} label="Eventi" value={stats?.eventsCount || 0} color="text-emerald-600 bg-emerald-50" />
              <StatCard icon={<User className="w-4 h-4" />} label="Sotto-Processi" value={stats?.subprocessesCount || 0} color="text-purple-600 bg-purple-50" />
            </div>
            <div className="text-[10px] text-slate-400">Tipo: {activeFile?.name?.split('.').pop()?.toUpperCase() || 'BPMN'}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-slate-100 p-3">
      <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${color} mb-2`}>{icon}</div>
      <p className="text-lg font-bold text-slate-800">{value}</p>
      <p className="text-[10px] text-slate-500">{label}</p>
    </div>
  );
}

function getElements(xml: string): Array<{ id: string; name: string; type: string }> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  const els: Array<{ id: string; name: string; type: string }> = [];
  const process = doc.querySelector('process');
  if (!process) return [];
  for (const node of Array.from(process.children)) {
    const tag = node.tagName.includes(':') ? node.tagName.split(':')[1] : node.tagName;
    if (['extensionElements', 'laneSet', 'documentation', 'sequenceFlow'].includes(tag)) continue;
    els.push({ id: node.getAttribute('id') || '', name: node.getAttribute('name') || '', type: tag });
  }
  return els;
}
