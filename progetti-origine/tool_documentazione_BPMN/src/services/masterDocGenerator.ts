import {
  DocSectionOptions,
  MasterDocGenOptions,
  OracleEcosystem,
} from '../types/jca';

export function generateHighLevelArchitectureDoc(
  ecosystem: OracleEcosystem,
  options: MasterDocGenOptions
): string {
  const { sections, language, applicationName = 'Oracle SOA & ADF Suite' } = options;
  const isIt = language === 'it';
  const lines: string[] = [];

  const sanitizeMd = (val?: string | number | null) => {
    if (val === undefined || val === null || val === '') return 'N/D';
    return String(val).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
  };

  const sanitizeMermaid = (val: string) => val.replace(/["\[\]{}|<>]/g, '_').replace(/[\r\n]+/g, ' ').trim().slice(0, 80);

  const cleanPortType = (raw?: string) => {
    if (!raw) return undefined;
    const t = raw.trim();
    if (!t) return undefined;
    const hashPart = t.includes('#') ? (t.split('#').pop() || t) : t;
    const m = hashPart.match(/(?:wsdl\.)?(?:portType|interface)\s*\(\s*([^)]+)\s*\)?/i);
    if (m && m[1]) return m[1].trim();
    const fallback = t.match(/interface\s*\(\s*([^)\s]+)\s*\)?/i);
    if (fallback && fallback[1]) return fallback[1].trim();
    return t;
  };

  // Header & Metadata
  lines.push(`# ${options.docTitle || (isIt ? 'Architettura di Sistema & Documentazione Tecnica Completa' : 'Complete System Architecture & Technical Documentation')}`);
  lines.push(`## ${applicationName}`);
  lines.push('');
  lines.push(`> **${isIt ? 'Data Generazione' : 'Generation Date'}**: ${new Date(ecosystem.analyzedAt || Date.now()).toLocaleString(isIt ? 'it-IT' : 'en-US')}  `);
  lines.push(`> **${isIt ? 'Totale File di Progetto Analizzati' : 'Total Project Files Analyzed'}**: \`${ecosystem.totalFiles}\`  `);
  lines.push(`> **${isIt ? 'Piattaforma Target' : 'Target Platform'}**: Oracle Fusion Middleware (SOA Suite 12c / 11g & ADF)  `);
  lines.push(`> **${isIt ? 'Generazione' : 'Generation Engine'}**: 100% Deterministico & Offline (SCA Topology Parser)`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Table of Contents
  lines.push(`## ${isIt ? 'Indice Generale della Documentazione' : 'Table of Contents'}`);
  lines.push(`1. [${isIt ? "1. Visione Alto Livello & Inventario dell'Ecosistema" : '1. High-Level Vision & Ecosystem Inventory'}](#1-visione-alto-livello--inventario-dellecosistema)`);
  if (sections.includeArchitectureTopology || sections.includeCompositesMatrix) {
    lines.push(`2. [${isIt ? '2. Topologia SCA & Compositi (composite.xml)' : '2. SCA Topology & Composites (composite.xml)'}](#2-topologia-sca--compositi-compositexml)`);
  }
  if (sections.includeProcessesBpmnBpel || sections.includeMediatorsCatalog || sections.includeHumanTasksCatalog) {
    lines.push(`3. [${isIt ? '3. Orchestrazione & Processi di Business (BPMN, BPEL, Mediator, Human Tasks)' : '3. Orchestration & Business Processes (BPMN, BPEL, Mediator, Human Tasks)'}](#3-orchestrazione--processi-di-business)`);
  }
  if (sections.includeJcaMatrix) {
    lines.push(`4. [${isIt ? '4. Adapter JCA & Matrice JNDI (DB, JMS, File, FTP, AQ)' : '4. JCA Adapters & JNDI Matrix (DB, JMS, File, FTP, AQ)'}](#4-adapter-jca--matrice-jndi)`);
  }
  if (sections.includeWsdlXsdCatalog) {
    lines.push(`5. [${isIt ? '5. Contratti di Servizio WSDL & Schemi Dati XSD' : '5. Service Contracts WSDL & Data Schemas XSD'}](#5-contratti-di-servizio-wsdl--schemi-dati-xsd)`);
  }
  if (sections.includeComponentTypeCatalog && ecosystem.componentTypes?.length > 0) {
    lines.push(`5b. [${isIt ? '5b. Descrittori ComponentType SCA' : '5b. SCA ComponentType Descriptors'}](#53-descrittori-componenttype)`);
  }
  if (sections.includeDvmCatalog && ecosystem.dvms?.length > 0) {
    lines.push(`5c. [${isIt ? '5c. Domain Value Maps (DVM)' : '5c. Domain Value Maps (DVM)'}](#54-domain-value-maps)`);
  }
  if (sections.includeXsltCatalog) {
    lines.push(`6. [${isIt ? '6. Mappature & Trasformazioni Dati XSLT' : '6. Data Mappings & XSLT Transformations'}](#6-mappature--trasformazioni-dati-xslt)`);
  }
  if (sections.includeAdfBindings && ecosystem.dataControls.length > 0) {
    lines.push(`7. [${isIt ? '7. Integrazioni ADF & Data Controls (.dcx / .cpx)' : '7. ADF Integrations & Data Controls (.dcx / .cpx)'}](#7-integrazioni-adf--data-controls)`);
  }
  if (sections.includeDevOpsChecklist) {
    lines.push(`8. [${isIt ? '8. DevOps, Script WLST & Promozione Ambienti (DEV / TEST / PROD)' : '8. DevOps, WLST Scripts & Environment Promotion (DEV / TEST / PROD)'}](#8-devops-script-wlst--promozione-ambienti)`);
  }
  if (sections.includeMermaidDiagrams) {
    lines.push(`9. [${isIt ? '9. Diagrammi Architetturali Mermaid (End-to-End SCA Flow)' : '9. Architectural Mermaid Diagrams (End-to-End SCA Flow)'}](#9-diagrammi-architetturali-mermaid)`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // ==========================================
  // 1. VISIONE ALTO LIVELLO & INVENTARIO
  // ==========================================
  if (sections.includeSummary) {
    lines.push(`## 1. ${isIt ? "Visione Alto Livello & Inventario dell'Ecosistema" : 'High-Level Vision & Ecosystem Inventory'}`);
    lines.push('');
    lines.push(
      isIt
        ? `L'applicazione analizzata rappresenta un sistema enterprise distribuito eterogeneo basato sullo standard **SCA (Service Component Architecture)** di Oracle SOA Suite e Oracle ADF. L'architettura realizza il disaccoppiamento dei canali applicativi mediante la mediazione dei messaggi, l'orchestrazione procedurale e a eventi, e l'accesso affidabile ai dati transazionali e ai sistemi di messaggistica.`
        : `The analyzed application represents a distributed enterprise system based on Oracle SOA Suite SCA and Oracle ADF. The architecture decouples application channels through message mediation, procedural and event-driven orchestration, and robust transactional data access.`
    );
    lines.push('');

    // Distribution by Layer
    lines.push(`### ${isIt ? 'Distribuzione per Layer Architetturale' : 'Distribution by Architectural Layer'}`);
    lines.push('');
    lines.push(`| ${isIt ? 'Layer Architetturale' : 'Architectural Layer'} | ${isIt ? 'Artefatti Principali' : 'Core Artifacts'} | ${isIt ? 'Conteggio' : 'Count'} | ${isIt ? 'Descrizione del Ruolo' : 'Role Description'} |`);
    lines.push('|---|---|---|---|');
    lines.push(`| **SCA Composites & Descriptors** | \`composite.xml\`, \`.componentType\` | **${ecosystem.composites.length + (ecosystem.componentTypes?.length || 0)}** | ${isIt ? 'Definizione dei confini dei servizi, binding di protocollo e cablaggio interno dei componenti.' : 'Service boundaries, protocol bindings, and internal component wiring.'} ${(ecosystem.componentTypes?.length ? ` (ComponentType: ${ecosystem.componentTypes.length})` : '')} |`);
    lines.push(`| **Business Process & Orchestration** | \`.bpmn\`, \`.bpel\`, \`.mplan\`, \`.task\` | **${ecosystem.bpmnProcesses.length + ecosystem.bpelProcesses.length + ecosystem.mediators.length + ecosystem.humanTasks.length}** | ${isIt ? 'Esecuzione dei flussi di lavoro, regole decisionali, mediazione messaggi e approvazioni utente.' : 'Workflow execution, routing mediation, decision logic, and user approvals.'} |`);
    lines.push(`| **Integration & Resource Adapters** | \`.jca\` | **${ecosystem.jcaAdapters.length}** | ${isIt ? 'Connettori JCA 1.5 verso Database, Code JMS, File System/FTP e code Oracle AQ.' : 'JCA 1.5 Resource Adapters to Databases, JMS Queues, File/FTP and Oracle AQ.'} |`);
    lines.push(`| **Service Contracts & Data Models** | \`.wsdl\`, \`.xsd\` | **${ecosystem.wsdlContracts.length + ecosystem.xsdSchemas.length}** | ${isIt ? 'Interfacce di servizio SOAP (PortTypes, Operations) e schemi di validazione entità XML.' : 'SOAP service contracts (PortTypes, Operations) and XML entity validation schemas.'} |`);
    lines.push(`| **Transformation & Mapping** | \`.xsl\`, \`.xslt\`, \`.dvm\` | **${ecosystem.xsltTransforms.length + (ecosystem.dvms?.length || 0)}** | ${isIt ? 'Fogli di stile XSLT e Domain Value Maps per la conversione canonica.' : 'XSLT stylesheets and DVMs for canonical conversion.'} |`);
    lines.push(`| **DevOps & Automation** | \`.py\`, \`.sh\`, \`.sql\`, \`.properties\`, \`.tcl\`, \`.ctl\` | **${ecosystem.scripts.length}** | ${isIt ? 'Script WLST Python/TCL, Shell, SQL e proprietà ambiente.' : 'WLST Python/TCL, Shell, SQL and environment configs.'} |`);
    if ((ecosystem.dvms?.length || 0) > 0) {
      lines.push(`| **Domain Value Maps** | \`.dvm\` | **${ecosystem.dvms.length}** | ${isIt ? 'Tabelle di mapping cross-reference per mediazione (MDS).' : 'Cross-reference mapping tables for mediation (MDS).'} |`);
    }
    if (ecosystem.dataControls.length > 0) {
      lines.push(`| **ADF UI & Data Controls** | \`.dcx\`, \`.cpx\` | **${ecosystem.dataControls.length}** | ${isIt ? 'Data Control e binding ADF per interfaccia utente.' : 'ADF Data Controls and UI page bindings.'} |`);
    }
    lines.push('');

    // Detailed Files breakdown
    lines.push(`### ${isIt ? 'Inventario Quantitativo dei File di Progetto' : 'Quantitative Project File Inventory'}`);
    lines.push('');
    lines.push(`| ${isIt ? 'Estensione File' : 'File Extension'} | ${isIt ? 'Quantità' : 'Quantity'} | ${isIt ? 'Percentuale sul Totale' : 'Percentage'} | ${isIt ? 'Ruolo nel Runtime Oracle' : 'Oracle Runtime Role'} |`);
    lines.push('|---|---|---|---|');

    const roleMap: Record<string, string> = {
      '.xml': isIt ? 'Descrittori Compositi SCA / Configurazione' : 'SCA Composite Descriptors / Config',
      '.wsdl': isIt ? 'Contratti Web Service SOAP (PortTypes, Operations)' : 'SOAP Web Service Contracts',
      '.xsd': isIt ? 'Modelli di dati e schemi di validazione XML' : 'XML Data Models & Schemas',
      '.jca': isIt ? 'Connettori di risorsa (DB, JMS, File, FTP, AQ)' : 'Resource Adapters (DB, JMS, File, FTP, AQ)',
      '.bpmn': isIt ? 'Processi di Business BPMN 2.0' : 'BPMN 2.0 Business Processes',
      '.bpel': isIt ? 'Orchestrazioni di Servizio BPEL' : 'BPEL Service Orchestrations',
      '.componentType': isIt ? 'Definizione interfacce e riferimenti SCA' : 'SCA Component Type Interfaces',
      '.mplan': isIt ? 'Regole di Routing e Mediazione Oracle Mediator' : 'Oracle Mediator Routing Rules',
      '.task': isIt ? 'Human Workflow & Task di approvazione' : 'Human Workflow Approval Tasks',
      '.dvm': isIt ? 'Domain Value Map - mapping cross-reference MDS' : 'Domain Value Map - MDS cross-ref',
      '.xsl': isIt ? 'Trasformazioni Dati XSLT' : 'XSLT Data Transformations',
      '.xslt': isIt ? 'Trasformazioni Dati XSLT' : 'XSLT Data Transformations',
      '.jws': isIt ? 'Workspace di Sviluppo JDeveloper' : 'JDeveloper Workspaces',
      '.jpr': isIt ? 'Progetti Modulari JDeveloper' : 'JDeveloper Modular Projects',
      '.dcx': isIt ? 'ADF Data Control Definitions' : 'ADF Data Control Definitions',
      '.cpx': isIt ? 'ADF Page Definition Data Bindings' : 'ADF Page Definition Data Bindings',
      '.sql': isIt ? 'Script Database DDL / DML' : 'Database SQL Scripts',
      '.sh': isIt ? 'Shell Script di Build e Automazione' : 'Shell Build/Deploy Scripts',
      '.py': isIt ? 'Script WLST (WebLogic Scripting Tool)' : 'WLST Python Automation Scripts',
      '.properties': isIt ? 'Configurazioni Ambiente / Parametri' : 'Environment Configuration Properties',
      '.tcl': isIt ? 'Script TCL / WLST' : 'TCL / WLST Scripts',
      '.ctl': isIt ? 'Control file SQL*Loader / ETL' : 'SQL*Loader Control Files',
      '.java': isIt ? 'Sorgenti Java' : 'Java Sources',
      '.jspx': isIt ? 'Pagine ADF / JSF' : 'ADF JSF Pages',
      '.sample': isIt ? 'Payload XML di esempio / test' : 'Sample XML payloads',
      'none': isIt ? 'File senza estensione' : 'Extensionless files',
      '.pack': isIt ? 'Package SCA compilato' : 'Compiled SCA package',
      '.rev': isIt ? 'Revisione SCA' : 'SCA revision',
      '.idx': isIt ? 'Indice MDS' : 'MDS index',
      '.yml': isIt ? 'Configurazione YAML / DevOps' : 'YAML config',
      '.gitignore': isIt ? 'Esclusione Git' : 'Git ignore',
      '.jar': isIt ? 'Libreria Java' : 'Java library',
    };

    const total = ecosystem.totalFiles || 1;
    Object.entries(ecosystem.fileCountByExtension)
      .sort((a, b) => b[1] - a[1])
      .forEach(([ext, count]) => {
        const role = roleMap[ext] || (isIt ? 'Risorsa di supporto / configurazione' : 'Support / Config Resource');
        const pct = ((count / total) * 100).toFixed(1);
        lines.push(`| \`${ext || 'Senza Estensione'}\` | **${count}** | \`${pct}%\` | ${role} |`);
      });

    lines.push('');
  }

  // ==========================================
  // 2. COMPOSITI SCA (composite.xml)
  // ==========================================
  if (sections.includeArchitectureTopology || sections.includeCompositesMatrix) {
    lines.push(`## 2. ${isIt ? 'Topologia SCA & Compositi (composite.xml)' : 'SCA Topology & Composites (composite.xml)'}`);
    lines.push('');
    lines.push(
      isIt
        ? `I file \`composite.xml\` definiscono l'architettura dei moduli di integrazione SCA. Ogni composito espone dei **Servizi Inbound**, orchestra la logica mediante **Componenti Interni** e invoca risorse esterne tramite **Riferimenti Outbound** e adapter JCA.`
        : `The \`composite.xml\` files define SCA integration module architecture. Each composite exposes Inbound Services, coordinates logic via Internal Components, and calls external resources via Outbound References.`
    );
    lines.push('');

    if (ecosystem.composites.length === 0) {
      lines.push(`> *${isIt ? 'Nessun descrittore composite.xml rilevato nei file caricati.' : 'No composite.xml descriptors found.'}*`);
      lines.push('');
    } else {
      ecosystem.composites.forEach((comp, idx) => {
        lines.push(`### 2.${idx + 1} Composito: \`${comp.name}\` (Revisione: \`${comp.revision || '1.0'}\`)`);
        lines.push('');
        lines.push(`- **${isIt ? 'Percorso File' : 'File Path'}**: \`${comp.relativePath || comp.fileName}\``);
        lines.push(`- **Target Namespace**: \`${comp.targetNamespace || 'N/D'}\``);
        lines.push(`- **${isIt ? 'Stato / Modalità Esecuzione' : 'State / Execution Mode'}**: \`${comp.state || 'on'}\` / \`${comp.mode || 'active'}\``);
        lines.push(`- **${isIt ? 'Metriche Componenti' : 'Component Metrics'}**: Componenti: **${comp.components.length}** | Servizi Inbound: **${comp.services.length}** | Reference Outbound: **${comp.references.length}** | Wire: **${comp.wires.length}**`);
        lines.push('');

        // Components
        lines.push(`#### ${isIt ? 'Componenti Interni del Composito' : 'Internal Composite Components'} (${comp.components.length})`);
        if (comp.components.length === 0) {
          lines.push(`- *${isIt ? 'Nessun componente interno dichiarato nel composite.xml.' : 'No internal components declared.'}*`);
        } else {
          lines.push(`| ${isIt ? 'Nome Componente' : 'Component Name'} | ${isIt ? 'Tipo SCA' : 'SCA Type'} | ${isIt ? 'File di Implementazione' : 'Implementation File'} |`);
          lines.push('|---|---|---|');
          comp.components.forEach((c) => {
            lines.push(`| **\`${sanitizeMd(c.name)}\`** | \`${c.type.toUpperCase()}\` | \`${sanitizeMd(c.implementationSource)}\` |`);
          });
        }
        lines.push('');

        // Inbound Services
        lines.push(`#### ${isIt ? 'Servizi di Ingresso Esposti (Inbound Services)' : 'Exposed Inbound Services'} (${comp.services.length})`);
        if (comp.services.length === 0) {
          lines.push(`- *${isIt ? 'Nessun servizio di ingresso esposto.' : 'No exposed inbound services.'}*`);
        } else {
          lines.push(`| ${isIt ? 'Servizio Inbound' : 'Inbound Service'} | ${isIt ? 'Binding / Protocollo' : 'Binding / Protocol'} | ${isIt ? 'Interfaccia WSDL / PortType' : 'WSDL Interface / PortType'} | ${isIt ? 'Configurazione / JCA' : 'Configuration / JCA'} |`);
          lines.push('|---|---|---|---|');
          comp.services.forEach((s) => {
            const pt = cleanPortType(s.interfacePortType || s.interfaceWsdl) || s.uiWsdlLocation;
            lines.push(`| **\`${sanitizeMd(s.name)}\`** | \`${s.bindingType || 'SOAP'}\` | \`${sanitizeMd(pt)}\` | \`${sanitizeMd(s.bindingConfig || s.jcaLocation)}\` |`);
          });
        }
        lines.push('');

        // Outbound References
        lines.push(`#### ${isIt ? 'Riferimenti Esterni (Outbound References & Adapters)' : 'Outbound References & Adapters'} (${comp.references.length})`);
        if (comp.references.length === 0) {
          lines.push(`- *${isIt ? 'Nessun riferimento esterno dichiarato.' : 'No outbound references declared.'}*`);
        } else {
          lines.push(`| ${isIt ? 'Riferimento Outbound' : 'Outbound Reference'} | ${isIt ? 'Tipo Binding' : 'Binding Type'} | ${isIt ? 'Interfaccia PortType' : 'PortType Interface'} | ${isIt ? 'File JCA / Endpoint Target' : 'JCA File / Target Endpoint'} |`);
          lines.push('|---|---|---|---|');
          comp.references.forEach((r) => {
            const pt = cleanPortType(r.interfacePortType || r.interfaceWsdl) || r.uiWsdlLocation;
            lines.push(`| **\`${sanitizeMd(r.name)}\`** | \`${r.bindingType || 'JCA'}\` | \`${sanitizeMd(pt)}\` | \`${sanitizeMd(r.jcaLocation || r.bindingConfig)}\` |`);
          });
        }
        lines.push('');

        // Wires
        if (comp.wires.length > 0) {
          lines.push(`#### ${isIt ? 'Matrice di Cablaggio SCA (Wires)' : 'SCA Wiring Matrix (Wires)'} (${comp.wires.length})`);
          lines.push(`| ${isIt ? 'Sorgente (Source Component / Service)' : 'Source'} | | ${isIt ? 'Destinazione (Target Component / Reference)' : 'Target'} |`);
          lines.push('|---|:---:|---|');
          comp.wires.forEach((w) => {
            lines.push(`| \`${sanitizeMd(w.source)}\` | ➔ | \`${sanitizeMd(w.target)}\` |`);
          });
          lines.push('');
        }
      });
    }
  }

  // ==========================================
  // 3. ORCHESTRAZIONE & PROCESSI DI BUSINESS
  // ==========================================
  if (sections.includeProcessesBpmnBpel || sections.includeMediatorsCatalog || sections.includeHumanTasksCatalog) {
    lines.push(`## 3. ${isIt ? 'Orchestrazione & Processi di Business' : 'Orchestration & Business Processes'}`);
    lines.push('');

    // BPMN Processes
    if (sections.includeProcessesBpmnBpel) {
      lines.push(`### 3.1 ${isIt ? 'Processi BPMN 2.0' : 'BPMN 2.0 Processes'} (${ecosystem.bpmnProcesses.length})`);
      lines.push('');
      if (ecosystem.bpmnProcesses.length === 0) {
        lines.push(`> *${isIt ? 'Nessun processo BPMN rilevato nei sorgenti.' : 'No BPMN processes detected.'}*`);
      } else {
        ecosystem.bpmnProcesses.forEach((bpmn, bIdx) => {
          lines.push(`#### 3.1.${bIdx + 1} Processo BPMN: \`${bpmn.name}\``);
          lines.push(`- **${isIt ? 'File' : 'File'}**: \`${bpmn.relativePath || bpmn.fileName}\``);
          lines.push(`- **${isIt ? 'Ruoli / Swimlanes' : 'Roles / Swimlanes'}**: ${bpmn.swimlanes.length > 0 ? bpmn.swimlanes.map((l) => `\`${l}\``).join(', ') : (isIt ? 'Default System Lane' : 'Default Lane')}`);
          lines.push(`- **${isIt ? 'Metriche di Processo' : 'Process Metrics'}**: User Tasks: **${bpmn.userTasks.length}** | Service Tasks: **${bpmn.serviceTasks.length}** | Gateways: **${bpmn.gateways.length}** | Eventi: **${bpmn.events.length}**`);
          lines.push('');

          if (bpmn.userTasks.length > 0 || bpmn.serviceTasks.length > 0) {
            lines.push(`| ${isIt ? 'Nome Attività' : 'Activity Name'} | ${isIt ? 'Tipologia' : 'Type'} | ${isIt ? 'Identificativo XML' : 'XML ID'} | ${isIt ? 'Dettagli / Documentazione' : 'Details / Documentation'} |`);
            lines.push('|---|---|---|---|');
            bpmn.userTasks.forEach((ut) => {
              lines.push(`| **\`${sanitizeMd(ut.name)}\`** | \`User Task (Interazione Umana)\` | \`${sanitizeMd(ut.id)}\` | \`${sanitizeMd(ut.documentation || 'Task operatore con form')}\` |`);
            });
            bpmn.serviceTasks.forEach((st) => {
              lines.push(`| **\`${sanitizeMd(st.name)}\`** | \`Service Task (Invocazione Automatica)\` | \`${sanitizeMd(st.id)}\` | \`${sanitizeMd(st.implementation || 'Invocazione servizio SCA')}\` |`);
            });
            lines.push('');
          }
        });
      }
      lines.push('');

      // BPEL Processes
      lines.push(`### 3.2 ${isIt ? 'Flussi di Integrazione BPEL' : 'BPEL Integration Flows'} (${ecosystem.bpelProcesses.length})`);
      lines.push('');
      if (ecosystem.bpelProcesses.length === 0) {
        lines.push(`> *${isIt ? 'Nessun processo BPEL rilevato nei sorgenti.' : 'No BPEL processes detected.'}*`);
      } else {
        ecosystem.bpelProcesses.forEach((bpel, bpIdx) => {
          lines.push(`#### 3.2.${bpIdx + 1} Processo BPEL: \`${bpel.name}\``);
          lines.push(`- **${isIt ? 'File' : 'File'}**: \`${bpel.relativePath || bpel.fileName}\``);
          lines.push(`- **Partner Links (${bpel.partnerLinks.length})**: ${bpel.partnerLinks.map((p) => `\`${p.name}\``).join(', ') || 'Nessuno'}`);
          lines.push(`- **${isIt ? 'Attività' : 'Activities'}**: Invoke: **${bpel.invokes.length}** | Receive: **${bpel.receives.length}** | Fault Handlers: **${bpel.faultHandlers.length}** | Variabili: **${bpel.variables.length}**`);
          lines.push('');

          // Partner Links table
          if (bpel.partnerLinks.length > 0) {
            lines.push(`##### Partner Links Dichiarati`);
            lines.push(`| Partner Link | Partner Link Type | My Role | Partner Role |`);
            lines.push('|---|---|---|---|');
            bpel.partnerLinks.forEach((pl) => {
              lines.push(`| **\`${sanitizeMd(pl.name)}\`** | \`${sanitizeMd(pl.partnerLinkType)}\` | \`${sanitizeMd(pl.myRole)}\` | \`${sanitizeMd(pl.partnerRole)}\` |`);
            });
            lines.push('');
          }

          // Invokes table
          if (bpel.invokes.length > 0) {
            lines.push(`##### Invocazioni di Servizio (Invoke Activities)`);
            lines.push(`| Partner Link | ${isIt ? 'Operazione Invocata' : 'Invoked Operation'} | ${isIt ? 'Variabile Input' : 'Input Variable'} | ${isIt ? 'Variabile Output' : 'Output Variable'} |`);
            lines.push('|---|---|---|---|');
            bpel.invokes.forEach((inv) => {
              lines.push(`| \`${sanitizeMd(inv.partnerLink)}\` | **\`${sanitizeMd(inv.operation)}\`** | \`${sanitizeMd(inv.inputVariable)}\` | \`${sanitizeMd(inv.outputVariable)}\` |`);
            });
            lines.push('');
          }

          // Fault Handlers
          if (bpel.faultHandlers.length > 0) {
            lines.push(`##### Gestione Eccezioni (Fault Handlers)`);
            lines.push(`| # | Fault Name / Handler |`);
            lines.push('|---|---|');
            bpel.faultHandlers.forEach((fh, fIdx) => {
              lines.push(`| ${fIdx + 1} | \`${sanitizeMd(fh)}\` |`);
            });
            lines.push('');
          }
        });
      }
      lines.push('');
    }

    // Oracle Mediator (.mplan)
    if (sections.includeMediatorsCatalog) {
      lines.push(`### 3.3 ${isIt ? 'Regole di Routing Oracle Mediator (.mplan)' : 'Oracle Mediator Routing Rules (.mplan)'} (${ecosystem.mediators.length})`);
      lines.push('');
      if (ecosystem.mediators.length === 0) {
        lines.push(`> *${isIt ? 'Nessun descrittore Oracle Mediator (.mplan) rilevato.' : 'No Mediator files found.'}*`);
      } else {
        ecosystem.mediators.forEach((med, mIdx) => {
          lines.push(`#### 3.3.${mIdx + 1} Mediator: \`${med.name}\``);
          lines.push(`- **${isIt ? 'File' : 'File'}**: \`${med.relativePath || med.fileName}\``);
          lines.push(`- **${isIt ? 'Numero Operazioni Gestite' : 'Handled Operations'}**: **${med.operations.length}**`);
          lines.push('');

          med.operations.forEach((op) => {
            lines.push(`##### Operazione: \`${op.name}\``);
            if (op.routingRules.length === 0) {
              lines.push(`- *Nessuna regola di routing dichiarata per questa operazione.*`);
            } else {
              lines.push(`| Regola | Target Service | Azione | Filtro (Expression) | Trasformazioni XSLT |`);
              lines.push('|---|---|---|---|---|');
              op.routingRules.forEach((rr, rIdx) => {
                const xsls = rr.transformations.map((t) => `\`${t}\``).join('<br/>') || '-';
                const filter = rr.filterExpression ? `\`${sanitizeMd(rr.filterExpression)}\`` : 'Nessuno (Diretto)';
                lines.push(`| **#${rIdx + 1}** | \`${sanitizeMd(rr.targetService || 'Self')}\` | \`${rr.actionType || 'invoke'}\` | ${filter} | ${xsls} |`);
              });
            }
            lines.push('');
          });
        });
      }
      lines.push('');
    }

    // Human Tasks (.task)
    if (sections.includeHumanTasksCatalog) {
      lines.push(`### 3.4 ${isIt ? 'Human Workflow & Task Utente (.task)' : 'Human Workflow & Approval Tasks (.task)'} (${ecosystem.humanTasks.length})`);
      lines.push('');
      if (ecosystem.humanTasks.length === 0) {
        lines.push(`> *${isIt ? 'Nessun descrittore Human Task (.task) rilevato.' : 'No Human Task files found.'}*`);
      } else {
        lines.push(`| ${isIt ? 'Nome Task' : 'Task Name'} | ${isIt ? 'Titolo Notifica' : 'Notification Title'} | ${isIt ? 'Esiti Previsti (Outcomes)' : 'Outcomes'} | ${isIt ? 'Assegnatari / Ruoli' : 'Assignees / Roles'} | ${isIt ? 'Priorità' : 'Priority'} |`);
        lines.push('|---|---|---|---|---|');
        ecosystem.humanTasks.forEach((ht) => {
          const outcomes = ht.outcomes.map((o) => `\`${o}\``).join(', ') || '`APPROVE`, `REJECT`';
          const parts = ht.participants.map((p) => `\`${p}\``).join(', ') || '`Workflow Users`';
          lines.push(`| **\`${sanitizeMd(ht.name)}\`** | \`${sanitizeMd(ht.title || ht.name)}\` | ${outcomes} | ${parts} | \`${ht.priority || '3'}\` |`);
        });
        lines.push('');
      }
    }
  }

  // ==========================================
  // 4. ADAPTER JCA & MATRICE JNDI
  // ==========================================
  if (sections.includeJcaMatrix) {
    lines.push(`## 4. ${isIt ? 'Adapter JCA & Matrice JNDI (DB, JMS, File, FTP, AQ)' : 'JCA Adapters & JNDI Matrix (DB, JMS, File, FTP, AQ)'}`);
    lines.push('');
    lines.push(
      isIt
        ? `Tutti i connettori JCA 1.5 del progetto analizzati in dettaglio: configurazione di connessione WebLogic (JNDI), query SQL, mapping dei parametri, politiche transazionali e configurazione di messaggistica.`
        : `All JCA 1.5 adapters analyzed in detail: WebLogic JNDI connection parameters, SQL queries, parameter mapping, transaction policies, and messaging endpoints.`
    );
    lines.push('');

    if (ecosystem.jcaAdapters.length === 0) {
      lines.push(`> *${isIt ? 'Nessun file .jca rilevato nel progetto.' : 'No .jca files found.'}*`);
    } else {
      // Summary table
      lines.push(`### ${isIt ? 'Riepilogo Matrice Connettori JCA & JNDI' : 'JCA & JNDI Matrix Summary'}`);
      lines.push('');
      lines.push(`| ${isIt ? 'Nome Adapter' : 'Adapter Name'} | ${isIt ? 'Tipo' : 'Type'} | ${isIt ? 'JNDI Connection Factory' : 'JNDI Location'} | ${isIt ? 'Operazione / Query' : 'Operation / Query'} | ${isIt ? 'Tabelle / Destination' : 'Tables / Destination'} |`);
      lines.push('|---|---|---|---|---|');

      ecosystem.jcaAdapters.forEach((jca) => {
        const jndi = jca.connectionFactory.location || 'N/D';
        jca.endpoints.forEach((ep) => {
          let opDetail = ep.operation;
          let tables = 'N/D';
          if (ep.sqlAnalysis) {
            opDetail = `${ep.sqlAnalysis.sqlType || ''} ${ep.sqlAnalysis.procedureName || ep.operation}`;
            tables = ep.sqlAnalysis.tables.join(', ') || ep.sqlAnalysis.descriptorName || 'N/D';
          } else if (ep.messagingAnalysis) {
            opDetail = `${ep.messagingAnalysis.destinationType || 'JMS'}: ${ep.messagingAnalysis.destinationName || ep.operation}`;
            tables = ep.messagingAnalysis.payloadType || 'TextMessage';
          } else if (ep.fileAnalysis) {
            opDetail = `File: ${ep.fileAnalysis.fileName || '*'}`;
            tables = ep.fileAnalysis.physicalDirectory || ep.fileAnalysis.logicalDirectory || 'Dir';
          }
          lines.push(`| **\`${sanitizeMd(jca.name)}\`** | \`${jca.adapter.toUpperCase()}\` | \`${sanitizeMd(jndi)}\` | \`${sanitizeMd(opDetail)}\` | \`${sanitizeMd(tables)}\` |`);
        });
      });
      lines.push('');

      // Deep dive for each JCA file
      lines.push(`### ${isIt ? 'Schede Tecniche di Dettaglio per Singolo Adapter JCA' : 'Detailed Technical Sheets per JCA Adapter'}`);
      lines.push('');

      ecosystem.jcaAdapters.forEach((jca, jIdx) => {
        lines.push(`#### 4.${jIdx + 1} Adapter: \`${jca.name}\` (${jca.adapter.toUpperCase()})`);
        lines.push(`- **${isIt ? 'File Sorgente' : 'Source File'}**: \`${jca.relativePath || jca.fileName}\``);
        lines.push(`- **JNDI Location**: \`${jca.connectionFactory.location || 'N/D'}\``);
        lines.push(`- **${isIt ? 'Classe Adapter' : 'Adapter Class'}**: \`${jca.adapter}\``);
        lines.push(`- **${isIt ? 'Totale Endpoints' : 'Total Endpoints'}**: **${jca.endpoints.length}**`);
        lines.push('');

        jca.endpoints.forEach((ep, epIdx) => {
          lines.push(`##### Endpoint ${epIdx + 1}: \`${ep.operation}\` (${ep.type.toUpperCase()})`);
          lines.push(`- **Spec Class**: \`${ep.specClassName}\``);

          // If DB SQL Analysis
          if (ep.sqlAnalysis) {
            const sql = ep.sqlAnalysis;
            lines.push(`- **SQL Type**: \`${sql.sqlType || 'PURE SQL'}\``);
            if (sql.procedureName) lines.push(`- **Stored Procedure / Package**: \`${sql.procedureName}\``);
            if (sql.tables && sql.tables.length > 0) lines.push(`- **${isIt ? 'Tabelle Coinvolte' : 'Tables Involved'}**: ${sql.tables.map((t) => `\`${t}\``).join(', ')}`);
            if (sql.parameters && sql.parameters.length > 0) {
              lines.push(`- **${isIt ? 'Parametri Rilevati' : 'Detected Parameters'}**: ${sql.parameters.map((p) => `\`${p}\``).join(', ')}`);
            }
            if (sql.sqlString) {
              lines.push('');
              lines.push('```sql');
              lines.push(sql.sqlString.trim());
              lines.push('```');
              lines.push('');
            }
          }

          // If JMS Messaging Analysis
          if (ep.messagingAnalysis) {
            const msg = ep.messagingAnalysis;
            lines.push(`- **Destination Name**: \`${msg.destinationName || 'N/D'}\``);
            lines.push(`- **Destination Type**: \`${msg.destinationType || 'Queue'}\``);
            lines.push(`- **Payload Type**: \`${msg.payloadType || 'TextMessage'}\``);
            if (msg.messageSelector) lines.push(`- **Message Selector**: \`${msg.messageSelector}\``);
            if (msg.deliveryMode) lines.push(`- **Delivery Mode**: \`${msg.deliveryMode}\``);
          }

          // If File / FTP Analysis
          if (ep.fileAnalysis) {
            const fa = ep.fileAnalysis;
            if (fa.physicalDirectory) lines.push(`- **Physical Directory**: \`${fa.physicalDirectory}\``);
            if (fa.logicalDirectory) lines.push(`- **Logical Directory**: \`${fa.logicalDirectory}\``);
            if (fa.fileName) lines.push(`- **File Naming Pattern**: \`${fa.fileName}\``);
            if (fa.pollingFrequency) lines.push(`- **Polling Frequency**: \`${fa.pollingFrequency}s\``);
            if (fa.deleteAfterRead !== undefined) lines.push(`- **Delete After Read**: \`${fa.deleteAfterRead}\``);
          }

          // Properties table for this endpoint
          if (ep.properties && ep.properties.length > 0) {
            lines.push('');
            lines.push(`| Proprietà InteractionSpec | Valore Configurato |`);
            lines.push('|---|---|');
            ep.properties.forEach((p) => {
              lines.push(`| \`${sanitizeMd(p.name)}\` | \`${sanitizeMd(p.value)}\` |`);
            });
            lines.push('');
          }
        });
      });
    }
    lines.push('');
  }

  // ==========================================
  // 5. CONTRATTI WSDL & SCHEMI XSD
  // ==========================================
  if (sections.includeWsdlXsdCatalog) {
    lines.push(`## 5. ${isIt ? 'Contratti di Servizio WSDL & Schemi Dati XSD' : 'Service Contracts WSDL & Data Schemas XSD'}`);
    lines.push('');

    // WSDL Contracts
    lines.push(`### 5.1 ${isIt ? 'Contratti WSDL (Interfacce SOAP / Web Services)' : 'WSDL Contracts (SOAP Interfaces)'} (${ecosystem.wsdlContracts.length})`);
    lines.push('');
    if (ecosystem.wsdlContracts.length === 0) {
      lines.push(`> *${isIt ? 'Nessun contratto WSDL rilevato nei file.' : 'No WSDL contracts found.'}*`);
    } else {
      ecosystem.wsdlContracts.forEach((wsdl, wIdx) => {
        lines.push(`#### 5.1.${wIdx + 1} Contratto WSDL: \`${wsdl.name}\``);
        lines.push(`- **${isIt ? 'File' : 'File'}**: \`${wsdl.relativePath || wsdl.fileName}\``);
        lines.push(`- **Target Namespace**: \`${wsdl.targetNamespace || 'N/D'}\``);
        lines.push(`- **PortTypes**: ${wsdl.portTypes.map((pt) => `\`${pt.name}\``).join(', ') || 'N/D'}`);
        lines.push('');

        wsdl.portTypes.forEach((pt) => {
          lines.push(`##### PortType: \`${sanitizeMd(pt.name)}\``);
          lines.push(`| ${isIt ? 'Operazione' : 'Operation'} | ${isIt ? 'Messaggio Input' : 'Input Message'} | ${isIt ? 'Messaggio Output' : 'Output Message'} | Fault Messages |`);
          lines.push('|---|---|---|---|');
          pt.operations.forEach((op) => {
            lines.push(`| **\`${sanitizeMd(op.name)}\`** | \`${sanitizeMd(op.inputMessage || '-')}\` | \`${sanitizeMd(op.outputMessage || '-')}\` | \`${sanitizeMd(op.faultMessages.join(', ') || '-')}\` |`);
          });
          lines.push('');
        });
      });
    }
    lines.push('');

    // XSD Schemas
    lines.push(`### 5.2 ${isIt ? 'Schemi Dati XSD (Entità e Modelli XML)' : 'XSD Data Schemas'} (${ecosystem.xsdSchemas.length})`);
    lines.push('');
    if (ecosystem.xsdSchemas.length === 0) {
      lines.push(`> *${isIt ? 'Nessuno schema XSD rilevato.' : 'No XSD schemas found.'}*`);
    } else {
      lines.push(`| Schema XSD | ${isIt ? 'Elementi Root' : 'Root Elements'} | ${isIt ? 'Complex Types' : 'Complex Types'} | Target Namespace | ${isIt ? 'Percorso' : 'Path'} |`);
      lines.push('|---|---|---|---|---|');
      ecosystem.xsdSchemas.forEach((xsd) => {
        const rootEls = xsd.elements.map((e) => `\`<${sanitizeMd(e.name)}>\``).slice(0, 3).join(', ') + (xsd.elements.length > 3 ? '...' : '');
        lines.push(`| **\`${sanitizeMd(xsd.name)}\`** | ${rootEls || '`N/D`'} | **\`${xsd.complexTypes.length}\`** | \`${sanitizeMd(xsd.targetNamespace)}\` | \`${sanitizeMd(xsd.relativePath || xsd.fileName)}\` |`);
      });
      lines.push('');
    }

    // ComponentType (dataset di esempio)
    const compTypes = ecosystem.componentTypes;
    if (sections.includeComponentTypeCatalog !== false && compTypes && compTypes.length > 0) {
      lines.push(`### 5.3 ${isIt ? 'Descrittori ComponentType SCA' : 'SCA ComponentType Descriptors'} (${compTypes.length})`);
      lines.push('');
      lines.push(`| ${isIt ? 'ComponentType' : 'ComponentType'} | Services | References | Properties | ${isIt ? 'Percorso' : 'Path'} |`);
      lines.push('|---|---|---|---|---|');
      compTypes.slice(0, 100).forEach((ct) => {
        const svc = ct.services.map(s=> s.interfacePortType ? `\`${sanitizeMd(s.name)}\`→\`${sanitizeMd(cleanPortType(s.interfacePortType) || '')}\`` : `\`${sanitizeMd(s.name)}\``).slice(0,3).join('<br/>') || '`N/D`';
        const refs = ct.references.map(r=> r.interfacePortType ? `\`${sanitizeMd(r.name)}\`→\`${sanitizeMd(cleanPortType(r.interfacePortType) || '')}\`` : `\`${sanitizeMd(r.name)}\``).slice(0,3).join('<br/>') || '`N/D`';
        lines.push(`| **\`${sanitizeMd(ct.name)}\`** | ${svc} | ${refs} | **\`${ct.properties.length}\`** | \`${sanitizeMd(ct.relativePath || ct.fileName)}\` |`);
      });
      if (compTypes.length > 100) lines.push(`> *... +${compTypes.length - 100} altri ComponentType omessi per brevità*`);
      lines.push('');
    }

    // DVM (repository MDS di esempio)
    const dvms = ecosystem.dvms;
    if (sections.includeDvmCatalog !== false && dvms && dvms.length > 0) {
      lines.push(`### 5.4 ${isIt ? 'Domain Value Maps (DVM)' : 'Domain Value Maps (DVM)'} (${dvms.length})`);
      lines.push('');
      lines.push(`| ${isIt ? 'DVM Name' : 'DVM Name'} | Colonne | Righe | ${isIt ? 'Percorso' : 'Path'} |`);
      lines.push('|---|---|---|---|');
      dvms.slice(0, 100).forEach((d) => {
        lines.push(`| **\`${sanitizeMd(d.name)}\`** | \`${sanitizeMd(d.columns.join(', ') || 'N/D')}\` | **\`${d.rowsCount}\`** | \`${sanitizeMd(d.relativePath || d.fileName)}\` |`);
      });
      if (dvms.length > 100) lines.push(`> *... +${dvms.length - 100} altri DVM omessi*`);
      lines.push('');
    }
  }

  // ==========================================
  // 6. MAPPATURE & TRASFORMAZIONI XSLT
  // ==========================================
  if (sections.includeXsltCatalog) {
    lines.push(`## 6. ${isIt ? 'Mappature & Trasformazioni Dati XSLT' : 'Data Mappings & XSLT Transformations'} (${ecosystem.xsltTransforms.length})`);
    lines.push('');
    if (ecosystem.xsltTransforms.length === 0) {
      lines.push(`> *${isIt ? 'Nessuna trasformazione XSLT (.xsl / .xslt) rilevata.' : 'No XSLT stylesheets found.'}*`);
    } else {
      lines.push(`| ${isIt ? 'Foglio di Stile' : 'Stylesheet'} | ${isIt ? 'Template Matches' : 'Template Matches'} | ${isIt ? 'Namespaces Sorgente' : 'Source Namespaces'} | ${isIt ? 'Percorso File' : 'Path'} |`);
      lines.push('|---|---|---|---|');
      ecosystem.xsltTransforms.forEach((xsl) => {
        const matches = xsl.templateMatches.map((m) => `\`match="${sanitizeMd(m)}"\``).slice(0, 3).join('<br/>') || '`match="/"`';
        const nsCount = Object.keys(xsl.sourceNamespaces || {}).length;
        lines.push(`| **\`${sanitizeMd(xsl.name)}\`** | ${matches} | **\`${nsCount}\`** namespaces | \`${sanitizeMd(xsl.relativePath || xsl.fileName)}\` |`);
      });
      lines.push('');
    }
  }

  // ==========================================
  // 7. ADF INTEGRATIONS & DATA CONTROLS
  // ==========================================
  if (sections.includeAdfBindings && ecosystem.dataControls.length > 0) {
    lines.push(`## 7. ${isIt ? 'Integrazioni ADF & Data Controls' : 'ADF Integrations & Data Controls'} (${ecosystem.dataControls.length})`);
    lines.push('');
    lines.push(`| ${isIt ? 'File Data Control' : 'Data Control File'} | ${isIt ? 'Tipo' : 'Type'} | ${isIt ? 'Percorso Relativo' : 'Relative Path'} |`);
    lines.push('|---|---|---|');
    ecosystem.dataControls.forEach((dc) => {
      lines.push(`| **\`${sanitizeMd(dc.name)}\`** | \`${dc.type.toUpperCase()}\` | \`${sanitizeMd(dc.relativePath || dc.fileName)}\` |`);
    });
    lines.push('');
  }

  // ==========================================
  // 8. DEVOPS, SCRIPT WLST & PROMOZIONE AMBIENTI
  // ==========================================
  if (sections.includeDevOpsChecklist) {
    lines.push(`## 8. ${isIt ? 'DevOps, Script WLST & Promozione Ambienti' : 'DevOps, WLST Scripts & Environment Promotion'}`);
    lines.push('');
    lines.push(
      isIt
        ? `Guida e checklist esaustiva per il provisioning su WebLogic Server, packaging SAR, configurazione dei Config Plan (Plan.xml) e deployment nei vari ambienti (Sviluppo, Collaudo, Produzione):`
        : `Deployment configuration guide for WebLogic Server, SAR packaging, SOA Config Plans (Plan.xml), and multi-environment promotion (DEV, TEST, PROD):`
    );
    lines.push('');

    // Script Catalog
    if (ecosystem.scripts.length > 0) {
      lines.push(`### 8.1 ${isIt ? 'Catalogo Script di Automazione e Build' : 'Automation & Build Scripts Catalog'} (${ecosystem.scripts.length})`);
      lines.push('');
      lines.push(`| ${isIt ? 'Script' : 'Script'} | ${isIt ? 'Tipo' : 'Type'} | ${isIt ? 'Scopo / Destinazione' : 'Purpose / Role'} | ${isIt ? 'Righe' : 'Lines'} | ${isIt ? 'Percorso' : 'Path'} |`);
      lines.push('|---|---|---|---|---|');
      ecosystem.scripts.forEach((s) => {
        lines.push(`| **\`${sanitizeMd(s.name)}\`** | \`${s.type.toUpperCase()}\` | \`${sanitizeMd(s.purpose)}\` | **\`${s.linesCount}\`** | \`${sanitizeMd(s.relativePath || s.name)}\` |`);
      });
      lines.push('');
    }

    // WebLogic Configuration Checklist
    lines.push(`### 8.2 ${isIt ? 'Checklist di Configurazione WebLogic Server (WLS)' : 'WebLogic Server (WLS) Configuration Checklist'}`);
    lines.push('');
    lines.push(`1. **JDBC Data Sources (Database JCA)**:`);
    lines.push(`   - Censire su WebLogic Console tutti i JNDI Database richiesti (es. \`eis/DB/...\`).`);
    lines.push(`   - Configurare il Connection Pool (Initial Capacity: 10, Max Capacity: 50, Test on Reserve abilitato).`);
    lines.push(`   - Impostare il supporto per transazioni distribuite XA o \`Emulate Two-Phase Commit\` in caso di driver non-XA.`);
    lines.push('');
    lines.push(`2. **JMS Modules & Subdeployments (JMS JCA)**:`);
    lines.push(`   - Creare i JMS Modules targettati sui managed server SOA.`);
    lines.push(`   - Censire i JNDI delle Connection Factory (\`jms/...\`, \`eis/wls/Queue\`).`);
    lines.push(`   - Creare le Uniform Distributed Queues (UDQ) e verificare i parametri di Redelivery Limit e Error Queue.`);
    lines.push('');
    lines.push(`3. **SOA Config Plan (Plan.xml)**:`);
    lines.push(`   - Sostituire le URL degli endpoint WSDL remoti per ciascun ambiente di destinazione.`);
    lines.push(`   - Configurare le credenziali di sicurezza CSF (Credential Store Framework) evitando password in chiaro.`);
    lines.push(`   - Aggiornare i percorsi fisici delle directory per gli adapter File e FTP.`);
    lines.push('');
    lines.push(`4. **Promozione Ambienti (DEV ➔ TEST ➔ PROD)**:`);
    lines.push(`   - Validare il build SAR tramite Maven o Ant.`);
    lines.push(`   - Eseguire il deploy tramite script WLST: \`sca_deployComposite('http://admin_host:7001', 'sca_project_rev1.0.jar', configplan='soa_configplan_prod.xml')\`.`);
    lines.push(`   - Eseguire lo smoke-test dei servizi esposti da Enterprise Manager (Fusion Middleware Control).`);
    lines.push('');
  }

  // ==========================================
  // 9. MERMAID DIAGRAMS
  // ==========================================
  if (sections.includeMermaidDiagrams) {
    lines.push(`## 9. ${isIt ? 'Diagrammi Architetturali Mermaid (End-to-End SCA Flow)' : 'Architectural Mermaid Diagrams (End-to-End SCA Flow)'}`);
    lines.push('');
    lines.push('```mermaid');
    lines.push('graph TD');
    lines.push('  %% Layer 1: Consumer & Canali');
    lines.push('  subgraph Layer_Consumer ["1. Consumer Esterni & Canali Applicativi"]');
    lines.push('    WebClient["Portali Web / UI"]');
    lines.push('    SoapClient["Client SOAP Esterni"]');
    lines.push('    RestClient["Applicazioni Mobile / REST"]');
    lines.push('  end');
    lines.push('');
    lines.push('  %% Layer 2: SCA Inbound Services');
    lines.push('  subgraph Layer_SCA_Inbound ["2. Servizi Inbound SCA (composite.xml)"]');
    if (ecosystem.composites.length > 0 && ecosystem.composites[0].services.length > 0) {
      ecosystem.composites[0].services.slice(0, 4).forEach((s, idx) => {
        lines.push(`    InboundSvc_${idx}["Inbound: ${sanitizeMermaid(s.name)} (${sanitizeMermaid(s.bindingType || 'SOAP')})"]`);
      });
    } else {
      lines.push('    InboundSvc_0["Inbound SOAP / REST Service"]');
    }
    lines.push('  end');
    lines.push('');
    lines.push('  %% Layer 3: Orchestration');
    lines.push('  subgraph Layer_Orchestration ["3. Orchestrazione, Processi & Mediazione"]');
    if (ecosystem.mediators.length > 0) {
      lines.push(`    MedComp["Oracle Mediator: ${sanitizeMermaid(ecosystem.mediators[0].name)}"]`);
    }
    if (ecosystem.bpelProcesses.length > 0) {
      lines.push(`    BpelComp["BPEL Process: ${sanitizeMermaid(ecosystem.bpelProcesses[0].name)}"]`);
    }
    if (ecosystem.bpmnProcesses.length > 0) {
      lines.push(`    BpmnComp["BPMN 2.0: ${sanitizeMermaid(ecosystem.bpmnProcesses[0].name)}"]`);
    }
    if (ecosystem.humanTasks.length > 0) {
      lines.push(`    TaskComp["Human Task: ${sanitizeMermaid(ecosystem.humanTasks[0].name)}"]`);
    }
    if (ecosystem.mediators.length === 0 && ecosystem.bpelProcesses.length === 0 && ecosystem.bpmnProcesses.length === 0) {
      lines.push('    ScaEngine["Oracle SCA Orchestration Engine"]');
    }
    lines.push('  end');
    lines.push('');
    lines.push('  %% Layer 4: Adapters');
    lines.push('  subgraph Layer_Adapters ["4. Adapter JCA & Riferimenti Outbound"]');
    if (ecosystem.jcaAdapters.length > 0) {
      ecosystem.jcaAdapters.slice(0, 4).forEach((jca, idx) => {
        lines.push(`    Adapter_${idx}["JCA ${sanitizeMermaid(jca.adapter.toUpperCase())}: ${sanitizeMermaid(jca.name)}<br/>(${sanitizeMermaid(jca.connectionFactory.location || 'JNDI')})"]`);
      });
    } else {
      lines.push('    Adapter_0["JCA DB Adapter (eis/DB)"]');
      lines.push('    Adapter_1["JCA JMS Adapter (eis/wls/Queue)"]');
    }
    lines.push('  end');
    lines.push('');
    lines.push('  %% Layer 5: Backend Systems');
    lines.push('  subgraph Layer_Backend ["5. Risorse di Backend & Database"]');
    lines.push('    OracleDB[("Oracle Database Transazionale")]');
    lines.push('    JmsBroker[("WebLogic JMS Message Broker")]');
    lines.push('    FileSystem[("File System / Server FTP")]');
    lines.push('  end');
    lines.push('');
    lines.push('  %% Connections');
    lines.push('  SoapClient --> InboundSvc_0');
    lines.push('  WebClient --> InboundSvc_0');
    lines.push('  RestClient --> InboundSvc_0');
    if (ecosystem.mediators.length > 0) {
      lines.push('  InboundSvc_0 --> MedComp');
      if (ecosystem.bpelProcesses.length > 0) lines.push('  MedComp --> BpelComp');
      if (ecosystem.bpmnProcesses.length > 0) lines.push('  MedComp --> BpmnComp');
    } else if (ecosystem.bpelProcesses.length > 0) {
      lines.push('  InboundSvc_0 --> BpelComp');
    }
    if (ecosystem.jcaAdapters.length > 0) {
      lines.push('  BpelComp --> Adapter_0');
      lines.push('  Adapter_0 --> OracleDB');
      if (ecosystem.jcaAdapters.length > 1) {
        lines.push('  BpelComp --> Adapter_1');
        lines.push('  Adapter_1 --> JmsBroker');
      }
    }
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}
