import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ViewMode, SelectedElementInfo } from '../types';
import { ZoomIn, ZoomOut, Maximize2, Minimize2, Loader2, AlertCircle, Search, ChevronUp, ChevronDown } from 'lucide-react';

interface Props {
  xmlContent: string;
  viewMode: ViewMode;
  searchQuery: string;
  activeSimulationElementId: string | null;
  onElementSelect: (info: SelectedElementInfo | null) => void;
  onViewerReady: (viewer: any) => void;
  onError: (msg: string) => void;
}

export function BpmnCanvas({ xmlContent, viewMode, searchQuery, activeSimulationElementId, onElementSelect, onViewerReady, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const loadingRef = useRef(false);
  const contentRef = useRef('');
  const hoveredRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; name: string; type: string } | null>(null);
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [searchIndex, setSearchIndex] = useState(-1);
  const [highlightedPath, setHighlightedPath] = useState<{ element: string; incoming: string[]; outgoing: string[] } | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onElementSelectRef = useRef(onElementSelect);
  onElementSelectRef.current = onElementSelect;
  const onViewerReadyRef = useRef(onViewerReady);
  onViewerReadyRef.current = onViewerReady;

  const clearHighlight = useCallback(() => {
    if (!viewerRef.current) return;
    const c: any = viewerRef.current.get('canvas');
    if (highlightedPath) {
      c.removeMarker(highlightedPath.element, 'bpmn-path-highlight');
      for (const id of highlightedPath.incoming) c.removeMarker(id, 'bpmn-path-highlight');
      for (const id of highlightedPath.outgoing) c.removeMarker(id, 'bpmn-path-highlight');
    }
    setHighlightedPath(null);
  }, [highlightedPath]);

  const highlightConnected = useCallback((elementId: string) => {
    if (!viewerRef.current) return;
    const registry: any = viewerRef.current.get('elementRegistry');
    const c: any = viewerRef.current.get('canvas');
    clearHighlight();

    const element = registry.get(elementId);
    if (!element) return;

    const incoming: string[] = [];
    const outgoing: string[] = [];

    if (element.incoming) {
      for (const f of element.incoming) {
        incoming.push(f.id);
        if (f.source) { incoming.push(f.source.id); c.addMarker(f.source.id, 'bpmn-path-highlight'); }
        c.addMarker(f.id, 'bpmn-path-highlight');
      }
    }
    if (element.outgoing) {
      for (const f of element.outgoing) {
        outgoing.push(f.id);
        if (f.target) { outgoing.push(f.target.id); c.addMarker(f.target.id, 'bpmn-path-highlight'); }
        c.addMarker(f.id, 'bpmn-path-highlight');
      }
    }

    c.addMarker(elementId, 'bpmn-path-highlight');
    setHighlightedPath({ element: elementId, incoming, outgoing });
  }, [clearHighlight]);

  const loadDiagram = useCallback(async () => {
    if (!xmlContent || !canvasRef.current) return;
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    contentRef.current = xmlContent;
    setTooltip(null);
    setHighlightedPath(null);

    try {
      if (viewerRef.current) {
        viewerRef.current.detach && viewerRef.current.detach();
        viewerRef.current = null;
      }
      canvasRef.current.innerHTML = '';

      const BpmnJS = viewMode === 'editor'
        ? (await import('bpmn-js/lib/Modeler')).default
        : (await import('bpmn-js/lib/NavigatedViewer')).default;

      const viewer = new BpmnJS({ container: canvasRef.current, height: '100%', width: '100%' });
      viewerRef.current = viewer;

      const { ensureBpmnDiagramDI } = await import('../utils/bpmnDiGenerator');
      const xmlToLoad = await ensureBpmnDiagramDI(xmlContent);

      await viewer.importXML(xmlToLoad);

      const c: any = viewer.get('canvas');
      c.zoom('fit-viewport');
      let z = c.zoom();
      if (z < 0.4) { c.zoom(0.4); z = 0.4; }
      setZoomLevel(z);

      viewer.on('element.click', (event: any) => {
        const el = event.element;
        if (!el) return;
        if (el.type === 'bpmn:SequenceFlow') {
          highlightConnected(el.id);
          return;
        }
        const info: SelectedElementInfo = {
          id: el.id,
          type: el.type?.replace('bpmn:', '') || '',
          name: el.businessObject?.name || el.id,
          documentation: el.businessObject?.documentation?.[0]?.text || undefined,
          incoming: [],
          outgoing: [],
        };
        if (el.incoming) {
          info.incoming = el.incoming.map((f: any) => ({
            id: f.id, name: f.businessObject?.name, sourceId: f.source?.id,
          }));
        }
        if (el.outgoing) {
          info.outgoing = el.outgoing.map((f: any) => ({
            id: f.id, name: f.businessObject?.name, targetId: f.target?.id,
          }));
        }
        onElementSelectRef.current(info);
        highlightConnected(el.id);
        c.scrollToElement(el.id);
      });

      viewer.on('element.hover', (event: any) => {
        const el = event.element;
        if (!el || el.type === 'bpmn:SequenceFlow' || el.type === 'bpmn:Lane' || el.type === 'bpmn:Participant') return;
        hoveredRef.current = el.id;
        c.addMarker(el.id, 'bpmn-hover-highlight');
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          setTooltip({
            x: event.originalEvent?.clientX ? event.originalEvent.clientX - rect.left : 0,
            y: event.originalEvent?.clientY ? event.originalEvent.clientY - rect.top - 40 : 0,
            name: el.businessObject?.name || el.id,
            type: el.type?.replace('bpmn:', '') || '',
          });
        }
      });

      viewer.on('element.out', (event: any) => {
        const el = event.element;
        if (!el) return;
        hoveredRef.current = null;
        c.removeMarker(el.id, 'bpmn-hover-highlight');
        setTooltip(null);
      });

      viewer.on('element.dblclick', (event: any) => {
        const el = event.element;
        if (!el) return;
        c.scrollToElement(el.id);
        c.zoom(1.5, { x: el.x, y: el.y });
        setZoomLevel(c.zoom());
      });

      viewer.on('canvas.viewbox.changed', ({ viewbox }: any) => {
        setZoomLevel(viewbox.scale || 1);
      });

      onViewerReadyRef.current(viewer);
    } catch (err: any) {
      if (contentRef.current !== xmlContent) return;
      const msg = err?.message || 'Errore nel caricamento del diagramma';
      setError(msg);
      onErrorRef.current(msg);
    } finally {
      loadingRef.current = false;
      if (contentRef.current === xmlContent) setLoading(false);
    }
  }, [xmlContent, viewMode, highlightConnected, clearHighlight]);

  useEffect(() => {
    loadDiagram();
    return () => {
      if (viewerRef.current) {
        viewerRef.current.detach && viewerRef.current.detach();
        viewerRef.current = null;
      }
    };
  }, [loadDiagram]);

  useEffect(() => {
    if (!viewerRef.current) return;
    const c: any = viewerRef.current.get('canvas');
    const registry: any = viewerRef.current.get('elementRegistry');
    c.getContainer().querySelectorAll('.bpmn-search-highlight').forEach((el: Element) => el.classList.remove('bpmn-search-highlight'));
    const results: string[] = [];
    if (searchQuery) {
      registry.forEach((element: any) => {
        if (element.businessObject?.name?.toLowerCase().includes(searchQuery.toLowerCase())) {
          c.addMarker(element.id, 'bpmn-search-highlight');
          results.push(element.id);
        }
      });
    }
    setSearchResults(results);
    setSearchIndex(results.length > 0 ? 0 : -1);
    if (results.length > 0) {
      c.scrollToElement(results[0]);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (!viewerRef.current) return;
    const c: any = viewerRef.current.get('canvas');
    c.getContainer().querySelectorAll('.bpmn-simulation-active').forEach((el: Element) => el.classList.remove('bpmn-simulation-active'));
    if (activeSimulationElementId) {
      c.addMarker(activeSimulationElementId, 'bpmn-simulation-active');
      try { c.scrollToElement(activeSimulationElementId); } catch {}
    }
  }, [activeSimulationElementId]);

  useEffect(() => {
    if (!viewerRef.current) return;
    const c: any = viewerRef.current.get('canvas');
    requestAnimationFrame(() => {
      try { c.resized?.(); } catch {}
      try { c.zoom('fit-viewport'); } catch {}
    });
  }, [isExpanded]);

  const goToSearchResult = (index: number) => {
    if (!viewerRef.current || searchResults.length === 0) return;
    const c: any = viewerRef.current.get('canvas');
    const idx = (index + searchResults.length) % searchResults.length;
    setSearchIndex(idx);
    c.scrollToElement(searchResults[idx]);
  };

  const handleZoomIn = () => { if (viewerRef.current) { const c: any = viewerRef.current.get('canvas'); c.zoom(1.3); setZoomLevel(c.zoom()); } };
  const handleZoomOut = () => { if (viewerRef.current) { const c: any = viewerRef.current.get('canvas'); c.zoom(0.7); setZoomLevel(c.zoom()); } };
  const handleZoomReset = () => { if (viewerRef.current) { const c: any = viewerRef.current.get('canvas'); c.zoom('fit-viewport'); let z = c.zoom(); if (z < 0.4) { c.zoom(0.4); z = 0.4; } setZoomLevel(z); } };

  const viewLabel = viewMode === 'editor' ? 'Editor' : viewMode === 'simulation' ? 'Simulazione' : 'Visualizzazione';
  const statusBadge = searchQuery ? 'Ricerca attiva' : 'Seleziona un elemento';

  return (
    <div ref={containerRef} className={isExpanded ? 'fixed inset-0 z-[60] bg-slate-950/90 p-3' : 'flex-1 relative min-h-0 overflow-hidden bg-slate-100 p-3'}>
      <div className={isExpanded ? 'relative h-full overflow-hidden rounded-[28px] border border-slate-700 bg-white shadow-[0_40px_120px_-40px_rgba(15,23,42,0.75)]' : 'relative h-full overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_80px_-36px_rgba(15,23,42,0.35)]'}>
        <div className="absolute inset-x-0 top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">Visualizzazione BPMN</p>
              <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <span>{viewLabel}</span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="text-xs font-medium text-slate-500">{statusBadge}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setIsExpanded((prev) => !prev)} className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-100">
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                {isExpanded ? 'Riduci' : 'Espandi'}
              </button>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
                {searchQuery ? `Risultati: ${searchResults.length}` : 'Interazione guidata'}
              </div>
            </div>
          </div>
        </div>

        <div className="absolute inset-0 top-[64px]">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-50/85 z-30 pointer-events-none">
              <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-slate-600 shadow-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm font-medium">Caricamento diagramma...</span>
              </div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-50/90 z-30">
              <div className="flex max-w-md flex-col items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/90 p-6 text-center text-rose-600 shadow-sm">
                <AlertCircle className="w-8 h-8" />
                <span className="text-sm font-semibold">{error}</span>
              </div>
            </div>
          )}
          <div ref={canvasRef} className="h-full w-full min-h-0" />
        </div>

        {searchQuery && searchResults.length > 0 && (
          <div className="absolute left-4 top-[78px] z-20 flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-semibold text-slate-600">{searchIndex + 1} / {searchResults.length}</span>
            <button onClick={() => goToSearchResult(searchIndex - 1)} className="rounded-full p-1 text-slate-500 transition-colors hover:bg-slate-100" aria-label="Risultato precedente">
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => goToSearchResult(searchIndex + 1)} className="rounded-full p-1 text-slate-500 transition-colors hover:bg-slate-100" aria-label="Risultato successivo">
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {tooltip && (
          <div className="pointer-events-none absolute z-30 max-w-[260px] rounded-2xl border border-slate-200 bg-slate-900/95 px-3 py-2 text-xs text-white shadow-2xl" style={{ left: tooltip.x, top: tooltip.y }}>
            <p className="truncate font-semibold">{tooltip.name}</p>
            <p className="mt-0.5 text-[10px] text-slate-400">{tooltip.type}</p>
          </div>
        )}

        <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1 rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-lg backdrop-blur-sm">
          <button onClick={handleZoomOut} className="rounded-xl p-1.5 text-slate-600 transition-colors hover:bg-slate-100" title="Zoom indietro"><ZoomOut className="w-4 h-4" /></button>
          <span className="w-12 select-none text-center text-[11px] font-semibold text-slate-500">{Math.round(zoomLevel * 100)}%</span>
          <button onClick={handleZoomIn} className="rounded-xl p-1.5 text-slate-600 transition-colors hover:bg-slate-100" title="Zoom avanti"><ZoomIn className="w-4 h-4" /></button>
          <div className="mx-1 h-4 w-px bg-slate-200" />
          <button onClick={handleZoomReset} className="rounded-xl p-1.5 text-slate-600 transition-colors hover:bg-slate-100" title="Adatta alla finestra"><Maximize2 className="w-4 h-4" /></button>
        </div>

        <div className="absolute bottom-4 left-4 z-20">
          <span className="rounded-full border border-slate-200 bg-white/85 px-3 py-1.5 text-[10px] font-medium text-slate-500 shadow-sm backdrop-blur-sm">
            Click: seleziona · Doppio click: zoom · Hover: anteprima
          </span>
        </div>
      </div>

      <style>{`
        .djs-label, .djs-visual text {
          font-family: 'Inter', 'Segoe UI', system-ui, sans-serif !important;
          font-size: 12px !important;
          font-weight: 500 !important;
          fill: #1e293b !important;
        }

        .bjs-container, .djs-container {
          background-color: #f8fafc !important;
          background-image: radial-gradient(#e2e8f0 1px, transparent 1px) !important;
          background-size: 24px 24px !important;
        }

        .djs-shape .djs-visual > rect:nth-child(1) {
          stroke: #cbd5e1 !important;
          stroke-width: 1.5px !important;
          rx: 8px !important;
          ry: 8px !important;
          fill: #ffffff !important;
          filter: drop-shadow(0 1px 3px rgba(15, 23, 42, 0.1)) !important;
        }

        .djs-shape .djs-visual > circle:nth-child(1) {
          stroke: #94a3b8 !important;
          stroke-width: 1.5px !important;
          fill: #ffffff !important;
          filter: drop-shadow(0 1px 3px rgba(15, 23, 42, 0.1)) !important;
        }

        .djs-shape .djs-visual > polygon:nth-child(1) {
          stroke: #cbd5e1 !important;
          stroke-width: 1.5px !important;
          fill: #ffffff !important;
          filter: drop-shadow(0 1px 3px rgba(15, 23, 42, 0.1)) !important;
        }

        .djs-connection .djs-visual > path:nth-child(1) {
          stroke: #94a3b8 !important;
          stroke-width: 1.5px !important;
          fill: none !important;
          marker-end: url('#sequenceflow-end') !important;
        }

        .bpmn-hover-highlight .djs-visual > rect:nth-child(1),
        .bpmn-hover-highlight .djs-visual > circle:nth-child(1),
        .bpmn-hover-highlight .djs-visual > polygon:nth-child(1) {
          stroke: #3b82f6 !important;
          stroke-width: 2px !important;
          fill: #eff6ff !important;
          filter: drop-shadow(0 4px 6px rgba(59, 130, 246, 0.2)) !important;
        }

        .bpmn-search-highlight .djs-visual > rect:nth-child(1),
        .bpmn-search-highlight .djs-visual > circle:nth-child(1),
        .bpmn-search-highlight .djs-visual > polygon:nth-child(1) {
          stroke: #f59e0b !important;
          stroke-width: 2.5px !important;
          stroke-dasharray: 6 3 !important;
        }

        .bpmn-path-highlight .djs-visual > rect:nth-child(1),
        .bpmn-path-highlight .djs-visual > circle:nth-child(1),
        .bpmn-path-highlight .djs-visual > polygon:nth-child(1) {
          stroke: #8b5cf6 !important;
          stroke-width: 2.5px !important;
          fill: #f5f3ff !important;
        }
        .bpmn-path-highlight.djs-connection .djs-visual > path:nth-child(1) {
          stroke: #8b5cf6 !important;
          stroke-width: 2.5px !important;
        }

        .bpmn-simulation-active .djs-visual > rect:nth-child(1),
        .bpmn-simulation-active .djs-visual > circle:nth-child(1),
        .bpmn-simulation-active .djs-visual > polygon:nth-child(1) {
          stroke: #10b981 !important;
          stroke-width: 2.5px !important;
          fill: #ecfdf5 !important;
        }
        .bpmn-simulation-active.djs-connection .djs-visual > path:nth-child(1) {
          stroke: #10b981 !important;
          stroke-width: 3px !important;
        }

        @keyframes simPulse {
          0%, 100% { filter: drop-shadow(0 0 4px rgba(16, 185, 129, 0.4)) !important; }
          50% { filter: drop-shadow(0 0 12px rgba(16, 185, 129, 0.9)) !important; }
        }
        .bpmn-simulation-active {
          animation: simPulse 1.5s ease-in-out infinite;
        }

        .bjs-powered-by { display: none !important; }
        .djs-palette, .djs-minimap, .djs-context-pad, .djs-popup { display: none !important; }
      `}</style>
    </div>
  );
}
