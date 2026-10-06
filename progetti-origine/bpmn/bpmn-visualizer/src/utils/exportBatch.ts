// Export a batch di tutto il portafoglio SOA in un unico ZIP:
// una cartella per ogni composite (nome del servizio) contenente un
// documento Markdown con la documentazione ricostruita e una cartella
// images/ con i diagrammi (composite + processi BPMN) in SVG.

import JSZip from 'jszip';
import { Reconstruction, ReconstructedComposite, ReconstructedProcess } from './reconstruction';
import { buildLabelMap, buildDescriptionMap, ParsedProcessDocumentation } from './documentationXmlParser';
import { bpmnToDrawioNodes, compositeToDrawioNodes } from './drawioGenerator';
import { renderDiagramSvg } from './svgDiagram';
import { BpmnElement } from '../types';

export function sanitize(name: string): string {
  const cleaned = name.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned || 'composite';
}

interface FlowInfo {
  id: string;
  from: string;
  to: string;
  condition?: string;
}

function flowsOf(elements: BpmnElement[]): FlowInfo[] {
  const out: FlowInfo[] = [];
  for (const el of elements) {
    if (el.rawType !== 'sequenceFlow') continue;
    const src = elements.find((e) => e.id === el.incoming[0]);
    const tgt = elements.find((e) => e.id === el.outgoing[0]);
    out.push({
      id: el.id,
      from: src ? src.name || src.id : el.incoming[0],
      to: tgt ? tgt.name || tgt.id : el.outgoing[0],
      condition: el.conditionExpression,
    });
  }
  return out;
}

function processDocTopics(p: ReconstructedProcess): string[] {
  if (!p.documentation) return [];
  const labelMap = buildLabelMap(p.documentation, ['it', 'en']);
  const descMap = buildDescriptionMap(p.documentation, ['it', 'en']);
  const lines: string[] = [];
  lines.push('### Topic di documentazione');
  lines.push('');
  if (p.documentation.topics.length === 0) {
    lines.push('_Nessun topic._');
    return lines;
  }
  lines.push('| Elemento | Label | Descrizione |');
  lines.push('|---|---|---|');
  for (const t of p.documentation.topics) {
    const label = labelMap.get(t.elementId) || '—';
    const desc = (descMap.get(t.elementId) || '').replace(/\n/g, ' ');
    lines.push(`| \`${t.elementId}\` | ${label} | ${desc || '—'} |`);
  }
  return lines;
}

