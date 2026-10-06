import { BpmnProcessInfo, OracleEcosystem } from '../types/jca';

export type BpmnNodeKind = 'start' | 'end' | 'userTask' | 'serviceTask' | 'gateway' | 'event';

export interface BpmnGraphNode {
  id: string;
  label: string;
  kind: BpmnNodeKind;
  lane?: string;
  detail?: string;
  /** file sorgente del processo */
  source: string;
  /** collegamenti ad artefatti reali (match esatto, mai fuzzy) */
  links: Array<{ kind: 'task' | 'jca' | 'wsdl' | 'reference' | 'composite'; label: string; path: string }>;
}

export interface BpmnGraphEdge {
  from: string;
  to: string;
  label?: string;
}

export interface BpmnGraph {
  nodes: BpmnGraphNode[];
  edges: BpmnGraphEdge[];
  warnings: string[];
  syntheticOrder: boolean;
}

const base = (p?: string): string => (p || '').replace(/\\/g, '/').split('/').pop()?.toLowerCase() || '';

/** Grafo di un singolo processo BPMN: nodi + archi sequenceFlow reali o catena sintetica dichiarata. */
export function buildBpmnGraph(proc: BpmnProcessInfo, eco?: OracleEcosystem): BpmnGraph {
  const nodes: BpmnGraphNode[] = [];
  const edges: BpmnGraphEdge[] = [];
  const warnings: string[] = [];
  const source = proc.relativePath || proc.fileName;

  const linkTask = (name?: string, extra?: string): BpmnGraphNode['links'] => {
    if (!eco || !name) return [];
    const out: BpmnGraphNode['links'] = [];
    const nl = name.toLowerCase();
    const ht = eco.humanTasks.find((t) => t.name.toLowerCase() === nl || (extra || '').toLowerCase() === t.name.toLowerCase());
    if (ht) out.push({ kind: 'task', label: ht.name, path: ht.relativePath || ht.fileName });
    return out;
  };

  const linkService = (svc: { name: string; implementation?: string; calledElement?: string; operationRef?: string }): BpmnGraphNode['links'] => {
    if (!eco) return [];
    const out: BpmnGraphNode['links'] = [];
    const cands = [svc.implementation, svc.calledElement, svc.operationRef, svc.name].filter(Boolean) as string[];
    for (const c of cands) {
      const cb = base(c);
      const jca = eco.jcaAdapters.find((j) => base(j.relativePath) === cb || base(j.fileName) === cb || j.name.toLowerCase() === c.toLowerCase());
      if (jca && !out.some((o) => o.path === (jca.relativePath || jca.fileName))) {
        out.push({ kind: 'jca', label: jca.name, path: jca.relativePath || jca.fileName });
      }
      const wsdl = eco.wsdlContracts.find((w) => base(w.relativePath) === cb || w.name.toLowerCase() === c.toLowerCase());
      if (wsdl && !out.some((o) => o.path === (wsdl.relativePath || wsdl.fileName))) {
        out.push({ kind: 'wsdl', label: wsdl.name, path: wsdl.relativePath || wsdl.fileName });
      }
      for (const comp of eco.composites) {
        const ref = comp.references.find((r) => r.name.toLowerCase() === c.toLowerCase());
        if (ref && !out.some((o) => o.kind === 'reference' && o.label === ref.name)) {
          out.push({ kind: 'reference', label: `${comp.name}.${ref.name}`, path: comp.relativePath || comp.fileName });
        }
      }
    }
    return out;
  };

  proc.events.forEach((e) => {
    const kind: BpmnNodeKind = e.type === 'startEvent' ? 'start' : e.type === 'endEvent' ? 'end' : 'event';
    nodes.push({
      id: e.id || `event-${e.name}`, label: e.name, kind,
      lane: e.lane, detail: e.type, source, links: [],
    });
  });
  proc.userTasks.forEach((t) => {
    nodes.push({
      id: t.id || `user-${t.name}`, label: t.name, kind: 'userTask',
      lane: t.lane, detail: t.documentation || (t.formKey ? `form: ${t.formKey}` : undefined),
      source, links: linkTask(t.name, t.formKey || t.calledElement),
    });
  });
  proc.serviceTasks.forEach((t) => {
    nodes.push({
      id: t.id || `svc-${t.name}`, label: t.name, kind: 'serviceTask',
      lane: t.lane, detail: t.documentation || (t.implementation ? `impl: ${t.implementation}` : undefined),
      source, links: linkService(t),
    });
  });
  proc.gateways.forEach((g) => {
    nodes.push({
      id: g.id || `gw-${g.name}`, label: g.name, kind: 'gateway',
      lane: g.lane, detail: `gateway ${g.type}`, source, links: [],
    });
  });

  const knownIds = new Set(nodes.map((n) => n.id));
  proc.flows.forEach((f) => {
    if (!knownIds.has(f.sourceRef) || !knownIds.has(f.targetRef)) {
      warnings.push(`Arco ${f.id} con estremi non modellati (${f.sourceRef}→${f.targetRef}): nodo intermedio non estratto.`);
      return;
    }
    edges.push({ from: f.sourceRef, to: f.targetRef, label: f.condition || f.name });
  });

  let syntheticOrder = proc.syntheticOrder || proc.flows.length === 0;
  if (edges.length === 0 && nodes.length > 1) {
    // Fallback dichiarato: catena in ordine documento (start → task → gateway → end)
    syntheticOrder = true;
    warnings.push('Nessun sequenceFlow nel file: ordine sintetico da ordine documento, da validare.');
    const order = (k: BpmnNodeKind): number =>
      k === 'start' ? 0 : k === 'userTask' || k === 'serviceTask' ? 1 : k === 'gateway' ? 2 : k === 'event' ? 3 : 4;
    const sorted = [...nodes].sort((a, b) => order(a.kind) - order(b.kind));
    for (let i = 0; i + 1 < sorted.length; i++) {
      edges.push({ from: sorted[i].id, to: sorted[i + 1].id });
    }
  }

  return { nodes, edges, warnings, syntheticOrder };
}

