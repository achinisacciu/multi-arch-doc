import { JCAAdapterConfig, MarkdownGenOptions } from '../types/jca';

export const DEFAULT_DOC_SECTIONS = {
  includeSummary: true,
  includeJndiSpecs: true,
  includeEndpoints: true,
  includeSqlAnalysis: true,
  includePropertiesCatalog: true,
  includeTransactionProfile: true,
  includeMermaid: true,
  includeDevOpsChecklist: true,
  includeRawSnippet: false,
};

/**
 * Escapes characters for clean Markdown table rendering (prevents pipe broken formatting)
 */
function escapeTableMarkdown(str: string): string {
  if (!str) return '';
  return str.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

/**
 * Generates automated, complete technical documentation in Markdown format for a JCA adapter file.
 * Fully deterministic, rule-based, and complete without AI.
 */
export function generateJcaMarkdown(
  config: JCAAdapterConfig,
  options: MarkdownGenOptions = {
    language: 'it',
    sections: DEFAULT_DOC_SECTIONS,
  }
): string {
  const isIt = options.language === 'it';
  const sec = options.sections || DEFAULT_DOC_SECTIONS;
  const now = new Date().toLocaleString(isIt ? 'it-IT' : 'en-US', {
    dateStyle: 'full',
    timeStyle: 'medium',
  });

  const adapterTypeUpper = config.adapter.toUpperCase();
  const primaryEndpoint = config.endpoints[0];
  const isOutbound = primaryEndpoint?.type === 'interaction';
  const directionStr = isOutbound
    ? (isIt ? 'Outbound (Invocazione / Scrittura)' : 'Outbound (Invoke / Interaction)')
    : (isIt ? 'Inbound (Polling / Consumo Eventi)' : 'Inbound (Polling / Message Activation)');

  const docTitle = options.docTitle || (isIt
    ? `Specifiche Tecniche Adapter JCA: ${config.name}`
    : `JCA Adapter Technical Specification: ${config.name}`);

  let md = '';
  let sectionIndex = 1;

  // Header & Metadata Block
  md += `# ${docTitle}\n\n`;
  md += `> **${isIt ? 'Generazione Documentazione Automatica' : 'Automated Technical Documentation'}**  \n`;
  md += `> **${isIt ? 'File Sorgente' : 'Source File'}**: \`${config.relativePath || config.fileName}\` (${(config.fileSize / 1024).toFixed(2)} KB)  \n`;
  md += `> **${isIt ? 'Data Elaborazione' : 'Generated On'}**: ${now}  \n`;
  md += `> **${isIt ? 'Tipo Adapter' : 'Adapter Type'}**: \`${adapterTypeUpper}\` (${config.adapterRaw || config.adapter})  \n`;
  md += `> **${isIt ? 'Direzione Flusso' : 'Integration Flow'}**: ${directionStr}  \n`;
  md += `> **${isIt ? 'WSDL Correlato' : 'Associated WSDL'}**: \`${config.wsdlLocation}\`  \n\n`;
  md += `---\n\n`;

  // 1. Executive Summary
  if (sec.includeSummary) {
    md += `## ${sectionIndex++}. ${isIt ? 'Sintesi Architetturale & Obiettivo' : 'Executive Architecture Summary'}\n\n`;
    if (isIt) {
      md += `Il presente documento descrive le specifiche tecniche e i dettagli di configurazione dell'adapter JCA **\`${config.name}\`**.\n\n`;
      md += `- **Tecnologia Adapter**: Oracle / JCA Resource Adapter per **${getAdapterFriendlyName(config.adapter, 'it')}**.\n`;
      md += `- **Canale di Integrazione**: Flusso ${directionStr}.\n`;
      md += `- **Risorsa JNDI Target**: \`${config.connectionFactory.location || 'N/D'}\`.\n`;
      if (config.connectionFactory.uiConnectionName) {
        md += `- **Connessione Progettuale**: \`${config.connectionFactory.uiConnectionName}\`.\n`;
      }
      md += `- **Contratto di Interfaccia**: WSDL \`${config.wsdlLocation}\`.\n\n`;
    } else {
      md += `This document provides the exhaustive technical specification and runtime configuration details for the JCA Adapter **\`${config.name}\`**.\n\n`;
      md += `- **Adapter Technology**: Oracle / JCA Resource Adapter for **${getAdapterFriendlyName(config.adapter, 'en')}**.\n`;
      md += `- **Integration Channel**: ${directionStr} flow.\n`;
      md += `- **Target JNDI Resource**: \`${config.connectionFactory.location || 'N/A'}\`.\n`;
      if (config.connectionFactory.uiConnectionName) {
        md += `- **Design Connection**: \`${config.connectionFactory.uiConnectionName}\`.\n`;
      }
      md += `- **Interface Contract**: WSDL \`${config.wsdlLocation}\`.\n\n`;
    }
  }

  // 2. Connection Factory & JNDI Specs (Rendered cleanly as compliant Markdown Table)
  if (sec.includeJndiSpecs) {
    md += `## ${sectionIndex++}. ${isIt ? 'Specifiche Connessione & Risorse JNDI' : 'Connection Factory & JNDI Resource Specifications'}\n\n`;
    md += `| ${isIt ? 'Parametro' : 'Parameter'} | ${isIt ? 'Valore Configurato' : 'Configured Value'} | ${isIt ? 'Descrizione & Impatto Runtime' : 'Description & Runtime Impact'} |\n`;
    md += `| :--- | :--- | :--- |\n`;
    md += `| **JNDI Location** | \`${escapeTableMarkdown(config.connectionFactory.location || (isIt ? 'Non specificato' : 'Not specified'))}\` | ${isIt ? 'Nome JNDI della Connection Factory configurata nell\'Application Server (es. WebLogic console).' : 'JNDI Outbound Connection Pool registered in WebLogic / AppServer.'} |\n`;
    if (config.connectionFactory.uiConnectionName) {
      md += `| **UI Connection Name** | \`${escapeTableMarkdown(config.connectionFactory.uiConnectionName)}\` | ${isIt ? 'Nome simbolico della connessione in ambiente di sviluppo (JDeveloper / Eclipse).' : 'Design-time connection alias in development IDE.'} |\n`;
    }
    if (config.connectionFactory.uiQueryResultConfiguration) {
      md += `| **Query Result Config** | \`${escapeTableMarkdown(config.connectionFactory.uiQueryResultConfiguration)}\` | ${isIt ? 'Configurazione wizard per la strutturazione dei result set.' : 'Wizard metadata for result set serialization.'} |\n`;
    }
    Object.entries(config.connectionFactory.otherAttributes).forEach(([k, v]) => {
      md += `| **\`${escapeTableMarkdown(k)}\`** | \`${escapeTableMarkdown(v)}\` | ${isIt ? 'Attributo specifico Connection Factory' : 'Connection factory attribute'} |\n`;
    });
    md += `\n`;
  }

  // 3. Endpoints & Operations Matrix
  if (sec.includeEndpoints) {
    md += `## ${sectionIndex++}. ${isIt ? 'Endpoint, Operazioni & Spec Class' : 'Endpoints, Operations & Spec Classes'}\n\n`;
    config.endpoints.forEach((ep) => {
      const epTypeLabel = ep.type === 'interaction' ? 'Endpoint Interaction (Invoke/Outbound)' : 'Endpoint Activation (Consume/Inbound)';
      md += `### ${isIt ? 'Endpoint' : 'Endpoint'}: \`${ep.operation || 'default'}\` (\`${ep.portType}\`)\n\n`;
      md += `- **${isIt ? 'Tipo Endpoint' : 'Endpoint Type'}**: \`${epTypeLabel}\`\n`;
      md += `- **Port Type**: \`${ep.portType}\`\n`;
      md += `- **Operation**: \`${ep.operation}\`\n`;
      md += `- **Spec Class**: \`${ep.specClassName || (isIt ? 'Generico' : 'Generic')}\`\n`;
      md += `- **${isIt ? 'Categoria Funzionale' : 'Functional Category'}**: **${ep.specCategory}**\n\n`;

      // 4. SQL or Messaging or File Detailed Analysis
      if (sec.includeSqlAnalysis) {
        if (ep.sqlAnalysis && (ep.sqlAnalysis.sqlString || ep.sqlAnalysis.procedureName || ep.sqlAnalysis.dmlType)) {
          md += `#### ${isIt ? 'Specifiche Query SQL / Stored Procedure' : 'SQL Query & Stored Procedure Specifications'}\n\n`;
          if (ep.sqlAnalysis.procedureName) {
            md += `- **${isIt ? 'Stored Procedure' : 'Stored Procedure'}**: \`${ep.sqlAnalysis.packageName ? `${ep.sqlAnalysis.packageName}.` : ''}${ep.sqlAnalysis.procedureName}\`\n`;
          }
          if (ep.sqlAnalysis.schemaName) {
            md += `- **${isIt ? 'Schema Database' : 'Database Schema'}**: \`${ep.sqlAnalysis.schemaName}\`\n`;
          }
          if (ep.sqlAnalysis.dmlType) {
            md += `- **DML Type**: \`${ep.sqlAnalysis.dmlType}\`\n`;
          }
          if (ep.sqlAnalysis.descriptorName) {
            md += `- **TopLink Descriptor**: \`${ep.sqlAnalysis.descriptorName}\`\n`;
          }
          if (ep.sqlAnalysis.tables && ep.sqlAnalysis.tables.length > 0) {
            md += `- **${isIt ? 'Tabelle Coinvolte' : 'Referenced Tables'}**: ${ep.sqlAnalysis.tables.map((t) => `\`${t}\``).join(', ')}\n`;
          }
          if (ep.sqlAnalysis.parameters && ep.sqlAnalysis.parameters.length > 0) {
            md += `- **${isIt ? 'Parametri di Bind Rilevati' : 'Detected Bind Parameters'}**: ${ep.sqlAnalysis.parameters.map((p) => `\`#${p}\``).join(', ')}\n`;
          }
          if (ep.sqlAnalysis.sqlString) {
            md += `\n**${isIt ? 'Istruzione SQL Eseguita' : 'Executed SQL Statement'}:**\n\n`;
            md += '```sql\n';
            md += formatSql(ep.sqlAnalysis.sqlString);
            md += '\n```\n\n';
          }
        }

        if (ep.messagingAnalysis) {
          md += `#### ${isIt ? 'Dettagli Messaging JMS / Broker' : 'JMS Messaging & Queue Specifications'}\n\n`;
          if (ep.messagingAnalysis.destinationName) {
            md += `- **${isIt ? 'Destinazione JNDI' : 'Destination JNDI'}**: \`${ep.messagingAnalysis.destinationName}\`\n`;
          }
          if (ep.messagingAnalysis.destinationType) {
            md += `- **${isIt ? 'Tipo Destinazione' : 'Destination Type'}**: \`${ep.messagingAnalysis.destinationType}\`\n`;
          }
          if (ep.messagingAnalysis.payloadType) {
            md += `- **Payload Format**: \`${ep.messagingAnalysis.payloadType}\`\n`;
          }
          if (ep.messagingAnalysis.messageSelector) {
            md += `- **Message Selector (Filter)**: \`${ep.messagingAnalysis.messageSelector}\`\n`;
          }
          if (ep.messagingAnalysis.deliveryMode) {
            md += `- **Delivery Mode**: \`${ep.messagingAnalysis.deliveryMode}\`\n`;
          }
          md += `\n`;
        }

        if (ep.fileAnalysis) {
          md += `#### ${isIt ? 'Parametri File System & Polling' : 'File System & Polling Parameters'}\n\n`;
          if (ep.fileAnalysis.physicalDirectory) {
            md += `- **Physical Directory**: \`${ep.fileAnalysis.physicalDirectory}\`\n`;
          }
          if (ep.fileAnalysis.logicalDirectory) {
            md += `- **Logical Directory**: \`${ep.fileAnalysis.logicalDirectory}\`\n`;
          }
          if (ep.fileAnalysis.fileName) {
            md += `- **File Name / Pattern**: \`${ep.fileAnalysis.fileName}\`\n`;
          }
          if (ep.fileAnalysis.pollingFrequency) {
            md += `- **${isIt ? 'Frequenza Polling' : 'Polling Frequency'}**: \`${ep.fileAnalysis.pollingFrequency} sec\`\n`;
          }
          if (ep.fileAnalysis.deleteAfterRead !== undefined) {
            md += `- **Delete File After Read**: \`${ep.fileAnalysis.deleteAfterRead ? 'True (Elimina)' : 'False (Mantieni)'}\`\n`;
          }
          if (ep.fileAnalysis.archiveDirectory) {
            md += `- **Archive Directory**: \`${ep.fileAnalysis.archiveDirectory}\`\n`;
          }
          md += `\n`;
        }
      }

      // Property Table
      if (sec.includePropertiesCatalog && ep.properties.length > 0) {
        md += `#### ${isIt ? 'Catalogo Completo delle Proprietà Configurate' : 'Complete Configured Properties Catalog'}\n\n`;
        md += `| ${isIt ? 'Proprietà' : 'Property'} | ${isIt ? 'Valore' : 'Value'} | ${isIt ? 'Categoria' : 'Category'} | ${isIt ? 'Descrizione Funzionale' : 'Functional Description'} |\n`;
        md += `| :--- | :--- | :--- | :--- |\n`;
        ep.properties.forEach((p) => {
          const valDisplay = p.value ? `\`${escapeTableMarkdown(p.value)}\`` : `*(vuoto)*`;
          const catBadge = formatCategoryBadge(p.category, isIt);
          md += `| **\`${escapeTableMarkdown(p.name)}\`** | ${valDisplay} | ${catBadge} | ${escapeTableMarkdown(p.description)} |\n`;
        });
        md += `\n`;
      }
    });
  }

  // 5. Reliability & Transaction Profile
  if (sec.includeTransactionProfile) {
    md += `## ${sectionIndex++}. ${isIt ? 'Profilo di Transazionalità & Affidabilità Runtime' : 'Transactionality & Runtime Reliability Profile'}\n\n`;
    if (isIt) {
      md += `- **Partecipazione a Transazioni Globali (XA / JTA)**: Verificare che la Connection Factory \`${config.connectionFactory.location || 'JNDI'}\` sia configurata con supporto XA se richiesta consistenza two-phase commit.\n`;
      md += `- **Idempotenza & Retry**: Per i flussi outbound, valutare la gestione di retry in caso di timeout della risorsa remota.\n`;
      md += `- **Gestione Concorrenza**: Verificare il dimensionamento del pool di connessioni (Initial Capacity / Max Capacity) sull'application server per supportare il carico di picco.\n\n`;
    } else {
      md += `- **Global Transaction (XA / JTA) Support**: Ensure connection factory \`${config.connectionFactory.location || 'JNDI'}\` is provisioned with XA compliance if two-phase commit guarantees are required.\n`;
      md += `- **Idempotency & Retry**: For outbound invoke interactions, configure fault policies and retry intervals.\n`;
      md += `- **Connection Pool Sizing**: Verify minimum and maximum pool capacity in the application server to handle expected peak concurrency.\n\n`;
    }
  }

  // 6. Mermaid Integration & Sequence Diagrams
  if (sec.includeMermaid) {
    md += `## ${sectionIndex++}. ${isIt ? 'Diagramma Architetturale (Mermaid)' : 'Architecture Flow Diagram (Mermaid)'}\n\n`;
    md += generateMermaidBlock(config, isIt);
    md += `\n\n`;
  }

  // 7. DevOps & Deployment Checklist
  if (sec.includeDevOpsChecklist) {
    md += `## ${sectionIndex++}. ${isIt ? 'Checklist di Deploy & Configurazione DevOps' : 'DevOps Deployment & Verification Checklist'}\n\n`;
    if (isIt) {
      md += `- [ ] **Verifica JNDI Connection Factory**: Accertarsi che \`${config.connectionFactory.location}\` esista e punti alla risorsa target corretta nell'ambiente di destinazione (Sviluppo / Test / Produzione).\n`;
      md += `- [ ] **Verifica Credenziali e Pool**: Verificare che l'utente di servizio e la password del pool abbiano i privilegi necessari.\n`;
      md += `- [ ] **Allineamento WSDL & Schema**: Verificare che il WSDL \`${config.wsdlLocation}\` sia impacchettato correttamente nel composite SOA / OSB.\n`;
      md += `- [ ] **Configurazione Config Plan (Plan.xml)**: Personalizzare le variabili di ambiente specifiche (JNDI, directory, host) nel piano di deploy per l'ambiente target.\n`;
      md += `- [ ] **Test di Connettività**: Eseguire un ping test della risorsa e verificare che non vi siano eccezioni \`ResourceException\` o \`JNDI lookup failures\`.\n\n`;
    } else {
      md += `- [ ] **Verify JNDI Connection Factory**: Confirm that \`${config.connectionFactory.location}\` is created and mapped to the right endpoint in WebLogic / AppServer.\n`;
      md += `- [ ] **Credential & Security Audit**: Ensure service account credentials bound to the resource adapter have required permissions.\n`;
      md += `- [ ] **WSDL & Schema Alignment**: Ensure referenced WSDL \`${config.wsdlLocation}\` is present in the deployment archive.\n`;
      md += `- [ ] **Config Plan (Plan.xml) Customization**: Override environment-specific JNDI or path variables for target staging/production environments.\n`;
      md += `- [ ] **Connectivity & Smoke Test**: Validate adapter initialization logs for any \`ResourceException\` or JNDI binding failures.\n\n`;
    }
  }

  // 8. Raw XML snippet
  if (sec.includeRawSnippet) {
    md += `## ${sectionIndex++}. ${isIt ? 'Sorgente XML Originale (.jca)' : 'Original JCA XML Source'}\n\n`;
    md += '```xml\n';
    md += config.rawXml;
    md += '\n```\n';
  }

  return md;
}

