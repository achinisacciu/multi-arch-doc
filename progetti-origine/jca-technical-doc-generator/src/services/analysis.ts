import { OracleEcosystem } from '../types/jca';

export interface DanglingRef {
  from: string;
  ref: string;
  kind: 'wsdl' | 'jca' | 'impl' | 'xslt' | 'import';
}

export interface LineageRow {
  resourceType: 'table' | 'procedure' | 'queue' | 'directory' | 'dvm' | 'xref';
  resource: string;
  artifact: string;
  composites: string[];
}

export interface HygieneFinding {
  kind: 'hardcoded-endpoint' | 'cleartext-secret' | 'orphan' | 'dangling';
  where: string;
  detail: string;
}

const base = (p?: string): string => (p || '').replace(/\\/g, '/').split('/').pop()?.toLowerCase() || '';

/** Riferimenti a file citati ma assenti dal repository. */
export function findDanglingRefs(eco: OracleEcosystem): DanglingRef[] {
  const known = new Set(eco.rawFiles.map((f) => base(f.relativePath) || base(f.name)));
  const out: DanglingRef[] = [];
  const check = (from: string, ref: string | undefined, kind: DanglingRef['kind']): void => {
    if (!ref || /^oramds:\//i.test(ref) || /^[a-z]+:\/\//i.test(ref)) return;
    const b = base(ref);
    if (b && !known.has(b) && !out.some((o) => o.from === from && o.ref === ref)) {
      out.push({ from, ref, kind });
    }
  };
  eco.composites.forEach((c) => {
    c.services.forEach((s) => check(c.relativePath, s.uiWsdlLocation, 'wsdl'));
    c.references.forEach((r) => {
      check(c.relativePath, r.uiWsdlLocation, 'wsdl');
      check(c.relativePath, r.jcaLocation, 'jca');
    });
    c.components.forEach((x) => check(c.relativePath, x.implementationSource, 'impl'));
    (c.imports || []).forEach((i) => check(c.relativePath, i.location, 'import'));
  });
  eco.jcaAdapters.forEach((j) => check(j.relativePath, j.wsdlLocation, 'wsdl'));
  eco.mediators.forEach((m) =>
    m.operations.forEach((o) => o.routingRules.forEach((r) => r.transformations.forEach((t) => check(m.relativePath, t, 'xslt'))))
  );
  return out.sort((a, b) => a.from.localeCompare(b.from));
}

/** Artefatti mai referenziati (wsdl/xsd/xslt/dvm/jca/componentType/bpel/mplan/task). */
export function findOrphans(eco: OracleEcosystem): Array<{ path: string; kind: string }> {
  const referenced = new Set<string>();
  const add = (ref?: string): void => {
    const b = base(ref);
    if (b) referenced.add(b);
  };
  eco.composites.forEach((c) => {
    c.services.forEach((s) => add(s.uiWsdlLocation));
    c.references.forEach((r) => { add(r.uiWsdlLocation); add(r.jcaLocation); });
    c.components.forEach((x) => add(x.implementationSource));
    (c.imports || []).forEach((i) => add(i.location));
  });
  eco.jcaAdapters.forEach((j) => add(j.wsdlLocation));
  eco.mediators.forEach((m) =>
    m.operations.forEach((o) => o.routingRules.forEach((r) => r.transformations.forEach(add)))
  );
  const orphans: Array<{ path: string; kind: string }> = [];
  const consider = (path: string, kind: string): void => {
    const b = base(path);
    if (b && !referenced.has(b)) orphans.push({ path, kind });
  };
  eco.wsdlContracts.forEach((w) => consider(w.relativePath, 'wsdl'));
  eco.xsdSchemas.forEach((x) => consider(x.relativePath, 'xsd'));
  eco.xsltTransforms.forEach((x) => consider(x.relativePath, 'xslt'));
  (eco.dvms || []).forEach((d) => consider(d.relativePath, 'dvm'));
  eco.jcaAdapters.forEach((j) => consider(j.relativePath, 'jca'));
  (eco.componentTypes || []).forEach((c) => consider(c.relativePath, 'componentType'));
  eco.bpelProcesses.forEach((p) => consider(p.relativePath, 'bpel'));
  eco.mediators.forEach((m) => consider(m.relativePath, 'mplan'));
  eco.humanTasks.forEach((t) => consider(t.relativePath, 'task'));
  return orphans.sort((a, b) => a.path.localeCompare(b.path));
}

/** Indice inverso risorsa -> artifact -> composite (lineage). */
export function buildLineage(eco: OracleEcosystem): LineageRow[] {
  const rows: LineageRow[] = [];
  // adapter .jca -> composite che lo referenziano (per basename config)
  const adapterUsers = new Map<string, string[]>();
  eco.jcaAdapters.forEach((j) => {
    const users = eco.composites
      .filter((c) => c.references.some((r) => base(r.jcaLocation) === base(j.relativePath) || base(r.jcaLocation) === base(j.fileName)))
      .map((c) => c.name);
    adapterUsers.set(j.name, users);
  });
  eco.jcaAdapters.forEach((j) => {
    const users = adapterUsers.get(j.name) || [];
    j.endpoints.forEach((e) => {
      (e.sqlAnalysis?.tables || []).forEach((t) => rows.push({ resourceType: 'table', resource: t, artifact: j.name, composites: users }));
      if (e.sqlAnalysis?.procedureName) rows.push({ resourceType: 'procedure', resource: e.sqlAnalysis.procedureName, artifact: j.name, composites: users });
      if (e.messagingAnalysis?.destinationName) rows.push({ resourceType: 'queue', resource: e.messagingAnalysis.destinationName, artifact: j.name, composites: users });
      if (e.fileAnalysis?.physicalDirectory) rows.push({ resourceType: 'directory', resource: e.fileAnalysis.physicalDirectory, artifact: j.name, composites: users });
    });
  });
  // dvm/xref usage: chi li nomina in xslt/mediator/bpel
  const searchers = [
    ...eco.xsltTransforms.map((x) => ({ name: x.name, content: x.rawContent })),
    ...eco.mediators.map((m) => ({ name: m.name, content: m.rawXml })),
    ...eco.bpelProcesses.map((p) => ({ name: p.name, content: p.rawXml })),
  ];
  [...(eco.dvms || []).map((d) => ({ kind: 'dvm' as const, name: d.name })), ...(eco.xrefs || []).map((x) => ({ kind: 'xref' as const, name: x.name }))].forEach((r) => {
    const users = searchers.filter((s) => s.content.toLowerCase().includes(r.name.toLowerCase()) || (r.kind === 'dvm' && /dvm:lookup/i.test(s.content))).map((s) => s.name);
    if (users.length) rows.push({ resourceType: r.kind, resource: r.name, artifact: [...new Set(users)].join('; '), composites: [] });
  });
  // dedup
  const seen = new Set<string>();
  return rows.filter((r) => {
    const k = `${r.resourceType}|${r.resource}|${r.artifact}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const HARDCODED_RE = /(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)/i;

/** Endpoint hardcoded e segreti in chiaro (mai valori nei documenti: solo file + hint). */
export function findHygiene(eco: OracleEcosystem): HygieneFinding[] {
  const out: HygieneFinding[] = [];
  eco.wsdlContracts.forEach((w) => {
    if (w.soapAddress && HARDCODED_RE.test(w.soapAddress)) {
      out.push({ kind: 'hardcoded-endpoint', where: w.relativePath, detail: `soap:address su host interno/loopback in ${w.serviceName || w.name}` });
    }
  });
  const secretRe = /(password|passwd|secret|privatekey)\s*=\s*["']([^"'$*{}@\s]{4,})["']/gi;
  eco.rawFiles.forEach((f) => {
    if (!/\.(properties|xml|jca|py|sh)$/i.test(f.name)) return;
    if (f.content.length > 500000) return;
    let m: RegExpExecArray | null;
    secretRe.lastIndex = 0;
    let hits = 0;
    while ((m = secretRe.exec(f.content)) !== null && hits < 3) {
      hits += 1;
      out.push({ kind: 'cleartext-secret', where: f.relativePath, detail: `possibile segreto in chiaro (chiave "${m[1]}"): spostare in credential store` });
    }
  });
  return out;
}
