import React, { useEffect, useRef, useState } from 'react';
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import Modeler from 'bpmn-js/lib/Modeler';
import { ViewMode, CanvasTheme, SelectedElementInfo } from '../types';
import { AlertTriangle, ZoomIn, ZoomOut, Maximize2, RotateCcw } from 'lucide-react';

interface BpmnCanvasProps {
  xmlContent: string;
  viewMode: ViewMode;
  canvasTheme: CanvasTheme;
  searchQuery: string;
  activeSimulationElementId?: string | null;
  onElementSelect: (info: SelectedElementInfo | null) => void;
  onViewerReady: (viewerInstance: any) => void;
  onError?: (error: string) => void;
}

export const BpmnCanvas: React.FC<BpmnCanvasProps> = ({
  xmlContent,
  viewMode,
  canvasTheme,
  searchQuery,
  activeSimulationElementId,
  onElementSelect,
  onViewerReady,
  onError,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const bpmnViewerRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Initialize viewer or modeler instance
  useEffect(() => {
    if (!containerRef.current) return;

    // Destroy previous viewer if exists
    if (bpmnViewerRef.current) {
      try {
        bpmnViewerRef.current.destroy();
      } catch (e) {
        console.error('Destroy error', e);
      }
      bpmnViewerRef.current = null;
    }

    const container = containerRef.current;
    container.innerHTML = '';

    const instanceOptions = {
      container,
    };

    const instance = viewMode === 'editor' ? new Modeler(instanceOptions) : new NavigatedViewer(instanceOptions);
    bpmnViewerRef.current = instance;
    onViewerReady(instance);

    // Attach event listeners for selection
    const eventBus = instance.get('eventBus') as any;
    const elementRegistry = instance.get('elementRegistry') as any;

    eventBus.on('selection.changed', (e: any) => {
      const selectedElements = e.newSelection;
      if (selectedElements && selectedElements.length > 0) {
        const el = selectedElements[0];
        const businessObj = el.businessObject || {};
        
        const incoming = (el.incoming || []).map((flow: any) => ({
          id: flow.id,
          name: flow.businessObject?.name,
          sourceId: flow.source?.id,
        }));

        const outgoing = (el.outgoing || []).map((flow: any) => ({
          id: flow.id,
          name: flow.businessObject?.name,
          targetId: flow.target?.id,
        }));

        onElementSelect({
          id: el.id,
          type: el.type,
          name: businessObj.name || el.id,
          documentation: businessObj.documentation?.[0]?.text || businessObj.documentation,
          incoming,
          outgoing,
          businessProperties: {
            processRef: businessObj.processRef?.id,
            scriptFormat: businessObj.scriptFormat,
            implementation: businessObj.implementation,
          },
        });
      } else {
        onElementSelect(null);
      }
    });

    eventBus.on('canvas.viewbox.changed', () => {
      try {
        const canvas = instance.get('canvas') as any;
        const viewbox = canvas.viewbox();
        setZoomLevel(Math.round((viewbox.scale || 1) * 100));
      } catch (e) {
        // ignore
      }
    });

    return () => {
      if (bpmnViewerRef.current) {
        try {
          bpmnViewerRef.current.destroy();
        } catch (e) {
          // ignore
        }
        bpmnViewerRef.current = null;
      }
    };
  }, [viewMode]);

  // Import XML into active viewer
  useEffect(() => {
    const viewer = bpmnViewerRef.current;
    if (!viewer || !xmlContent) return;

    setLoading(true);
    setLoadError(null);

    viewer
      .importXML(xmlContent)
      .then(() => {
        setLoading(false);
        const canvas = viewer.get('canvas');
        canvas.zoom('fit-viewport', 'auto');
      })
      .catch((err: any) => {
        setLoading(false);
        const errMsg = err?.message || 'Formato file BPMN 2.0 non valido o corrotto';
        setLoadError(errMsg);
        if (onError) onError(errMsg);
      });
  }, [xmlContent]);

  // Handle Search Query Highlighting
  useEffect(() => {
    const viewer = bpmnViewerRef.current;
    if (!viewer || loading || loadError) return;

    try {
      const canvas = viewer.get('canvas');
      const elementRegistry = viewer.get('elementRegistry');

      // Clear previous search highlights
      elementRegistry.forEach((element: any) => {
        canvas.removeMarker(element.id, 'bpmn-search-highlight');
      });

      if (searchQuery.trim().length > 1) {
        const query = searchQuery.toLowerCase();
        let firstMatched: any = null;

        elementRegistry.forEach((element: any) => {
          const name = (element.businessObject?.name || '').toLowerCase();
          const id = (element.id || '').toLowerCase();
          if (name.includes(query) || id.includes(query)) {
            canvas.addMarker(element.id, 'bpmn-search-highlight');
            if (!firstMatched) firstMatched = element;
          }
        });

        if (firstMatched) {
          canvas.scrollToElement(firstMatched);
        }
      }
    } catch (e) {
      console.error('Search highlight error', e);
    }
  }, [searchQuery, loading, loadError]);

  // Handle Simulation Active Element Highlighting
  useEffect(() => {
    const viewer = bpmnViewerRef.current;
    if (!viewer || loading || loadError) return;

    try {
      const canvas = viewer.get('canvas');
      const elementRegistry = viewer.get('elementRegistry');

      elementRegistry.forEach((element: any) => {
        canvas.removeMarker(element.id, 'bpmn-simulation-active');
      });

      if (activeSimulationElementId) {
        canvas.addMarker(activeSimulationElementId, 'bpmn-simulation-active');
        const element = elementRegistry.get(activeSimulationElementId);
        if (element) {
          canvas.scrollToElement(element);
        }
      }
    } catch (e) {
      console.error('Simulation highlight error', e);
    }
  }, [activeSimulationElementId, loading, loadError]);

  // Zoom control helpers
  const handleZoomIn = () => {
    if (bpmnViewerRef.current) {
      const canvas = bpmnViewerRef.current.get('canvas');
      canvas.zoom(canvas.zoom() * 1.25);
    }
  };

  const handleZoomOut = () => {
    if (bpmnViewerRef.current) {
      const canvas = bpmnViewerRef.current.get('canvas');
      canvas.zoom(canvas.zoom() * 0.8);
    }
  };

  const handleResetZoom = () => {
    if (bpmnViewerRef.current) {
      const canvas = bpmnViewerRef.current.get('canvas');
      canvas.zoom('fit-viewport', 'auto');
    }
  };

  // Theme container classes
  const getThemeClass = () => {
    switch (canvasTheme) {
      case 'blueprint':
        return 'bg-slate-900 text-slate-100 bpmn-theme-blueprint';
      case 'dark':
        return 'bg-slate-950 text-slate-200 bpmn-theme-dark';
      case 'contrast':
        return 'bg-amber-50/40 text-slate-900';
      default:
        return 'bg-white text-slate-900';
    }
  };

  return (
    <div className="relative flex-1 h-full w-full overflow-hidden flex flex-col bg-slate-200/50">
      {/* Dynamic CSS overlay for canvas highlights */}
      <style>{`
        .bjs-container .bpmn-search-highlight:not(.djs-connection) .djs-visual > :nth-child(1) {
          stroke: #3b82f6 !important;
          stroke-width: 4px !important;
          fill: #eff6ff !important;
        }
        .bjs-container .bpmn-simulation-active:not(.djs-connection) .djs-visual > :nth-child(1) {
          stroke: #10b981 !important;
          stroke-width: 5px !important;
          animation: pulseMarker 1.2s infinite alternate;
        }
        @keyframes pulseMarker {
          from { stroke-width: 3px; filter: drop-shadow(0 0 2px #10b981); }
          to { stroke-width: 6px; filter: drop-shadow(0 0 8px #10b981); }
        }
        .bpmn-theme-blueprint {
          background-image: radial-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 0);
          background-size: 20px 20px;
        }
        .bpmn-theme-dark {
          background-image: radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 0);
          background-size: 24px 24px;
        }
        .bjs-powered-by { display: none !important; }
      `}</style>

      {/* Main Canvas Mounting Point */}
      <div
        ref={containerRef}
        className={`w-full h-full flex-1 relative ${getThemeClass()} transition-colors duration-200`}
      />

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex items-center justify-center z-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-semibold text-slate-700">Caricamento diagramma BPMN...</p>
          </div>
        </div>
      )}

      {/* Load Error Banner */}
      {loadError && !loading && (
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-6 z-20">
          <div className="bg-white rounded-xl shadow-xl border border-rose-200 p-6 max-w-md w-full text-center">
            <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto text-rose-600 mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">Errore Caricamento BPMN</h3>
            <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono text-left max-h-32 overflow-y-auto">
              {loadError}
            </p>
            <p className="text-[11px] text-slate-400 mt-3">
              Verifica che il file contenga uno schema XML valido conforme allo standard BPMN 2.0.
            </p>
          </div>
        </div>
      )}

      {/* Floating Canvas Controls */}
      <div className="absolute bottom-4 left-4 flex items-center gap-1 bg-white/95 backdrop-blur-xs p-1.5 rounded-xl shadow-md border border-slate-200 z-10 text-slate-700">
        <button
          onClick={handleZoomIn}
          title="Zoom Avanti"
          className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          title="Zoom Indietro"
          className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="h-4 w-px bg-slate-200 mx-1" />
        <button
          onClick={handleResetZoom}
          title="Adatta alla finestra"
          className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium px-2"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span>{zoomLevel}%</span>
        </button>
      </div>
    </div>
  );
};
