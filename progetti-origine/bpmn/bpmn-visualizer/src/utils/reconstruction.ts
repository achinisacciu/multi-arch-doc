import { BpmnFileItem, ParsedComposite, ParsedBpmn } from '../types';
import { isCompositeXml, parseCompositeXml } from './compositeParser';
import {
  isDocumentationXml,
  parseProcessDocumentation,
  ParsedProcessDocumentation,
  buildLabelMap,
  buildDescriptionMap,
  componentNameFromDocumentationFile,
} from './documentationXmlParser';
import { isStubBpmnFile, associateBpmnToComposites } from './compositeAssociation';
import { parseBpmnXml } from './bpmnParser';

export interface ReconstructedProcess {
  componentName: string;
  componentId: string;
  bpmnFile: BpmnFileItem | null;
  parsed: ParsedBpmn | null;
  documentation: ParsedProcessDocumentation | null;
  services: Array<{ name: string; wsdlLocation?: string; binding?: string }>;
  references: Array<{ name: string; wsdlLocation?: string; binding?: string }>;
}

export interface ReconstructedComposite {
  file: BpmnFileItem;
  parsed: ParsedComposite;
  processes: ReconstructedProcess[];
  otherComponents: ParsedComposite['nodes'];
  services: Array<{ name: string; wsdlLocation?: string; binding?: string }>;
  references: Array<{ name: string; wsdlLocation?: string; binding?: string }>;
  externalRefs: Array<{ name: string; wsdlLocation?: string; target: string }>;
}

export interface Reconstruction {
  composites: ReconstructedComposite[];
  orphanProcesses: BpmnFileItem[];
  stubFiles: BpmnFileItem[];
  documentationFiles: Array<{ file: BpmnFileItem; parsed: ParsedProcessDocumentation }>;
  orphanDocumentation: BpmnFileItem[];
}

function refInfo(node: { name: string; wsdlLocation?: string; binding?: string }) {
  return { name: node.name, wsdlLocation: node.wsdlLocation, binding: node.binding };
}

