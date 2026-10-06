// Generatore di diagrammi draw.io (.drawio / mxGraph XML) a partire da
// processi BPMN o da grafi di lineage. Nessuna AI, layout rule-based.

import { LineageEdge } from './lineageExtractor';
import { ParsedComposite, CompositeNode } from '../types';

const FLOW_NODE_TAGS = new Set([
  'startEvent', 'endEvent', 'intermediateCatchEvent', 'intermediateThrowEvent', 'boundaryEvent',
  'task', 'userTask', 'serviceTask', 'sendTask', 'receiveTask', 'manualTask', 'scriptTask', 'businessRuleTask',
  'subProcess', 'callActivity', 'transaction', 'adHocSubProcess',
  'exclusiveGateway', 'parallelGateway', 'inclusiveGateway', 'eventBasedGateway', 'complexGateway',
  'textAnnotation', 'dataObject', 'dataStoreReference',
]);

function cleanTag(name: string): string {
  return name.includes(':') ? name.split(':')[1] : name;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isEvent(tag: string): boolean {
  return ['startEvent', 'endEvent', 'intermediateCatchEvent', 'intermediateThrowEvent', 'boundaryEvent'].includes(tag);
}
function isGateway(tag: string): boolean {
  return ['exclusiveGateway', 'parallelGateway', 'inclusiveGateway', 'eventBasedGateway', 'complexGateway'].includes(tag);
}

function getDefaultSize(tag: string): { w: number; h: number } {
  if (isEvent(tag)) return { w: 90, h: 44 };
  if (isGateway(tag)) return { w: 110, h: 44 };
  if (tag === 'textAnnotation') return { w: 110, h: 36 };
  if (tag === 'dataObject' || tag === 'dataStoreReference') return { w: 110, h: 40 };
  return { w: 150, h: 64 };
}

// Stesso linguaggio visivo dei composite.xml: scatole colorate per tipo,
// così il diagramma BPMN risulta coerente con quello del composite.
function getNodeStyle(tag: string): string {
  const raw = cleanTag(tag);
  const t = raw.toLowerCase();
  if (t === 'texteannotation') return 'text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;';
  if (t === 'dataobject' || t === 'datastorereference') return 'rounded=1;whiteSpace=wrap;html=1;fillColor=#F3E8FF;strokeColor=#7E22CE;strokeWidth=1.5;';
  if (t.includes('subprocess') || t === 'callactivity') return 'rounded=1;whiteSpace=wrap;html=1;fillColor=#CCFBF1;strokeColor=#0F766E;strokeWidth=1.5;dashed=1;';
  if (isEvent(raw)) return 'rounded=1;whiteSpace=wrap;html=1;fillColor=#D1FAE5;strokeColor=#047857;strokeWidth=1.5;';
  if (isGateway(raw)) return 'rounded=1;whiteSpace=wrap;html=1;fillColor=#FEF3C7;strokeColor=#B45309;strokeWidth=1.5;';
  return 'rounded=1;whiteSpace=wrap;html=1;fillColor=#DBEAFE;strokeColor=#1D4ED8;strokeWidth=1.5;';
}

export interface DrawioNodeSpec {
  id: string;
  value: string;
  x: number;
  y: number;
  w: number;
  h: number;
  style: string;
  kind: string;
}

export interface DrawioEdgeSpec {
  id: string;
  value: string;
  source: string;
  target: string;
  style?: string;
}

const EDGE_STYLE = 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;';

/**
 * Serialize a set of nodes/edges into a .drawio (mxGraph) XML document.
 * Compatible with app.diagrams.net.
 */
export function buildDrawioXml(
  name: string,
  nodes: DrawioNodeSpec[],
  edges: DrawioEdgeSpec[]
): string {
  const cells: string[] = [
    '<mxCell id="0" />',
    '<mxCell id="1" parent="0" />',
  ];

  nodes.forEach((n) => {
    cells.push(
      `<mxCell id="${escapeXml(n.id)}" value="${escapeXml(n.value)}" style="${escapeXml(n.style)}" vertex="1" parent="1">` +
        `<mxGeometry x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" as="geometry" />` +
        `</mxCell>`
    );
  });

  edges.forEach((e) => {
    cells.push(
      `<mxCell id="${escapeXml(e.id)}" value="${escapeXml(e.value)}" style="${escapeXml(e.style || EDGE_STYLE)}" edge="1" parent="1" source="${escapeXml(e.source)}" target="${escapeXml(e.target)}">` +
        `<mxGeometry relative="1" as="geometry" />` +
        `</mxCell>`
    );
  });

  return (
    `<mxfile host="app.diagrams.net" type="device" modified="${new Date().toISOString()}" agent="bpmn-visualizer">\n` +
    `  <diagram id="${escapeXml(`${name}-diagram`)}" name="${escapeXml(name)}">\n` +
    `    <mxGraphModel dx="900" dy="600" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1400" pageHeight="900" math="0" shadow="0">\n` +
    `      <root>\n` +
    cells.map((c) => `        ${c}`).join('\n') +
    `\n      </root>\n` +
    `    </mxGraphModel>\n` +
    `  </diagram>\n` +
    `</mxfile>\n`
  );
}

export type BpmnLayoutMode = 'layered' | 'topdown' | 'grid';

export interface BpmnLayoutOptions {
  mode?: BpmnLayoutMode;
  showDataObjects?: boolean;
  showAnnotations?: boolean;
  collapseSubprocesses?: boolean;
  maxGridColumns?: number;
}

/**
 * Layout a BPMN process into drawio nodes/edges.
 *
 * `mode`:
 * - `layered` (default, compat): colonne orizzontali per layer
 * - `topdown`: layer impilati in righe (verticale, compatto in larghezza)
 * - `grid`: griglia a serpentina con max `maxGridColumns` colonne
 *
 * Le opzioni `showDataObjects` / `showAnnotations` filtrano le categorie
 * rumorose PRIMA del layout (liberando spazio); i data object/annotation
 * nascosti vengono esclusi anche dagli edge.
 */
export function bpmnToDrawioNodes(
  xmlContent: string,
  opts: BpmnLayoutOptions = {}
): { nodes: DrawioNodeSpec[]; edges: DrawioEdgeSpec[]; layout: BpmnLayoutMode } {
  const mode = opts.mode || 'layered';
  const showDataObjects = opts.showDataObjects ?? true;
  const showAnnotations = opts.showAnnotations ?? true;
  const collapseSubprocesses = opts.collapseSubprocesses ?? false;
  const maxGridColumns = Math.max(2, opts.maxGridColumns || 6);

  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'text/xml');
  const processEl = doc.querySelector('process');
  if (!processEl) return { nodes: [], edges: [], layout: mode };

  const children = Array.from(processEl.children);
  const flowNodes = children.filter((n) => {
    const tag = cleanTag(n.tagName);
    if (!FLOW_NODE_TAGS.has(tag)) return false;
    if ((tag === 'dataObject' || tag === 'dataStoreReference') && !showDataObjects) return false;
    if (tag === 'textAnnotation' && !showAnnotations) return false;
    return true;
  });
  const sequenceFlows = children.filter((n) => cleanTag(n.tagName) === 'sequenceFlow');

  const nameOf = (el: Element) => el.getAttribute('name') || el.getAttribute('id') || cleanTag(el.tagName);
  const subCount = (el: Element): number => {
    let n = 0;
    for (const c of Array.from(el.children)) {
      if (FLOW_NODE_TAGS.has(cleanTag(c.tagName))) n++;
      n += subCount(c);
    }
    return n;
  };
  const labelOf = (el: Element): string => {
    const tag = cleanTag(el.tagName);
    let label = nameOf(el);
    if (collapseSubprocesses && (tag.includes('subprocess') || tag === 'callActivity')) {
      const n = subCount(el);
      if (n > 0) label = `${label} · ${n} attività`;
    }
    return label;
  };

  const nodeById = new Map<string, Element>();
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const n of flowNodes) {
    const id = n.getAttribute('id');
    if (id) nodeById.set(id, n);
  }
  for (const f of sequenceFlows) {
    const src = f.getAttribute('sourceRef') || '';
    const tgt = f.getAttribute('targetRef') || '';
    if (!src || !tgt) continue;
    if (!outgoing.has(src)) outgoing.set(src, []);
    outgoing.get(src)!.push(tgt);
    if (!incoming.has(tgt)) incoming.set(tgt, []);
    incoming.get(tgt)!.push(src);
  }
  for (const id of nodeById.keys()) {
    if (!outgoing.has(id)) outgoing.set(id, []);
    if (!incoming.has(id)) incoming.set(id, []);
  }

  // Dimensioni adattive: i nodi crescono in base alla lunghezza del label.
  const sizeOf = (el: Element): { w: number; h: number } => {
    const tag = cleanTag(el.tagName);
    const name = el.getAttribute('name') || el.getAttribute('id') || tag;
    if (isEvent(tag)) return { w: 90, h: 44 };
    if (isGateway(tag)) return { w: 110, h: 44 };
    if (tag === 'textAnnotation') return { w: Math.max(110, Math.min(260, 60 + name.length * 6.5)), h: 36 };
    if (tag === 'dataObject' || tag === 'dataStoreReference')
      return { w: Math.max(110, Math.min(220, 70 + name.length * 6.5)), h: 40 };
    const w = Math.max(150, Math.min(300, 90 + name.length * 7.2));
    return { w, h: 64 };
  };

  // Layered auto-layout SEMPRE come base: i file Oracle BPMN usano coordinate
  // relative ("relative-coordinates"), quindi usarle direttamente causa
  // sovrapposizioni. L'assegnazione ai layer è condivisa dai 3 layout.
  let startIds = [...nodeById.keys()].filter(
    (id) => (incoming.get(id) || []).length === 0 && cleanTag(nodeById.get(id)!.tagName) === 'startEvent'
  );
  if (startIds.length === 0 && nodeById.size > 0) startIds = [[...nodeById.keys()][0]];

  const layer = new Map<string, number>();
  const visited = new Set<string>();
  const queue: string[] = [];
  for (const s of startIds) { layer.set(s, 0); visited.add(s); queue.push(s); }
  let qi = 0;
  while (qi < queue.length) {
    const curr = queue[qi++];
    const currL = layer.get(curr) || 0;
    for (const next of outgoing.get(curr) || []) {
      if (!nodeById.has(next)) continue;
      const nl = currL + 1;
      if (!layer.has(next) || layer.get(next)! < nl) layer.set(next, nl);
      if (!visited.has(next)) { visited.add(next); queue.push(next); }
    }
  }
  for (const id of nodeById.keys()) {
    if (!visited.has(id)) { layer.set(id, 0); visited.add(id); }
  }

  const maxLayer = Math.max(...layer.values());
  const layerGroups: string[][] = Array.from({ length: maxLayer + 1 }, () => []);
  for (const [id, l] of layer) layerGroups[l].push(id);

  // Barycenter heuristic ordering (riduce i crossing tra edge)
  for (let l = 1; l <= maxLayer; l++) {
    layerGroups[l].sort((a, b) => {
      const predA = (incoming.get(a) || []).filter((p) => layer.get(p) === l - 1);
      const predB = (incoming.get(b) || []).filter((p) => layer.get(p) === l - 1);
      const avgA = predA.length > 0 ? predA.reduce((s, id) => s + layerGroups[l - 1].indexOf(id), 0) / predA.length : 0;
      const avgB = predB.length > 0 ? predB.reduce((s, id) => s + layerGroups[l - 1].indexOf(id), 0) / predB.length : 0;
      return avgA - avgB;
    });
  }

  const MARGIN = 90;
  const H_GAP = 40; // gap orizzontale tra nodi adiacenti (topdown / grid)
  const ROW_GAP = 100; // corridoio verticale per le edge (topdown / grid)
  const COL_GAP = 270; // corridoio orizzontale per le edge (layered)
  const LAYER_V_GAP = 150; // gap verticale tra nodi nella stessa colonna (layered)

  const layoutPositions = new Map<string, { x: number; y: number }>();

  if (mode === 'layered') {
    let currentX = MARGIN;
    for (let l = 0; l <= maxLayer; l++) {
      const group = layerGroups[l];
      let currentY = MARGIN;
      const maxW = group.length > 0 ? Math.max(...group.map((id) => sizeOf(nodeById.get(id)!).w)) : 0;
      for (const id of group) {
        const sz = sizeOf(nodeById.get(id)!);
        layoutPositions.set(id, { x: currentX, y: currentY });
        currentY += sz.h + LAYER_V_GAP;
      }
      currentX += (maxW || 100) + COL_GAP;
    }
  } else if (mode === 'topdown') {
    let currentY = MARGIN;
    for (let l = 0; l <= maxLayer; l++) {
      const group = layerGroups[l];
      let currentX = MARGIN;
      const maxH = group.length > 0 ? Math.max(...group.map((id) => sizeOf(nodeById.get(id)!).h)) : 0;
      for (const id of group) {
        const sz = sizeOf(nodeById.get(id)!);
        layoutPositions.set(id, { x: currentX, y: currentY });
        currentX += sz.w + H_GAP;
      }
      currentY += maxH + ROW_GAP;
    }
  } else {
    // grid: serpentina a maxGridColumns colonne in ordine topologico (BFS)
    let currentX = MARGIN;
    let currentY = MARGIN;
    let col = 0;
    let rowMaxH = 0;
    for (let l = 0; l <= maxLayer; l++) {
      for (const id of layerGroups[l]) {
        const sz = sizeOf(nodeById.get(id)!);
        rowMaxH = Math.max(rowMaxH, sz.h);
        if (col >= maxGridColumns) {
          currentX = MARGIN;
          currentY += rowMaxH + ROW_GAP;
          col = 0;
          rowMaxH = 0;
        }
        layoutPositions.set(id, { x: currentX, y: currentY });
        currentX += sz.w + H_GAP;
        col++;
      }
    }
  }

  const nodes: DrawioNodeSpec[] = [];
  const edgePositions = new Map<string, { x: number; y: number; w: number; h: number }>();
  for (const node of flowNodes) {
    const id = node.getAttribute('id');
    if (!id) continue;
    const pos = layoutPositions.get(id);
    if (!pos) continue;
    const tag = cleanTag(node.tagName);
    const { w, h } = sizeOf(node);
    nodes.push({
      id,
      value: labelOf(node),
      x: pos.x,
      y: pos.y,
      w,
      h,
      style: getNodeStyle(tag),
      kind: tag,
    });
    edgePositions.set(id, { x: pos.x, y: pos.y, w, h });
  }

  const edges: DrawioEdgeSpec[] = [];
  for (const flow of sequenceFlows) {
    const id = flow.getAttribute('id');
    const sid = flow.getAttribute('sourceRef') || '';
    const tid = flow.getAttribute('targetRef') || '';
    if (!id || !sid || !tid) continue;
    if (!edgePositions.has(sid) || !edgePositions.has(tid)) continue;
    edges.push({
      id,
      value: flow.getAttribute('name') || '',
      source: sid,
      target: tid,
    });
  }

  return { nodes, edges, layout: mode };
}

