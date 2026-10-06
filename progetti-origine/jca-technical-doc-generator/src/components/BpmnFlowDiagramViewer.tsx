import React, { useMemo, useState } from 'react';
import { GitBranch, Copy, Check, ZoomIn, ZoomOut, AlertTriangle } from 'lucide-react';
import { BpmnProcessInfo, OracleEcosystem } from '../types/jca';
import { buildBpmnGraph, bpmnGraphToMermaid, BpmnGraphNode } from '../services/bpmnFlowGraph';

interface Props {
  proc: BpmnProcessInfo;
  ecosystem?: OracleEcosystem;
}

const NODE_W = 176;
const NODE_H = 64;
const COL_GAP = 90;
const ROW_GAP = 26;
const MAX_NODES = 80;

const kindStyle = (kind: BpmnGraphNode['kind']): { fill: string; stroke: string; label: string } => {
  switch (kind) {
    case 'start': return { fill: '#ecfdf5', stroke: '#10b981', label: 'START' };
    case 'end': return { fill: '#f5f3ff', stroke: '#8b5cf6', label: 'END' };
    case 'userTask': return { fill: '#fffbeb', stroke: '#f59e0b', label: 'USER' };
    case 'serviceTask': return { fill: '#eff6ff', stroke: '#3b82f6', label: 'SERVICE' };
    case 'gateway': return { fill: '#fdf2f8', stroke: '#ec4899', label: 'GATEWAY' };
    default: return { fill: '#f8fafc', stroke: '#94a3b8', label: 'EVENT' };
  }
};

