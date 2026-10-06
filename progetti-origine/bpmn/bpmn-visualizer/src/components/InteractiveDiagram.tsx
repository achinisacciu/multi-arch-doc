// Anteprima diagrammi interattiva:
// 1. zoom + pan reali (scroll, trascinamento, rotella ctrl+zoom)
// 2. toggle di visibilità (data object, annotazioni)
// 3. focus mode (clic su un nodo → evidenzia il sotto-grafo raggiungibile)
// 4. mini-mappa cliccabile
// 5. layout alternativi (topdown / grid / colonne)
// 6. numerazione dei passi
//
// Se viene passato `xmlContent` (processo BPMN) il layout può essere ricalcolato
// con le opzioni scelte; altrimenti (composite) i nodi/edge sono statici.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BpmnLayoutMode,
  bpmnToDrawioNodes,
  computeDrawioViewBox,
  DrawioEdgeSpec,
  DrawioNodeSpec,
} from '../utils/drawioGenerator';
import {
  classifyNode,
  focusReachable,
  isBpmnDiagram,
  numberSteps,
  routeEdges,
} from '../utils/diagramGeometry';
import {
  Columns3,
  Database,
  Focus,
  LayoutGrid,
  ListOrdered,
  Maximize,
  MousePointer2,
  Rows3,
  Scan,
  StickyNote,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

const FALLBACK_FILL = '#F3F4F6';
const FALLBACK_STROKE = '#64748B';

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function colorFromStyle(style: string, key: 'fillColor' | 'strokeColor', fallback: string): string {
  const m = style.match(new RegExp(`${key}=([^;]+)`));
  if (!m || !m[1] || m[1] === 'none') return fallback;
  return m[1];
}

// Greedy word-wrap per etichette dentro i rettangoli
function wrap(text: string, maxW: number, fontSize: number): string[] {
  const charsPerLine = Math.max(6, Math.floor(maxW / (fontSize * 0.62)));
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > charsPerLine) {
      if (line) lines.push(line);
      line = word;
      if (line.length > charsPerLine) {
        while (line.length > charsPerLine) {
          lines.push(line.slice(0, charsPerLine));
          line = line.slice(charsPerLine);
        }
      }
    } else {
      line = (line + ' ' + word).trim();
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

interface Props {
  nodes: DrawioNodeSpec[];
  edges: DrawioEdgeSpec[];
  xmlContent?: string;
}

export function InteractiveDiagram({ nodes: propNodes, edges: propEdges, xmlContent }: Props) {
  const [mode, setMode] = useState<BpmnLayoutMode>('topdown');
  const [showDataObjects, setShowDataObjects] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [showSteps, setShowSteps] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 400 });
  const [, setScrollTick] = useState(0);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const uid = useRef(`diag-${Math.random().toString(36).slice(2, 8)}`).current;
  const markerId = `arrow-${uid}`;
  const dragRef = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);
  const rafRef = useRef<number>(0);

  const computed = useMemo(() => {
    const r = xmlContent
      ? bpmnToDrawioNodes(xmlContent, {
          mode,
          showDataObjects,
          showAnnotations,
          collapseSubprocesses: true,
          maxGridColumns: 6,
        })
      : { nodes: propNodes, edges: propEdges, layout: 'grid' as BpmnLayoutMode };
    const box = computeDrawioViewBox(r.nodes);
    const pad = 40;
    const vbX = box.x - pad;
    const vbY = box.y - pad;
    const vbW = Math.max(100, box.width + pad * 2);
    const vbH = Math.max(60, box.height + pad * 2);
    const isBpmn = isBpmnDiagram(r.nodes);
    return {
      ...r,
      isBpmn,
      vbX,
      vbY,
      vbW,
      vbH,
      renderedEdges: routeEdges(r.nodes, r.edges),
      steps: showSteps && isBpmn ? numberSteps(r.nodes, r.edges) : null,
      focus: focusId ? focusReachable(r.edges, focusId) : null,
    };
  }, [xmlContent, mode, showDataObjects, showAnnotations, propNodes, propEdges, showSteps, focusId]);

  const { vbX, vbY, vbW, vbH } = computed;

  // ---- resize observer per la mini-mappa / viewport ----
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---- auto-fit larghezza quando cambia il layout ----
  const fitWidth = useCallback(() => {
    const el = scrollRef.current;
    if (!el || vbW <= 0) return;
    setZoom(clamp(el.clientWidth / vbW, 0.05, 3));
    el.scrollLeft = 0;
    el.scrollTop = 0;
  }, [vbW]);

  useEffect(() => {
    fitWidth();
  }, [fitWidth]);

  // ---- rotella: ctrl/meta+rotella = zoom attorno al cursore ----
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return; // scroll nativo
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const nz = clamp(zoom * factor, 0.05, 4);
      const vx = (el.scrollLeft + px) / zoom;
      const vy = (el.scrollTop + py) / zoom;
      setZoom(nz);
      requestAnimationFrame(() => {
        el.scrollLeft = vx * nz - px;
        el.scrollTop = vy * nz - py;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoom]);

  const onScroll = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => setScrollTick((t) => t + 1));
  };

  const zoomBy = (factor: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const cx = el.scrollLeft + el.clientWidth / 2;
    const cy = el.scrollTop + el.clientHeight / 2;
    const nz = clamp(zoom * factor, 0.05, 4);
    setZoom(nz);
    requestAnimationFrame(() => {
      el.scrollLeft = cx * (nz / zoom) - el.clientWidth / 2;
      el.scrollTop = cy * (nz / zoom) - el.clientHeight / 2;
    });
  };

  const fitAll = () => {
    const el = scrollRef.current;
    if (!el || vbW <= 0 || vbH <= 0) return;
    const z = clamp(Math.min(el.clientWidth / vbW, el.clientHeight / vbH), 0.05, 3);
    setZoom(z);
    el.scrollLeft = 0;
    el.scrollTop = 0;
  };

  // ---- drag per pan (solo sfondo; i nodi fermano la propagazione) ----
  const onPointerDown = (e: React.PointerEvent) => {
    const el = scrollRef.current;
    if (!el || e.button !== 0) return;
    dragRef.current = { x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop };
    el.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    const el = scrollRef.current;
    if (!d || !el) return;
    el.scrollLeft = d.sl - (e.clientX - d.x);
    el.scrollTop = d.st - (e.clientY - d.y);
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  const el = scrollRef.current;
  const scrollLeft = el?.scrollLeft ?? 0;
  const scrollTop = el?.scrollTop ?? 0;

  // ---- mini-mappa ----
  const MM_W = 200;
  const MM_H = Math.max(80, Math.min(170, (vbH / vbW) * 200));
  const visW = containerSize.w / zoom;
  const visH = containerSize.h / zoom;
  const visX = scrollLeft / zoom;
  const visY = scrollTop / zoom;
  const showMinimap = computed.nodes.length > 3;

  const onMinimapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * vbW + vbX;
    const py = ((e.clientY - rect.top) / rect.height) * vbH + vbY;
    const sc = scrollRef.current;
    if (!sc) return;
    sc.scrollLeft = px * zoom - sc.clientWidth / 2;
    sc.scrollTop = py * zoom - sc.clientHeight / 2;
  };

  const toggleFocus = (id: string) => setFocusId((cur) => (cur === id ? null : id));

  const focus = computed.focus;
  const dimmed = focus
    ? (id: string, isEdge: boolean) =>
        isEdge ? !focus.edgeIds.has(id) : !focus.nodeIds.has(id)
    : () => false;

  const steps = computed.steps;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 bg-slate-50/70 px-3 py-2">
        {computed.isBpmn && xmlContent && (
          <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5">
            <ToolButton active={mode === 'topdown'} onClick={() => setMode('topdown')} icon={<Rows3 className="h-3.5 w-3.5" />} label="Verticale" />
            <ToolButton active={mode === 'grid'} onClick={() => setMode('grid')} icon={<LayoutGrid className="h-3.5 w-3.5" />} label="Griglia" />
            <ToolButton active={mode === 'layered'} onClick={() => setMode('layered')} icon={<Columns3 className="h-3.5 w-3.5" />} label="Colonne" />
          </div>
        )}

        {computed.isBpmn && (
          <>
            <ToolButton
              active={showDataObjects}
              onClick={() => setShowDataObjects((v) => !v)}
              icon={<Database className="h-3.5 w-3.5" />}
              label="Dati"
            />
            <ToolButton
              active={showAnnotations}
              onClick={() => setShowAnnotations((v) => !v)}
              icon={<StickyNote className="h-3.5 w-3.5" />}
              label="Annotazioni"
            />
            <ToolButton
              active={showSteps}
              onClick={() => setShowSteps((v) => !v)}
              icon={<ListOrdered className="h-3.5 w-3.5" />}
              label="Passi"
            />
          </>
        )}

        {focusId && (
          <button
            onClick={() => setFocusId(null)}
            className="flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-medium text-indigo-600 hover:bg-indigo-100"
            title="Esci dalla modalità focus"
          >
            <Focus className="h-3 w-3" /> Focus attivo · annulla
          </button>
        )}

        <div className="ml-auto flex items-center gap-1">
          <span className="mr-1 hidden items-center gap-1 text-[9px] text-slate-400 sm:flex">
            <MousePointer2 className="h-3 w-3" /> clic = focus · trascina = pan · ctrl+rotella = zoom
          </span>
          <button onClick={() => zoomBy(1 / 1.25)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-200/70" title="Zoom -">
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="w-11 text-center text-[10px] font-medium text-slate-500">{Math.round(zoom * 100)}%</span>
          <button onClick={() => zoomBy(1.25)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-200/70" title="Zoom +">
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button onClick={fitWidth} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-200/70" title="Adatta larghezza">
            <Scan className="h-3.5 w-3.5" />
          </button>
          <button onClick={fitAll} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-200/70" title="Adatta tutto">
            <Maximize className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Viewport */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          className="h-full w-full cursor-grab overflow-auto bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.05),_transparent_40%),linear-gradient(180deg,_#f8fafc_0%,_#ffffff_100%)] active:cursor-grabbing"
          onScroll={onScroll}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div style={{ width: vbW * zoom, height: vbH * zoom }}>
            <div style={{ transform: `scale(${zoom})`, transformOrigin: '0 0', width: vbW, height: vbH }}>
              {computed.nodes.length === 0 ? (
                <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                  Nessun nodo da visualizzare.
                </div>
              ) : (
                <svg viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`} width={vbW} height={vbH} style={{ userSelect: 'none' }}>
                  <defs>
                    <marker id={markerId} markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
                      <path d="M0,0 L9,4.5 L0,9 Z" fill="#64748B" />
                    </marker>
                  </defs>

                  {/* sfondo che pulisce il focus */}
                  <rect
                    x={vbX}
                    y={vbY}
                    width={vbW}
                    height={vbH}
                    fill="transparent"
                    onClick={() => setFocusId(null)}
                  />

                  {/* Edge layer */}
                  {computed.renderedEdges.map((e) => (
                    <g key={e.id} opacity={dimmed(e.id, true) ? 0.07 : 1}>
                      <path
                        d={e.d}
                        fill="none"
                        stroke="#94A3B8"
                        strokeWidth="1.4"
                        markerEnd={`url(#${markerId})`}
                        strokeLinejoin="round"
                      />
                      {e.value && (
                        <text
                          x={e.labelX}
                          y={e.labelY}
                          textAnchor="middle"
                          fontSize="9"
                          fontFamily="JetBrains Mono, monospace"
                          fill="#475569"
                          stroke="#FFFFFF"
                          strokeWidth="3"
                          paintOrder="stroke"
                        >
                          {e.value}
                        </text>
                      )}
                    </g>
                  ))}

                  {/* Node layer */}
                  {computed.nodes.map((n) => {
                    const kind = classifyNode(n);
                    const dim = dimmed(n.id, false);
                    const opacity = dim ? 0.15 : 1;

                    if (kind === 'annotation') {
                      return (
                        <g key={n.id} opacity={opacity} onPointerDown={(e) => e.stopPropagation()} onClick={() => toggleFocus(n.id)}>
                          <text
                            x={n.x + 6}
                            y={n.y + n.h}
                            fontSize="10"
                            fontFamily="JetBrains Mono, monospace"
                            fill="#64748B"
                            fontStyle="italic"
                          >
                            {n.value}
                          </text>
                        </g>
                      );
                    }

                    const fill = colorFromStyle(n.style, 'fillColor', FALLBACK_FILL);
                    const stroke = colorFromStyle(n.style, 'strokeColor', FALLBACK_STROKE);
                    const hasFill = n.style.includes('fillColor') && !n.style.includes('fillColor=none');
                    const cx = n.x + n.w / 2;
                    const cy = n.y + n.h / 2;
                    const lines = wrap(n.value, n.w - 16, 11);
                    const lineH = 14;
                    const startY = cy - ((lines.length - 1) * lineH) / 2;
                    const isSub = kind === 'subprocess';

                    return (
                      <g
                        key={n.id}
                        opacity={opacity}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => toggleFocus(n.id)}
                        className="cursor-pointer"
                      >
                        <rect
                          x={n.x}
                          y={n.y}
                          width={n.w}
                          height={n.h}
                          rx={isSub ? 6 : 8}
                          fill={hasFill ? fill : '#FFFFFF'}
                          stroke={stroke}
                          strokeWidth={dim ? 1 : 1.5}
                          strokeDasharray={isSub ? '5 4' : undefined}
                        />
                        <text
                          x={cx}
                          y={startY + 4}
                          textAnchor="middle"
                          fontSize="11"
                          fontFamily="JetBrains Mono, monospace"
                          fill="#0F172A"
                        >
                          {lines.map((line, i) => (
                            <tspan key={i} x={cx} dy={i === 0 ? 0 : lineH}>
                              {line}
                            </tspan>
                          ))}
                        </text>
                        {steps && steps.has(n.id) && (
                          <g>
                            <circle cx={n.x + 9} cy={n.y + 9} r={8} fill="#0F172A" />
                            <text x={n.x + 9} y={n.y + 12} textAnchor="middle" fontSize="8.5" fill="#FFFFFF" fontFamily="JetBrains Mono, monospace">
                              {steps.get(n.id)}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </svg>
              )}
            </div>
          </div>
        </div>

        {/* Mini-mappa */}
        {showMinimap && (
          <div className="pointer-events-none absolute bottom-3 right-3 z-10 rounded-lg border border-slate-200 bg-white/90 p-1 shadow-lg backdrop-blur-sm">
            <svg
              width={MM_W}
              height={MM_H}
              viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
              preserveAspectRatio="none"
              className="pointer-events-auto cursor-pointer rounded"
              onClick={onMinimapClick}
              aria-label="Mini-mappa: clicca per navigare"
            >
              <rect x={vbX} y={vbY} width={vbW} height={vbH} fill="#f8fafc" />
              {computed.nodes.map((n) => {
                const dim = focus ? !focus.nodeIds.has(n.id) : false;
                const fill = colorFromStyle(n.style, 'fillColor', '#E2E8F0');
                const stroke = colorFromStyle(n.style, 'strokeColor', '#94A3B8');
                return (
                  <rect
                    key={n.id}
                    x={n.x}
                    y={n.y}
                    width={Math.max(2, n.w)}
                    height={Math.max(2, n.h)}
                    rx={2}
                    fill={dim ? '#E2E8F0' : fill}
                    stroke={dim ? '#CBD5E1' : stroke}
                    strokeWidth="0.5"
                  />
                );
              })}
              <rect
                x={visX}
                y={visY}
                width={Math.max(6, visW)}
                height={Math.max(4, visH)}
                fill="rgba(59,130,246,0.12)"
                stroke="#3B82F6"
                strokeWidth="1"
              />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}

function ToolButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
        active ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'
      }`}
      title={label}
    >
      {icon}
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}
