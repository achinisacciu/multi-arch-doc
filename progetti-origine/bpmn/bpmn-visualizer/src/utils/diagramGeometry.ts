// Geometria di rendering per l'anteprima interattiva:
// - router di edge ortogonali adattivo (colonne o righe)
// - numerazione dei passi (BFS dai nodi di partenza)
// - reachability per la modalità focus

import { DrawioNodeSpec, DrawioEdgeSpec } from './drawioGenerator';

export interface RenderedEdge {
  id: string;
  d: string;
  labelX: number;
  labelY: number;
  value: string;
}

export type NodeKind =
  | 'event'
  | 'gateway'
  | 'data'
  | 'annotation'
  | 'subprocess'
  | 'service'
  | 'reference'
  | 'table'
  | 'task';

export function classifyNode(n: DrawioNodeSpec): NodeKind {
  const k = (n.kind || '').toLowerCase();
  if (k === 'dataobject' || k === 'datastorereference' || k === 'data') return 'data';
  if (k === 'texteannotation' || k === 'annotation') return 'annotation';
  if (k === 'reference' || k === 'datastore') return 'reference';
  if (k === 'service') return 'service';
  if (k === 'table') return 'table';
  if (
    k === 'startevent' || k === 'endevent' || k === 'intermediatecatchevent' ||
    k === 'intermediatethrowevent' || k === 'boundaryevent'
  ) return 'event';
  if (k.includes('gateway')) return 'gateway';
  if (k.includes('subprocess') || k === 'callactivity') return 'subprocess';
  if (k === 'component') return 'subprocess';
  return 'task';
}

const COMPOSITE_KINDS = new Set(['service', 'component', 'reference', 'unknown', 'table', 'lineage']);

export function isBpmnDiagram(nodes: DrawioNodeSpec[]): boolean {
  return nodes.length > 0 && nodes.some((n) => !COMPOSITE_KINDS.has((n.kind || '').toLowerCase()));
}

// ---------- Router edge ortogonale ----------

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function routeColumnAxis(nodes: DrawioNodeSpec[], edges: DrawioEdgeSpec[]): RenderedEdge[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const colGroup = new Map<number, DrawioNodeSpec[]>();
  for (const n of nodes) {
    const key = Math.round(n.x);
    if (!colGroup.has(key)) colGroup.set(key, []);
    colGroup.get(key)!.push(n);
  }
  const colLefts = Array.from(colGroup.keys()).sort((a, b) => a - b);
  const colWidth = new Map<number, number>();
  for (const [left, group] of colGroup) colWidth.set(left, Math.max(...group.map((g) => g.w)));
  const colIndex = new Map(colLefts.map((l, i) => [l, i]));
  const minTop = Math.min(...nodes.map((n) => n.y));

  const out: RenderedEdge[] = [];
  for (const e of edges) {
    const src = byId.get(e.source);
    const tgt = byId.get(e.target);
    if (!src || !tgt) continue;
    const x1 = src.x + src.w;
    const y1 = src.y + src.h / 2;
    const x2 = tgt.x;
    const y2 = tgt.y + tgt.h / 2;
    const si = colIndex.get(Math.round(src.x)) ?? 0;
    const ti = colIndex.get(Math.round(tgt.x)) ?? si;

    let d: string;
    let labelX = 0;
    let labelY = 0;

    if (si === ti && y2 >= y1) {
      d = `M ${x1} ${y1} L ${x2} ${y2}`;
      labelX = (x1 + x2) / 2;
      labelY = (y1 + y2) / 2 - 6;
    } else if (ti > si) {
      const rightI = colLefts[si] + (colWidth.get(colLefts[si]) || src.w);
      const leftNext = colLefts[si + 1] ?? rightI + 140;
      const gutter = (rightI + leftNext) / 2;
      d = `M ${x1} ${y1} L ${gutter} ${y1} L ${gutter} ${y2} L ${x2} ${y2}`;
      labelX = gutter;
      labelY = (y1 + y2) / 2 - 6;
    } else {
      const lift = Math.min(y1, y2) - 46;
      const top = Math.min(lift, minTop - 46);
      d = `M ${x1} ${y1} L ${x1} ${top} L ${x2} ${top} L ${x2} ${y2}`;
      labelX = (x1 + x2) / 2;
      labelY = top - 6;
    }

    out.push({ id: e.id, d, labelX, labelY, value: truncate(e.value || '', 40) });
  }
  return out;
}

