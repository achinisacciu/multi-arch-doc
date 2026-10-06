const NS_BPMIDI = 'http://www.omg.org/spec/BPMN/20100524/DI';
const NS_DC = 'http://www.omg.org/spec/DD/20100524/DC';
const NS_DI = 'http://www.omg.org/spec/DD/20100524/DI';

export async function ensureBpmnDiagramDI(xmlContent: string): Promise<string> {
  const hasDi = xmlContent.includes('bpmndi:BPMNDiagram') || xmlContent.includes('BPMNDiagram');
  const hasOracle = xmlContent.includes('OracleExtensions') || xmlContent.includes('ns5:OracleExtensions');

  if (hasDi && !hasOracle) {
    return xmlContent;
  }

  if (hasOracle) {
    return generateCustomDI(xmlContent);
  }

  if (!hasDi) {
    try {
      const { layoutProcess } = await import('bpmn-auto-layout');
      const result = await layoutProcess(xmlContent);
      if (result && result.includes('bpmndi:BPMNShape')) return result;
    } catch {
      // fall through to custom generator
    }
  }

  return generateCustomDI(xmlContent);
}

function generateCustomDI(xmlContent: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'text/xml');
  const definitions = doc.documentElement;

  definitions.setAttribute('xmlns:bpmndi', NS_BPMIDI);
  definitions.setAttribute('xmlns:dc', NS_DC);
  definitions.setAttribute('xmlns:di', NS_DI);

  const diagramEl = doc.createElementNS(NS_BPMIDI, 'bpmndi:BPMNDiagram');
  diagramEl.setAttribute('id', 'BpmnDiagram_1');
  const planeEl = doc.createElementNS(NS_BPMIDI, 'bpmndi:BPMNPlane');
  planeEl.setAttribute('id', 'BpmnPlane_1');

  const processEl = doc.querySelector('process');
  if (!processEl) return xmlContent;
  planeEl.setAttribute('bpmnElement', processEl.getAttribute('id') || '');

  const flowNodeTags = new Set([
    'startEvent', 'endEvent', 'intermediateCatchEvent', 'intermediateThrowEvent', 'boundaryEvent',
    'task', 'userTask', 'serviceTask', 'sendTask', 'receiveTask', 'manualTask', 'scriptTask', 'businessRuleTask',
    'subProcess', 'callActivity', 'transaction',
    'exclusiveGateway', 'parallelGateway', 'inclusiveGateway', 'eventBasedGateway', 'complexGateway',
    'textAnnotation', 'dataObject', 'dataStoreReference'
  ]);

  const children = Array.from(processEl.children);
  const flowNodes = children.filter(n => flowNodeTags.has(cleanTagName(n.tagName)));
  const sequenceFlows = children.filter(n => cleanTagName(n.tagName) === 'sequenceFlow');

  // Extract Oracle positions
  const oraclePositions = new Map<string, { x: number; y: number }>();
  for (const node of flowNodes) {
    const id = node.getAttribute('id');
    if (!id) continue;
    for (const ext of Array.from(node.children).filter(c => cleanTagName(c.tagName) === 'extensionElements')) {
      for (const ora of Array.from(ext.children).filter(c => cleanTagName(c.tagName) === 'OracleExtensions')) {
        for (const g of Array.from(ora.children).filter(c => cleanTagName(c.tagName) === 'GraphicsAttributes')) {
          for (const p of Array.from(g.children).filter(c => cleanTagName(c.tagName) === 'Position')) {
            const x = p.getAttribute('x');
            const y = p.getAttribute('y');
            if (x && y) oraclePositions.set(id, { x: parseInt(x), y: parseInt(y) });
          }
        }
      }
    }
  }

  // Build graph
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
    if (!outgoing.has(src)) outgoing.set(src, []);
    outgoing.get(src)!.push(tgt);
    if (!incoming.has(tgt)) incoming.set(tgt, []);
    incoming.get(tgt)!.push(src);
  }
  for (const id of nodeById.keys()) {
    if (!outgoing.has(id)) outgoing.set(id, []);
    if (!incoming.has(id)) incoming.set(id, []);
  }

  const hasOracle = oraclePositions.size >= flowNodes.length * 0.5;
  let layoutPositions: Map<string, { x: number; y: number }>;

  if (hasOracle) {
    layoutPositions = new Map(oraclePositions);
    const placed = new Set(oraclePositions.keys());

    // Auto-place remaining nodes
    const unplaced = flowNodes.filter(n => {
      const id = n.getAttribute('id');
      return id && !placed.has(id);
    });
    for (const node of unplaced) {
      const id = node.getAttribute('id')!;
      const { w, h } = getDefaultSize(cleanTagName(node.tagName));
      const neighbors = [...(incoming.get(id) || []), ...(outgoing.get(id) || [])];
      let placedNeighbor: string | null = null;
      for (const nid of neighbors) {
        if (placed.has(nid)) { placedNeighbor = nid; break; }
      }
      if (placedNeighbor) {
        const p = layoutPositions.get(placedNeighbor)!;
        layoutPositions.set(id, { x: p.x + w + 100, y: p.y + 60 });
      } else {
        layoutPositions.set(id, { x: 50, y: 100 + unplaced.indexOf(node) * 140 });
      }
      placed.add(id);
    }

    // Resolve overlaps
    const entries = [...layoutPositions.entries()];
    for (let iter = 0; iter < 10; iter++) {
      let moved = false;
      for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          const [idA, posA] = entries[i];
          const [idB, posB] = entries[j];
          const szA = getDefaultSize(cleanTagName(nodeById.get(idA)!.tagName));
          const szB = getDefaultSize(cleanTagName(nodeById.get(idB)!.tagName));
          const isOverlap = posA.x < posB.x + szB.w + 30 &&
                            posA.x + szA.w + 30 > posB.x &&
                            posA.y < posB.y + szB.h + 30 &&
                            posA.y + szA.h + 30 > posB.y;
          if (isOverlap) {
            const dx = (posA.x + szA.w / 2) - (posB.x + szB.w / 2);
            const dy = (posA.y + szA.h / 2) - (posB.y + szB.h / 2);
            const pushX = dx >= 0 ? 40 : -40;
            const pushY = dy >= 0 ? 40 : -40;
            layoutPositions.set(idA, { x: posA.x + pushX, y: posA.y + pushY });
            layoutPositions.set(idB, { x: posB.x - pushX, y: posB.y - pushY });
            entries[i] = [idA, layoutPositions.get(idA)!];
            entries[j] = [idB, layoutPositions.get(idB)!];
            moved = true;
          }
        }
      }
      if (!moved) break;
    }
  } else {
    // Layered auto-layout
    const startIds = [...nodeById.keys()].filter(id =>
      (incoming.get(id) || []).length === 0 && cleanTagName(nodeById.get(id)!.tagName) === 'startEvent'
    );
    if (startIds.length === 0) startIds.push([...nodeById.keys()][0]);

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

    // Barycenter heuristic
    for (let l = 1; l <= maxLayer; l++) {
      layerGroups[l].sort((a, b) => {
        const predA = (incoming.get(a) || []).filter(p => layer.get(p) === l - 1);
        const predB = (incoming.get(b) || []).filter(p => layer.get(p) === l - 1);
        const avgA = predA.length > 0 ? predA.reduce((s, id) => s + layerGroups[l - 1].indexOf(id), 0) / predA.length : 0;
        const avgB = predB.length > 0 ? predB.reduce((s, id) => s + layerGroups[l - 1].indexOf(id), 0) / predB.length : 0;
        return avgA - avgB;
      });
    }

    const H_SPACING = 80;
    const V_SPACING = 50;
    const MARGIN_H = 50;
    const MARGIN_V = 50;

    const layerWidths = layerGroups.map(group =>
      group.length > 0 ? Math.max(...group.map(id => getDefaultSize(cleanTagName(nodeById.get(id)!.tagName)).w)) : 0
    );

    layoutPositions = new Map();
    let currentX = MARGIN_H;
    for (let l = 0; l <= maxLayer; l++) {
      const group = layerGroups[l];
      let currentY = MARGIN_V;
      for (const id of group) {
        const sz = getDefaultSize(cleanTagName(nodeById.get(id)!.tagName));
        layoutPositions.set(id, { x: currentX, y: currentY });
        currentY += sz.h + V_SPACING;
      }
      currentX += (layerWidths[l] || 100) + H_SPACING;
    }
  }

  // Generate BPMNShape elements
  const edgePositions = new Map<string, { x: number; y: number; w: number; h: number }>();
  const placed = new Set<string>();
  for (const node of flowNodes) {
    const id = node.getAttribute('id') || '';
    if (!id || placed.has(id)) continue;
    placed.add(id);
    const pos = layoutPositions.get(id);
    if (!pos) continue;
    const tag = cleanTagName(node.tagName);
    const { w, h } = getDefaultSize(tag);
    const shapeEl = doc.createElementNS(NS_BPMIDI, 'bpmndi:BPMNShape');
    shapeEl.setAttribute('id', `Shape_${id}`);
    shapeEl.setAttribute('bpmnElement', id);
    const boundsEl = doc.createElementNS(NS_DC, 'dc:Bounds');
    boundsEl.setAttribute('x', String(pos.x));
    boundsEl.setAttribute('y', String(pos.y));
    boundsEl.setAttribute('width', String(w));
    boundsEl.setAttribute('height', String(h));
    shapeEl.appendChild(boundsEl);
    planeEl.appendChild(shapeEl);
    edgePositions.set(id, { x: pos.x, y: pos.y, w, h });
  }

  // Generate BPMNEdge elements
  for (const flow of sequenceFlows) {
    const id = flow.getAttribute('id');
    if (!id) continue;
    const sid = flow.getAttribute('sourceRef') || '';
    const tid = flow.getAttribute('targetRef') || '';
    const src = edgePositions.get(sid);
    const tgt = edgePositions.get(tid);
    if (!src || !tgt) continue;

    const cx1 = src.x + src.w / 2;
    const cy1 = src.y + src.h / 2;
    const cx2 = tgt.x + tgt.w / 2;
    const cy2 = tgt.y + tgt.h / 2;

    let sx = cx1;
    let sy = cy1;
    let tx = cx2;
    let ty = cy2;

    if (cx2 >= cx1) { sx = src.x + src.w; tx = tgt.x; }
    else { sx = src.x; tx = tgt.x + tgt.w; }

    const edgeEl = doc.createElementNS(NS_BPMIDI, 'bpmndi:BPMNEdge');
    edgeEl.setAttribute('id', `Edge_${id}`);
    edgeEl.setAttribute('bpmnElement', id);

    if (Math.abs(sy - ty) < 5) {
      addPoint(edgeEl, NS_DC, Math.round(sx), Math.round(sy));
      addPoint(edgeEl, NS_DC, Math.round(tx), Math.round(ty));
    } else {
      const midX = (sx + tx) / 2;
      addPoint(edgeEl, NS_DC, Math.round(sx), Math.round(sy));
      addPoint(edgeEl, NS_DC, Math.round(midX), Math.round(sy));
      addPoint(edgeEl, NS_DC, Math.round(midX), Math.round(ty));
      addPoint(edgeEl, NS_DC, Math.round(tx), Math.round(ty));
    }
    planeEl.appendChild(edgeEl);
  }

  diagramEl.appendChild(planeEl);
  definitions.appendChild(diagramEl);
  return new XMLSerializer().serializeToString(definitions);
}

function cleanTagName(name: string): string {
  return name.includes(':') ? name.split(':')[1] : name;
}

function getDefaultSize(tag: string): { w: number; h: number } {
  const t = tag.toLowerCase();
  if (t.includes('event')) return { w: 40, h: 40 };
  if (t.includes('gateway')) return { w: 50, h: 50 };
  if (t === 'textAnnotation') return { w: 100, h: 30 };
  if (t === 'dataObject' || t === 'dataStoreReference') return { w: 36, h: 50 };
  return { w: 110, h: 80 };
}

function addPoint(edge: Element, ns: string, x: number, y: number) {
  const wpEl = edge.ownerDocument.createElementNS(ns, 'dc:Point');
  wpEl.setAttribute('x', String(x));
  wpEl.setAttribute('y', String(y));
  edge.appendChild(wpEl);
}