export function buildReconstruction(files: BpmnFileItem[]): Reconstruction {
  // 1) Categorizza i file
  const compositeFiles: Array<{ file: BpmnFileItem; parsed: ParsedComposite }> = [];
  const docFiles: Array<{ file: BpmnFileItem; parsed: ParsedProcessDocumentation }> = [];
  const stubFiles: BpmnFileItem[] = [];

  for (const file of files) {
    if (isCompositeXml(file.name, file.content)) {
      try {
        compositeFiles.push({ file, parsed: parseCompositeXml(file.content, file.name) });
      } catch {
        /* skip malformed */
      }
    } else if (isDocumentationXml(file.name, file.content)) {
      try {
        docFiles.push({ file, parsed: parseProcessDocumentation(file.content, file.name) });
      } catch {
        /* skip malformed */
      }
    } else if (file.name.toLowerCase().endsWith('.bpmn') && isStubBpmnFile(file)) {
      stubFiles.push(file);
    }
  }

  // 2) Abbina i processi reali ai componenti dei composite (matching riusato)
  const associations = associateBpmnToComposites(files, compositeFiles);
  const byCompositeId = new Map<string, Set<string>>();
  for (const a of associations) {
    byCompositeId.set(a.compositeFileId, new Set(a.bpmnComponents.map((b) => b.component.name)));
  }

  // Mappa documentation: basename del file → parsed
  const docByName = new Map<string, ParsedProcessDocumentation>();
  const docByComponent = new Map<string, ParsedProcessDocumentation>();
  const matchedDoc = new Set<string>();
  for (const d of docFiles) {
    docByName.set(d.file.name.toLowerCase(), d.parsed);
    docByComponent.set(d.parsed.componentName.toLowerCase(), d.parsed);
  }
  const findDoc = (componentName: string): ParsedProcessDocumentation | null => {
    const byBase = docByName.get(`${componentName.toLowerCase()}documentation.xml`);
    if (byBase) {
      matchedDoc.add(byBase.fileName);
      return byBase;
    }
    const byComp = docByComponent.get(componentName.toLowerCase());
    if (byComp) {
      matchedDoc.add(byComp.fileName);
      return byComp;
    }
    return null;
  };

  // 3) Costruisce i composite ricostruiti
  const composites: ReconstructedComposite[] = compositeFiles.map(({ file, parsed }) => {
    const componentId = (name: string) => `component_${name}`;
    const serviceId = (name: string) => `service_${name}`;
    const referenceId = (name: string) => `reference_${name}`;

    const nodeById = new Map(parsed.nodes.map((n) => [n.id, n]));
    const servicesOf = (id: string) =>
      parsed.wires
        .filter((w) => w.target === id)
        .map((w) => nodeById.get(w.source))
        .filter((n): n is ParsedComposite['nodes'][number] => !!n && n.type === 'service')
        .map(refInfo);
    const referencesOf = (id: string) =>
      parsed.wires
        .filter((w) => w.source === id)
        .map((w) => nodeById.get(w.target))
        .filter((n): n is ParsedComposite['nodes'][number] => !!n && n.type === 'reference')
        .map(refInfo);

    const processes: ReconstructedProcess[] = [];
    const otherComponents: ParsedComposite['nodes'] = [];

    const associatedNames = byCompositeId.get(file.id) || new Set<string>();

    for (const node of parsed.nodes) {
      if (node.type !== 'component') continue;
      const isBpmnComponent =
        node.implementation === 'bpmn' || !!node.src?.toLowerCase().endsWith('.bpmn');
      if (!isBpmnComponent) {
        otherComponents.push(node);
        continue;
      }

      // Processo reale associato
      const assoc = associations
        .find((a) => a.compositeFileId === file.id)
        ?.bpmnComponents.find((b) => b.component.id === node.id);
      const bpmnFile = assoc?.file || null;
      let parsed: ParsedBpmn | null = null;
      if (bpmnFile) {
        try {
          parsed = parseBpmnXml(bpmnFile.content, bpmnFile.name);
        } catch {
          parsed = null;
        }
      }

      processes.push({
        componentName: node.name,
        componentId: node.id,
        bpmnFile,
        parsed,
        documentation: findDoc(node.name),
        services: servicesOf(componentId(node.name)),
        references: referencesOf(componentId(node.name)),
      });
      associatedNames.delete(node.name);
    }

    // Componenti dichiarati nel composite ma senza processo reale trovato
    for (const name of associatedNames) {
      const id = componentId(name);
      processes.push({
        componentName: name,
        componentId: id,
        bpmnFile: null,
        parsed: null,
        documentation: findDoc(name),
        services: servicesOf(id),
        references: referencesOf(id),
      });
    }

    // Reference verso altri compositi (per le relazioni)
    const externalRefs = parsed.nodes
      .filter((n) => n.type === 'reference' && !!n.wsdlLocation)
      .map((n) => ({ name: n.name, wsdlLocation: n.wsdlLocation!, target: inferTarget(n.wsdlLocation!) }));

    return {
      file,
      parsed,
      processes,
      otherComponents,
      services: parsed.nodes.filter((n) => n.type === 'service').map(refInfo),
      references: parsed.nodes.filter((n) => n.type === 'reference').map(refInfo),
      externalRefs,
    };
  });

  // 4) File avanzati
  const matchedProcIds = new Set<string>();
  for (const c of composites) {
    for (const p of c.processes) {
      if (p.bpmnFile) matchedProcIds.add(p.bpmnFile.id);
    }
  }
  const orphanProcesses = files.filter(
    (f) => f.name.toLowerCase().endsWith('.bpmn') && !isStubBpmnFile(f) && !matchedProcIds.has(f.id)
  );
  const orphanDocumentation = docFiles.filter((d) => !matchedDoc.has(d.parsed.fileName)).map((d) => d.file);

  return { composites, orphanProcesses, stubFiles, documentationFiles: docFiles, orphanDocumentation };
}

function inferTarget(wsdlLocation: string): string {
  // oramds:/.../esempio/PLSQLUtilityAdapter.wsdl -> ultimo segmento senza estensione
  const m = wsdlLocation.match(/\/([^/]+)\.wsdl$/i);
  if (m) return m[1];
  const p = wsdlLocation.split('/').pop() || wsdlLocation;
  return p.replace(/\.(wsdl|xsd)$/i, '');
}