/**
 * Generates a master batch document combining multiple JCA adapters into a single technical report.
 */
export function generateMasterBatchMarkdown(
  configs: JCAAdapterConfig[],
  options: MarkdownGenOptions = {
    language: 'it',
    sections: DEFAULT_DOC_SECTIONS,
  }
): string {
  const isIt = options.language === 'it';
  const now = new Date().toLocaleString(isIt ? 'it-IT' : 'en-US', {
    dateStyle: 'full',
    timeStyle: 'medium',
  });

  let md = '';
  md += `# ${isIt ? 'Documento Tecnico Cumulativo Adapter JCA' : 'Master JCA Adapters Technical Specification'}\n\n`;
  md += `> **${isIt ? 'Data Generazione' : 'Generated On'}**: ${now}  \n`;
  md += `> **${isIt ? 'Numero Totale Adapter' : 'Total Adapters'}**: ${configs.length}  \n\n`;
  md += `---\n\n`;

  // Master Table of Contents
  md += `## ${isIt ? 'Indice Generale degli Adapter Analizzati' : 'Master Index of Analyzed Adapters'}\n\n`;
  md += `| # | ${isIt ? 'Nome Adapter' : 'Adapter Name'} | ${isIt ? 'Tipo' : 'Type'} | ${isIt ? 'Percorso File' : 'File Path'} | JNDI Location | Operation |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;

  configs.forEach((c, idx) => {
    const op = c.endpoints[0]?.operation || 'default';
    md += `| ${idx + 1} | [**\`${escapeTableMarkdown(c.name)}\`**](#adapter-${idx + 1}-${c.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}) | \`${c.adapter.toUpperCase()}\` | \`${escapeTableMarkdown(c.relativePath || c.fileName)}\` | \`${escapeTableMarkdown(c.connectionFactory.location || 'N/D')}\` | \`${escapeTableMarkdown(op)}\` |\n`;
  });

  md += `\n---\n\n`;

  // Each individual adapter section
  configs.forEach((c, idx) => {
    md += `<a id="adapter-${idx + 1}-${c.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}"></a>\n\n`;
    md += `***\n\n`;
    md += generateJcaMarkdown(c, {
      ...options,
      docTitle: `${idx + 1}. Adapter: ${c.name} (${c.adapter.toUpperCase()})`,
    });
    md += `\n\n`;
  });

  return md;
}

