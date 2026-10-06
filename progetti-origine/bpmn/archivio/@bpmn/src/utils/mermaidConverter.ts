import type { ParsedBpmn, BpmnElement } from '../types';

function sid(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, '_') || 'n';
}

function shape(rawType: string, id: string, name: string): string {
  const s = sid(id);
  const label = (name || id).replace(/"/g, '\\"');
  const rt = rawType.toLowerCase();
  if (rt.includes('startevent')) return `${s}(("${label}"))`;
  if (rt.includes('endevent')) return `${s}((("${label}")))`;
  if (rt.includes('intermediate') || rt.includes('boundary')) return `${s}(("${label}"))`;
  if (rt.includes('gateway')) {
    if (rt.includes('parallel')) return `${s}{"${label || '+'}"}`;
    return `${s}{"${label}"}`;
  }
  if (rt.includes('callactivity') || rt.includes('subprocess')) return `${s}[["${label}"]]`;
  if (rt.includes('textannotation') || rt.includes('annotazion')) return `${s}[/"${label}"/]`;
  return `${s}["${label}"]`;
}

function nodeColor(rawType: string): string | null {
  const rt = rawType.toLowerCase();
  if (rt.includes('event')) return 'fill:#e0f2fe,stroke:#0284c7,color:#0f172a';
  if (rt.includes('gateway')) return 'fill:#fef3c7,stroke:#d97706,color:#0f172a';
  if (rt.includes('task')) return 'fill:#f0fdf4,stroke:#16a34a,color:#0f172a';
  if (rt.includes('callactivity') || rt.includes('subprocess')) return 'fill:#f3e8ff,stroke:#9333ea,color:#0f172a';
  return null;
}

function cleanTag(name: string): string {
  return name.includes(':') ? name.split(':')[1] : name;
}

export function bpmnToMermaid(parsed: ParsedBpmn): string {
  const lines: string[] = ['flowchart LR'];

  const doc = new DOMParser().parseFromString(parsed.rawXml, 'text/xml');
  const processEl = doc.querySelector('process');
  if (!processEl) return 'flowchart LR\n  noProcess["Nessun process trovato"]';

  const flowTags = new Set([
    'startEvent', 'endEvent', 'intermediateCatchEvent', 'intermediateThrowEvent', 'boundaryEvent',
    'task', 'userTask', 'serviceTask', 'sendTask', 'receiveTask', 'manualTask', 'scriptTask', 'businessRuleTask',
    'subProcess', 'callActivity', 'transaction',
    'exclusiveGateway', 'parallelGateway', 'inclusiveGateway', 'eventBasedGateway', 'complexGateway',
    'textAnnotation', 'dataObject', 'dataStoreReference'
  ]);

  const nodes: Array<{ id: string; name: string; rawType: string }> = [];
  const flows: Array<{ src: string; tgt: string; cond?: string }> = [];

  for (const child of Array.from(processEl.children)) {
    const tag = cleanTag(child.tagName);
    if (['extensionElements', 'laneSet', 'documentation'].includes(tag)) continue;

    if (tag === 'sequenceFlow') {
      const src = child.getAttribute('sourceRef') || '';
      const tgt = child.getAttribute('targetRef') || '';
      if (src && tgt) {
        const condEl = Array.from(child.children).find(c => cleanTag(c.tagName) === 'conditionExpression');
        flows.push({ src, tgt, cond: condEl?.textContent || undefined });
      }
      continue;
    }

    if (flowTags.has(tag)) {
      const id = child.getAttribute('id') || '';
      const name = child.getAttribute('name') || '';
      if (id) nodes.push({ id, name, rawType: tag });
    }
  }

  // Emit nodes
  for (const n of nodes) {
    lines.push(`  ${shape(n.rawType, n.id, n.name)}`);
  }

  // Emit flows
  for (const f of flows) {
    const srcExists = nodes.some(n => n.id === f.src);
    const tgtExists = nodes.some(n => n.id === f.tgt);
    if (!srcExists || !tgtExists) continue;
    const label = f.cond
      ? ` -- "${f.cond.replace(/["]/g, '').trim()}" -->`
      : ' -->';
    lines.push(`  ${sid(f.src)}${label} ${sid(f.tgt)}`);
  }

  // Styles
  for (const n of nodes) {
    const c = nodeColor(n.rawType);
    if (c) lines.push(`  style ${sid(n.id)} ${c}`);
  }

  return lines.join('\n');
}
