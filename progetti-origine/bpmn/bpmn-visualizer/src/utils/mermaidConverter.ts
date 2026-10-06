import { ParsedBpmn } from '../types';

function sid(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, '_') || 'n';
}

function shape(id: string, label: string, rawType: string): string {
  const s = sid(id);
  const l = (label || id).replace(/"/g, '\\"');
  const t = rawType.toLowerCase();
  if (t.includes('startevent')) return `${s}(("${l}"))`;
  if (t.includes('endevent')) return `${s}((("${l}")))`;
  if (t.includes('intermediate') || t.includes('boundary')) return `${s}(("${l}"))`;
  if (t.includes('gateway')) {
    if (t.includes('parallel')) return `${s}{"${l || '+'}"}`;
    return `${s}{"${l}"}`;
  }
  if (t.includes('callactivity') || t.includes('subprocess')) return `${s}[["${l}"]]`;
  if (t.includes('textannotation') || t.includes('annotazion')) return `${s}[/"${l}"/]`;
  return `${s}["${l}"]`;
}

function style(id: string, rawType: string): string | null {
  const t = rawType.toLowerCase();
  if (t.includes('event')) return `style ${sid(id)} fill:#e0f2fe,stroke:#0284c7,color:#0f172a`;
  if (t.includes('gateway')) return `style ${sid(id)} fill:#fef3c7,stroke:#d97706,color:#0f172a`;
  if (t.includes('task')) return `style ${sid(id)} fill:#f0fdf4,stroke:#16a34a,color:#0f172a`;
  if (t.includes('callactivity') || t.includes('subprocess')) return `style ${sid(id)} fill:#f3e8ff,stroke:#9333ea,color:#0f172a`;
  return null;
}

function cleanTag(n: string): string {
  return n.includes(':') ? n.split(':')[1] : n;
}

export function bpmnToMermaid(parsed: ParsedBpmn): string {
  // Parse raw XML directly for accuracy
  const doc = new DOMParser().parseFromString(parsed.rawXml, 'text/xml');
  const processEl = doc.querySelector('process');
  if (!processEl) return 'flowchart LR\n  noProcess["Nessun process trovato"]';

  const lines: string[] = ['flowchart LR'];

  // Collect flow nodes and sequence flows
  const flowTags = new Set([
    'startEvent', 'endEvent', 'intermediateCatchEvent', 'intermediateThrowEvent', 'boundaryEvent',
    'task', 'userTask', 'serviceTask', 'sendTask', 'receiveTask', 'manualTask', 'scriptTask', 'businessRuleTask',
    'subProcess', 'callActivity', 'transaction', 'adHocSubProcess',
    'exclusiveGateway', 'parallelGateway', 'inclusiveGateway', 'eventBasedGateway', 'complexGateway',
    'textAnnotation', 'dataObject', 'dataStoreReference'
  ]);

  const nodes: Array<{ id: string; name: string; type: string }> = [];
  const edges: Array<{ id: string; src: string; tgt: string; label?: string }> = [];

  for (const child of Array.from(processEl.children)) {
    const tag = cleanTag(child.tagName);

    if (tag === 'sequenceFlow') {
      const id = child.getAttribute('id') || '';
      const src = child.getAttribute('sourceRef') || '';
      const tgt = child.getAttribute('targetRef') || '';
      if (id && src && tgt) {
        // Check for conditionExpression child
        const condEl = Array.from(child.children).find(c => cleanTag(c.tagName) === 'conditionExpression');
        const cond = condEl?.textContent || undefined;
        edges.push({ id, src, tgt, label: cond });
      }
      continue;
    }

    if (flowTags.has(tag)) {
      const id = child.getAttribute('id') || '';
      const name = child.getAttribute('name') || '';
      if (id) nodes.push({ id, name, type: tag });
    }
  }

  // If no sequenceFlow elements found, try linking via outgoing/incoming children
  if (edges.length === 0) {
    const nodeById = new Map(nodes.map(n => [n.id, n]));
    // Build map from outgoing/incoming children
    for (const child of Array.from(processEl.children)) {
      const tag = cleanTag(child.tagName);
      if (!flowTags.has(tag)) continue;
      const id = child.getAttribute('id') || '';
      if (!id) continue;
      const outgoingEls = Array.from(child.children).filter(c => cleanTag(c.tagName) === 'outgoing');
      for (const outEl of outgoingEls) {
        const flowId = outEl.textContent || '';
        // Find the sequenceFlow with this id
        const flowChild = Array.from(processEl.children).find(c =>
          cleanTag(c.tagName) === 'sequenceFlow' && c.getAttribute('id') === flowId
        );
        if (flowChild) {
          const src = flowChild.getAttribute('sourceRef') || '';
          const tgt = flowChild.getAttribute('targetRef') || '';
          if (src && tgt) {
            const condEl = Array.from(flowChild.children).find(c => cleanTag(c.tagName) === 'conditionExpression');
            const cond = condEl?.textContent || undefined;
            // Avoid duplicates
            if (!edges.some(e => e.id === flowId)) {
              edges.push({ id: flowId, src, tgt, label: cond });
            }
          }
        }
      }
    }
  }

  // Emit nodes
  for (const n of nodes) {
    lines.push(`  ${shape(n.id, n.name, n.type)}`);
  }

  // Emit edges
  for (const e of edges) {
    const existsSrc = nodes.some(n => n.id === e.src);
    const existsTgt = nodes.some(n => n.id === e.tgt);
    if (!existsSrc || !existsTgt) continue;
    const arrow = e.label
      ? ` -- "${e.label.replace(/"/g, '').trim()}" -->`
      : ' -->';
    lines.push(`  ${sid(e.src)}${arrow} ${sid(e.tgt)}`);
  }

  // Styles
  for (const n of nodes) {
    const st = style(n.id, n.type);
    if (st) lines.push(`  ${st}`);
  }

  return lines.join('\n');
}