/**
 * Build a drawio diagram directly from a raw BPMN XML string.
 */
export function bpmnXmlToDrawio(xmlContent: string, name: string): string {
  const { nodes, edges } = bpmnToDrawioNodes(xmlContent);
  return buildDrawioXml(name, nodes, edges);
}

/**
 * Build a drawio diagram from a lineage edge list (process/component graph).
 */
export function lineageToDrawio(edges: LineageEdge[], name: string): string {
  const nodeSet = new Set<string>();
  const dedup = new Map<string, DrawioEdgeSpec>();
  for (const e of edges) {
    nodeSet.add(e.source);
    nodeSet.add(e.target);
  }

  const nodeIds = Array.from(nodeSet).sort();
  const indexOf = new Map(nodeIds.map((n, i) => [n, i]));

  const nodes: DrawioNodeSpec[] = nodeIds.map((n) => {
    const isTable = n.startsWith('TABLE_');
    const i = indexOf.get(n)!;
    return {
      id: `n_${i}`,
      value: isTable ? n.replace('TABLE_', '') : n,
      x: 40 + (i % 4) * 240,
      y: 40 + Math.floor(i / 4) * 120,
      w: 180,
      h: 60,
      style: isTable
        ? 'shape=cylinder3;whiteSpace=wrap;html=1;fillColor=#E3F2FD;strokeColor=#1D4ED8;'
        : 'rounded=1;whiteSpace=wrap;html=1;fillColor=#DCFCE7;strokeColor=#15803D;',
      kind: isTable ? 'table' : 'lineage',
    };
  });

  let counter = 0;
  for (const e of edges) {
    const src = indexOf.get(e.source);
    const tgt = indexOf.get(e.target);
    if (src === undefined || tgt === undefined) continue;
    const key = `${e.source}->${e.target}`;
    if (dedup.has(key)) continue;
    dedup.set(key, {
      id: `e_${counter++}`,
      value: e.rel || '',
      source: `n_${src}`,
      target: `n_${tgt}`,
    });
  }

  return buildDrawioXml(name, nodes, Array.from(dedup.values()));
}