function getAdapterFriendlyName(adapter: string, lang: 'it' | 'en'): string {
  const map: Record<string, { it: string; en: string }> = {
    db: { it: 'Database Relazionale (JDBC / Oracle DB)', en: 'Relational Database (JDBC / Oracle DB)' },
    jms: { it: 'JMS Message Broker (Queue / Topic)', en: 'JMS Message Broker (Queue / Topic)' },
    file: { it: 'File System Locale / Network Share', en: 'Local File System / Network Share' },
    ftp: { it: 'File Transfer Protocol (FTP / SFTP)', en: 'File Transfer Protocol (FTP / SFTP)' },
    aq: { it: 'Oracle Advanced Queuing (AQ)', en: 'Oracle Advanced Queuing (AQ)' },
    socket: { it: 'TCP Socket Protocol', en: 'TCP Socket Protocol' },
    rest: { it: 'REST / HTTP Service Adapter', en: 'REST / HTTP Service Adapter' },
    apps: { it: 'Oracle E-Business Suite (Apps)', en: 'Oracle E-Business Suite (Apps)' },
    mq: { it: 'IBM MQ Resource Adapter', en: 'IBM MQ Resource Adapter' },
    custom: { it: 'Custom Resource Adapter JCA', en: 'Custom Resource Adapter JCA' },
  };
  return map[adapter]?.[lang] || adapter.toUpperCase();
}