export const BpmnFlowDiagramViewer: React.FC<Props> = ({ proc, ecosystem }) => {
  const graph = useMemo(() => buildBpmnGraph(proc, ecosystem), [proc, ecosystem]);
  const mermaid = useMemo(() => bpmnGraphToMermaid(proc.name, graph), [proc.name, graph]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [copied, setCopied] = useState(false);

  const truncated = graph.nodes.length > MAX_NODES;
  const nodes = truncated ? graph.nodes.slice(0, MAX_NODES) : graph.nodes;
  const nodeSet = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes]);
  const edges = useMemo(() => graph.edges.filter((e) => nodeSet.has(e.from) && nodeSet.has(e.to)), [graph.edges, nodeSet]);

  // Layout a colonne: BFS dai nodi senza archi entranti
  const pos = useMemo(() => {
    const incoming = new Map<string, number>();
    nodes.forEach((n) => incoming.set(n.id, 0));
    edges.forEach((e) => incoming.set(e.to, (incoming.get(e.to) || 0) + 1));
    const depth = new Map<string, number>();
    const queue: string[] = nodes.filter((n) => (incoming.get(n.id) || 0) === 0).map((n) => n.id);
    nodes.forEach((n) => { if (!queue.includes(n.id)) depth.set(n.id, 0); });
    queue.forEach((id) => depth.set(id, 0));
    const adj = new Map<string, string[]>();
    edges.forEach((e) => {
      if (!adj.has(e.from)) adj.set(e.from, []);
      adj.get(e.from)?.push(e.to);
    });
    const q = [...queue];
    // Nodi isolati (nessun arco): colonna 0
    if (q.length === 0 && nodes.length) q.push(nodes[0].id);
    while (q.length) {
      const cur = q.shift()!;
      const d = depth.get(cur) || 0;
      (adj.get(cur) || []).forEach((nx) => {
        if ((depth.get(nx) ?? -1) < d + 1) {
          depth.set(nx, d + 1);
          q.push(nx);
        }
      });
    }
    const cols = new Map<number, string[]>();
    nodes.forEach((n) => {
      const d = depth.get(n.id) || 0;
      if (!cols.has(d)) cols.set(d, []);
      cols.get(d)?.push(n.id);
    });
    const out = new Map<string, { x: number; y: number }>();
    cols.forEach((ids, col) => {
      ids.forEach((id, row) => {
        out.set(id, { x: 20 + col * (NODE_W + COL_GAP), y: 20 + row * (NODE_H + ROW_GAP) });
      });
    });
    const maxCol = Math.max(0, ...cols.keys());
    return { map: out, width: 40 + (maxCol + 1) * (NODE_W + COL_GAP), height: 40 + Math.max(...[...cols.values()].map((v) => v.length), 1) * (NODE_H + ROW_GAP) };
  }, [nodes, edges]);

  const selected: BpmnGraphNode | null = nodes.find((n) => n.id === selectedId) || null;

  const copyMermaid = (): void => {
    const done = (): void => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(mermaid).then(done).catch(done);
    } else {
      done();
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <GitBranch className="w-3.5 h-3.5 text-amber-600" />
          Flusso interno: {proc.name}
          {graph.syntheticOrder && (
            <span className="ml-1 px-2 py-0.5 rounded bg-amber-100 border border-amber-300 text-amber-800 text-[10px] font-semibold">
              ordine sintetico (nessun sequenceFlow)
            </span>
          )}
        </h4>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setScale((s) => Math.max(0.5, +(s - 0.15).toFixed(2)))} className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50" title="Riduci zoom">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-mono text-slate-500 w-10 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale((s) => Math.min(1.8, +(s + 0.15).toFixed(2)))} className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50" title="Aumenta zoom">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button onClick={copyMermaid} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-[11px] font-semibold hover:bg-slate-700">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copiato' : 'Mermaid'}
          </button>
        </div>
      </div>

      {graph.warnings.length > 0 && (
        <div className="flex items-start gap-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div>{graph.warnings.map((w, i) => <div key={i}>• {w}</div>)}</div>
        </div>
      )}
      {truncated && (
        <div className="text-[11px] text-slate-600 bg-white border border-slate-200 rounded-lg p-2">
          Processo con {graph.nodes.length} nodi: mostro i primi {MAX_NODES}. Usa la lista task sotto per il resto.
        </div>
      )}

      <div className="overflow-auto bg-white rounded-lg border border-slate-200" style={{ maxHeight: 420 }}>
        <svg width={pos.width * scale} height={pos.height * scale} className="min-w-full">
          <defs>
            <marker id={`arr-${proc.id}`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8" fill="none" stroke="#64748b" strokeWidth="1.5" />
            </marker>
          </defs>
          <g transform={`scale(${scale})`}>
            {edges.map((e, i) => {
              const a = pos.map.get(e.from);
              const b = pos.map.get(e.to);
              if (!a || !b) return null;
              const x1 = a.x + NODE_W;
              const y1 = a.y + NODE_H / 2;
              const x2 = b.x;
              const y2 = b.y + NODE_H / 2;
              const mx = (x1 + x2) / 2;
              return (
                <g key={i}>
                  <path d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} fill="none" stroke="#64748b" strokeWidth="1.5" markerEnd={`url(#arr-${proc.id})`} />
                  {e.label && (
                    <text x={mx} y={Math.min(y1, y2) - 4} textAnchor="middle" fontSize="9" fill="#b45309" fontStyle="italic">
                      {e.label.length > 34 ? `${e.label.slice(0, 34)}…` : e.label}
                    </text>
                  )}
                </g>
              );
            })}
            {nodes.map((n) => {
              const p = pos.map.get(n.id);
              if (!p) return null;
              const st = kindStyle(n.kind);
              const isSel = selectedId === n.id;
              const label = n.label.length > 24 ? `${n.label.slice(0, 24)}…` : n.label;
              return (
                <g key={n.id} transform={`translate(${p.x},${p.y})`} onClick={() => setSelectedId(isSel ? null : n.id)} style={{ cursor: 'pointer' }}>
                  {n.kind === 'gateway' ? (
                    <polygon
                      points={`${NODE_W / 2},2 ${NODE_W - 2},${NODE_H / 2} ${NODE_W / 2},${NODE_H - 2} 2,${NODE_H / 2}`}
                      fill={st.fill} stroke={isSel ? '#4f46e5' : st.stroke} strokeWidth={isSel ? 3 : 2}
                    />
                  ) : (
                    <rect
                      width={NODE_W} height={NODE_H}
                      rx={n.kind === 'start' || n.kind === 'end' ? NODE_H / 2 : 10}
                      fill={st.fill} stroke={isSel ? '#4f46e5' : st.stroke} strokeWidth={isSel ? 3 : 2}
                    />
                  )}
                  <text x={NODE_W / 2} y={n.kind === 'gateway' ? NODE_H / 2 - 4 : 22} textAnchor="middle" fontSize="9" fontWeight="700" fill="#0f172a">
                    {st.label}
                  </text>
                  <text x={NODE_W / 2} y={n.kind === 'gateway' ? NODE_H / 2 + 12 : 40} textAnchor="middle" fontSize="11" fontWeight="600" fill="#1e293b">
                    {label}
                  </text>
                  {n.kind !== 'gateway' && n.lane && (
                    <text x={NODE_W / 2} y={54} textAnchor="middle" fontSize="9" fill="#78716c">
                      {n.lane.length > 26 ? `${n.lane.slice(0, 26)}…` : n.lane}
                    </text>
                  )}
                  {n.links.length > 0 && (
                    <circle cx={NODE_W - 10} cy={10} r={7} fill="#4f46e5" />
                  )}
                  {n.links.length > 0 && (
                    <text x={NODE_W - 10} y={13.5} textAnchor="middle" fontSize="9" fontWeight="800" fill="#fff">∞</text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {selected && (
        <div className="bg-white rounded-lg border border-indigo-200 p-3 text-xs space-y-1.5" role="dialog" aria-label={`Dettagli ${selected.label}`}>
          <div className="flex items-center justify-between">
            <strong className="text-slate-900">{selected.label}</strong>
            <button onClick={() => setSelectedId(null)} className="text-slate-400 hover:text-slate-700 text-xs px-1">✕ chiudi</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
            <div><span className="text-slate-500">Tipo:</span> <code className="font-mono">{selected.kind}</code></div>
            <div><span className="text-slate-500">ID XML:</span> <code className="font-mono break-all">{selected.id}</code></div>
            {selected.lane && <div><span className="text-slate-500">Lane:</span> {selected.lane}</div>}
            <div><span className="text-slate-500">File:</span> <code className="font-mono break-all">{selected.source}</code></div>
          </div>
          {selected.detail && <div className="text-[11px] text-slate-600">{selected.detail}</div>}
          {selected.links.length > 0 ? (
            <div className="pt-1">
              <div className="text-[11px] font-semibold text-slate-700">Collegamenti ad artefatti reali:</div>
              <ul className="text-[11px] space-y-0.5">
                {selected.links.map((l, i) => (
                  <li key={i} className="font-mono text-indigo-700 break-all">
                    [{l.kind}] {l.label} → {l.path}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-[11px] text-slate-400">Nessun collegamento ad artefatti (unresolved).</div>
          )}
        </div>
      )}
    </div>
  );
};