/**
 * Trigger a browser download of the generated .drawio file.
 */
export function downloadDrawio(xml: string, name: string): void {
  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name.replace(/\.(bpmn|xml)$/i, '') || 'diagramma'}.drawio`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------- Composite.xml (Oracle SOA) ----------

const COMPOSITE_NODE_STYLES: Record<CompositeNode['type'], string> = {
  service: 'rounded=1;whiteSpace=wrap;html=1;fillColor=#D1FAE5;strokeColor=#047857;strokeWidth=1.5;',
  component: 'rounded=1;whiteSpace=wrap;html=1;fillColor=#DBEAFE;strokeColor=#1D4ED8;strokeWidth=1.5;',
  reference: 'shape=cylinder3;whiteSpace=wrap;html=1;fillColor=#FEF3C7;strokeColor=#B45309;strokeWidth=1.5;',
  unknown: 'rounded=1;whiteSpace=wrap;html=1;fillColor=#F3F4F6;strokeColor=#64748B;strokeWidth=1.2;',
};

/**
 * Layout di un composite.xml: colonne per tipo.
 * - Servizi (ingressi) a sinistra
 * - Componenti al centro
 * - Riferimenti (uscite) a destra
 * - Nodi ignoti in una quarta colonna
 */
export function compositeToDrawioNodes(
  parsed: ParsedComposite
): { nodes: DrawioNodeSpec[]; edges: DrawioEdgeSpec[] } {
  const COL_W = 230;
  const COL_GAP = 90;
  const ROW_H = 70;
  const ROW_GAP = 26;
  const MARGIN = 40;

  const columns: CompositeNode['type'][] = ['service', 'component', 'reference', 'unknown'];

  const colIndex: Record<string, number> = { service: 0, component: 1, reference: 2, unknown: 3 };
  const colCounters: Record<string, number> = { service: 0, component: 0, reference: 0, unknown: 0 };

  const nodes: DrawioNodeSpec[] = parsed.nodes.map((n) => {
    const col = colIndex[n.type];
    const row = colCounters[n.type]++;
    const x = MARGIN + col * (COL_W + COL_GAP);
    const y = MARGIN + row * (ROW_H + ROW_GAP);

    const extra =
      n.type === 'component'
        ? `${n.implementation ? `\n[${n.implementation}]` : ''}`
        : n.type === 'reference'
        ? `${n.binding ? `\n(${n.binding})` : ''}`
        : n.type === 'service'
        ? `${n.binding ? `\n(${n.binding})` : ''}`
        : '';

    return {
      id: n.id,
      value: `${n.name}${extra}`,
      x,
      y,
      w: COL_W,
      h: ROW_H,
      style: COMPOSITE_NODE_STYLES[n.type],
      kind: n.type,
    };
  });

  const edges: DrawioEdgeSpec[] = parsed.wires.map((w) => ({
    id: w.id,
    value: '',
    source: w.source,
    target: w.target,
  }));

  return { nodes, edges };
}

/**
 * Build a drawio document from a parsed Oracle SOA composite.
 */
export function compositeToDrawio(parsed: ParsedComposite): string {
  const { nodes, edges } = compositeToDrawioNodes(parsed);
  return buildDrawioXml(parsed.compositeName, nodes, edges);
}

/**
 * ViewBox helper: returns the bounding box of a set of drawio nodes so the
 * SVG/HTML preview can size itself correctly.
 */
export function computeDrawioViewBox(nodes: DrawioNodeSpec[]): { x: number; y: number; width: number; height: number } {
  if (nodes.length === 0) return { x: 0, y: 0, width: 800, height: 400 };
  const maxX = Math.max(...nodes.map((n) => n.x + n.w));
  const maxY = Math.max(...nodes.map((n) => n.y + n.h));
  const minX = Math.min(...nodes.map((n) => n.x));
  const minY = Math.min(...nodes.map((n) => n.y));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