export const sanitizeMermaid = (v: string): string =>
  v.replace(/["()\[\]{}|<>#;]/g, '_').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'node';

/** ID Mermaid sicuro: solo [A-Za-z0-9_], mai con spazi o punti. */
export const mermaidId = (prefix: string, i: number): string => `${prefix}${i}`;

/**
 * Valida un flowchart Mermaid riga per riga: parentesi bilanciate, niente
 * doppie shape tipo `N0(id)([x])`, archi ben formati. Ritorna gli errori.
 */
export function validateMermaidFlowchart(mmd: string): string[] {
  const errors: string[] = [];
  const lines = mmd.split('\n');
  if (!lines[0]?.trimStart().startsWith('flowchart')) errors.push('prima riga non flowchart');
  lines.slice(1).forEach((raw, k) => {
    const line = raw.trim();
    if (!line || line.startsWith('%%')) return;
    const count = (ch: string): number => line.split('').filter((c) => c === ch).length;
    if (count('[') !== count(']')) errors.push(`riga ${k + 2}: parentesi quadre sbilanciate: ${line}`);
    if (count('(') !== count(')') && !/-->\|.*\|/.test(line)) errors.push(`riga ${k + 2}: parentesi tonde sbilanciate: ${line}`);
    if (count('{') !== count('}')) errors.push(`riga ${k + 2}: parentesi graffe sbilanciate: ${line}`);
    if (/\)\s*[\[(]/.test(line)) errors.push(`riga ${k + 2}: doppia shape: ${line}`);
    if (/-->/.test(line) && !/^\S+\s*-->(\|[^|\n]*\|)?\s*\S+/.test(line)) errors.push(`riga ${k + 2}: arco malformato: ${line}`);
    const idm = line.match(/^(\S+)/);
    if (idm && /^[^A-Za-z_]/.test(idm[1].replace(/^[([{]+/, '')) && !line.startsWith('%%')) {
      // tollerato: gli id generati sono N0/C0/..., altri casi segnalati sotto
      if (!/^[A-Za-z_][A-Za-z0-9_]*(\[.|\[|\(\[|\{\s*|[(\[{])?/.test(line)) errors.push(`riga ${k + 2}: id non sicuro: ${line}`);
    }
  });
  return errors;
}

/** Stesso grafo in Mermaid flowchart (per copia-incolla ed export ZIP). */
export function bpmnGraphToMermaid(procName: string, graph: BpmnGraph): string {
  const lines = [`flowchart LR`, `  %% ${sanitizeMermaid(procName)}${graph.syntheticOrder ? ' (ordine sintetico)' : ''}`];
  const shape = (id: string, n: BpmnGraphNode): string => {
    const l = sanitizeMermaid(n.label);
    if (n.kind === 'start') return `${id}([${l}])`;
    if (n.kind === 'end') return `${id}[[${l}]]`;
    if (n.kind === 'gateway') return `${id}{${l}}`;
    return `${id}[${l}]`;
  };
  graph.nodes.forEach((n, i) => {
    lines.push(`  ${shape(mermaidId('N', i), n)}`);
  });
  const idx = new Map(graph.nodes.map((n, i) => [n.id, i]));
  graph.edges.forEach((e) => {
    const a = idx.get(e.from);
    const b = idx.get(e.to);
    if (a === undefined || b === undefined) return;
    lines.push(e.label ? `  ${mermaidId('N', a)} -->|${sanitizeMermaid(e.label).slice(0, 40)}| ${mermaidId('N', b)}` : `  ${mermaidId('N', a)} --> ${mermaidId('N', b)}`);
  });
  return lines.join('\n');
}

export interface ProjectTreeNode {
  projectName: string;
  projectPath: string;
  projectKind: string;
  composites: Array<{ name: string; path: string; bpmnCount: number }>;
}

/** Livello grande: .jpr → composite contenuti (vicinanza cartella, riuso post-pass). */
export function buildProjectTree(eco: OracleEcosystem): ProjectTreeNode[] {
  const dirOf = (p: string): string => {
    const i = p.replace(/\\/g, '/').lastIndexOf('/');
    return i >= 0 ? p.slice(0, i).toLowerCase() : '';
  };
  return [...eco.projects]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => {
      const d = dirOf(p.relativePath);
      const contained = eco.composites.filter((c) => {
        const cd = dirOf(c.relativePath);
        return d && cd && (cd === d || cd.startsWith(d + '/') || d.startsWith(cd + '/'));
      });
      return {
        projectName: p.name,
        projectPath: p.relativePath,
        projectKind: p.projectKind,
        composites: contained.map((c) => ({
          name: c.name,
          path: c.relativePath || c.fileName,
          bpmnCount: c.components.filter((x) => x.type === 'bpmn').length,
        })),
      };
    });
}
