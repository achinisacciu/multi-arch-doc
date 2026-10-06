import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { BpmnElement, ParsedBpmn } from '../types';
import type { ViewMode } from '../types';
import { ZoomIn, ZoomOut, Maximize2, Loader2, AlertCircle, Search, ChevronUp, ChevronDown } from 'lucide-react';

interface Props {
  xmlContent: string;
  viewMode: ViewMode;
  searchQuery: string;
  activeStepElementId: string | null;
  onElementSelect: (info: any) => void;
  onViewerReady: (viewer: any) => void;
  onError: (msg: string) => void;
}

export function BpmnCanvas({ xmlContent, viewMode, searchQuery, activeStepElementId, onElementSelect, onViewerReady, onError }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const loadingRef = useRef(false);
  const contentRef = useRef('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; name: string; type: string } | null>(null);
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [searchIndex, setSearchIndex] = useState(-1);

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onElementSelectRef = useRef(onElementSelect);
  onElementSelectRef.current = onElementSelect;
  const onViewerReadyRef = useRef(onViewerReady);
  onViewerReadyRef.current = onViewerReady;

  const loadDiagram = useCallback(async () => {
    if (!xmlContent || !canvasRef.current) return;
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    contentRef.current = xmlContent;
    setTooltip(null);

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
        if (el.type === 'bpmn:SequenceFlow') return;
        const info = {
          id: el.id,
          type: el.type?.replace('bpmn:', '') || '',
          name: el.businessObject?.name || el.id,
          incoming: el.incoming?.map((f: any) => ({ id: f.id, name: f.businessObject?.name, sourceId: f.source?.id })) || [],
          outgoing: el.outgoing?.map((f: any) => ({ id: f.id, name: f.businessObject?.name, targetId: f.target?.id })) || [],
        };
        onElementSelectRef.current(info);
      });

      viewer.on('element.hover', (event: any) => {
        const el = event.element;
        if (!el || el.type === 'bpmn:SequenceFlow' || el.type === 'bpmn:Lane' || el.type === 'bpmn:Participant') return;
        c.addMarker(el.id, 'bpmn-hover');
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
        c.removeMarker(el.id, 'bpmn-hover');
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
  }, [xmlContent, viewMode]);

  useEffect(() => { loadDiagram(); }, [loadDiagram]);

  useEffect(() => {
    if (!viewerRef.current) return;
    const c: any = viewerRef.current.get('canvas');
    const registry: any = viewerRef.current.get('elementRegistry');
    c.getContainer().querySelectorAll('.bpmn-search').forEach((el: Element) => el.classList.remove('bpmn-search'));
    const results: string[] = [];
    if (searchQuery) {
      registry.forEach((element: any) => {
        if (element.businessObject?.name?.toLowerCase().includes(searchQuery.toLowerCase())) {
          c.addMarker(element.id, 'bpmn-search');
          results.push(element.id);
        }
      });
    }
    setSearchResults(results);
    setSearchIndex(results.length > 0 ? 0 : -1);
    if (results.length > 0) c.scrollToElement(results[0]);
  }, [searchQuery]);

  useEffect(() => {
    if (!viewerRef.current) return;
    const c: any = viewerRef.current.get('canvas');
    c.getContainer().querySelectorAll('.bpmn-step-active').forEach((el: Element) => el.classList.remove('bpmn-step-active'));
    if (activeStepElementId) {
      c.addMarker(activeStepElementId, 'bpmn-step-active');
      try { c.scrollToElement(activeStepElementId); } catch {}
    }
  }, [activeStepElementId]);

  const goToSearch = (i: number) => {
    if (!viewerRef.current || searchResults.length === 0) return;
    const c: any = viewerRef.current.get('canvas');
    const idx = (i + searchResults.length) % searchResults.length;
    setSearchIndex(idx);
    c.scrollToElement(searchResults[idx]);
  };

  const zoomIn = () => { if (viewerRef.current) { const c: any = viewerRef.current.get('canvas'); c.zoom(1.3); setZoomLevel(c.zoom()); } };
  const zoomOut = () => { if (viewerRef.current) { const c: any = viewerRef.current.get('canvas'); c.zoom(0.7); setZoomLevel(c.zoom()); } };
  const zoomFit = () => { if (viewerRef.current) { const c: any = viewerRef.current.get('canvas'); c.zoom('fit-viewport'); let z = c.zoom(); if (z < 0.4) { c.zoom(0.4); z = 0.4; } setZoomLevel(z); } };

  return (
    <div className="flex-1 relative min-h-0 overflow-hidden bg-[#fafbfc]">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-30 pointer-events-none">
          <div className="flex items-center gap-3 text-slate-500"><Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Caricamento diagramma...</span></div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-30">
          <div className="flex flex-col items-center gap-3 text-rose-500 max-w-md text-center p-6"><AlertCircle className="w-8 h-8" /><span className="text-sm font-medium">{error}</span></div>
        </div>
      )}
      <div ref={canvasRef} className="w-full h-full" />

      {searchQuery && searchResults.length > 0 && (
        <div className="absolute top-3 left-3 z-20 flex items-center gap-2 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200 px-3 py-2">
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-600 font-medium">{searchIndex + 1} / {searchResults.length}</span>
          <button onClick={() => goToSearch(searchIndex - 1)} className="p-0.5 rounded hover:bg-slate-100 text-slate-500"><ChevronUp className="w-3.5 h-3.5" /></button>
          <button onClick={() => goToSearch(searchIndex + 1)} className="p-0.5 rounded hover:bg-slate-100 text-slate-500"><ChevronDown className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {tooltip && (
        <div className="absolute z-30 pointer-events-none bg-slate-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl border border-slate-700 max-w-[260px]" style={{ left: tooltip.x, top: tooltip.y }}>
          <p className="font-semibold truncate">{tooltip.name}</p>
          <p className="text-slate-400 text-[10px] mt-0.5">{tooltip.type}</p>
        </div>
      )}

      <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200 p-1.5 z-20">
        <button onClick={zoomOut} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors" title="Zoom indietro"><ZoomOut className="w-4 h-4" /></button>
        <span className="text-[11px] font-medium text-slate-500 w-12 text-center select-none">{Math.round(zoomLevel * 100)}%</span>
        <button onClick={zoomIn} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors" title="Zoom avanti"><ZoomIn className="w-4 h-4" /></button>
        <div className="w-px h-4 bg-slate-200 mx-1" />
        <button onClick={zoomFit} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors" title="Adatta"><Maximize2 className="w-4 h-4" /></button>
      </div>

      <style>{`
        .djs-label, .djs-visual text {
          font-family: 'Inter', 'Segoe UI', system-ui, sans-serif !important;
          font-size: 12px !important;
          font-weight: 500 !important;
          fill: #1e293b !important;
        }
        .djs-shape .djs-visual > rect:nth-child(1) { stroke: #cbd5e1 !important; stroke-width: 1.5px !important; fill: #ffffff !important; }
        .djs-shape .djs-visual > circle:nth-child(1) { stroke: #94a3b8 !important; stroke-width: 1.5px !important; fill: #ffffff !important; }
        .djs-shape .djs-visual > polygon:nth-child(1) { stroke: #cbd5e1 !important; stroke-width: 1.5px !important; fill: #ffffff !important; }
        .djs-connection .djs-visual > path:nth-child(1) { stroke: #94a3b8 !important; stroke-width: 1.5px !important; fill: none !important; }
        .bpmn-hover .djs-visual > rect:nth-child(1), .bpmn-hover .djs-visual > circle:nth-child(1), .bpmn-hover .djs-visual > polygon:nth-child(1) { stroke: #3b82f6 !important; stroke-width: 2px !important; }
        .bpmn-search .djs-visual > rect:nth-child(1), .bpmn-search .djs-visual > circle:nth-child(1), .bpmn-search .djs-visual > polygon:nth-child(1) { stroke: #f59e0b !important; stroke-width: 2.5px !important; }
        .bpmn-step-active .djs-visual > rect:nth-child(1), .bpmn-step-active .djs-visual > circle:nth-child(1), .bpmn-step-active .djs-visual > polygon:nth-child(1) { stroke: #10b981 !important; stroke-width: 3px !important; }
        @keyframes stepPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .bpmn-step-active { animation: stepPulse 1s ease-in-out infinite; }
        .bjs-powered-by { display: none !important; }
        .djs-palette, .djs-minimap, .djs-context-pad, .djs-popup { display: none !important; }
      `}</style>
    </div>
  );
}