function formatCategoryBadge(category: string, isIt: boolean): string {
  const map: Record<string, { it: string; en: string }> = {
    core: { it: 'Core / Strutturale', en: 'Core' },
    sql: { it: 'SQL & DML', en: 'SQL & DML' },
    transaction: { it: 'Transazionale (XA)', en: 'Transaction' },
    performance: { it: 'Performance & Polling', en: 'Performance' },
    security: { it: 'Sicurezza & Credenziali', en: 'Security' },
    path: { it: 'Percorso / File System', en: 'Path' },
    general: { it: 'Generale', en: 'General' },
  };
  return `\`${map[category]?.[isIt ? 'it' : 'en'] || category}\``;
}

function formatSql(sql: string): string {
  if (!sql) return '';
  return sql
    .replace(/--.*$/gm, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(SELECT|FROM|WHERE|AND|OR|INSERT INTO|VALUES|UPDATE|SET|DELETE FROM|MERGE INTO|USING|ON|GROUP BY|ORDER BY|HAVING|LEFT JOIN|RIGHT JOIN|INNER JOIN)\b/gi, '\n$1')
    .trim();
}

function sanitizeMermaid(val: string): string {
  return val.replace(/["\[\]{}|<>]/g, '_').replace(/[\r\n]+/g, ' ').trim().slice(0, 80);
}

function generateMermaidBlock(config: JCAAdapterConfig, isIt: boolean): string {
  const primaryEp = config.endpoints[0];
  const isOutbound = primaryEp?.type === 'interaction';
  const adapterTypeLabel = sanitizeMermaid(config.adapter.toUpperCase());
  const targetResource = sanitizeMermaid(config.connectionFactory.location ? config.connectionFactory.location.split('/').pop() || config.connectionFactory.location : 'TargetResource');

  let chart = '```mermaid\n';
  chart += 'flowchart LR\n';
  if (isOutbound) {
    chart += `    ClientSOA[${isIt ? 'Servizio SOA / OSB' : 'SOA / OSB Composite'}] -->|${isIt ? 'Invocazione WSDL' : 'WSDL Invoke'}: ${sanitizeMermaid(primaryEp?.operation || 'op')}| JCAAdapter[JCA Adapter: ${sanitizeMermaid(config.name)}\\n(${adapterTypeLabel})]\n`;
    chart += `    JCAAdapter -->|JNDI: ${sanitizeMermaid(config.connectionFactory.location || 'eis/...')}| TargetSys[(${isIt ? 'Risorsa Target' : 'Target Resource'}: ${targetResource})]\n`;
  } else {
    chart += `    TargetSys[(${isIt ? 'Sorgente Dati / Broker' : 'Data Source / Broker'}: ${targetResource})] -->|${isIt ? 'Polling / Evento' : 'Poll / Event'}| JCAAdapter[JCA Adapter: ${sanitizeMermaid(config.name)}\\n(${adapterTypeLabel})]\n`;
    chart += `    JCAAdapter -->|${isIt ? 'Consegna Messaggio' : 'Deliver Payload'}: ${sanitizeMermaid(primaryEp?.operation || 'consume')}| ClientSOA[${isIt ? 'Servizio SOA / OSB Consumer' : 'SOA / OSB Consumer'}]\n`;
  }
  chart += '```\n\n';

  chart += '```mermaid\n';
  chart += 'sequenceDiagram\n';
  chart += '    autonumber\n';
  chart += `    actor Caller as ${isIt ? 'Processo Chiamante' : 'Caller Service'}\n`;
  chart += `    participant JCA as ${sanitizeMermaid(config.name)} (${adapterTypeLabel})\n`;
  chart += `    participant Target as ${targetResource}\n\n`;
  if (isOutbound) {
    chart += `    Caller->>+JCA: ${sanitizeMermaid(primaryEp?.operation || 'execute')}(payload)\n`;
    chart += `    JCA->>+Target: ${sanitizeMermaid(primaryEp?.sqlAnalysis?.sqlType || 'Invoke')} JNDI [${sanitizeMermaid(config.connectionFactory.location || 'EIS')}]\n`;
    chart += `    Target-->>-JCA: ${isIt ? 'Risultato / Ack' : 'Result / Status'}\n`;
    chart += `    JCA-->>-Caller: ${isIt ? 'Risposta Elaborata' : 'Response Message'}\n`;
  } else {
    chart += `    Target->>+JCA: ${isIt ? 'Nuovo Record / Messaggio' : 'New Message / File / Row'}\n`;
    chart += `    JCA->>+Caller: ${sanitizeMermaid(primaryEp?.operation || 'onMessage')}(payload)\n`;
    chart += `    Caller-->>-JCA: ${isIt ? 'Conferma Ricezione' : 'Acknowledgment'}\n`;
    chart += `    JCA-->>-Target: ${isIt ? 'Commit / Eliminazione Sorgente' : 'Commit / Delete Source'}\n`;
  }
  chart += '```';

  return chart;
}