export function buildCompositeMarkdown(c: ReconstructedComposite): string {
  const name = c.parsed.compositeName;
  const safeName = sanitize(name);
  const lines: string[] = [];

  lines.push(`# Composite: ${name}`);
  lines.push('');
  lines.push(`> Ricostruzione automatica dal file \`${c.file.relativePath}\``);
  lines.push('');

  lines.push('## Panoramica');
  lines.push('');
  lines.push('| Campo | Valore |');
  lines.push('|---|---|');
  lines.push(`| File | \`${c.file.relativePath}\` |`);
  if (c.parsed.applicationName) lines.push(`| Applicazione | ${c.parsed.applicationName} |`);
  if (c.parsed.revision) lines.push(`| Revisione | ${c.parsed.revision} |`);
  lines.push(`| Servizi esposti | ${c.services.length} |`);
  lines.push(`| Reference verso l'esterno | ${c.references.length} |`);
  lines.push(`| Componenti BPMN | ${c.processes.length} |`);
  lines.push(`| Processi con BPMN reale | ${c.processes.filter((p) => p.bpmnFile).length} |`);
  lines.push('');

  lines.push('## Diagramma composite');
  lines.push('');
  lines.push(`![Diagramma composite ${name}](images/${safeName}-composite.svg)`);
  lines.push('');

  lines.push('## Servizi esposti');
  lines.push('');
  if (c.services.length === 0) {
    lines.push('_Nessun servizio._');
  } else {
    lines.push('| Servizio | Binding | WSDL |');
    lines.push('|---|---|---|');
    for (const s of c.services) {
      lines.push(`| ${s.name} | ${s.binding || '—'} | ${s.wsdlLocation ? `\`${s.wsdlLocation}\`` : '—'} |`);
    }
  }
  lines.push('');

  lines.push('## Reference verso l\'esterno');
  lines.push('');
  if (c.references.length === 0) {
    lines.push('_Nessuna reference._');
  } else {
    lines.push('| Reference | Binding | WSDL |');
    lines.push('|---|---|---|');
    for (const r of c.references) {
      lines.push(`| ${r.name} | ${r.binding || '—'} | ${r.wsdlLocation ? `\`${r.wsdlLocation}\`` : '—'} |`);
    }
  }
  lines.push('');

  if (c.externalRefs.length > 0) {
    lines.push('## Dipendenze verso altri compositi');
    lines.push('');
    lines.push('| Reference | Destinazione | WSDL |');
    lines.push('|---|---|---|');
    for (const r of c.externalRefs) {
      lines.push(`| ${r.name} | ${r.target} | \`${r.wsdlLocation}\` |`);
    }
    lines.push('');
  }

  lines.push('## Processi');
  lines.push('');

  if (c.processes.length === 0) {
    lines.push('_Nessun processo BPMN dichiarato nel composite._');
    lines.push('');
  }

  for (const p of c.processes) {
    lines.push(`### ${p.componentName}`);
    lines.push('');
    if (p.bpmnFile) {
      lines.push(`![Diagramma processo ${p.componentName}](images/${sanitize(p.componentName)}-process.svg)`);
      lines.push('');
      lines.push('| Statistica | Valore |');
      lines.push('|---|---|');
      lines.push(`| File BPMN | \`${p.bpmnFile.relativePath}\` |`);
      lines.push(`| Nome processo | ${p.parsed?.processName || '—'} |`);
      lines.push(`| Elementi | ${p.parsed?.stats.totalElements ?? '—'} |`);
      lines.push(`| Attività | ${p.parsed?.stats.tasksCount ?? '—'} |`);
      lines.push(`| Gateway | ${p.parsed?.stats.gatewaysCount ?? '—'} |`);
      lines.push(`| Eventi | ${p.parsed?.stats.eventsCount ?? '—'} |`);
      lines.push(`| Topic di documentazione | ${p.documentation?.topics.length ?? '—'} |`);
      lines.push(`| Servizi in ingresso | ${p.services.map((s) => s.name).join(', ') || '—'} |`);
      lines.push(`| Reference in uscita | ${p.references.map((r) => r.name).join(', ') || '—'} |`);
      lines.push('');

      const allElements = p.parsed?.elements || [];
      const elements = allElements.filter((e) => e.rawType !== 'sequenceFlow');
      const flows = flowsOf(allElements);

      if (elements.length > 0) {
        const labelMap = p.documentation ? buildLabelMap(p.documentation, ['it', 'en']) : new Map<string, string>();
        const descMap = p.documentation ? buildDescriptionMap(p.documentation, ['it', 'en']) : new Map<string, string>();
        lines.push('### Elementi del processo');
        lines.push('');
        lines.push('| ID | Nome | Tipo | Descrizione |');
        lines.push('|---|---|---|---|');
        for (const el of elements) {
          const label = labelMap.get(el.id) || el.name || el.id;
          const desc = (descMap.get(el.id) || '').replace(/\n/g, ' ');
          lines.push(`| \`${el.id}\` | ${label} | ${el.type} | ${desc || '—'} |`);
        }
        lines.push('');
      }

      if (flows.length > 0) {
        lines.push('### Flussi');
        lines.push('');
        lines.push('| Da | A | Condizione |');
        lines.push('|---|---|---|');
        for (const f of flows) {
          lines.push(`| ${f.from} | ${f.to} | ${f.condition ? `\`${f.condition}\`` : '—'} |`);
        }
        lines.push('');
      }

      if (p.documentation && p.documentation.topics.length > 0) {
        lines.push(...processDocTopics(p));
        lines.push('');
      }
    } else {
      lines.push('> ⚠ Processo BPMN **non trovato** nel portafoglio.');
      lines.push('');
      lines.push(`- Servizi in ingresso: ${p.services.map((s) => s.name).join(', ') || '—'}`);
      lines.push(`- Reference in uscita: ${p.references.map((r) => r.name).join(', ') || '—'}`);
      lines.push('');
    }
  }

  if (c.otherComponents.length > 0) {
    lines.push('## Altri componenti');
    lines.push('');
    for (const oc of c.otherComponents) {
      lines.push(`- **${oc.name}** (${oc.implementation || oc.binding || oc.type})`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Costruisce il contenuto dello ZIP del portafoglio.
 * - una cartella per ogni composite (nome del servizio)
 * - `<nome>.md` con la documentazione ricostruita
 * - `images/` con i diagrammi composite e processo in SVG
 */
export async function exportReconstructionZip(rec: Reconstruction): Promise<Blob> {
  const zip = new JSZip();

  for (const c of rec.composites) {
    const safeName = sanitize(c.parsed.compositeName);
    const folder = zip.folder(safeName)!;
    const images = folder.folder('images')!;

    const compositeDiagram = compositeToDrawioNodes(c.parsed);
    images.file(
      `${safeName}-composite.svg`,
      renderDiagramSvg(compositeDiagram.nodes, compositeDiagram.edges, { standalone: true })
    );

    const used = new Set<string>([`${safeName}-composite.svg`]);
    for (const p of c.processes) {
      if (!p.bpmnFile) continue;
      const processDiagram = bpmnToDrawioNodes(p.bpmnFile.content, { mode: 'topdown', showDataObjects: false });
      let imgName = `${sanitize(p.componentName)}-process.svg`;
      let n = 1;
      while (used.has(imgName)) imgName = `${sanitize(p.componentName)}-${n++}-process.svg`;
      used.add(imgName);
      images.file(
        imgName,
        renderDiagramSvg(processDiagram.nodes, processDiagram.edges, { standalone: true, showSteps: true })
      );
    }

    folder.file(`${safeName}.md`, buildCompositeMarkdown(c));
  }

  return zip.generateAsync({ type: 'blob' });
}

export function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
