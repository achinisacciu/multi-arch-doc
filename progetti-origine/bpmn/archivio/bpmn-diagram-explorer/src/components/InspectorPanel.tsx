import React, { useState } from 'react';
import {
  Info,
  Layers,
  Search,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  X,
  Activity,
  ChevronRight,
} from 'lucide-react';
import { SelectedElementInfo, BpmnFileItem } from '../types';

interface InspectorPanelProps {
  selectedElement: SelectedElementInfo | null;
  activeFile: BpmnFileItem | null;
  bpmnViewerInstance: any;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onClose: () => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  selectedElement,
  activeFile,
  bpmnViewerInstance,
  searchQuery,
  onSearchQueryChange,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'inspector' | 'elements' | 'stats'>('inspector');

  // Helper to focus element on canvas
  const handleFocusElement = (elementId: string) => {
    if (!bpmnViewerInstance) return;
    try {
      const canvas = bpmnViewerInstance.get('canvas');
      const elementRegistry = bpmnViewerInstance.get('elementRegistry');
      const selection = bpmnViewerInstance.get('selection');
      
      const el = elementRegistry.get(elementId);
      if (el) {
        canvas.scrollToElement(el);
        selection.select(el);
      }
    } catch (e) {
      console.error('Focus element error', e);
    }
  };

  // Get list of all elements in current diagram
  const getDiagramElementsList = () => {
    if (!bpmnViewerInstance) return [];
    try {
      const elementRegistry = bpmnViewerInstance.get('elementRegistry');
      const list: Array<{ id: string; name: string; type: string }> = [];
      elementRegistry.forEach((el: any) => {
        if (el.type && !el.type.includes('EventDefinition') && !el.type.includes('SequenceFlow') && el.type !== 'bpmn:Process') {
          list.push({
            id: el.id,
            name: el.businessObject?.name || el.id,
            type: el.type.replace('bpmn:', ''),
          });
        }
      });
      return list;
    } catch (e) {
      return [];
    }
  };

  const allElements = getDiagramElementsList();

  return (
    <div className="w-80 h-full bg-white border-l border-slate-200 flex flex-col shrink-0 select-none shadow-xs">
      {/* Top Header */}
      <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-600" />
          <h3 className="font-bold text-xs text-slate-800">Ispezione & Elementi</h3>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg text-[11px] font-semibold">
          <button
            onClick={() => setActiveTab('inspector')}
            className={`px-2 py-1 rounded-md transition-all ${
              activeTab === 'inspector' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600'
            }`}
          >
            Dettagli
          </button>
          <button
            onClick={() => setActiveTab('elements')}
            className={`px-2 py-1 rounded-md transition-all ${
              activeTab === 'elements' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600'
            }`}
          >
            Elenco ({allElements.length})
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-2 py-1 rounded-md transition-all ${
              activeTab === 'stats' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600'
            }`}
          >
            Statistiche
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* TAB 1: INSPECTOR */}
        {activeTab === 'inspector' && (
          <>
            {selectedElement ? (
              <div className="space-y-4">
                {/* Element Badge Header */}
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-blue-600 bg-white px-2 py-0.5 rounded-md border border-blue-200">
                    {selectedElement.type.replace('bpmn:', '')}
                  </span>
                  <h4 className="font-bold text-slate-900 text-sm mt-2">
                    {selectedElement.name || selectedElement.id}
                  </h4>
                  <p className="text-[11px] font-mono text-slate-500 mt-0.5">ID: {selectedElement.id}</p>
                </div>

                {/* Documentation */}
                {selectedElement.documentation && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Descrizione / Documentazione
                    </label>
                    <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-700 leading-relaxed border border-slate-200">
                      {selectedElement.documentation}
                    </div>
                  </div>
                )}

                {/* Incoming Flows */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
                    Flussi in Ingresso ({selectedElement.incoming.length})
                  </label>
                  {selectedElement.incoming.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Nessun flusso in ingresso</p>
                  ) : (
                    <div className="space-y-1">
                      {selectedElement.incoming.map((flow) => (
                        <div
                          key={flow.id}
                          className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                        >
                          <span className="truncate text-slate-700 font-medium">
                            {flow.name || flow.id}
                          </span>
                          {flow.sourceId && (
                            <button
                              onClick={() => handleFocusElement(flow.sourceId!)}
                              className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-0.5"
                            >
                              Sorgente <ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Outgoing Flows */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    Flussi in Uscita ({selectedElement.outgoing.length})
                  </label>
                  {selectedElement.outgoing.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Nessun flusso in uscita</p>
                  ) : (
                    <div className="space-y-1">
                      {selectedElement.outgoing.map((flow) => (
                        <div
                          key={flow.id}
                          className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                        >
                          <span className="truncate text-slate-700 font-medium">
                            {flow.name || flow.id}
                          </span>
                          {flow.targetId && (
                            <button
                              onClick={() => handleFocusElement(flow.targetId!)}
                              className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-0.5"
                            >
                              Destinazione <ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-10 px-4">
                <Layers className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">Seleziona un elemento</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Clicca su un Task, Gateway o Evento nel canvas per visualizzarne le proprietà e le connessioni.
                </p>
              </div>
            )}
          </>
        )}

        {/* TAB 2: ELEMENTS LIST */}
        {activeTab === 'elements' && (
          <div className="space-y-3">
            {/* Search filter */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Filtra elementi nel canvas..."
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="space-y-1">
              {allElements.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">Nessun elemento presente</p>
              ) : (
                allElements
                  .filter(
                    (el) =>
                      el.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      el.type.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((el) => (
                    <button
                      key={el.id}
                      onClick={() => handleFocusElement(el.id)}
                      className="w-full flex items-center justify-between p-2 hover:bg-slate-100 rounded-lg text-xs text-left transition-colors border border-transparent hover:border-slate-200"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-semibold text-slate-800 truncate">{el.name}</p>
                        <p className="text-[10px] text-slate-500">{el.type}</p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </button>
                  ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: STATS */}
        {activeTab === 'stats' && (
          <div className="space-y-3">
            <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
              Metriche Processo
            </h4>

            {activeFile?.stats ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-2xl font-black text-blue-600">{activeFile.stats.tasksCount}</p>
                  <p className="text-[11px] font-semibold text-blue-800 mt-0.5">Attività / Task</p>
                </div>

                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <p className="text-2xl font-black text-amber-600">{activeFile.stats.gatewaysCount}</p>
                  <p className="text-[11px] font-semibold text-amber-800 mt-0.5">Gateway / Decisioni</p>
                </div>

                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                  <p className="text-2xl font-black text-emerald-600">{activeFile.stats.eventsCount}</p>
                  <p className="text-[11px] font-semibold text-emerald-800 mt-0.5">Eventi (Inizio/Fine)</p>
                </div>

                <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
                  <p className="text-2xl font-black text-purple-600">{activeFile.stats.subprocessesCount}</p>
                  <p className="text-[11px] font-semibold text-purple-800 mt-0.5">Sottoprocessi</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-4">Statistiche non disponibili</p>
            )}

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
              <p className="font-bold text-slate-800">Conformità BPMN 2.0</p>
              <p className="text-[11px] text-slate-500">
                Il diagramma è strutturato con la notazione standard OMG BPMN 2.0 per l'automazione dei processi di business.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
