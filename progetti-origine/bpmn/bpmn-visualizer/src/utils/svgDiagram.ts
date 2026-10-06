// Renderer SVG puro (nessun React) per i diagrammi drawio-generati.
// È la fonte unica di verità per l'anteprima a schermo e per l'export
// delle immagini dentro lo ZIP (cartella images/).

import { DrawioNodeSpec, DrawioEdgeSpec, computeDrawioViewBox } from './drawioGenerator';
import { classifyNode, numberSteps } from './diagramGeometry';

const FALLBACK_FILL = '#F3F4F6';
const FALLBACK_STROKE = '#64748B';

type ShapeKind = 'ellipse' | 'rhombus' | 'rect';

function colorFromStyle(style: string, key: 'fillColor' | 'strokeColor', fallback: string): string {
  const m = style.match(new RegExp(`${key}=([^;]+)`));
  if (!m || !m[1] || m[1] === 'none') return fallback;
  return m[1];
}

function shapeOf(style: string): ShapeKind {
  if (style.includes('rhombus')) return 'rhombus';
  if (style.includes('ellipse')) return 'ellipse';
  return 'rect';
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
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

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface RenderDiagramOptions {
  standalone?: boolean;
  showSteps?: boolean;
}

/**
 * Serializza un set di nodi/edge in un documento SVG.
 * `standalone: true` aggiunge lo sfondo bianco (per i file images/*.svg).
 */
export function renderDiagramSvg(
  nodes: DrawioNodeSpec[],
  edges: DrawioEdgeSpec[],
  opts: RenderDiagramOptions = {}
): string {
  const box = computeDrawioViewBox(nodes);
  const pad = 40;
  const vbX = box.x - pad;
  const vbY = box.y - pad;
  const vbW = box.width + pad * 2;
  const vbH = box.height + pad * 2;

  const uid = Math.random().toString(36).slice(2, 8);
  const markerId = `arrow-${uid}`;

  const steps = opts.showSteps ? numberSteps(nodes, edges) : null;
  const stepBadge = (n: DrawioNodeSpec): string => {
    if (!steps || !steps.has(n.id)) return '';
    const k = classifyNode(n);
    if (k === 'data' || k === 'annotation') return '';
    return (
      `<circle cx="${n.x + 9}" cy="${n.y + 9}" r="8" fill="#0F172A"/>` +
      `<text x="${n.x + 9}" y="${n.y + 12}" text-anchor="middle" font-size="8.5" fill="#FFFFFF" font-family="JetBrains Mono,monospace">${steps.get(n.id)}</text>`
    );
  };

  const parts: string[] = [];
  const responsive =
    'class="w-full h-auto" style="min-height:420px;font-family:JetBrains Mono,monospace,sans-serif"';
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" width="${vbW}" height="${vbH}"${opts.standalone ? ' font-family="JetBrains Mono,monospace,sans-serif"' : ' ' + responsive}>`
  );
  if (opts.standalone) {
    parts.push(`<rect x="${vbX}" y="${vbY}" width="${vbW}" height="${vbH}" fill="#ffffff" />`);
  }
  parts.push(
    `<defs><marker id="${markerId}" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 Z" fill="#64748B"/></marker></defs>`
  );

  // ---- Edge layer (colonne per corridoio ortogonale, come l'anteprima) ----
  const colGroup = new Map<number, DrawioNodeSpec[]>();
  for (const n of nodes) {
    const key = Math.round(n.x);
    if (!colGroup.has(key)) colGroup.set(key, []);
    colGroup.get(key)!.push(n);
  }
  const colLefts = Array.from(colGroup.keys()).sort((a, b) => a - b);
  const colWidth = new Map<number, number>();
  for (const [left, group] of colGroup) {
    colWidth.set(left, Math.max(...group.map((g) => g.w)));
  }
  const colIndex = new Map(colLefts.map((l, i) => [l, i]));

  for (const e of edges) {
    const src = nodes.find((n) => n.id === e.source);
    const tgt = nodes.find((n) => n.id === e.target);
    if (!src || !tgt) continue;
    const x1 = src.x + src.w;
    const y1 = src.y + src.h / 2;
    const x2 = tgt.x;
    const y2 = tgt.y + tgt.h / 2;

    const si = colIndex.get(Math.round(src.x)) ?? 0;
    const ti = colIndex.get(Math.round(tgt.x)) ?? si;
    const forward = ti > si;

    let d: string;
    let labelX = 0;
    let labelY = 0;

    if (forward) {
      const rightI = colLefts[si] + (colWidth.get(colLefts[si]) || src.w);
      const leftNext = colLefts[si + 1] ?? rightI + 140;
      const gutter = (rightI + leftNext) / 2;
      d = `M ${x1} ${y1} L ${gutter} ${y1} L ${gutter} ${y2} L ${x2} ${y2}`;
      labelX = gutter;
      labelY = (y1 + y2) / 2 - 6;
    } else {
      const lift = Math.min(y1, y2) - 46;
      d = `M ${x1} ${y1} L ${x1} ${lift} L ${x2} ${lift} L ${x2} ${y2}`;
      labelX = (x1 + x2) / 2;
      labelY = lift - 6;
    }

    parts.push(
      `<path d="${d}" fill="none" stroke="#94A3B8" stroke-width="1.4" marker-end="url(#${markerId})" stroke-linejoin="round"/>`
    );
    if (e.value) {
      parts.push(
        `<text x="${labelX}" y="${labelY}" text-anchor="middle" font-size="9" fill="#475569" stroke="#FFFFFF" stroke-width="3" paint-order="stroke">${esc(truncate(e.value, 40))}</text>`
      );
    }
  }

  // ---- Node layer ----
  for (const n of nodes) {
    const fill = colorFromStyle(n.style, 'fillColor', FALLBACK_FILL);
    const stroke = colorFromStyle(n.style, 'strokeColor', FALLBACK_STROKE);
    const hasFill = n.style.includes('fillColor') && !n.style.includes('fillColor=none');
    const kind = shapeOf(n.style);
    const cx = n.x + n.w / 2;
    const cy = n.y + n.h / 2;

    if (kind === 'ellipse') {
      const r = Math.min(n.w, n.h) / 2;
      parts.push(
        `<g><circle cx="${cx}" cy="${cy}" r="${r}" fill="${hasFill ? fill : '#FFFFFF'}" stroke="${stroke}" stroke-width="1.5"/>` +
          `<text x="${cx}" y="${n.y + n.h + 14}" text-anchor="middle" font-size="10" fill="#334155" stroke="#FFFFFF" stroke-width="3" paint-order="stroke">${esc(truncate(n.value, 30))}</text>${stepBadge(n)}</g>`
      );
      continue;
    }

    if (kind === 'rhombus') {
      const pts = `${cx},${n.y} ${n.x + n.w},${cy} ${cx},${n.y + n.h} ${n.x},${cy}`;
      parts.push(
        `<g><polygon points="${pts}" fill="${hasFill ? fill : '#FFFFFF'}" stroke="${stroke}" stroke-width="1.5" stroke-linejoin="round"/>` +
          `<text x="${cx}" y="${n.y + n.h + 14}" text-anchor="middle" font-size="10" fill="#334155" stroke="#FFFFFF" stroke-width="3" paint-order="stroke">${esc(truncate(n.value, 30))}</text>${stepBadge(n)}</g>`
      );
      continue;
    }

    const lines = wrap(n.value, n.w - 16, 11);
    const lineH = 14;
    const startY = cy - ((lines.length - 1) * lineH) / 2;
    const tspans = lines
      .map((line, i) => `<tspan x="${cx}" dy="${i === 0 ? 0 : lineH}">${esc(line)}</tspan>`)
      .join('');
    parts.push(
      `<g><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="8" fill="${hasFill ? fill : '#FFFFFF'}" stroke="${stroke}" stroke-width="1.5"/>` +
        `<text x="${cx}" y="${startY + 4}" text-anchor="middle" font-size="11" fill="#0F172A">${tspans}</text>${stepBadge(n)}</g>`
    );
  }

  parts.push('</svg>');
  return parts.join('');
}
