export async function ensureBpmnDiagramDI(xmlContent: string): Promise<string> {
  const hasDi = xmlContent.includes('bpmndi:BPMNDiagram') || xmlContent.includes('BPMNDiagram');
  const hasOracle = xmlContent.includes('OracleExtensions') || xmlContent.includes('ns5:OracleExtensions');

  // If it has existing DI and no Oracle extensions, keep original layout
  if (hasDi && !hasOracle) {
    return xmlContent;
  }

  // If it has Oracle extensions, use our layout with Oracle positions
  if (hasOracle) {
    return generateCustomDI(xmlContent);
  }

  // No DI and no Oracle: try bpmn-auto-layout
  if (!hasDi) {
    try {
      const { layoutProcess } = await import(/* @vite-ignore */ 'bpmn-auto-layout');
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
  const defsTag = definitions.tagName.includes(':') ? definitions.tagName.split(':')[1] : definitions.tagName;
  if (defsTag !== 'definitions') return xmlContent;

  const nsBpmndi = 'http://www.omg.org/spec/BPMN/20100524/DI';
  const nsDc = 'http://www.omg.org/spec/DD/20100524/DC';
  const nsDi = 'http://www.omg.org/spec/DD/20100524/DI';

  definitions.setAttribute('xmlns:bpmndi', nsBpmndi);
  definitions.setAttribute('xmlns:dc', nsDc);
  definitions.setAttribute('xmlns:di', nsDi);

  const diagramEl = doc.createElementNS(nsBpmndi, 'bpmndi:BPMNDiagram');
  diagramEl.setAttribute('id', 'BpmnDiagram_1');

  const planeEl = doc.createElementNS(nsBpmndi, 'bpmndi:BPMNPlane');
  planeEl.setAttribute('id', 'BpmnPlane_1');

  const processEl = doc.querySelector('process');
  if (!processEl) return xmlContent;
  planeEl.setAttribute('bpmnElement', processEl.getAttribute('id') || '');

  const flowNodeTags = new Set([
    'startEvent', 'endEvent', 'intermediateCatchEvent', 'intermediateThrowEvent', 'boundaryEvent',
    'task', 'userTask', 'serviceTask', 'sendTask', 'receiveTask', 'manualTask', 'scriptTask', 'businessRuleTask',
    'subProcess', 'callActivity', 'transaction', 'adHocSubProcess',
    'exclusiveGateway', 'parallelGateway', 'inclusiveGateway', 'eventBasedGateway', 'complexGateway',
    'textAnnotation', 'dataObject', 'dataStoreReference'
  ]);

  const children = Array.from(processEl.children);
  const flowNodes = children.filter(n => {
    const tag = n.tagName.includes(':') ? n.tagName.split(':')[1] : n.tagName;
    return flowNodeTags.has(tag);
  });
  const sequenceFlows = children.filter(n => {
    const tag = n.tagName.includes(':') ? n.tagName.split(':')[1] : n.tagName;
    return tag === 'sequenceFlow';
  });

  const getLocalTag = (el: Element) => el.tagName.includes(':') ? el.tagName.split(':')[1] : el.tagName;
  const isEvent = (t: string) => ['startEvent', 'endEvent', 'intermediateCatchEvent', 'intermediateThrowEvent', 'boundaryEvent'].includes(t);
  const isGateway = (t: string) => ['exclusiveGateway', 'parallelGateway', 'inclusiveGateway', 'eventBasedGateway', 'complexGateway'].includes(t);
  const getDefaultSize = (tag: string) => {
    if (isEvent(tag)) return { w: 40, h: 40 };
    if (isGateway(tag)) return { w: 50, h: 50 };
    if (tag === 'textAnnotation') return { w: 100, h: 30 };
    if (tag === 'dataObject' || tag === 'dataStoreReference') return { w: 36, h: 50 };
    return { w: 110, h: 80 };
  };

  // Extract Oracle positions
  const oraclePositions = new Map<string, { x: number; y: number }>();
  for (const node of flowNodes) {
    const id = node.getAttribute('id');
    if (!id) continue;
    for (const ext of Array.from(node.children).filter(c => {
      const t = c.tagName.includes(':') ? c.tagName.split(':')[1] : c.tagName;
      return t === 'extensionElements';
    })) {
      for (const ora of Array.from(ext.children).filter(c => {
        const t = c.tagName.includes(':') ? c.tagName.split(':')[1] : c.tagName;
        return t === 'OracleExtensions';
      })) {
        for (const g of Array.from(ora.children).filter(c => {
          const t = c.tagName.includes(':') ? c.tagName.split(':')[1] : c.tagName;
          return t === 'GraphicsAttributes';
        })) {
          for (const p of Array.from(g.children).filter(c => {
            const t = c.tagName.includes(':') ? c.tagName.split(':')[1] : c.tagName;
            return t === 'Position';
          })) {
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
    const unplaced = flowNodes.filter(n => {
      const id = n.getAttribute('id');
      return id && !placed.has(id);
    });

    for (const node of unplaced) {
      const id = node.getAttribute('id')!;
      const tag = getLocalTag(node);
      const { w, h } = getDefaultSize(tag);
      const neighbors = [...(incoming.get(id) || []), ...(outgoing.get(id) || [])];
      let placedNeighbor: string | null = null;
      for (const nid of neighbors) {
        if (placed.has(nid)) { placedNeighbor = nid; break; }
      }
      if (placedNeighbor) {
        const p = layoutPositions.get(placedNeighbor)!;
        layoutPositions.set(id, { x: p.x + w + 140, y: p.y + 90 });
      } else {
        layoutPositions.set(id, { x: 70, y: 90 + unplaced.indexOf(node) * 150 });
      }
      placed.add(id);
    }

    const entries = [...layoutPositions.entries()];
    for (let iter = 0; iter < 10; iter++) {
      let moved = false;
      for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          const [idA, posA] = entries[i];
          const [idB, posB] = entries[j];
          const tA = getLocalTag(nodeById.get(idA)!);
          const tB = getLocalTag(nodeById.get(idB)!);
          const szA = getDefaultSize(tA);
          const szB = getDefaultSize(tB);

          const isOverlap = posA.x < posB.x + szB.w + 30 &&
                            posA.x + szA.w + 30 > posB.x &&
                            posA.y < posB.y + szB.h + 30 &&
                            posA.y + szA.h + 30 > posB.y;

          if (isOverlap) {
            const dx = (posA.x + szA.w / 2) - (posB.x + szB.w / 2);
            const dy = (posA.y + szA.h / 2) - (posB.y + szB.h / 2);
            const pushX = dx >= 0 ? 60 : -60;
            const pushY = dy >= 0 ? 60 : -60;

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
      (incoming.get(id) || []).length === 0 && getLocalTag(nodeById.get(id)!) === 'startEvent'
    );
    if (startIds.length === 0) {
      startIds.push([...nodeById.keys()][0]);
    }

    const layer = new Map<string, number>();
    const visited = new Set<string>();
    const queue: string[] = [];
    for (const s of startIds) {
      layer.set(s, 0);
      visited.add(s);
      queue.push(s);
    }
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

    for (let l = 1; l <= maxLayer; l++) {
      layerGroups[l].sort((a, b) => {
        const predA = (incoming.get(a) || []).filter(p => layer.get(p) === l - 1);
        const predB = (incoming.get(b) || []).filter(p => layer.get(p) === l - 1);
        const avgA = predA.length > 0 ? predA.reduce((s, id) => s + layerGroups[l - 1].indexOf(id), 0) / predA.length : 0;
        const avgB = predB.length > 0 ? predB.reduce((s, id) => s + layerGroups[l - 1].indexOf(id), 0) / predB.length : 0;
        return avgA - avgB;
      });
    }

    const H_SPACING = 140;
    const V_SPACING = 110;
    const MARGIN_H = 70;
    const MARGIN_V = 70;

    const layerWidths = [];
    for (let l = 0; l <= maxLayer; l++) {
      const group = layerGroups[l];
      if (group.length === 0) { layerWidths.push(0); continue; }
      const sizes = group.map(id => getDefaultSize(getLocalTag(nodeById.get(id)!)));
      layerWidths.push(Math.max(...sizes.map(s => s.w)));
    }

    layoutPositions = new Map();
    let currentX = MARGIN_H;
    for (let l = 0; l <= maxLayer; l++) {
      const group = layerGroups[l];
      let currentY = MARGIN_V;
      for (let i = 0; i < group.length; i++) {
        const id = group[i];
        const sz = getDefaultSize(getLocalTag(nodeById.get(id)!));
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
    const tag = getLocalTag(node);
    const { w, h } = getDefaultSize(tag);
    const shapeEl = doc.createElementNS(nsBpmndi, 'bpmndi:BPMNShape');
    shapeEl.setAttribute('id', `Shape_${id}`);
    shapeEl.setAttribute('bpmnElement', id);
    const boundsEl = doc.createElementNS(nsDc, 'dc:Bounds');
    boundsEl.setAttribute('x', String(pos.x));
    boundsEl.setAttribute('y', String(pos.y));
    boundsEl.setAttribute('width', String(w));
    boundsEl.setAttribute('height', String(h));
    shapeEl.appendChild(boundsEl);
    planeEl.appendChild(shapeEl);
    edgePositions.set(id, { x: pos.x, y: pos.y, w, h });
  }

  // Generate BPMNEdge elements
  const flowEntries = sequenceFlows.map((flow, index) => ({ flow, index }));
  for (const { flow, index } of flowEntries) {
    const id = flow.getAttribute('id');
    if (!id) continue;
    const sid = flow.getAttribute('sourceRef') || '';
    const tid = flow.getAttribute('targetRef') || '';
    const src = edgePositions.get(sid);
    const tgt = edgePositions.get(tid);
    if (!src || !tgt) continue;

    const srcCenterX = src.x + src.w / 2;
    const srcCenterY = src.y + src.h / 2;
    const tgtCenterX = tgt.x + tgt.w / 2;
    const tgtCenterY = tgt.y + tgt.h / 2;

    const startX = srcCenterX + (tgtCenterX >= srcCenterX ? src.w / 2 + 8 : -(src.w / 2 + 8));
    const startY = srcCenterY;
    const endX = tgtCenterX + (tgtCenterX >= srcCenterX ? -(tgt.w / 2 + 8) : tgt.w / 2 + 8);
    const endY = tgtCenterY;

    const laneOffset = ((index % 5) - 2) * 24;
    const bendX = (startX + endX) / 2 + laneOffset;
    const bendY = (startY + endY) / 2 + laneOffset;

    const edgeEl = doc.createElementNS(nsBpmndi, 'bpmndi:BPMNEdge');
    edgeEl.setAttribute('id', `Edge_${id}`);
    edgeEl.setAttribute('bpmnElement', id);

    if (Math.abs(startY - endY) < 6) {
      addPoint(edgeEl, nsDc, Math.round(startX), Math.round(startY));
      addPoint(edgeEl, nsDc, Math.round(endX), Math.round(endY));
    } else {
      const points: Array<{ x: number; y: number }> = [
        { x: Math.round(startX), y: Math.round(startY) },
        { x: Math.round(startX + (endX >= startX ? 70 : -70)), y: Math.round(startY) },
        { x: Math.round(startX + (endX >= startX ? 70 : -70)), y: Math.round(endY) },
        { x: Math.round(endX), y: Math.round(endY) },
      ];

      if (Math.abs(startX - endX) > Math.abs(startY - endY)) {
        points[1] = { x: Math.round(bendX), y: Math.round(startY) };
        points[2] = { x: Math.round(bendX), y: Math.round(endY) };
      } else {
        points[1] = { x: Math.round(startX), y: Math.round(bendY) };
        points[2] = { x: Math.round(endX), y: Math.round(bendY) };
      }

      points.forEach((p) => addPoint(edgeEl, nsDc, p.x, p.y));
    }
    planeEl.appendChild(edgeEl);
  }

  diagramEl.appendChild(planeEl);
  definitions.appendChild(diagramEl);

  return new XMLSerializer().serializeToString(definitions);
}

function addPoint(edge: Element, nsDc: string, x: number, y: number) {
  const wpEl = edge.ownerDocument.createElementNS(nsDc, 'dc:Point');
  wpEl.setAttribute('x', String(x));
  wpEl.setAttribute('y', String(y));
  edge.appendChild(wpEl);
}