function routeRowAxis(nodes: DrawioNodeSpec[], edges: DrawioEdgeSpec[]): RenderedEdge[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const rowGroup = new Map<number, DrawioNodeSpec[]>();
  for (const n of nodes) {
    const key = Math.round(n.y);
    if (!rowGroup.has(key)) rowGroup.set(key, []);
    rowGroup.get(key)!.push(n);
  }
  const rowTops = Array.from(rowGroup.keys()).sort((a, b) => a - b);
  const rowH = new Map<number, number>();
  for (const [top, group] of rowGroup) rowH.set(top, Math.max(...group.map((g) => g.h)));
  const rowIndex = new Map(rowTops.map((l, i) => [l, i]));
  const minTop = Math.min(...rowTops);

  const out: RenderedEdge[] = [];
  for (const e of edges) {
    const src = byId.get(e.source);
    const tgt = byId.get(e.target);
    if (!src || !tgt) continue;
    const x1 = src.x + src.w / 2;
    const y1 = src.y + src.h;
    const x2 = tgt.x + tgt.w / 2;
    const y2 = tgt.y;
    const si = rowIndex.get(Math.round(src.y)) ?? 0;
    const ti = rowIndex.get(Math.round(tgt.y)) ?? si;

    let d: string;
    let labelX = 0;
    let labelY = 0;

    if (si === ti) {
      if (tgt.x >= src.x) {
        const lx1 = src.x + src.w;
        const lx2 = tgt.x;
        const ly = src.y + src.h / 2;
        d = `M ${lx1} ${ly} L ${lx2} ${ly}`;
        labelX = (lx1 + lx2) / 2;
        labelY = ly - 5;
      } else {
        const top = minTop - 46;
        const rx1 = src.x + src.w / 2;
        const rx2 = tgt.x + tgt.w / 2;
        d = `M ${rx1} ${y1} L ${rx1} ${top} L ${rx2} ${top} L ${rx2} ${y2}`;
        labelX = (rx1 + rx2) / 2;
        labelY = top - 6;
      }
    } else if (ti > si) {
      const bottom = rowTops[si] + (rowH.get(rowTops[si]) || src.h);
      const top = rowTops[ti];
      const gy = (bottom + top) / 2;
      d = `M ${x1} ${y1} L ${x1} ${gy} L ${x2} ${gy} L ${x2} ${y2}`;
      labelX = (x1 + x2) / 2;
      labelY = gy - 4;
    } else {
      const top = minTop - 46;
      d = `M ${x1} ${y1} L ${x1} ${top} L ${x2} ${top} L ${x2} ${y2}`;
      labelX = (x1 + x2) / 2;
      labelY = top - 6;
    }

    out.push({ id: e.id, d, labelX, labelY, value: truncate(e.value || '', 40) });
  }
  return out;
}

export function routeEdges(nodes: DrawioNodeSpec[], edges: DrawioEdgeSpec[]): RenderedEdge[] {
  if (nodes.length === 0 || edges.length === 0) return [];
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const xSpan = Math.max(...xs) - Math.min(...xs);
  const ySpan = Math.max(...ys) - Math.min(...ys);
  if (xSpan >= ySpan) return routeColumnAxis(nodes, edges);
  return routeRowAxis(nodes, edges);
}

// ---------- Numerazione dei passi ----------

export function numberSteps(nodes: DrawioNodeSpec[], edges: DrawioEdgeSpec[]): Map<string, number> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const adj = new Map<string, string[]>();
  const inDeg = new Map<string, number>();
  for (const n of nodes) {
    adj.set(n.id, []);
    inDeg.set(n.id, 0);
  }
  for (const e of edges) {
    if (!byId.has(e.source) || !byId.has(e.target)) continue;
    adj.get(e.source)!.push(e.target);
    inDeg.set(e.target, (inDeg.get(e.target) || 0) + 1);
  }

  const starts = nodes
    .filter((n) => (inDeg.get(n.id) || 0) === 0)
    .map((n) => n.id);

  const seen = new Set<string>();
  const order: string[] = [];
  const q: string[] = [];
  for (const s of starts) {
    if (!seen.has(s)) {
      seen.add(s);
      q.push(s);
    }
  }
  while (q.length) {
    const id = q.shift()!;
    order.push(id);
    for (const t of adj.get(id) || []) {
      if (!seen.has(t)) {
        seen.add(t);
        q.push(t);
      }
    }
  }
  for (const n of nodes) {
    if (!seen.has(n.id)) {
      seen.add(n.id);
      order.push(n.id);
    }
  }

  const steps = new Map<string, number>();
  let i = 1;
  for (const id of order) {
    const n = byId.get(id);
    if (!n) continue;
    const k = classifyNode(n);
    if (k === 'data' || k === 'annotation') continue;
    steps.set(id, i++);
  }
  return steps;
}

// ---------- Focus: raggiungibilità (predecessori + successori) ----------

export function focusReachable(
  edges: DrawioEdgeSpec[],
  rootId: string
): { nodeIds: Set<string>; edgeIds: Set<string> } {
  const out = new Map<string, string[]>();
  const inc = new Map<string, string[]>();
  for (const e of edges) {
    if (!out.has(e.source)) out.set(e.source, []);
    out.get(e.source)!.push(e.target);
    if (!inc.has(e.target)) inc.set(e.target, []);
    inc.get(e.target)!.push(e.source);
  }
  const reached = new Set<string>([rootId]);
  const q = [rootId];
  while (q.length) {
    const id = q.shift()!;
    for (const t of out.get(id) || []) {
      if (!reached.has(t)) {
        reached.add(t);
        q.push(t);
      }
    }
    for (const p of inc.get(id) || []) {
      if (!reached.has(p)) {
        reached.add(p);
        q.push(p);
      }
    }
  }
  const edgeIds = new Set(
    edges.filter((e) => reached.has(e.source) && reached.has(e.target)).map((e) => e.id)
  );
  return { nodeIds: reached, edgeIds };
}
