import { OracleEcosystem } from '../types/jca';
import { findDanglingRefs, findOrphans, buildLineage, findHygiene } from './analysis';
import { buildBpmnGraph, bpmnGraphToMermaid, sanitizeMermaid as mmSafe, mermaidId } from './bpmnFlowGraph';

export type DocsPackage = Record<string, string>;

const sanitizeMd = (val?: string | number | null): string => {
  if (val === undefined || val === null || val === '') return 'N/D';
  return String(val).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
};

const sanitizeMermaid = (val: string): string =>
  val.replace(/["\[\]{}|<>]/g, '_').replace(/[\r\n]+/g, ' ').trim().slice(0, 80);

const csvCell = (val?: string | number | null): string => {
  const s = val === undefined || val === null ? '' : String(val);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const safeName = (val: string): string =>
  (val || 'unnamed').replace(/[^a-zA-Z0-9-_]+/g, '_').slice(0, 80) || 'unnamed';

/** Suffisso stabile dal path per evitare sovrascritture tra omonimi (117 composite.xml). */
const hash8 = (s: string): string => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
};

/** Nome file ZIP unico: nome leggibile + hash del relativePath. */
const uniqueDocName = (name: string, relativePath: string): string =>
  `${safeName(name)}--${hash8(relativePath || name)}`;

const pad3 = (n: number): string => String(n + 1).padStart(3, '0');

export function buildDocsPackage(
  ecosystem: OracleEcosystem,
  opts: { language?: 'it' | 'en'; applicationName?: string } = {}
): DocsPackage {
  const isIt = (opts.language || 'it') === 'it';
  const appName = opts.applicationName || 'Oracle SOA Suite & ADF Ecosystem';
  const pkg: DocsPackage = {};
  const date = new Date(ecosystem.analyzedAt || Date.now()).toISOString().slice(0, 10);

  const composites = [...ecosystem.composites].sort((a, b) => a.name.localeCompare(b.name));
  const projects = [...(ecosystem.projects || [])].sort((a, b) => a.name.localeCompare(b.name));
  const workspaces = [...(ecosystem.workspaces || [])].sort((a, b) => a.name.localeCompare(b.name));
  const osbList = [...(ecosystem.osbArtifacts || [])].sort((a, b) => a.name.localeCompare(b.name));
  const edns = [...(ecosystem.ednEvents || [])].sort((a, b) => a.name.localeCompare(b.name));
  const xrefList = [...(ecosystem.xrefs || [])].sort((a, b) => a.name.localeCompare(b.name));
  const fps = [...(ecosystem.faultPolicies || [])].sort((a, b) => a.name.localeCompare(b.name));
  const rulesList = [...(ecosystem.businessRules || [])].sort((a, b) => a.name.localeCompare(b.name));
  const secRefs = [...(ecosystem.securityRefs || [])];
  const nxsdList = [...(ecosystem.nxsdSchemas || [])].sort((a, b) => a.name.localeCompare(b.name));
  // Fase 6: ConfigPlan raggruppati per ambiente
  const plans = [...(ecosystem.configPlans || [])].sort((a, b) => a.env.localeCompare(b.env));
  const planEnvs = [...new Set(plans.map((p) => p.env))].sort();
  const envs = planEnvs.length ? planEnvs : ['DEV', 'TEST', 'PROD'];
  const bpels = [...ecosystem.bpelProcesses].sort((a, b) => a.name.localeCompare(b.name));
  const bpmns = [...ecosystem.bpmnProcesses].sort((a, b) => a.name.localeCompare(b.name));
  const mediators = [...ecosystem.mediators].sort((a, b) => a.name.localeCompare(b.name));
  const jcas = [...ecosystem.jcaAdapters].sort((a, b) => a.name.localeCompare(b.name));
  const wsdls = [...ecosystem.wsdlContracts].sort((a, b) => a.name.localeCompare(b.name));
  const xsds = [...ecosystem.xsdSchemas].sort((a, b) => a.name.localeCompare(b.name));
  const dvms = [...(ecosystem.dvms || [])].sort((a, b) => a.name.localeCompare(b.name));

  // ---- derived interfaces: inbound = composite.services, outbound = composite.references ----
  interface IfRow {
    id: string;
    name: string;
    direction: string;
    protocol: string;
    producer: string;
    consumer: string;
    composite: string;
    path: string;
  }
  const ifRows: IfRow[] = [];
  let ifCounter = 0;
  composites.forEach((c) => {
    c.services.forEach((s) => {
      ifCounter += 1;
      ifRows.push({
        id: `IF-${pad3(ifCounter - 1)}`,
        name: s.name,
        direction: 'inbound',
        protocol: s.bindingType || 'SOAP',
        producer: 'external',
        consumer: c.name,
        composite: c.name,
        path: c.relativePath || c.fileName,
      });
    });
    c.references.forEach((r) => {
      ifCounter += 1;
      ifRows.push({
        id: `IF-${pad3(ifCounter - 1)}`,
        name: r.name,
        direction: 'outbound',
        protocol: r.bindingType || 'SOAP',
        producer: c.name,
        consumer: r.name,
        composite: c.name,
        path: c.relativePath || c.fileName,
      });
    });
  });

  const openQuestions: string[] = [];
  jcas.forEach((j) => {
    if (j.validationWarnings?.length) openQuestions.push(`Q-JCA-${safeName(j.name)} | ${j.validationWarnings.length} warning su ${j.relativePath}`);
    j.endpoints.forEach((e) => {
      if (e.portType === 'UnknownPort' || e.operation === 'UnknownOperation')
        openQuestions.push(`Q-JCA-${safeName(j.name)} | endpoint senza portType/operation in ${j.relativePath}`);
    });
  });
  composites.forEach((c) => {
    if (!c.services.length) openQuestions.push(`Q-COMP-${safeName(c.name)} | nessun service inbound dichiarato in ${c.relativePath}`);
  });
  projects.forEach((p) => {
    if (p.projectKind === 'unknown') openQuestions.push(`Q-PRJ-${safeName(p.name)} | tipo progetto non classificabile in ${p.relativePath} (verificare .jpr)`);
  });
  if (!workspaces.length && (composites.length || projects.length)) openQuestions.push('Q-WS-001 | nessun workspace .jws: confini applicativi da confermare manualmente');

  // ================= README =================
  pkg['README.md'] = `# ${sanitizeMd(appName)}\n\n${isIt ? 'Documentazione docs-as-code generata in modo deterministico e offline.' : 'Deterministic offline docs-as-code documentation.'}\n\n- ${isIt ? 'Indice' : 'Index'}: \`docs/00-INDEX.md\`\n- ${isIt ? 'Architettura' : 'Architecture'}: \`docs/technical/architecture.md\`\n- ${isIt ? 'Inventario composite' : 'Composites inventory'}: \`docs/technical/soa-inventory.md\`\n- ${isIt ? 'Catalogo interfacce' : 'Interfaces catalog'}: \`docs/technical/integration-catalog.md\`\n- Runbook: \`docs/operations/runbook.md\`\n\n## ${isIt ? 'Stato reverse engineering' : 'Reverse engineering status'} (${date})\n\n- Workspace: ${workspaces.length} | Progetti: ${projects.length} (SOA ${projects.filter((p) => p.projectKind === 'soa').length} / OSB ${projects.filter((p) => p.projectKind === 'osb').length} / ADF ${projects.filter((p) => p.projectKind === 'adf').length})\n- Composite: ${composites.length} | OSB: ${osbList.length}\n- EDN: ${edns.length} | XREF: ${xrefList.length} | Fault: ${fps.length} | Rules: ${rulesList.length}\n- Adapter JCA: ${jcas.length}\n- BPEL: ${bpels.length} | Mediator: ${mediators.length}\n- WSDL: ${wsdls.length} | XSD: ${xsds.length} | DVM: ${dvms.length}\n- Interfacce derivate: ${ifRows.length}\n- Open questions: ${openQuestions.length}\n`;

  pkg['CHANGELOG.md'] = `# Changelog\n\n## ${date}\n\n- Generazione iniziale docs-as-code a strati (Markdown + Mermaid + CSV/YAML).\n- Nessun binario, nessun Word come fonte primaria.\n`;

  // ================= docs root =================
  pkg['docs/00-INDEX.md'] = `# ${isIt ? 'Indice documentazione' : 'Documentation index'}\n\n## Generale\n- Executive summary: \`01-EXECUTIVE-SUMMARY.md\`\n- Glossario: \`02-GLOSSARY.md\`\n- Mappa repository: \`03-REPOSITORY-MAP.md\`\n- Log reverse engineering: \`04-REVERSE-ENGINEERING-LOG.md\`\n\n## Funzionale\n- \`functional/business-capabilities.md\`\n- \`functional/end-to-end-flows.md\`\n- \`functional/functional-map.md\`\n\n## Tecnico\n- \`technical/architecture.md\`\n- \`technical/soa-inventory.md\`\n- \`technical/integration-catalog.md\`\n- \`technical/composites/INDEX.md\`\n- \`technical/interfaces/INDEX.md\`\n- \`technical/bpel/INDEX.md\`\n- \`technical/bpmn/INDEX.md\`\n- \`technical/mediator/INDEX.md\`\n\n## Operations / Decisions / Inventory / Reverse\n- \`operations/runbook.md\`, \`operations/troubleshooting.md\`\n- \`decisions/adr-0001-docs-as-code.md\`\n- \`inventory/composites.csv\`, \`inventory/interfaces.csv\`, \`inventory/endpoints.yaml\`, \`inventory/traceability-matrix.csv\`\n- \`inventory/projects.csv\`, \`inventory/osb.csv\`, \`inventory/events.csv\`, \`inventory/xref.csv\`, \`inventory/faults.csv\`, \`inventory/integrity.csv\`, \`inventory/lineage.csv\`\n- \`inventory/services.csv\`, \`inventory/dvm-lookups.csv\`, \`inventory/configplans.csv\`\n- \`technical/adapters/adapters.md\`, \`technical/data/schemas.md\`, \`technical/data/dvm-lookup.md\`, \`technical/data/translations.md\`, \`technical/data/dictionary.md\`, \`technical/deployment-order.md\`\n- \`technical/policies/fault-policies.md\`, \`technical/policies/security-policies.md\`\n- \`technical/environments.md\`, \`technical/deployment.md\`, \`technical/security.md\`, \`technical/monitoring.md\`, \`technical/fault-handling.md\`\n- \`technical/events.md\`, \`technical/rules.md\`\n- \`diagrams/architecture.mmd\`, \`diagrams/integration-landscape.mmd\`\n- \`reverse/coverage.md\`\n- \`reverse/open-questions.md\`, \`reverse/assumptions.md\`, \`reverse/findings.md\`, \`reverse/risks.md\`\n`;

  pkg['docs/01-EXECUTIVE-SUMMARY.md'] = `# Executive summary (${date})\n\n${isIt ? `Sistema enterprise basato su Oracle SOA Suite (SCA) e ADF. Analizzati ${ecosystem.totalFiles} file: ${composites.length} composite, ${jcas.length} adapter JCA, ${bpels.length} BPEL, ${mediators.length} mediator, ${wsdls.length} WSDL, ${xsds.length} XSD.` : `Enterprise system on Oracle SOA Suite (SCA) and ADF. Analyzed ${ecosystem.totalFiles} files.`}\n\n| Layer | ${isIt ? 'Conteggio' : 'Count'} |\n|---|---|\n| Workspace / Progetti | ${workspaces.length} / ${projects.length} |\n| SCA Composites | ${composites.length} |\n| OSB (proxy/business/pipeline) | ${osbList.length} |\n| JCA Adapters | ${jcas.length} |\n| BPEL / Mediator | ${bpels.length} / ${mediators.length} |\n| WSDL / XSD | ${wsdls.length} / ${xsds.length} |\n| DVM | ${dvms.length} |\n| EDN / XREF / Fault / Rules | ${edns.length} / ${xrefList.length} / ${fps.length} / ${rulesList.length} |\n`;

  pkg['docs/02-GLOSSARY.md'] = `# ${isIt ? 'Glossario' : 'Glossary'}\n\n| ${isIt ? 'Termine' : 'Term'} | ${isIt ? 'Significato' : 'Meaning'} |\n|---|---|\n| Composite | Unità di deployment SCA (composite.xml) |\n| BPEL | Orchestrazione di servizi |\n| Mediator | Routing / mediazione messaggi + transform XSLT |\n| JCA | Resource adapter (DB, JMS, File, FTP, AQ) |\n| WSDL / XSD | Contratto servizio / schema dati |\n| DVM | Domain Value Map, mapping cross-reference |\n| JNDI | Nome logico connection factory (es. eis/DB/...) |\n`;

  pkg['docs/03-REPOSITORY-MAP.md'] = `# Repository map\n\n## Workspace e progetti (Fase 1)\n\n${workspaces.map((w) => `- **${sanitizeMd(w.name)}** — \`${sanitizeMd(w.relativePath)}\` (${w.projects.length} progetti)`).join('\n') || '- Nessun workspace .jws rilevato (confini applicativi da confermare)'}\n\n| Progetto | Tipo | Tech scope | Classpath libs | Deployment profiles | Path |\n|---|---|---|---|---|---|\n${projects.map((p) => `| ${sanitizeMd(p.name)} | ${p.projectKind} | ${(p.technologyScope.map(sanitizeMd).join(', ') || 'N/D')} | ${(p.classpathLibs.map(sanitizeMd).slice(0, 5).join(', ') || 'N/D')} | ${(p.deploymentProfiles.map(sanitizeMd).join(', ') || 'N/D')} | \`${sanitizeMd(p.relativePath)}\` |`).join('\n') || '| N/D | N/D | N/D | N/D | N/D | N/D |'}\n\n## Distribuzione estensioni\n\n| ${isIt ? 'Estensione' : 'Extension'} | ${isIt ? 'Quantità' : 'Count'} |\n|---|---|\n${Object.entries(ecosystem.fileCountByExtension).sort((a, b) => b[1] - a[1]).map(([ext, n]) => `| \`${sanitizeMd(ext)}\` | ${n} |`).join('\n')}\n`;

  pkg['docs/04-REVERSE-ENGINEERING-LOG.md'] = `# Reverse engineering log (${date})\n\n## Fase 1 — inventario rapido\n- [x] soa-inventory + integration-catalog + open-questions\n\n## Fase 2 — dettaglio per composite\n- [x] un file per composite in \`technical/composites/\`\n\n## Fase 3 — collegare tecnico al business\n- [ ] validare end-to-end flows con owner di dominio\n\n## Fase 4 — operativo\n- [ ] runbook / troubleshooting validati in ambiente TEST\n`;

  // ================= functional =================
  pkg['docs/functional/functional-map.md'] = `# Functional map\n\n| Capability | Composite | ${isIt ? 'Stato' : 'Status'} |\n|---|---|---|\n${composites.map((c) => `| ${sanitizeMd(c.name)} | \`${sanitizeMd(c.name)}\` | da-validare |`).join('\n') || '| N/D | N/D | N/D |'}\n`;
  pkg['docs/functional/business-capabilities.md'] = `# Business capabilities\n\n${isIt ? 'Capacità business supportate dai composite censiti. Dettaglio per use case in attesa di validazione funzionale.' : 'Business capabilities supported by inventoried composites.'}\n\n${composites.map((c) => `- **${sanitizeMd(c.name)}** — \`${sanitizeMd(c.relativePath || c.fileName)}\``).join('\n')}\n`;
  pkg['docs/functional/end-to-end-flows.md'] = `# End-to-end flows\n\n\`\`\`mermaid\nflowchart LR\n  EXT["external"]\n${composites.slice(0, 12).map((c, i) => `  ${mermaidId('E', i)}["${mmSafe(c.name)}"]\n  EXT --> ${mermaidId('E', i)}`).join('\n') || '  EXT["external"] --> SYS["system"]'}\n\`\`\`\n\n| Flow | Entry (inbound) | Outbound |\n|---|---|---|\n${composites.map((c) => `| END-${safeName(c.name)} | ${(c.services.map((s) => sanitizeMd(s.name)).join(', ') || 'N/D')} | ${(c.references.map((r) => sanitizeMd(r.name)).join(', ') || 'N/D')} |`).join('\n')}\n`;

  // ================= technical =================
  pkg['docs/technical/architecture.md'] = `# Architecture\n\n\`\`\`mermaid\nflowchart TB\n  subgraph SOA[SOA Suite - SCA]\n${composites.slice(0, 15).map((c, i) => `    ${mermaidId('S', i)}["${mmSafe(c.name)}"]`).join('\n')}\n  end\n  subgraph ADAPTERS[JCA]\n${jcas.slice(0, 10).map((j, i) => `    ${mermaidId('A', i)}["${mmSafe(j.name)}"]`).join('\n')}\n  end\n\`\`\`\n\n- Partition / revision: vedi schede composite.\n- Deployment plan e property per ambiente: vedi \`deployment.md\` + \`environments.md\`.\n`;
  pkg['docs/technical/soa-inventory.md'] = `# SOA inventory\n\n| ID | Composite | Path | ${isIt ? 'Servizi esposti' : 'Exposed'} | ${isIt ? 'Riferimenti' : 'References'} | Componenti |\n|---|---|---|---|---|---|\n${composites.map((c, i) => `| COMP-${pad3(i)} | ${sanitizeMd(c.name)} | \`${sanitizeMd(c.relativePath || c.fileName)}\` | ${(c.services.map((s) => sanitizeMd(s.name)).join('<br/>') || 'N/D')} | ${(c.references.map((r) => sanitizeMd(r.name)).join('<br/>') || 'N/D')} | ${(c.components.map((x) => sanitizeMd(`${x.name} [${x.type}]`)).join('<br/>') || 'N/D')} |`).join('\n')}\n\n## OSB (Service Bus)\n\n| ID | Nome | Tipo | Endpoint | Path |\n|---|---|---|---|---|\n${osbList.map((o, i) => `| OSB-${pad3(i)} | ${sanitizeMd(o.name)} | ${o.kind} | \`${sanitizeMd(o.endpointUri || 'N/D')}\` | \`${sanitizeMd(o.relativePath || o.fileName)}\` |`).join('\n') || '| N/D | nessun artefatto OSB rilevato | - | - | - |'}\n`;
  pkg['docs/technical/integration-catalog.md'] = `# Integration catalog\n\n| ID | Nome | Direzione | Protocollo | Producer | Consumer |\n|---|---|---|---|---|---|\n${ifRows.map((r) => `| ${r.id} | ${sanitizeMd(r.name)} | ${r.direction} | ${sanitizeMd(r.protocol)} | ${sanitizeMd(r.producer)} | ${sanitizeMd(r.consumer)} |`).join('\n') || '| N/D | N/D | N/D | N/D | N/D | N/D |'}\n`;
  pkg['docs/technical/environments.md'] = `# Environments\n\n| Ambiente | Note |\n|---|---|\n| DEV | Endpoint e JNDI da deployment plan |\n| TEST | Allineato a DEV, dati di test |\n| PROD | Credential store, policy OWSM attive |\n\n> Dettaglio endpoint per ambiente: \`inventory/endpoints.yaml\`.\n`;
  pkg['docs/technical/deployment.md'] = `# Deployment\n\n1. Build composite (SAR).\n2. Validare deployment plan.\n3. Deploy su SOA Suite.\n4. Verificare stato composite + test endpoint.\n\nParametri variabili per ambiente: vedi \`inventory/endpoints.yaml\`.\n\n## ConfigPlan rilevati (${plans.length})\n\n| Plan | Composite | Env | Override |\n|---|---|---|---|\n${plans.map((p) => `| \`${sanitizeMd(p.relativePath || p.fileName)}\` | ${sanitizeMd(p.compositeName)} | ${p.env} | ${p.replacements.length} searchReplace |`).join('\n') || '| N/D | nessun ConfigPlan: gli override ambiente vanno confermati manualmente | - | - |'}\n`;
  pkg['docs/technical/security.md'] = `# Security\n\n> Non documentare mai password o segreti. Solo alias, scopo, owner.\n\n| Alias / Policy | Uso | Owner |\n|---|---|---|\n| CSF alias (da mappare) | Accesso endpoint esterni | Integration Team |\n`;
  pkg['docs/technical/monitoring.md'] = `# Monitoring\n\n- Enterprise Manager: stato composite, fault instances, audit trail.\n- Alert su fault ripetuti / code bloccate.\n`;
  pkg['docs/technical/fault-handling.md'] = `# Fault handling\n\n| Fault | Azione |\n|---|---|\n| RemoteServiceTimeout | Verificare endpoint + retry da fault policy |\n| BindingFault | Controllare deployment plan |\n| SecurityPolicyViolation | Verificare CSF / keystore |\n`;

  const compositeDocName = (c: { name: string; relativePath: string }): string =>
    uniqueDocName(c.name, c.relativePath);
  pkg['docs/technical/composites/INDEX.md'] = `# Composites index\n\n${composites.map((c, i) => `- [COMP-${pad3(i)} ${sanitizeMd(c.name)}](./${compositeDocName(c)}.md) — \`${sanitizeMd(c.relativePath || c.fileName)}\``).join('\n')}\n`;
  composites.forEach((c, i) => {
    const id = `COMP-${pad3(i)}`;
    pkg[`docs/technical/composites/${compositeDocName(c)}.md`] =
      `---\nid: ${id}\nname: ${sanitizeMd(c.name)}\ntype: soa-composite\nstatus: reverse-engineering-in-progress\nsource_path: ${sanitizeMd(c.relativePath || c.fileName)}\nlast_reviewed: ${date}\n---\n\n# ${sanitizeMd(c.name)}\n\n## 1. Percorso repository\n\`${sanitizeMd(c.relativePath || c.fileName)}\` (rev ${sanitizeMd(c.revision || 'N/D')}, ns \`${sanitizeMd(c.targetNamespace || 'N/D')}\`)\n\n## 2. Componenti interni\n${c.components.map((x) => `- ${sanitizeMd(x.name)} [${sanitizeMd(x.type)}]`).join('\n') || '- N/D'}\n\n## 3. Servizi esposti\n${c.services.map((s) => `- \`${sanitizeMd(s.name)}\` (${sanitizeMd(s.bindingType || 'N/D')})`).join('\n') || '- N/D'}\n\n## 4. Riferimenti / servizi consumati\n${c.references.map((r) => `- \`${sanitizeMd(r.name)}\` (${sanitizeMd(r.bindingType || 'N/D')})`).join('\n') || '- N/D'}\n\n## 5. Adapter / DVM / mapping\n- Vedi \`../adapters/adapters.md\`, \`../data/dvm-lookup.md\`, \`inventory/traceability-matrix.csv\`.\n\n## 5a. Flusso interno (wire service → component → reference)\n\n\`\`\`mermaid\nflowchart LR\n${(() => {
      const names: string[] = [];
      const push = (n: string): string => {
        if (!names.includes(n)) names.push(n);
        return mermaidId('W', names.indexOf(n));
      };
      const decl = (n: string): string => `  ${push(n)}["${mmSafe(n)}"]`;
      if (c.wires.length) {
        const seen = new Set<string>();
        c.wires.forEach((w) => { seen.add(w.source); seen.add(w.target); });
        const d = [...seen].map(decl).join('\n');
        const e = c.wires.map((w) => `  ${push(w.source)} --> ${push(w.target)}`).join('\n');
        return `${d}\n${e}`;
      }
      const ins = c.services.map((s) => s.name);
      const outs = c.references.map((r) => r.name);
      if (!ins.length && !outs.length) return '  N0["nessun flusso"]';
      const d = [c.name, ...ins, ...outs].map(decl).join('\n');
      const e = [...ins.map((s) => `  ${push(s)} --> ${push(c.name)}`), ...outs.map((r) => `  ${push(c.name)} --> ${push(r)}`)].join('\n');
      return `${d}\n${e}`;
    })()}\n\`\`\`\n\n## 5b. Import e repository MDS\n${((c.imports || []).map((imp) => `- \`${sanitizeMd(imp.location || imp.namespace || 'N/D')}\` (${sanitizeMd(imp.importType || 'N/D')})${imp.isMds ? ' — **MDS condiviso**' : ''}`).join('\n') || '- Nessun import rilevato (WSDL/XSD locali o non dichiarati)')}\n\n## 6. Punti aperti\n- Verificare policy sicurezza endpoint.\n- Verificare transform XSLT effettivamente usate.\n`;
  });

  pkg['docs/technical/interfaces/INDEX.md'] = `# Interfaces index\n\n${ifRows.map((r) => `- [${r.id} ${sanitizeMd(r.name)}](./${r.id}-${safeName(r.name)}.md)`).join('\n')}\n`;
  ifRows.forEach((r) => {
    pkg[`docs/technical/interfaces/${r.id}-${safeName(r.name)}.md`] =
      `---\ninterface_id: ${r.id}\nname: ${sanitizeMd(r.name)}\ndirection: ${r.direction}\nprotocol: ${sanitizeMd(r.protocol)}\nproducer: ${sanitizeMd(r.producer)}\nconsumer: ${sanitizeMd(r.consumer)}\nstatus: inventoried\n---\n\n# ${r.id} - ${sanitizeMd(r.name)}\n\n## Direzione\n${r.direction}\n\n## Protocollo\n${sanitizeMd(r.protocol)}\n\n## Composite\n${sanitizeMd(r.composite)} — \`${sanitizeMd(r.path)}\`\n\n## WSDL / XSD\nVedi \`inventory/services.csv\` e schede WSDL/XSD.\n\n## Punti aperti\n- Verificare autenticazione in PROD.\n- Verificare obbligatorietà campi chiave.\n`;
  });

  pkg['docs/technical/bpel/INDEX.md'] = `# BPEL index\n\n${bpels.map((p, i) => `- [BPEL-${pad3(i)} ${sanitizeMd(p.name)}](./BPEL-${pad3(i)}-${safeName(p.name)}.md)`).join('\n')}\n`;
  bpels.forEach((p, i) => {
    pkg[`docs/technical/bpel/BPEL-${pad3(i)}-${safeName(p.name)}.md`] =
      `# BPEL-${pad3(i)} - ${sanitizeMd(p.name)}\n\n- File: \`${sanitizeMd(p.relativePath || p.fileName)}\`\n- Partner links: ${(p.partnerLinks.map((x) => sanitizeMd(x.name)).join(', ') || 'N/D')}\n- Invokes: ${(p.invokes.map((x) => sanitizeMd(`${x.partnerLink}.${x.operation}`)).join(', ') || 'N/D')}\n- Receives: ${(p.receives.map((x) => sanitizeMd(`${x.partnerLink}.${x.operation}`)).join(', ') || 'N/D')}\n- Replies: ${((p.replies || []).map((x) => sanitizeMd(`${x.partnerLink}.${x.operation}`)).join(', ') || 'N/D')}\n- Fault handlers: ${(p.faultHandlers.join(', ') || 'N/D')}\n\n## Sequenza attività (ordine documento)\n${(p.activitySequence.map((a, k) => `${k + 1}. ${sanitizeMd(a)}`).join('\n') || '- N/D')}\n\n## Assign / manipolazioni dati\n${((p.assigns || []).map((a) => `- ${sanitizeMd(a.name || 'assign')}: to [${a.toVariables.map(sanitizeMd).join(', ') || '-'}] from [${a.fromXPaths.map(sanitizeMd).join(' | ') || '-'}]`).join('\n') || '- Nessun assign rilevato')}\n\n## Controllo e rami\n${((p.controlFlow || []).map((c) => `- ${c.kind}${c.name ? ` (${sanitizeMd(c.name)})` : ''}${c.condition ? `: ${sanitizeMd(c.condition)}` : ''}`).join('\n') || '- Nessun blocco condizionale/ciclo rilevato')}\n`;
  });

  // BPMN per-processo: nodi + archi sequenceFlow + Mermaid (stesso albero, file aggiunti)
  pkg['docs/technical/bpmn/INDEX.md'] = `# BPMN index\n\n${bpmns.map((b, i) => `- [BPMN-${pad3(i)} ${sanitizeMd(b.name)}](./BPMN-${pad3(i)}-${uniqueDocName(b.name, b.relativePath)}.md) — \`${sanitizeMd(b.relativePath || b.fileName)}\``).join('\n')}\n`;
  bpmns.forEach((b, i) => {
    const g = buildBpmnGraph(b, ecosystem);
    const docName = `BPMN-${pad3(i)}-${uniqueDocName(b.name, b.relativePath)}`;
    pkg[`docs/technical/bpmn/${docName}.md`] =
      `# BPMN-${pad3(i)} - ${sanitizeMd(b.name)}${g.syntheticOrder ? ' (ordine sintetico)' : ''}\n\n- File: \`${sanitizeMd(b.relativePath || b.fileName)}\`\n- Swimlanes: ${(b.swimlanes.map(sanitizeMd).join(', ') || 'N/D')}\n- User tasks: **${b.userTasks.length}** | Service tasks: **${b.serviceTasks.length}** | Gateways: **${b.gateways.length}** | Eventi: **${b.events.length}** | Archi: **${b.flows.length}**\n${g.warnings.length ? `\n> Avvisi: ${g.warnings.map(sanitizeMd).join(' | ')}\n` : ''}\n## Nodi\n${g.nodes.map((n) => `- **${sanitizeMd(n.label)}** [\`${n.kind}\`${n.lane ? `, lane ${sanitizeMd(n.lane)}` : ''}] id \`${sanitizeMd(n.id)}\`${n.detail ? ` — ${sanitizeMd(n.detail)}` : ''}${n.links.length ? ` → ${n.links.map((l) => `${l.kind}:${sanitizeMd(l.label)}`).join(', ')}` : ''}`).join('\n') || '- N/D'}\n\n## Archi (sequenceFlow)\n${(b.flows.map((f) => `- \`${sanitizeMd(f.sourceRef)}\` → \`${sanitizeMd(f.targetRef)}\`${f.condition ? ` — condizione: ${sanitizeMd(f.condition)}` : ''}`).join('\n') || '- Nessun sequenceFlow: ordine sintetico da ordine documento')}\n\n## Diagramma\n\n\`\`\`mermaid\n${bpmnGraphToMermaid(b.name, g)}\n\`\`\`\n`;
    pkg[`docs/diagrams/flows/${docName}.mmd`] = bpmnGraphToMermaid(b.name, g);
  });

  pkg['docs/technical/mediator/INDEX.md'] = `# Mediator index\n\n${mediators.map((m, i) => `- [MED-${pad3(i)} ${sanitizeMd(m.name)}](./MED-${pad3(i)}-${safeName(m.name)}.md)`).join('\n')}\n`;
  mediators.forEach((m, i) => {
    const rules = m.operations.flatMap((o) => o.routingRules.map((rr, k) => `- ${sanitizeMd(o.name)} #${k + 1}: ${sanitizeMd(rr.actionType)} -> ${sanitizeMd(rr.targetService || 'self')} xslt:${sanitizeMd(rr.transformations.join(',') || 'none')}`)).join('\n');
    pkg[`docs/technical/mediator/MED-${pad3(i)}-${safeName(m.name)}.md`] =
      `# MED-${pad3(i)} - ${sanitizeMd(m.name)}\n\n- File: \`${sanitizeMd(m.relativePath || m.fileName)}\`\n\n## Routing rules\n${rules || '- N/D'}\n`;
  });

  pkg['docs/technical/adapters/adapters.md'] = `# Adapter inventory\n\n| ID | Adapter | Tipo | JNDI / location | Endpoint |\n|---|---|---|---|---|\n${jcas.map((j, i) => `| ADP-${pad3(i)} | ${sanitizeMd(j.name)} | ${sanitizeMd(j.adapter)} | \`${sanitizeMd(j.connectionFactory?.location || 'N/D')}\` | ${(j.endpoints.map((e) => sanitizeMd(`${e.portType}.${e.operation}`)).join('<br/>') || 'N/D')} |`).join('\n')}\n`;
  pkg['docs/technical/data/schemas.md'] = `# Schemas (XSD)\n\n| Schema | Elementi root (cardinalità) | ComplexTypes | Path |\n|---|---|---|---|\n${xsds.map((x) => `| ${sanitizeMd(x.name)} | ${(x.elements.map((e) => sanitizeMd(e.name) + ((e.minOccurs || e.maxOccurs) ? ` [${e.minOccurs || '1'}..${e.maxOccurs || '1'}]` : '')).slice(0, 3).join(', ') || 'N/D')} | ${x.complexTypes.length} | \`${sanitizeMd(x.relativePath || x.fileName)}\` |`).join('\n')}\n\n# WSDL\n\n| WSDL | PortTypes | Operazioni | Path |\n|---|---|---|---|\n${wsdls.map((w) => `| ${sanitizeMd(w.name)} | ${(w.portTypes.map((p) => sanitizeMd(p.name)).join(', ') || 'N/D')} | ${(w.portTypes.flatMap((p) => p.operations).map((o) => sanitizeMd(o.name)).slice(0, 5).join(', ') || 'N/D')} | \`${sanitizeMd(w.relativePath || w.fileName)}\` |`).join('\n')}\n`;
  pkg['docs/technical/data/dvm-lookup.md'] = `# DVM e Lookup\n\n| ID | Nome | Colonne | Righe | Path |\n|---|---|---|---|---|\n${dvms.map((d, i) => `| DVM-${pad3(i)} | ${sanitizeMd(d.name)} | ${sanitizeMd(d.columns.join(', ') || 'N/D')} | ${d.rowsCount} | \`${sanitizeMd(d.relativePath || d.fileName)}\` |`).join('\n') || '| N/D | N/D | N/D | N/D | N/D |'}\n`;
  pkg['docs/technical/events.md'] = `# EDN Events (event bus)\n\n| Evento | Namespace | Publisher | Subscriber | Path |\n|---|---|---|---|---|\n${edns.map((e) => `| ${sanitizeMd(e.name)} | ${sanitizeMd(e.namespace || 'N/D')} | ${(e.publishers.map(sanitizeMd).join(', ') || 'N/D')} | ${(e.subscribers.map(sanitizeMd).join(', ') || 'N/D')} | \`${sanitizeMd(e.relativePath || e.fileName)}\` |`).join('\n') || '| N/D | nessun evento EDN rilevato | - | - | - |'}\n`;
  pkg['docs/technical/rules.md'] = `# Business Rules\n\n| Dictionary | Decision functions | Rulesets | Path |\n|---|---|---|---|\n${rulesList.map((r) => `| ${sanitizeMd(r.name)} | ${(r.decisionFunctions.map(sanitizeMd).join(', ') || 'N/D')} | ${(r.rulesets.map(sanitizeMd).join(', ') || 'N/D')} | \`${sanitizeMd(r.relativePath || r.fileName)}\` |`).join('\n') || '| N/D | nessuna regola rilevata | - | - |'}\n`;
  pkg['docs/technical/policies/fault-policies.md'] = `# Fault policies\n\n| Policy file | Fault | Azione | Retry | Binding (composite/component) |\n|---|---|---|---|---|\n${fps.flatMap((f) => f.conditions.length ? f.conditions.map((c) => `| \`${sanitizeMd(f.relativePath || f.fileName)}\` | ${sanitizeMd(c.faultName || '*')} | ${sanitizeMd(c.action || 'N/D')} | ${sanitizeMd(c.retryCount || 'N/D')} | ${(f.bindings.map((b) => sanitizeMd(b.composite || b.component || '')).join(', ') || '-')} |`) : [`| \`${sanitizeMd(f.relativePath || f.fileName)}\` | - | - | - | ${(f.bindings.map((b) => `${sanitizeMd(b.composite || b.component || '')}→${sanitizeMd(b.policy || '')}`).join(', ') || '-')} |`]).join('\n') || '| N/D | nessuna fault policy rilevata: retry e DLQ da confermare | - | - | - |'}\n\n- DLQ / error queue: vedi schede adapter JMS/AQ.\n`;
  pkg['docs/technical/policies/security-policies.md'] = `# Security policies\n\n> Mai password o segreti: solo policy URI e alias CSF.\n\n| Tipo | Valore | Usato da |\n|---|---|---|\n${secRefs.map((s) => `| ${s.kind} | \`${sanitizeMd(s.value)}\` | ${sanitizeMd(s.usedBy)} |`).join('\n') || '| - | nessuna policy OWSM o alias CSF rilevato: verificare in PROD | - |'}\n`;
  pkg['docs/technical/data/translations.md'] = `# XREF e traduzioni formato nativo (NXSD)\n\n## XREF (cross-reference)\n\n| Nome | Tabella | Colonne | Path |\n|---|---|---|---|\n${xrefList.map((x) => `| ${sanitizeMd(x.name)} | ${sanitizeMd(x.tableName || 'N/D')} | ${sanitizeMd(x.columns.join(', ') || 'N/D')} | \`${sanitizeMd(x.relativePath || x.fileName)}\` |`).join('\n') || '| N/D | nessuna XREF rilevata | - | - |'}\n\n## NXSD (File/FTP non-XML)\n\n| Schema | Root | Fixed-length | Path |\n|---|---|---|---|\n${nxsdList.map((n) => `| ${sanitizeMd(n.name)} | ${sanitizeMd(n.rootElement || 'N/D')} | ${n.isFixedLength ? 'sì' : 'no'} | \`${sanitizeMd(n.relativePath || n.fileName)}\` |`).join('\n') || '| N/D | nessun XSD con annotazioni nxsd: rilevato | - | - |'}\n`;

  // ================= operations / decisions / diagrams =================
  pkg['docs/operations/runbook.md'] = `# Runbook\n\n## Verifica stato composite (EM)\n- composite deployed, fault instances, audit trail.\n\n| Fault | Causa | Azione |\n|---|---|---|\n| RemoteServiceTimeout | Sistema esterno lento | Retry + verifica endpoint |\n| BindingFault | Endpoint errato | Deployment plan |\n| SecurityPolicyViolation | Credenziali | CSF / keystore |\n`;
  pkg['docs/operations/troubleshooting.md'] = `# Troubleshooting\n\n- Audit trail attivo sui composite critici.\n- Correlare fault con traceability-matrix per impatto business.\n`;
  pkg['docs/decisions/adr-0001-docs-as-code.md'] = `# ADR-0001 — docs-as-code\n\n- Formato: Markdown + Mermaid/PlantUML + CSV/YAML.\n- Export secondari (PDF/HTML) non primari. Niente Word come fonte.\n- Versionata insieme al codice.\n`;
  // ID indicizzati (C0/I0): i nomi reali con spazi/punti non sono ID Mermaid validi.
  pkg['docs/diagrams/architecture.mmd'] =
    `flowchart TB\n${composites.slice(0, 20).map((c, i) => `  ${mermaidId('C', i)}["${mmSafe(c.name)}"]`).join('\n')}\n`;
  pkg['docs/diagrams/integration-landscape.mmd'] = (() => {
    const names: string[] = [];
    ifRows.slice(0, 30).forEach((r) => {
      if (!names.includes(r.producer)) names.push(r.producer);
      if (!names.includes(r.consumer)) names.push(r.consumer);
    });
    const idOf = (n: string): string => mermaidId('I', names.indexOf(n));
    const decl = names.map((n) => `  ${idOf(n)}["${mmSafe(n)}"]`).join('\n');
    const edges = ifRows.slice(0, 30).map((r) => `  ${idOf(r.producer)} --> ${idOf(r.consumer)}`).join('\n');
    return `flowchart LR\n${decl}${decl ? '\n' : ''}${edges || '  EXT["external"] --> SYS["system"]'}\n`;
  })();

  // ================= inventory =================
  pkg['docs/inventory/composites.csv'] =
    `composite_id,composite_name,path,revision,services,references\n` +
    composites.map((c, i) => [`COMP-${pad3(i)}`, c.name, c.relativePath || c.fileName, c.revision || '', c.services.map((s) => s.name).join(';'), c.references.map((r) => r.name).join(';')].map(csvCell).join(',')).join('\n');
  pkg['docs/inventory/interfaces.csv'] =
    `interface_id,name,direction,protocol,producer,consumer,composite\n` +
    ifRows.map((r) => [r.id, r.name, r.direction, r.protocol, r.producer, r.consumer, r.composite].map(csvCell).join(',')).join('\n');
  pkg['docs/inventory/services.csv'] =
    `service_id,service_name,composite,binding,wsdl_path\n` +
    composites.flatMap((c, i) => c.services.map((s, k) => [`SVC-${pad3(i)}-${k + 1}`, s.name, c.name, s.bindingType || '', c.relativePath || c.fileName].map(csvCell).join(','))).join('\n');
  pkg['docs/inventory/dvm-lookups.csv'] =
    `dvm_id,name,columns,rows,path\n` +
    dvms.map((d, i) => [`DVM-${pad3(i)}`, d.name, d.columns.join(';'), String(d.rowsCount), d.relativePath || d.fileName].map(csvCell).join(',')).join('\n');
  pkg['docs/inventory/projects.csv'] =
    `project_id,project_name,kind,tech_scope,classpath_libs,deployment_profiles,workspace,path\n` +
    projects.map((p, i) => [`PRJ-${pad3(i)}`, p.name, p.projectKind, p.technologyScope.join(';'), p.classpathLibs.join(';'), p.deploymentProfiles.join(';'), p.jwsSource || '', p.relativePath || p.fileName].map(csvCell).join(',')).join('\n');
  pkg['docs/inventory/osb.csv'] =
    `osb_id,name,kind,endpoint_uri,service_type,path\n` +
    osbList.map((o, i) => [`OSB-${pad3(i)}`, o.name, o.kind, o.endpointUri || '', o.serviceType || '', o.relativePath || o.fileName].map(csvCell).join(',')).join('\n');
  pkg['docs/inventory/events.csv'] =
    `event_id,name,namespace,publishers,subscribers,path\n` +
    edns.map((e, i) => [`EVT-${pad3(i)}`, e.name, e.namespace || '', e.publishers.join(';'), e.subscribers.join(';'), e.relativePath || e.fileName].map(csvCell).join(',')).join('\n');
  pkg['docs/inventory/xref.csv'] =
    `xref_id,name,table,columns,path\n` +
    xrefList.map((x, i) => [`XRF-${pad3(i)}`, x.name, x.tableName || '', x.columns.join(';'), x.relativePath || x.fileName].map(csvCell).join(',')).join('\n');
  pkg['docs/inventory/faults.csv'] =
    `policy_file,fault,action,retry,binding\n` +
    fps.flatMap((f) => f.conditions.length ? f.conditions.map((c) => [f.relativePath || f.fileName, c.faultName || '*', c.action || '', c.retryCount || '', f.bindings.map((b) => b.composite || b.component || '').join(';')].map(csvCell).join(',')) : [[f.relativePath || f.fileName, '', '', '', f.bindings.map((b) => `${b.composite || b.component || ''}->${b.policy || ''}`).join(';')].map(csvCell).join(',')]).join('\n');
  // Fase 6: applica i ConfigPlan agli endpoint (match ESATTO composite + target).
  // Niente substring fuzzy: su 117 composite "Order" non deve matchare "OrderCancel".
  // Il target vuoto (property/import globali) non valorizza mai un endpoint puntuale.
  const matchReplace = (composite: string, ifName: string, env: string): string | undefined => {
    const cands = plans.filter((p) => p.env === env);
    const compL = composite.toLowerCase();
    const ifL = ifName.toLowerCase();
    for (const p of cands) {
      if (p.compositeName.toLowerCase() !== compL) continue;
      const hit = p.replacements.find((r) => {
        if (!r.replace) return false;
        const t = (r.target || '').toLowerCase();
        if (!t) return false;
        return t === ifL;
      });
      if (hit) return hit.replace;
    }
    return undefined;
  };
  pkg['docs/inventory/endpoints.yaml'] =
    `endpoints:\n` +
    ifRows.map((r) => {
      const overrides = envs.map((e) => `      ${e}:\n        url: ${matchReplace(r.composite, r.name, e) || 'TO_BE_MAPPED'}`).join('\n');
      return `  - id: ${r.id}\n    name: "${r.name.replace(/"/g, "'")}"\n    direction: ${r.direction}\n    protocol: "${r.protocol.replace(/"/g, "'")}"\n    producer: "${r.producer.replace(/"/g, "'")}"\n    consumer: "${r.consumer.replace(/"/g, "'")}"\n    composite: "${r.composite.replace(/"/g, "'")}"\n    environment_overrides:\n${overrides}\n`;
    }).join('');
  pkg['docs/inventory/configplans.csv'] =
    `plan,composite,env,scope,target,attribute,search,replace\n` +
    plans.flatMap((p) => p.replacements.map((r) => [p.relativePath || p.fileName, p.compositeName, p.env, r.scope, r.target, r.attribute || '', r.search, r.replace].map(csvCell).join(','))).join('\n');
  pkg['docs/inventory/traceability-matrix.csv'] =
    `composite_id,composite_name,interface_id,service_name,bpel_mediator,status\n` +
    composites.map((c, i) => {
      const ifs = ifRows.filter((r) => r.composite === c.name);
      if (!ifs.length) return [`COMP-${pad3(i)}`, c.name, '', '', '', 'inventoried'].map(csvCell).join(',');
      return ifs.map((r) => [`COMP-${pad3(i)}`, c.name, r.id, r.name, '', 'inventoried'].map(csvCell).join(',')).join('\n');
    }).join('\n');

  // ================= Fase E: integrity + lineage + igiene =================
  const dangling = findDanglingRefs(ecosystem);
  const orphans = findOrphans(ecosystem);
  const lineage = buildLineage(ecosystem);
  const hygiene = findHygiene(ecosystem);
  dangling.forEach((d) => openQuestions.push(`Q-REF-${safeName(d.from)} | riferimento pendente: ${d.ref} (${d.kind}) citato ma file assente`));
  hygiene.filter((h) => h.kind === 'hardcoded-endpoint').forEach((h) => openQuestions.push(`Q-ENV-${safeName(h.where)} | ${h.detail}`));

  pkg['docs/inventory/integrity.csv'] =
    `check,from,ref,detail\n` +
    [...dangling.map((d) => ['dangling', d.from, d.ref, d.kind].map(csvCell).join(',')),
     ...orphans.map((o) => ['orphan', o.path, '', o.kind].map(csvCell).join(','))].join('\n');
  pkg['docs/inventory/lineage.csv'] =
    `resource_type,resource,artifact,composites\n` +
    lineage.map((l) => [l.resourceType, l.resource, l.artifact, l.composites.join(';')].map(csvCell).join(',')).join('\n');

  // ================= Fase F: coverage, dictionary, deploy order =================
  const extTotal = ecosystem.fileCountByExtension;
  const covGroups: Array<[string, number, string[]]> = [
    ['Workspace/progetti (.jws/.jpr)', workspaces.length + projects.length, ['.jws', '.jpr']],
    ['Composite (.xml descriptor)', composites.length + plans.length + fps.length, ['.xml']],
    ['OSB (.proxy/.biz/.pipeline/.xquery/.xq/.spl)', osbList.length, ['.proxy', '.biz', '.pipeline', '.xquery', '.xq', '.spl']],
    ['JCA (.jca)', jcas.length, ['.jca']],
    ['BPEL / BPMN / Mediator / Task', bpels.length + ecosystem.bpmnProcesses.length + mediators.length + ecosystem.humanTasks.length, ['.bpel', '.bpmn', '.mplan', '.task']],
    ['WSDL / XSD / XSLT', wsdls.length + xsds.length + ecosystem.xsltTransforms.length, ['.wsdl', '.xsd', '.xsl', '.xslt']],
    ['DVM / XREF / EDN / Rules / componentType', dvms.length + xrefList.length + edns.length + rulesList.length + (ecosystem.componentTypes || []).length, ['.dvm', '.xref', '.edn', '.rules', '.componenttype']],
    ['Script/DevOps', ecosystem.scripts.length, ['.sh', '.py', '.sql', '.properties', '.tcl', '.ctl', '.java', '.jspx']],
    ['ADF bindings (.dcx/.cpx)', ecosystem.dataControls.length, ['.dcx', '.cpx']],
  ];
  pkg['docs/reverse/coverage.md'] = `# Coverage report (onestà documentale)\n\n| Gruppo | Artefatti modellati | File totali | Copertura |\n|---|---|---|---|\n${covGroups.map(([label, parsed, exts]) => {
    const total = exts.reduce((s, e) => s + (extTotal[e] || 0), 0);
    const pct = total ? Math.round((Math.min(parsed, total) / total) * 100) : 100;
    return `| ${label} | ${parsed} | ${total} | ${pct}% |`;
  }).join('\n')}\n\n> Il resto (sample payload, binari, file senza estensione) è conteggiato in \`03-REPOSITORY-MAP.md\` ma non modellato: vedi \`inventory/integrity.csv\` per gli orfani.\n`;

  pkg['docs/technical/data/dictionary.md'] = `# Data dictionary (messaggi canonici)\n\n| Elemento | Tipo | Cardinalità | Schema | Usato da (euristica nome) |\n|---|---|---|---|---|\n${xsds.flatMap((x) => x.elements.map((e) => {
    const users = wsdls.flatMap((w) => w.portTypes.flatMap((p) => p.operations)).filter((o) => [o.inputMessage, o.outputMessage].some((m) => (m || '').toLowerCase().includes(e.name.toLowerCase().split('request')[0].split('response')[0] || '§')));
    return `| ${sanitizeMd(e.name)} | ${sanitizeMd(e.type || 'N/D')} | ${e.minOccurs || '1'}..${e.maxOccurs || '1'} | ${sanitizeMd(x.name)} | ${(users.map((u) => sanitizeMd(u.name)).slice(0, 3).join(', ') || 'N/D')} |`;
  })).join('\n') || '| N/D | - | - | - | - |'}\n`;

  // Deploy order: dipendenze composite→composite (reference/service matching + EDN subscriber)
  const compNames = composites.map((c) => c.name.toLowerCase());
  const depOf = (cName: string, refs: string[]): string[] => {
    const out: string[] = [];
    refs.forEach((r) => {
      const rl = r.toLowerCase();
      if (rl.length < 4) return;
      composites.forEach((c) => {
        if (c.name === cName) return;
        const cl = c.name.toLowerCase();
        const svcHit = c.services.some((s) => s.name.toLowerCase() === rl || (rl.length > 5 && (rl.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(rl))));
        if (cl !== rl && (rl.includes(cl) || cl.includes(rl) || svcHit) && !out.includes(c.name)) out.push(c.name);
      });
    });
    return out;
  };
  const depMap = new Map(composites.map((c) => {
    const ednDeps = edns.filter((e) => e.publishers.includes(c.name)).flatMap((e) => e.subscribers)
      .filter((s) => compNames.includes(s.toLowerCase()));
    return [c.name, [...new Set([...depOf(c.name, c.references.map((r) => r.name)), ...ednDeps.filter((s) => s !== c.name)])]];
  }));
  const levels = new Map<string, number>();
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 20) {
    changed = false;
    composites.forEach((c) => {
      const deps = depMap.get(c.name) || [];
      const lvl = deps.length ? Math.max(...deps.map((d) => (levels.get(d) ?? 0))) + (deps.some((d) => !levels.has(d)) ? 0 : 1) : 0;
      if (levels.get(c.name) !== lvl) { levels.set(c.name, lvl); changed = true; }
    });
  }
  pkg['docs/technical/deployment-order.md'] = `# Deployment order (euristica)\n\nLivello 0 = nessuna dipendenza da altre composite. Verificare manualmente prima del deploy.\n\n| Livello | Composite | Dipende da |\n|---|---|---|\n${[...levels.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).map(([n, l]) => `| ${l} | ${sanitizeMd(n)} | ${((depMap.get(n) || []).map(sanitizeMd).join(', ') || '-')} |`).join('\n') || '| - | nessuna composite | - |'}\n`;

  // ================= reverse =================
  pkg['docs/reverse/open-questions.md'] = `# Open questions\n\n| ID | Domanda | Stato |\n|---|---|---|\n${openQuestions.map((q, i) => `| Q-${pad3(i)} | ${sanitizeMd(q)} | aperta |`).join('\n') || '| Q-001 | Verificare owner funzionali e policy PROD | aperta |'}\n`;
  pkg['docs/reverse/assumptions.md'] = `# Assunzioni\n\n| ID | Assunzione | Rischio |\n|---|---|---|\n| A-001 | I namespace e i binding descrivono il dominio reale | medio |\n| A-002 | Gli endpoint TO_BE_MAPPED vanno valorizzati da deployment plan | alto |\n`;
  pkg['docs/reverse/findings.md'] = `# Findings\n\n- Inventario generato deterministicamente da parser SCA/JCA/WSDL/XSD.\n- Nessun segreto analizzato: solo alias e path.\n- Riferimenti pendenti: ${dangling.length} | Orfani: ${orphans.length} | Righe lineage: ${lineage.length}\n\n## Riferimenti pendenti (file citato ma assente)\n${dangling.map((d) => `- \`${sanitizeMd(d.from)}\` → \`${sanitizeMd(d.ref)}\` (${d.kind})`).join('\n') || '- Nessuno'}\n\n## Orfani (mai referenziati, da verificare)\n${orphans.slice(0, 30).map((o) => `- \`${sanitizeMd(o.path)}\` (${o.kind})`).join('\n') || '- Nessuno'}${orphans.length > 30 ? `\n- ... +${orphans.length - 30} altri in inventory/integrity.csv` : ''}\n\n## Igiene\n${hygiene.map((h) => `- [${h.kind}] \`${sanitizeMd(h.where)}\`: ${sanitizeMd(h.detail)}`).join('\n') || '- Nessuna anomalia rilevata'}\n`;
  const secretCount = hygiene.filter((h) => h.kind === 'cleartext-secret').length;
  pkg['docs/reverse/risks.md'] = `# Risks\n\n| ID | Rischio | Mitigazione |\n|---|---|---|\n| R-001 | Endpoint PROD non mappati | Compilare endpoints.yaml da plan.xml |\n| R-002 | DVM non allineati | Confrontare dvm-lookups.csv con MDS |\n| R-003 | ${dangling.length} riferimenti pendenti (doc incompleta a runtime) | Ripristinare i file mancanti o aggiornare i riferimenti |\n${secretCount ? `| R-004 | ${secretCount} possibili segreti in chiaro nel codice | Spostare in credential store, mai nei documenti |\n` : ''}`;

  return pkg;
}
