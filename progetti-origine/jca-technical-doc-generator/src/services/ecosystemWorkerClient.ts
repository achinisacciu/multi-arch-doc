import { OracleEcosystem } from '../types/jca';
import { buildOracleEcosystem, collectSecurityRefs } from './ecosystemParser';

export interface InputFile {
  content: string;
  name: string;
  relativePath: string;
}

/** Soglia oltre la quale il parsing va nel Web Worker (main thread libero). */
export const WORKER_THRESHOLD = 500;

/**
 * I Web Worker nei browser non hanno DOMParser: usarli per XML produce
 * gusci vuoti (117 composite con nome "composite" e zero servizi).
 * Finché il worker non usa un parser XML isomorfo, il parsing XML resta
 * sul main thread (dove DOMParser esiste), a chunk per non freezare la UI.
 */
function hasDomParser(): boolean {
  return typeof DOMParser !== 'undefined';
}

function buildBatched(files: InputFile[]): Promise<OracleEcosystem> {
  // Batch sincroni con yield per tenere la UI reattiva su repo grandi (9000 file).
  return new Promise((resolve) => {
    const CHUNK = 400;
    let index = 0;
    let acc: OracleEcosystem | null = null;
    const mergeInto = (target: OracleEcosystem, part: OracleEcosystem): void => {
      target.composites.push(...part.composites);
      target.componentTypes.push(...part.componentTypes);
      target.dvms.push(...part.dvms);
      target.jcaAdapters.push(...part.jcaAdapters);
      target.bpelProcesses.push(...part.bpelProcesses);
      target.bpmnProcesses.push(...part.bpmnProcesses);
      target.mediators.push(...part.mediators);
      target.humanTasks.push(...part.humanTasks);
      target.wsdlContracts.push(...part.wsdlContracts);
      target.xsdSchemas.push(...part.xsdSchemas);
      target.xsltTransforms.push(...part.xsltTransforms);
      target.dataControls.push(...part.dataControls);
      target.scripts.push(...part.scripts);
      target.workspaces.push(...part.workspaces);
      target.projects.push(...part.projects);
      target.osbArtifacts.push(...part.osbArtifacts);
      target.configPlans.push(...part.configPlans);
      target.ednEvents.push(...part.ednEvents);
      target.xrefs.push(...part.xrefs);
      target.faultPolicies.push(...part.faultPolicies);
      target.businessRules.push(...part.businessRules);
      target.nxsdSchemas.push(...part.nxsdSchemas);
      target.securityRefs.push(...part.securityRefs);
      target.rawFiles.push(...part.rawFiles);
      Object.entries(part.fileCountByExtension).forEach(([k, v]) => {
        target.fileCountByExtension[k] = (target.fileCountByExtension[k] || 0) + v;
      });
      target.totalFiles += part.totalFiles;
    };
    const step = (): void => {
      const slice = files.slice(index, index + CHUNK);
      const part = buildOracleEcosystem(slice);
      if (!acc) {
        acc = part;
      } else {
        mergeInto(acc, part);
      }
      index += CHUNK;
      if (index < files.length) {
        setTimeout(step, 0);
      } else {
        if (acc) {
          finalizeBatched(acc);
          acc.analyzedAt = new Date().toISOString();
        }
        resolve(acc ?? buildOracleEcosystem([]));
      }
    };
    step();
  });
}

/**
 * Post-pass globale dopo il merge dei chunk: i singoli chunk non vedono
 * l'intera repo (projectKind, jwsSource, NXSD duplicati, securityRefs).
 */
function finalizeBatched(acc: OracleEcosystem): void {
  const dirOf = (p: string): string => {
    const i = p.replace(/\\/g, '/').lastIndexOf('/');
    return i >= 0 ? p.slice(0, i).toLowerCase() : '';
  };
  const compositeDirs = new Set(acc.composites.map((c) => dirOf(c.relativePath)));
  const osbDirs = new Set(acc.osbArtifacts.map((o) => dirOf(o.relativePath)));
  const adfHints = new Set(
    acc.rawFiles.filter((f) => /\.(jspx|dcx|cpx)$/i.test(f.name)).map((f) => dirOf(f.relativePath))
  );
  acc.projects.forEach((p) => {
    const d = dirOf(p.relativePath);
    const inTree = (dirs: Set<string>): boolean => {
      for (const cd of dirs) {
        if (cd && (d === cd || d.startsWith(cd + '/') || cd.startsWith(d + '/'))) return true;
      }
      return false;
    };
    if (p.projectKind === 'unknown') {
      if (inTree(compositeDirs)) p.projectKind = 'soa';
      else if (inTree(osbDirs)) p.projectKind = 'osb';
      else if (inTree(adfHints)) p.projectKind = 'adf';
    }
    const owner = acc.workspaces.find((w) =>
      w.projects.some((jp) => p.relativePath.toLowerCase().endsWith((jp.toLowerCase().split('/').pop() || jp.toLowerCase())))
    );
    if (owner) p.jwsSource = owner.relativePath;
  });
  // NXSD: ricalcolo globale senza duplicati da chunk
  acc.nxsdSchemas.length = 0;
  acc.xsdSchemas.forEach((x) => {
    if (/nxsd:/i.test(x.rawXml)) {
      const base = `${x.relativePath}::${x.fileName}`.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 64);
      let h = 0;
      const s = `${x.relativePath}${x.fileName}`;
      for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
      acc.nxsdSchemas.push({
        id: `nxsd-${base}-${Math.abs(h).toString(36)}`,
        name: x.name,
        rootElement: x.elements[0]?.name,
        isFixedLength: /fixedlength/i.test(x.rawXml),
        fileName: x.fileName,
        relativePath: x.relativePath,
        rawXml: x.rawXml,
      });
    }
  });
  // Security refs globali, deduplicati
  const seen = new Set(acc.securityRefs.map((r) => `${r.kind}|${r.value}|${r.usedBy}`));
  collectSecurityRefs(acc.composites, acc.jcaAdapters).forEach((r) => {
    const k = `${r.kind}|${r.value}|${r.usedBy}`;
    if (!seen.has(k)) {
      seen.add(k);
      acc.securityRefs.push(r);
    }
  });
}

export function buildEcosystemAsync(files: InputFile[]): Promise<OracleEcosystem> {
  if (!hasDomParser()) {
    return Promise.reject(new Error('DOMParser non disponibile: impossibile parsare XML in questo contesto.'));
  }
  if (files.length < WORKER_THRESHOLD || typeof Worker === 'undefined') {
    return Promise.resolve(buildOracleEcosystem(files));
  }
  // Worker disabilitato per XML finché non usa parser isomorfo (vedi ecosystem.worker.ts):
  // parsing a chunk sul main thread, UI libera grazie allo yield.
  return buildBatched(files);
}
