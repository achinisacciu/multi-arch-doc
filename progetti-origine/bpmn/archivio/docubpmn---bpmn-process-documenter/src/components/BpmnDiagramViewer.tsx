import React, { useEffect, useRef, useState } from 'react';
import BpmnViewer from 'bpmn-js/lib/Viewer';
import { ZoomIn, ZoomOut, Maximize2, Layers, Info, CheckCircle2, ArrowRightLeft, FileText, CornerDownRight } from 'lucide-react';
import { BpmnElement, ParsedBpmn } from '../types';
import { getFriendlyTypeName } from '../utils/bpmnParser';
import { ensureBpmnDiagramDI } from '../utils/bpmnDiGenerator';

interface BpmnDiagramViewerProps {
  xml: string;
  parsedBpmn: ParsedBpmn;
  selectedElementId?: string;
  onSelectElement?: (element: BpmnElement | null) => void;
}

export const BpmnDiagramViewer: React.FC<BpmnDiagramViewerProps> = ({
  xml,
  parsedBpmn,
  selectedElementId,
  onSelectElement,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<BpmnElement | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  useEffect(() => {
    if (!containerRef.current || !xml) return;

    let isMounted = true;

    // Clean previous viewer if any
    if (viewerRef.current) {
      try {
        viewerRef.current.destroy();
      } catch (e) {
        // ignore destroy errors
      }
      viewerRef.current = null;
    }

    const viewer = new BpmnViewer({
      container: containerRef.current,
      height: '100%',
      width: '100%',
    });

    viewerRef.current = viewer;

    const safeXml = ensureBpmnDiagramDI(xml);

    viewer.importXML(safeXml)
      .then((result: any) => {
        if (!isMounted || viewerRef.current !== viewer) return;

        const { warnings } = result;
        if (warnings && warnings.length > 0) {
          console.warn('Avvisi importazione BPMN:', warnings);
        }

        setError(null);

        // Safe async zoom call
        setTimeout(() => {
          if (!isMounted || viewerRef.current !== viewer) return;
          try {
            const canvas: any = viewer.get('canvas');
            if (canvas && typeof canvas.zoom === 'function') {
              canvas.zoom('fit-viewport');
            }
          } catch (zoomErr) {
            console.warn('Zoom fit-viewport non riuscito:', zoomErr);
          }
        }, 60);
      })
      .catch((err: any) => {
        if (!isMounted || viewerRef.current !== viewer) return;
        console.error('Errore nel rendering del diagramma BPMN:', err);
        setError(`Impossibile visualizzare il diagramma grafico: ${err?.message || 'XML BPMN non valido'}`);
      });

    // Handle element selection
    try {
      const eventBus: any = viewer.get('eventBus');
      eventBus.on('element.click', (e: any) => {
        if (!isMounted) return;
        const elementId = e.element?.id;
        const found = parsedBpmn.elements.find((el) => el.id === elementId);
        if (found) {
          setSelectedItem(found);
          if (onSelectElement) onSelectElement(found);
        } else {
          setSelectedItem(null);
          if (onSelectElement) onSelectElement(null);
        }
      });
    } catch (e) {
      console.warn('Impossibile agganciare eventBus:', e);
    }

    return () => {
      isMounted = false;
      if (viewerRef.current) {
        try {
          viewerRef.current.destroy();
        } catch (e) {}
        viewerRef.current = null;
      }
    };
  }, [xml, parsedBpmn]);

  // Sync selection highlight when prop changes
  useEffect(() => {
    if (selectedElementId && viewerRef.current) {
      const found = parsedBpmn.elements.find((el) => el.id === selectedElementId);
      if (found) {
        setSelectedItem(found);
        try {
          const selection: any = viewerRef.current.get('selection');
          const elementRegistry: any = viewerRef.current.get('elementRegistry');
          const shape = elementRegistry.get(selectedElementId);
          if (shape) {
            selection.select(shape);
          }
        } catch (e) {
          // ignore highlight error if shape isn't directly selectable
        }
      }
    }
  }, [selectedElementId, parsedBpmn]);

  const handleZoomIn = () => {
    if (viewerRef.current) {
      const canvas: any = viewerRef.current.get('canvas');
      canvas.zoom(canvas.zoom() * 1.2);
      setZoomLevel(Math.round(canvas.zoom() * 100));
    }
  };

  const handleZoomOut = () => {
    if (viewerRef.current) {
      const canvas: any = viewerRef.current.get('canvas');
      canvas.zoom(canvas.zoom() / 1.2);
      setZoomLevel(Math.round(canvas.zoom() * 100));
    }
  };

  const handleResetZoom = () => {
    if (viewerRef.current) {
      const canvas: any = viewerRef.current.get('canvas');
      canvas.zoom('fit-viewport');
      setZoomLevel(100);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[650px] bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
      
      {/* Diagram Main Area */}
      <div className="flex-1 relative flex flex-col bg-slate-950/70">
        
        {/* Canvas Toolbar Controls */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-1 bg-slate-900/90 backdrop-blur p-1.5 rounded-xl border border-slate-800 text-slate-200 shadow-lg">
          <button
            onClick={handleZoomIn}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors"
            title="Ingrandisci"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors"
            title="Riduci"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleResetZoom}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors text-xs font-mono px-2"
            title="Adatta alla finestra"
          >
            <Maximize2 className="w-3.5 h-3.5 inline mr-1" />
            Adatta
          </button>
          <span className="text-[11px] font-mono text-slate-400 px-2 border-l border-slate-800">
            {zoomLevel}%
          </span>
        </div>

        {/* Instructions Banner */}
        <div className="absolute top-4 right-4 z-10 hidden sm:flex items-center gap-2 bg-slate-900/90 backdrop-blur px-3 py-1.5 rounded-xl border border-slate-800 text-xs text-slate-300 shadow-lg">
          <Info className="w-3.5 h-3.5 text-blue-400" />
          <span>Clicca su qualsiasi nodo nel diagramma per ispezionare le sue proprietà.</span>
        </div>

        {/* BPMN Canvas Container */}
        <div className="flex-1 w-full h-full relative" ref={containerRef}>
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 p-6 text-center text-red-400">
              <div>
                <Info className="w-10 h-10 text-red-400 mx-auto mb-2" />
                <p className="font-semibold">{error}</p>
                <p className="text-xs text-slate-400 mt-1">Puoi comunque consultare l'analisi testuale completa nella scheda Documentazione AI.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Side Inspector Panel for Selected Element */}
      <div className="w-full lg:w-80 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 p-5 flex flex-col justify-between overflow-y-auto">
        <div>
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Layers className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Ispettore Elemento
            </h3>
          </div>

          {selectedItem ? (
            <div className="mt-4 space-y-4 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Nome Elemento</span>
                <p className="font-bold text-sm text-white mt-0.5">{selectedItem.name || selectedItem.id}</p>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Tipo BPMN 2.0</span>
                <p className="inline-block mt-1 px-2.5 py-1 rounded-md bg-blue-500/20 text-blue-300 font-medium border border-blue-500/30">
                  {getFriendlyTypeName(selectedItem.rawType)}
                </p>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">ID Nodo</span>
                <p className="font-mono text-slate-300 text-[11px] mt-0.5 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                  {selectedItem.id}
                </p>
              </div>

              {selectedItem.laneName && (
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Corsia / Ruolo (Lane)</span>
                  <p className="text-indigo-300 font-semibold mt-0.5">{selectedItem.laneName}</p>
                </div>
              )}

              {selectedItem.documentation && (
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold flex items-center gap-1">
                    <FileText className="w-3 h-3 text-slate-400" /> Note & Documentazione BPMN
                  </span>
                  <p className="text-slate-300 mt-1 p-2 bg-slate-950 rounded-lg border border-slate-800 italic text-[11px]">
                    "{selectedItem.documentation}"
                  </p>
                </div>
              )}

              {/* Connections */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-semibold block">Flussi in Ingresso ({selectedItem.incoming.length})</span>
                  {selectedItem.incoming.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedItem.incoming.map((incId) => (
                        <span key={incId} className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                          &rarr; {incId}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-500 text-[11px]">Nessuno (Evento iniziale o scatenato)</span>
                  )}
                </div>

                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-semibold block">Flussi in Uscita ({selectedItem.outgoing.length})</span>
                  {selectedItem.outgoing.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedItem.outgoing.map((outId) => (
                        <span key={outId} className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                          {outId} &rarr;
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-500 text-[11px]">Nessuno (Evento finale)</span>
                  )}
                </div>
              </div>

              {/* Camunda metadata if present */}
              {(selectedItem.camundaAssignee || selectedItem.camundaCandidateGroups || selectedItem.formFields) && (
                <div className="pt-2 border-t border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-semibold block">Estensioni Camunda</span>
                  {selectedItem.camundaAssignee && (
                    <p className="text-slate-300 text-[11px]">Assegnatario: <span className="text-blue-400 font-mono">{selectedItem.camundaAssignee}</span></p>
                  )}
                  {selectedItem.camundaCandidateGroups && (
                    <p className="text-slate-300 text-[11px]">Gruppo Candidato: <span className="text-blue-400 font-mono">{selectedItem.camundaCandidateGroups}</span></p>
                  )}
                  {selectedItem.formFields && selectedItem.formFields.length > 0 && (
                    <div className="mt-1">
                      <span className="text-slate-400 text-[10px]">Campi Form ({selectedItem.formFields.length}):</span>
                      <ul className="list-disc list-inside text-slate-300 text-[11px]">
                        {selectedItem.formFields.map(f => (
                          <li key={f.id}>{f.label} ({f.type})</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

            </div>
          ) : (
            <div className="mt-12 text-center text-slate-500 py-6">
              <CornerDownRight className="w-8 h-8 text-slate-700 mx-auto mb-2" />
              <p className="text-xs">Seleziona un qualsiasi elemento sul grafico per visualizzarne i dettagli estesi.</p>
            </div>
          )}
        </div>

        {/* Footer Summary Stats */}
        <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Totale Nodi: <strong className="text-slate-200">{parsedBpmn.stats.totalElements}</strong></span>
          <span>Task: <strong className="text-blue-400">{parsedBpmn.stats.tasksCount}</strong></span>
          <span>Gateway: <strong className="text-indigo-400">{parsedBpmn.stats.gatewaysCount}</strong></span>
        </div>
      </div>

    </div>
  );
};