export function reconstructionToMarkdown(rec: Reconstruction): string {
  const lines: string[] = [];
  lines.push(`# Ricostruzione Portafoglio SOA`);
  lines.push(``);
  lines.push(
    `- **Compositi:** ${rec.composites.length} · **Processi BPMN reali:** ${countProcesses(rec)} · **Stub ignorati:** ${rec.stubFiles.length} · **File documentation.xml:** ${rec.documentationFiles.length}`
  );
  lines.push(``);

  for (const c of rec.composites) {
    lines.push(`## Composite: ${c.parsed.compositeName}`);
    lines.push(``);
    lines.push(`- File: \`${c.file.relativePath}\``);
    if (c.parsed.applicationName) lines.push(`- Applicazione: ${c.parsed.applicationName}`);
    if (c.parsed.revision) lines.push(`- Revisione: ${c.parsed.revision}`);
    lines.push(`- Servizi: ${c.services.map((s) => s.name).join(', ') || '—'}`);
    lines.push(`- Reference: ${c.references.map((r) => r.name).join(', ') || '—'}`);
    if (c.externalRefs.length > 0) {
      lines.push(``);
      lines.push(`### Dipendenze verso altri compositi`);
      lines.push(``);
      lines.push(`| Reference | Destinazione | WSDL |`);
      lines.push(`|---|---|---|`);
      for (const r of c.externalRefs) {
        lines.push(`| ${r.name} | ${r.target} | \`${r.wsdlLocation}\` |`);
      }
    }

    if (c.processes.length > 0) {
      lines.push(``);
      lines.push(`### Processi`);
      lines.push(``);
      for (const p of c.processes) {
        lines.push(`#### ${p.componentName}`);
        lines.push(``);
        if (p.bpmnFile) {
          lines.push(`- File BPMN: \`${p.bpmnFile.relativePath}\``);
          const pname = p.parsed?.processName || '';
          lines.push(`- Processo: ${pname || '—'}`);
          lines.push(`- Elementi: ${p.parsed?.stats.totalElements ?? '—'} · Attività: ${p.parsed?.stats.tasksCount ?? '—'} · Gateway: ${p.parsed?.stats.gatewaysCount ?? '—'} · Eventi: ${p.parsed?.stats.eventsCount ?? '—'}`);
        } else {
          lines.push(`- ⚠ Processo BPMN **non trovato** nel portafoglio`);
        }
        lines.push(`- Documentazione: ${p.documentation ? `${p.documentation.topics.length} topic` : '—'}`);
        lines.push(`- Servizi in ingresso: ${p.services.map((s) => s.name).join(', ') || '—'}`);
        lines.push(`- Reference in uscita: ${p.references.map((r) => r.name).join(', ') || '—'}`);
      }
    }

    if (c.otherComponents.length > 0) {
      lines.push(``);
      lines.push(`### Altri componenti`);
      lines.push(``);
      for (const oc of c.otherComponents) {
        lines.push(`- **${oc.name}** (${oc.implementation || oc.binding || oc.type})`);
      }
    }
    lines.push(``);
  }

  if (rec.orphanProcesses.length > 0) {
    lines.push(`## Processi non associati a compositi`);
    lines.push(``);
    for (const f of rec.orphanProcesses) lines.push(`- \`${f.relativePath}\``);
    lines.push(``);
  }
  if (rec.orphanDocumentation.length > 0) {
    lines.push(`## Documentazione non associata`);
    lines.push(``);
    for (const f of rec.orphanDocumentation) lines.push(`- \`${f.relativePath}\``);
    lines.push(``);
  }
  if (rec.stubFiles.length > 0) {
    lines.push(`## Stub JDeveloper ignorati (default.bpmn)`);
    lines.push(``);
    for (const f of rec.stubFiles) lines.push(`- \`${f.relativePath}\``);
    lines.push(``);
  }

  return lines.join('\n');
}

export function countProcesses(rec: Reconstruction): number {
  return rec.composites.reduce((acc, c) => acc + c.processes.filter((p) => p.bpmnFile).length, 0);
}
