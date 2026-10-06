import { BpmnFileItem, CompositeNode, ParsedComposite } from '../types';
import { parseBpmnXml } from './bpmnParser';

export interface BpmnAssociation {
  component: CompositeNode;
  file: BpmnFileItem;
  matchedBy: 'src' | 'name' | 'processName';
}

export interface CompositeAssociation {
  compositeFileId: string;
  compositeName: string;
  bpmnComponents: BpmnAssociation[];
}

export interface CompositeRefEntry {
  file: BpmnFileItem;
  parsed: ParsedComposite;
}

const normalize = (p: string) => p.replace(/\\/g, '/').toLowerCase();

const STUB_FLOW_TAGS =
  /<(userTask|serviceTask|scriptTask|manualTask|sendTask|receiveTask|businessRuleTask|task|subProcess|callActivity|exclusiveGateway|parallelGateway|inclusiveGateway|eventBasedGateway|complexGateway)\b/i;

/**
 * Riconosce i file "default.bpmn" stub generati da JDeveloper: processi vuoti
 * (solo start/end, nessun elemento di flusso). I compositi referenziano i
 * processi reali in `processes/<nome>.bpmn`, quindi questi stub vanno
 * filtrati/marcati per non inquinare diagrammi e associazioni.
 */
export function isStubBpmn(content: string): boolean {
  return !STUB_FLOW_TAGS.test(content);
}

export function isStubBpmnFile(file: BpmnFileItem): boolean {
  return file.name.toLowerCase().endsWith('.bpmn') && isStubBpmn(file.content);
}

/**
 * Abbina i file .bpmn presenti nel portafoglio ai componenti BPMN dichiarati
 * nei composite (via <implementation.bpmn src>). Strategia di matching, in ordine:
 *  1. basename del path `src` uguale al nome file
 *  2. il path `src` combacia con la coda del relativePath del file
 *  3. nome componente == nome file senza estensione
 *  4. nome componente == nome del processo BPMN (parsing del file)
 */
export function associateBpmnToComposites(
  files: BpmnFileItem[],
  composites: CompositeRefEntry[]
): CompositeAssociation[] {
  const bpmnFiles = files.filter((f) => f.name.toLowerCase().endsWith('.bpmn'));
  const byName = new Map<string, BpmnFileItem>();
  for (const f of bpmnFiles) {
    byName.set(normalize(f.name), f);
    const base = f.name.replace(/\.bpmn$/i, '');
    if (!byName.has(normalize(base))) byName.set(normalize(base), f);
  }

  const parsedCache = new Map<string, string>();
  const getProcessName = (f: BpmnFileItem): string => {
    if (!parsedCache.has(f.id)) {
      try {
        parsedCache.set(f.id, normalize(parseBpmnXml(f.content, f.name).processName));
      } catch {
        parsedCache.set(f.id, '');
      }
    }
    return parsedCache.get(f.id)!;
  };

  const findBySrc = (srcNorm: string): BpmnFileItem | undefined => {
    const srcBase = srcNorm.split('/').pop() || '';
    const byBase = byName.get(srcBase);
    if (byBase) return byBase;
    return bpmnFiles.find(
      (f) => normalize(f.relativePath).endsWith(srcNorm) || normalize(f.name) === srcBase
    );
  };

  const results: CompositeAssociation[] = [];
  for (const c of composites) {
    const bpmnComponents: BpmnAssociation[] = [];
    for (const node of c.parsed.nodes) {
      const isBpmn =
        node.type === 'component' &&
        (node.implementation === 'bpmn' || !!node.src?.toLowerCase().endsWith('.bpmn'));
      if (!isBpmn) continue;

      let match: BpmnFileItem | undefined;
      let matchedBy: 'src' | 'name' | 'processName' | undefined;

      if (node.src) {
        const m = findBySrc(normalize(node.src));
        if (m) {
          match = m;
          matchedBy = 'src';
        }
      }
      if (!match) {
        const m = byName.get(node.name.toLowerCase());
        if (m) {
          match = m;
          matchedBy = 'name';
        }
      }
      if (!match) {
        const m = bpmnFiles.find((f) => getProcessName(f) === node.name.toLowerCase());
        if (m) {
          match = m;
          matchedBy = 'processName';
        }
      }

      if (match && matchedBy) bpmnComponents.push({ component: node, file: match, matchedBy });
    }

    if (bpmnComponents.length > 0) {
      results.push({
        compositeFileId: c.file.id,
        compositeName: c.parsed.compositeName,
        bpmnComponents,
      });
    }
  }
  return results;
}

export function unassociatedBpmn(
  files: BpmnFileItem[],
  associations: CompositeAssociation[]
): BpmnFileItem[] {
  const matched = new Set<string>();
  for (const a of associations) {
    for (const b of a.bpmnComponents) matched.add(b.file.id);
  }
  return files.filter(
    (f) => f.name.toLowerCase().endsWith('.bpmn') && !isStubBpmnFile(f) && !matched.has(f.id)
  );
}
