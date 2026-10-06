import {
  BpelProcessInfo,
  BpmnProcessInfo,
  CompositeComponent,
  CompositeConfig,
  CompositeReference,
  CompositeService,
  CompositeWire,
  DataControlInfo,
  HumanTaskInfo,
  JCAAdapterConfig,
  MediatorInfo,
  MediatorRoutingRule,
  OracleEcosystem,
  ProjectInfo,
  ScriptInfo,
  WorkspaceInfo,
  WsdlContractInfo,
  WsdlOperation,
  WsdlPortType,
  XsdSchemaInfo,
  XsltInfo,
} from '../types/jca';
import { parseJcaContent } from './jcaParser';

function parseXmlSafe(content: string): Document | null {
  const withoutBom = content.replace(/^\uFEFF/, '');
  const trimmed = withoutBom.trimStart();
  // Rimuove commenti iniziali <!-- ... --> prima di verificare '<'
  const withoutLeadingComments = trimmed.replace(/^(<!--[\s\S]*?-->\s*)*/, '');
  if (!withoutLeadingComments.startsWith('<')) {
    if (trimmed.length > 0 && !trimmed.includes('<')) return null;
  }
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(withoutBom, 'text/xml');
    if (doc.getElementsByTagName('parsererror').length > 0) {
      return null;
    }
    return doc;
  } catch {
    return null;
  }
}

function getLocalName(el: Element): string {
  const tag = el.tagName || '';
  const parts = tag.split(':');
  return parts[parts.length - 1];
}

function getDirectChildElements(parent: Element, localName: string): Element[] {
  return Array.from(parent.children).filter((c) => getLocalName(c as Element) === localName) as Element[];
}

function isCompositeDocument(doc: Document): boolean {
  const root = doc.documentElement;
  if (!root) return false;
  const ln = getLocalName(root);
  if (ln === 'composite') return true;
  // Solo se root è wrapper noto (es. sca:definitions), altrimenti falso positivo su <composite> dentro commento/payload
  const hasDirectCompositeChild = Array.from(root.children).some((c) => getLocalName(c as Element) === 'composite');
  if (hasDirectCompositeChild) return true;
  return false;
}

/**
 * Estrae il nome del PortType dall'attributo interface del composite SCA.
 * Gestisce sia wsdl.interface che wsdl.portType e diversi formati SCA 11g/12c:
 *  - http://xmlns.oracle.com/...#wsdl.interface(MyPortType)
 *  - http://xmlns.oracle.com/...#wsdl.portType(MyPortType)
 *  - wsdl.interface(MyPort)
 *  - MyPortType
 */
function extractPortType(interfaceAttr?: string): string | undefined {
  if (!interfaceAttr) return undefined;
  const trimmed = interfaceAttr.trim();
  if (!trimmed) return undefined;
  const hashPart = trimmed.includes('#') ? (trimmed.split('#').pop() || trimmed) : trimmed;
  // Supporta QName con prefisso (ns:MyPortType) dentro parentesi
  const match = hashPart.match(/(?:wsdl\.)?(?:portType|interface)\s*\(\s*([^)]+?)\s*\)/i);
  if (match && match[1]) {
    const raw = match[1].trim();
    // Se contiene ':', prendi local part dopo ':'
    if (raw.includes(':')) return raw.split(':').pop()!.trim();
    return raw;
  }
  const cleaned = hashPart.replace(/wsdl\./gi, '').replace(/[()]/g, '').trim();
  if (cleaned.includes(':')) return cleaned.split(':').pop()?.trim() || cleaned;
  const legacy = cleaned.match(/interface\s*\(\s*(.+)/i);
  if (legacy && legacy[1]) return legacy[1].replace(/[()]/g, '').trim().split(':').pop()!.trim();
  return cleaned || undefined;
}

// 1. Composite.xml Parser
export function parseCompositeXml(content: string, fileName: string, relativePath: string): CompositeConfig {
  const doc = parseXmlSafe(content);
  let name = fileName.replace(/\.xml$/i, '');
  let revision = '1.0';
  let mode = 'active';
  let state = 'on';
  let targetNamespace = '';

  const services: CompositeService[] = [];
  const components: CompositeComponent[] = [];
  const references: CompositeReference[] = [];
  const wires: CompositeWire[] = [];

  if (doc && isCompositeDocument(doc)) {
    const compositeEl = (doc.getElementsByTagName('composite')[0] as Element) || (doc.getElementsByTagNameNS('*', 'composite')[0] as Element) || doc.documentElement;
    if (compositeEl) {
      name = compositeEl.getAttribute('name') || name;
      revision = compositeEl.getAttribute('revision') || revision;
      mode = compositeEl.getAttribute('mode') || mode;
      state = compositeEl.getAttribute('state') || state;
      targetNamespace = compositeEl.getAttribute('targetNamespace') || '';
    }

    // Services (Inbound / Exposed) - solo figli diretti di <composite>, non quelli dentro <component>
    const serviceEls = getDirectChildElements(compositeEl as Element, 'service');
    serviceEls.forEach((s) => {
      const sName = s.getAttribute('name') || 'UnnamedService';
      const uiWsdlLocation = s.getAttribute('ui:wsdlLocation') || s.getAttribute('wsdlLocation') || undefined;

      const interfaceEl = s.getElementsByTagName('interface.wsdl')[0] || s.getElementsByTagName('interface')[0];
      const interfaceWsdl = interfaceEl?.getAttribute('interface') || undefined;
      const interfacePortType = extractPortType(interfaceWsdl);

      const bindingWs = s.getElementsByTagName('binding.ws')[0];
      const bindingJca = s.getElementsByTagName('binding.jca')[0];
      const bindingRest = s.getElementsByTagName('binding.rest')[0];
      const bindingDirect = s.getElementsByTagName('binding.direct')[0];

      let bindingType: CompositeService['bindingType'] = 'other';
      let bindingConfig: string | undefined = undefined;
      let jcaLocation: string | undefined = undefined;

      if (bindingWs) {
        bindingType = 'ws';
        bindingConfig = bindingWs.getAttribute('port') || bindingWs.getAttribute('location') || undefined;
      } else if (bindingJca) {
        bindingType = 'jca';
        jcaLocation = bindingJca.getAttribute('config') || undefined;
        bindingConfig = jcaLocation;
      } else if (bindingRest) {
        bindingType = 'rest';
        bindingConfig = bindingRest.getAttribute('uri') || undefined;
      } else if (bindingDirect) {
        bindingType = 'direct';
      }

      services.push({
        name: sName,
        uiWsdlLocation,
        interfaceWsdl,
        interfacePortType,
        bindingType,
        bindingConfig,
        jcaLocation,
      });
    });

    // Components (BPEL, BPMN, Mediator, Human Task, Decision/Rules)
    const compEls = Array.from(doc.getElementsByTagName('component'));
    compEls.forEach((c) => {
      const cName = c.getAttribute('name') || 'UnnamedComponent';
      let cType: CompositeComponent['type'] = 'unknown';
      let implSrc: string | undefined = undefined;

      const bpelEl = c.getElementsByTagName('implementation.bpel')[0];
      const bpmnEl = c.getElementsByTagName('implementation.bpmn')[0];
      const mediatorEl = c.getElementsByTagName('implementation.mediator')[0];
      const taskEl = c.getElementsByTagName('implementation.workflow')[0] || c.getElementsByTagName('implementation.humanTask')[0];
      const decisionEl = c.getElementsByTagName('implementation.decision')[0];
      const springEl = c.getElementsByTagName('implementation.spring')[0];

      if (bpelEl) {
        cType = 'bpel';
        implSrc = bpelEl.getAttribute('src') || undefined;
      } else if (bpmnEl) {
        cType = 'bpmn';
        implSrc = bpmnEl.getAttribute('src') || undefined;
      } else if (mediatorEl) {
        cType = 'mediator';
        implSrc = mediatorEl.getAttribute('src') || undefined;
      } else if (taskEl) {
        cType = 'human-task';
        implSrc = taskEl.getAttribute('src') || undefined;
      } else if (decisionEl) {
        cType = 'decision';
        implSrc = decisionEl.getAttribute('src') || undefined;
      } else if (springEl) {
        cType = 'spring';
        implSrc = springEl.getAttribute('src') || undefined;
      }

      const compServices = Array.from(c.getElementsByTagName('service')).map((s) => s.getAttribute('name') || '');
      const compReferences = Array.from(c.getElementsByTagName('reference')).map((r) => r.getAttribute('name') || '');

      components.push({
        name: cName,
        type: cType,
        implementationSource: implSrc,
        services: compServices,
        references: compReferences,
        description: `Componente SCA ${cType.toUpperCase()} - ${cName}`,
      });
    });

    // References (Outbound / Adapters / External Partners) - solo figli diretti di <composite>
    const refEls = getDirectChildElements(compositeEl as Element, 'reference');
    refEls.forEach((r) => {
      const rName = r.getAttribute('name') || 'UnnamedReference';
      const uiWsdlLocation = r.getAttribute('ui:wsdlLocation') || r.getAttribute('wsdlLocation') || undefined;

      const interfaceEl = r.getElementsByTagName('interface.wsdl')[0] || r.getElementsByTagName('interface')[0];
      const interfaceWsdl = interfaceEl?.getAttribute('interface') || undefined;
      const interfacePortType = extractPortType(interfaceWsdl);

      const bindingWs = r.getElementsByTagName('binding.ws')[0];
      const bindingJca = r.getElementsByTagName('binding.jca')[0];
      const bindingRest = r.getElementsByTagName('binding.rest')[0];
      const bindingDirect = r.getElementsByTagName('binding.direct')[0];

      let bindingType: CompositeReference['bindingType'] = 'other';
      let bindingConfig: string | undefined = undefined;
      let jcaLocation: string | undefined = undefined;

      if (bindingWs) {
        bindingType = 'ws';
        bindingConfig = bindingWs.getAttribute('location') || bindingWs.getAttribute('port') || undefined;
      } else if (bindingJca) {
        bindingType = 'jca';
        jcaLocation = bindingJca.getAttribute('config') || undefined;
        bindingConfig = jcaLocation;
      } else if (bindingRest) {
        bindingType = 'rest';
        bindingConfig = bindingRest.getAttribute('uri') || undefined;
      } else if (bindingDirect) {
        bindingType = 'direct';
      }

      references.push({
        name: rName,
        uiWsdlLocation,
        interfaceWsdl,
        interfacePortType,
        bindingType,
        bindingConfig,
        jcaLocation,
      });
    });

    // Wires (Internal routing between Services, Components and References)
    const wireEls = Array.from(doc.getElementsByTagName('wire'));
    wireEls.forEach((w) => {
      const sourceEl = w.getElementsByTagName('source.uri')[0];
      const targetEl = w.getElementsByTagName('target.uri')[0];
      const source = sourceEl?.textContent || w.getAttribute('source') || '';
      const target = targetEl?.textContent || w.getAttribute('target') || '';
      if (source && target) {
        wires.push({ source, target });
      }
    });
  }

  return {
    id: (() => { let h=0; const s=relativePath+fileName; for(let i=0;i<s.length;i++) h=((h<<5)-h+s.charCodeAt(i))|0; return `composite-${(relativePath||fileName).replace(/[^a-zA-Z0-9]/g,"-").slice(0,48)}-${Math.abs(h).toString(36)}`; })(),
    name,
    revision,
    mode,
    state,
    targetNamespace,
    services,
    components,
    references,
    wires,
    rawXml: content,
    fileName,
    relativePath,
    fileSize: new Blob([content]).size,
  };
}

// 2. BPEL Parser (.bpel)
export function parseBpelXml(content: string, fileName: string, relativePath: string): BpelProcessInfo {
  const doc = parseXmlSafe(content);
  let name = fileName.replace(/\.bpel$/i, '');
  const partnerLinks: BpelProcessInfo['partnerLinks'] = [];
  const variables: BpelProcessInfo['variables'] = [];
  const invokes: BpelProcessInfo['invokes'] = [];
  const receives: BpelProcessInfo['receives'] = [];
  const faultHandlers: string[] = [];

  if (doc) {
    const processEl = doc.getElementsByTagName('process')[0] || doc.documentElement;
    if (processEl) {
      name = processEl.getAttribute('name') || name;
    }

    // PartnerLinks
    const plEls = Array.from(doc.getElementsByTagName('partnerLink'));
    plEls.forEach((pl) => {
      const plName = pl.getAttribute('name') || '';
      const plType = pl.getAttribute('partnerLinkType') || '';
      const myRole = pl.getAttribute('myRole') || undefined;
      const partnerRole = pl.getAttribute('partnerRole') || undefined;
      if (plName) {
        partnerLinks.push({ name: plName, partnerLinkType: plType, myRole, partnerRole });
      }
    });

    // Variables
    const varEls = Array.from(doc.getElementsByTagName('variable'));
    varEls.forEach((v) => {
      const vName = v.getAttribute('name') || '';
      if (vName) {
        variables.push({
          name: vName,
          messageType: v.getAttribute('messageType') || undefined,
          element: v.getAttribute('element') || undefined,
          type: v.getAttribute('type') || undefined,
        });
      }
    });

    // Invokes
    const invokeEls = Array.from(doc.getElementsByTagName('invoke'));
    invokeEls.forEach((inv) => {
      invokes.push({
        name: inv.getAttribute('name') || undefined,
        partnerLink: inv.getAttribute('partnerLink') || '',
        portType: inv.getAttribute('portType') || undefined,
        operation: inv.getAttribute('operation') || '',
        inputVariable: inv.getAttribute('inputVariable') || undefined,
        outputVariable: inv.getAttribute('outputVariable') || undefined,
      });
    });

    // Receives
    const recvEls = Array.from(doc.getElementsByTagName('receive'));
    recvEls.forEach((rcv) => {
      receives.push({
        name: rcv.getAttribute('name') || undefined,
        partnerLink: rcv.getAttribute('partnerLink') || '',
        portType: rcv.getAttribute('portType') || undefined,
        operation: rcv.getAttribute('operation') || '',
        variable: rcv.getAttribute('variable') || undefined,
        createInstance: rcv.getAttribute('createInstance') === 'yes' || rcv.getAttribute('createInstance') === 'true',
      });
    });

    // Catch / Faults
    const catchEls = Array.from(doc.getElementsByTagName('catch')).concat(Array.from(doc.getElementsByTagName('catchAll')));
    catchEls.forEach((c) => {
      const faultName = c.getAttribute('faultName') || c.tagName;
      faultHandlers.push(faultName);
    });
  }

  return {
    id: (() => { let h=0; const s=relativePath+fileName; for(let i=0;i<s.length;i++) h=((h<<5)-h+s.charCodeAt(i))|0; return `bpel-${(relativePath||fileName).replace(/[^a-zA-Z0-9]/g,"-").slice(0,48)}-${Math.abs(h).toString(36)}`; })(),
    name,
    partnerLinks,
    variables,
    invokes,
    receives,
    faultHandlers,
    fileName,
    relativePath,
    rawXml: content,
  };
}

// 3. BPMN Parser (.bpmn)
export function parseBpmnXml(content: string, fileName: string, relativePath: string): BpmnProcessInfo {
  const doc = parseXmlSafe(content);
  let name = fileName.replace(/\.bpmn$/i, '');
  const swimlanes: string[] = [];
  const userTasks: BpmnProcessInfo['userTasks'] = [];
  const serviceTasks: BpmnProcessInfo['serviceTasks'] = [];
  const gateways: BpmnProcessInfo['gateways'] = [];
  const events: BpmnProcessInfo['events'] = [];

  if (doc) {
    // Namespace-agnostic: cerca per localName
    const allEls = Array.from(doc.getElementsByTagName('*'));
    const findByLocal = (local: string) => allEls.filter((e) => getLocalName(e as Element) === local) as Element[];
    const processEl = findByLocal('process')[0] || doc.documentElement;
    if (processEl) {
      name = processEl.getAttribute('name') || processEl.getAttribute('id') || name;
    }

    // Lanes / Swimlanes
    findByLocal('lane').forEach((l) => {
      const lName = l.getAttribute('name') || l.getAttribute('id');
      if (lName) swimlanes.push(lName);
    });

    // User Tasks
    findByLocal('userTask').forEach((ut) => {
      userTasks.push({
        id: ut.getAttribute('id') || '',
        name: ut.getAttribute('name') || ut.getAttribute('id') || 'User Task',
      });
    });

    // Service Tasks
    findByLocal('serviceTask').forEach((st) => {
      serviceTasks.push({
        id: st.getAttribute('id') || '',
        name: st.getAttribute('name') || st.getAttribute('id') || 'Service Task',
        implementation: st.getAttribute('implementation') || undefined,
      });
    });

    // Gateways
    const gwTags = ['exclusiveGateway', 'parallelGateway', 'inclusiveGateway', 'eventBasedGateway', 'complexGateway'];
    gwTags.forEach((gt) => {
      findByLocal(gt).forEach((g) => {
        gateways.push({
          name: g.getAttribute('name') || g.getAttribute('id') || gt,
          type: gt.replace('Gateway', ''),
        });
      });
    });

    // Events
    const evTags = ['startEvent', 'endEvent', 'intermediateCatchEvent', 'intermediateThrowEvent', 'boundaryEvent'];
    evTags.forEach((et) => {
      findByLocal(et).forEach((e) => {
        events.push({
          name: e.getAttribute('name') || e.getAttribute('id') || et,
          type: et,
        });
      });
    });
  }

  return {
    id: (() => { let h=0; const s=relativePath+fileName; for(let i=0;i<s.length;i++) h=((h<<5)-h+s.charCodeAt(i))|0; return `bpmn-${(relativePath||fileName).replace(/[^a-zA-Z0-9]/g,"-").slice(0,48)}-${Math.abs(h).toString(36)}`; })(),
    name,
    swimlanes,
    userTasks,
    serviceTasks,
    gateways,
    events,
    fileName,
    relativePath,
    rawXml: content,
  };
}

// 4. Mediator Parser (.mplan)
export function parseMediatorXml(content: string, fileName: string, relativePath: string): MediatorInfo {
  const doc = parseXmlSafe(content);
  let name = fileName.replace(/\.mplan$/i, '');
  const operations: MediatorInfo['operations'] = [];

  if (doc) {
    const mediatorEl = doc.getElementsByTagName('Mediator')[0] || doc.documentElement;
    if (mediatorEl) {
      name = mediatorEl.getAttribute('name') || name;
    }

    const opEls = Array.from(doc.getElementsByTagName('operation'));
    opEls.forEach((op) => {
      const opName = op.getAttribute('name') || 'default';
      const routingRules: MediatorRoutingRule[] = [];

      const routeEls = Array.from(op.getElementsByTagName('route'));
      routeEls.forEach((r) => {
        const targetService = r.getAttribute('target') || r.getAttribute('service') || undefined;
        const opTarget = r.getAttribute('operation') || undefined;

        const conditionEl = r.getElementsByTagName('condition')[0];
        const filterExpression = conditionEl?.textContent || conditionEl?.getAttribute('expression') || undefined;

        const transformEls = Array.from(r.getElementsByTagName('transform'));
        const transformations = transformEls.map((t) => t.getAttribute('file') || t.getAttribute('name') || '').filter(Boolean);

        const actionEl = r.getElementsByTagName('invoke')[0] ? 'invoke' : r.getElementsByTagName('reply')[0] ? 'reply' : r.getElementsByTagName('echo')[0] ? 'echo' : 'invoke';

        routingRules.push({
          operation: opTarget,
          targetService,
          filterExpression,
          transformations,
          actionType: actionEl as any,
        });
      });

      operations.push({
        name: opName,
        routingRules,
      });
    });
  }

  return {
    id: (() => { let h=0; const s=relativePath+fileName; for(let i=0;i<s.length;i++) h=((h<<5)-h+s.charCodeAt(i))|0; return `mediator-${(relativePath||fileName).replace(/[^a-zA-Z0-9]/g,"-").slice(0,48)}-${Math.abs(h).toString(36)}`; })(),
    name,
    operations,
    fileName,
    relativePath,
    rawXml: content,
  };
}

// 5. Human Task Parser (.task)
export function parseHumanTaskXml(content: string, fileName: string, relativePath: string): HumanTaskInfo {
  const doc = parseXmlSafe(content);
  let name = fileName.replace(/\.task$/i, '');
  let title: string | undefined = undefined;
  let priority: string | undefined = '3';
  const outcomes: string[] = [];
  const participants: string[] = [];
  const payloadElements: string[] = [];
  let expiration: string | undefined = undefined;

  if (doc) {
    const taskDefEl = doc.getElementsByTagName('taskDefinition')[0] || doc.documentElement;
    if (taskDefEl) {
      name = taskDefEl.getAttribute('name') || name;
      title = doc.getElementsByTagName('title')[0]?.textContent || undefined;
      priority = doc.getElementsByTagName('priority')[0]?.textContent || priority;
      expiration = doc.getElementsByTagName('duration')[0]?.textContent || undefined;
    }

    const outcomeEls = Array.from(doc.getElementsByTagName('outcome'));
    outcomeEls.forEach((o) => {
      const val = o.textContent?.trim();
      if (val && !outcomes.includes(val)) outcomes.push(val);
    });

    const participantEls = Array.from(doc.getElementsByTagName('participant'));
    participantEls.forEach((p) => {
      const pName = p.getAttribute('name') || p.textContent?.trim() || '';
      if (pName && !participants.includes(pName)) participants.push(pName);
    });

    const payloadEls = Array.from(doc.getElementsByTagName('payload'));
    payloadEls.forEach((pl) => {
      Array.from(pl.children).forEach((child) => {
        if (child.nodeName && !payloadElements.includes(child.nodeName)) {
          payloadElements.push(child.nodeName);
        }
      });
    });
  }

  return {
    id: (() => { let h=0; const s=relativePath+fileName; for(let i=0;i<s.length;i++) h=((h<<5)-h+s.charCodeAt(i))|0; return `task-${(relativePath||fileName).replace(/[^a-zA-Z0-9]/g,"-").slice(0,48)}-${Math.abs(h).toString(36)}`; })(),
    name,
    title,
    priority,
    outcomes: outcomes.length > 0 ? outcomes : ['APPROVE', 'REJECT'],
    participants,
    payloadElements,
    expiration,
    fileName,
    relativePath,
    rawXml: content,
  };
}

// 6. WSDL Parser (.wsdl)
export function parseWsdlXml(content: string, fileName: string, relativePath: string): WsdlContractInfo {
  const doc = parseXmlSafe(content);
  let name = fileName.replace(/\.wsdl$/i, '');
  let targetNamespace = '';
  const portTypes: WsdlPortType[] = [];
  const imports: string[] = [];
  let serviceName: string | undefined = undefined;
  let soapAddress: string | undefined = undefined;

  if (doc) {
    const defEl = doc.getElementsByTagName('definitions')[0] || doc.getElementsByTagName('wsdl:definitions')[0] || doc.documentElement;
    if (defEl) {
      name = defEl.getAttribute('name') || name;
      targetNamespace = defEl.getAttribute('targetNamespace') || '';
    }

    // Imports
    const importEls = Array.from(doc.getElementsByTagName('import')).concat(Array.from(doc.getElementsByTagName('wsdl:import')));
    importEls.forEach((imp) => {
      const loc = imp.getAttribute('location') || imp.getAttribute('schemaLocation');
      if (loc) imports.push(loc);
    });

    // PortTypes
    const ptEls = Array.from(doc.getElementsByTagName('portType')).concat(Array.from(doc.getElementsByTagName('wsdl:portType')));
    ptEls.forEach((pt) => {
      const ptName = pt.getAttribute('name') || 'UnnamedPort';
      const operations: WsdlOperation[] = [];

      const opEls = Array.from(pt.getElementsByTagName('operation')).concat(Array.from(pt.getElementsByTagName('wsdl:operation')));
      opEls.forEach((op) => {
        const opName = op.getAttribute('name') || 'UnnamedOperation';
        const inputEl = op.getElementsByTagName('input')[0] || op.getElementsByTagName('wsdl:input')[0];
        const outputEl = op.getElementsByTagName('output')[0] || op.getElementsByTagName('wsdl:output')[0];
        const faultEls = Array.from(op.getElementsByTagName('fault')).concat(Array.from(op.getElementsByTagName('wsdl:fault')));

        operations.push({
          name: opName,
          inputMessage: inputEl?.getAttribute('message') || undefined,
          outputMessage: outputEl?.getAttribute('message') || undefined,
          faultMessages: faultEls.map((f) => f.getAttribute('message') || f.getAttribute('name') || '').filter(Boolean),
        });
      });

      portTypes.push({
        name: ptName,
        operations,
      });
    });

    // Services & SOAP Address
    const svcEl = doc.getElementsByTagName('service')[0] || doc.getElementsByTagName('wsdl:service')[0];
    if (svcEl) {
      serviceName = svcEl.getAttribute('name') || undefined;
      const addrEl = doc.getElementsByTagName('address')[0] || doc.getElementsByTagName('soap:address')[0];
      soapAddress = addrEl?.getAttribute('location') || undefined;
    }
  }

  return {
    id: (() => { let h=0; const s=relativePath+fileName; for(let i=0;i<s.length;i++) h=((h<<5)-h+s.charCodeAt(i))|0; return `wsdl-${(relativePath||fileName).replace(/[^a-zA-Z0-9]/g,"-").slice(0,48)}-${Math.abs(h).toString(36)}`; })(),
    name,
    targetNamespace,
    portTypes,
    imports,
    serviceName,
    soapAddress,
    fileName,
    relativePath,
    rawXml: content,
  };
}

// 7. XSD Parser (.xsd)
export function parseXsdXml(content: string, fileName: string, relativePath: string): XsdSchemaInfo {
  const doc = parseXmlSafe(content);
  let name = fileName.replace(/\.xsd$/i, '');
  let targetNamespace = '';
  const elements: XsdSchemaInfo['elements'] = [];
  const complexTypes: XsdSchemaInfo['complexTypes'] = [];
  const simpleTypes: string[] = [];
  const imports: string[] = [];
  const includes: string[] = [];

  if (doc) {
    const schemaEl = doc.getElementsByTagName('schema')[0] || doc.getElementsByTagName('xsd:schema')[0] || doc.documentElement;
    if (schemaEl) {
      targetNamespace = schemaEl.getAttribute('targetNamespace') || '';
    }

    const impEls = Array.from(doc.getElementsByTagName('import')).concat(Array.from(doc.getElementsByTagName('xsd:import')));
    impEls.forEach((imp) => {
      const loc = imp.getAttribute('schemaLocation');
      if (loc) imports.push(loc);
    });

    const incEls = Array.from(doc.getElementsByTagName('include')).concat(Array.from(doc.getElementsByTagName('xsd:include')));
    incEls.forEach((inc) => {
      const loc = inc.getAttribute('schemaLocation');
      if (loc) includes.push(loc);
    });

    // Elementi root: solo figli diretti di <schema>, non nested in complexType (fix overcount dataset grande)
    const rootElements = ((): Element[] => {
      if (!schemaEl) return [];
      const direct = Array.from((schemaEl as Element).children).filter(c => getLocalName(c as Element) === 'element') as Element[];
      if (direct.length > 0) return direct;
      // fallback legacy per parser vecchio: cerca solo quelli con parent === schema
      return Array.from(doc.getElementsByTagName('element')).concat(Array.from(doc.getElementsByTagName('xsd:element')) as any).filter(e => (e as Element).parentElement === schemaEl) as Element[];
    })();
    rootElements.forEach((el) => {
      const eName = el.getAttribute('name');
      if (eName) {
        elements.push({
          name: eName,
          type: el.getAttribute('type') || undefined,
        });
      }
    });
    // Mantieni anche count totale nested per diagnostica se necessario, ma complexTypes solo top-level
    const ctEls = ((): Element[] => {
      if (!schemaEl) return [];
      const direct = Array.from((schemaEl as Element).children).filter(c => getLocalName(c as Element) === 'complexType') as Element[];
      if (direct.length > 0) return direct;
      return Array.from(doc.getElementsByTagName('complexType')).concat(Array.from(doc.getElementsByTagName('xsd:complexType')) as any).filter(e => (e as Element).parentElement === schemaEl) as Element[];
    })();
    // Se nessun complexType top-level (alcuni XSD li definiscono nested), fallback a globale
    const ctToProcess = ctEls.length > 0 ? ctEls : Array.from(doc.getElementsByTagName('complexType')).concat(Array.from(doc.getElementsByTagName('xsd:complexType')) as any) as Element[];
    ctToProcess.forEach((ct) => {
      const ctName = ct.getAttribute('name') || 'Anonymous';
      const childCount = ct.getElementsByTagName('element').length + ct.getElementsByTagName('xsd:element').length;
      complexTypes.push({
        name: ctName,
        elementCount: childCount,
      });
    });
    // Deduplica solo per nomi non-Anonymous e considerando namespace se presente
    const seenCt = new Set<string>();
    const dedupedCt: typeof complexTypes = [];
    complexTypes.forEach(ct => {
      if (ct.name === 'Anonymous') { dedupedCt.push(ct); return; }
      if (!seenCt.has(ct.name)) { seenCt.add(ct.name); dedupedCt.push(ct); }
    });
    complexTypes.length = 0; dedupedCt.forEach(c=>complexTypes.push(c));

    const stEls = Array.from(doc.getElementsByTagName('simpleType')).concat(Array.from(doc.getElementsByTagName('xsd:simpleType')));
    stEls.forEach((st) => {
      const stName = st.getAttribute('name');
      if (stName && !simpleTypes.includes(stName)) simpleTypes.push(stName);
    });
  }

  return {
    id: (() => { let h=0; const s=relativePath+fileName; for(let i=0;i<s.length;i++) h=((h<<5)-h+s.charCodeAt(i))|0; return `xsd-${(relativePath||fileName).replace(/[^a-zA-Z0-9]/g,"-").slice(0,48)}-${Math.abs(h).toString(36)}`; })(),
    name,
    targetNamespace,
    elements,
    complexTypes,
    simpleTypes,
    imports,
    includes,
    fileName,
    relativePath,
    rawXml: content,
  };
}

// 8. XSLT Parser (.xsl)
export function parseXslt(content: string, fileName: string, relativePath: string): XsltInfo {
  const doc = parseXmlSafe(content);
  let name = fileName.replace(/\.xsl$/i, '').replace(/\.xslt$/i, '');
  const sourceNamespaces: Record<string, string> = {};
  const targetNamespaces: Record<string, string> = {};
  const templateMatches: string[] = [];

  if (doc) {
    const stylesheetEl = doc.getElementsByTagName('stylesheet')[0] || doc.getElementsByTagName('xsl:stylesheet')[0] || doc.documentElement;
    if (stylesheetEl) {
      for (let i = 0; i < stylesheetEl.attributes.length; i++) {
        const attr = stylesheetEl.attributes[i];
        if (attr.name.startsWith('xmlns:')) {
          const prefix = attr.name.replace('xmlns:', '');
          sourceNamespaces[prefix] = attr.value;
        }
      }
    }

    const tplEls = [
      ...Array.from(doc.getElementsByTagName('template')),
      ...Array.from(doc.getElementsByTagName('xsl:template')),
    ];
    tplEls.forEach((tpl) => {
      const match = tpl.getAttribute('match') || tpl.getAttribute('name');
      if (match) templateMatches.push(match);
    });
  }

  return {
    id: (() => { let h=0; const s=relativePath+fileName; for(let i=0;i<s.length;i++) h=((h<<5)-h+s.charCodeAt(i))|0; return `xslt-${(relativePath||fileName).replace(/[^a-zA-Z0-9]/g,"-").slice(0,48)}-${Math.abs(h).toString(36)}`; })(),
    name,
    sourceNamespaces,
    targetNamespaces,
    templateMatches: templateMatches.length > 0 ? templateMatches : ['/'],
    fileName,
    relativePath,
    rawContent: content,
  };
}

// 8b. ComponentType Parser (.componentType)
export function parseComponentTypeXml(content: string, fileName: string, relativePath: string): import('../types/jca').ComponentTypeInfo {
  const doc = parseXmlSafe(content);
  let name = fileName.replace(/\.componentType$/i, '');
  let targetNamespace: string | undefined = undefined;
  const services: import('../types/jca').ComponentTypeInfo['services'] = [];
  const references: import('../types/jca').ComponentTypeInfo['references'] = [];
  const properties: import('../types/jca').ComponentTypeInfo['properties'] = [];
  if (doc) {
    const ctEl = doc.getElementsByTagName('componentType')[0] || doc.documentElement;
    if (ctEl) {
      targetNamespace = ctEl.getAttribute('targetNamespace') || undefined;
      // name da componentType può non esserci, usa fileName
    }
    const svcEls = Array.from(doc.getElementsByTagName('service'));
    svcEls.forEach((s) => {
      const sName = s.getAttribute('name') || 'UnnamedService';
      const ifaceEl = s.getElementsByTagName('interface.wsdl')[0] || s.getElementsByTagName('interface')[0];
      const interfaceWsdl = ifaceEl?.getAttribute('interface') || undefined;
      const interfacePortType = extractPortType(interfaceWsdl);
      services.push({ name: sName, interfaceWsdl, interfacePortType });
    });
    const refEls = Array.from(doc.getElementsByTagName('reference'));
    refEls.forEach((r) => {
      const rName = r.getAttribute('name') || 'UnnamedReference';
      const ifaceEl = r.getElementsByTagName('interface.wsdl')[0] || r.getElementsByTagName('interface')[0];
      const interfaceWsdl = ifaceEl?.getAttribute('interface') || undefined;
      const interfacePortType = extractPortType(interfaceWsdl);
      references.push({ name: rName, interfaceWsdl, interfacePortType });
    });
    const propEls = Array.from(doc.getElementsByTagName('property'));
    propEls.forEach((p) => {
      const pName = p.getAttribute('name') || '';
      if (pName) properties.push({ name: pName, type: p.getAttribute('type') || undefined });
    });
  }
  return {
    id: (() => { let h=0; const s=relativePath+fileName; for(let i=0;i<s.length;i++) h=((h<<5)-h+s.charCodeAt(i))|0; return `ct-${(relativePath||fileName).replace(/[^a-zA-Z0-9]/g,"-").slice(0,48)}-${Math.abs(h).toString(36)}`; })(),
    name,
    targetNamespace,
    services,
    references,
    properties,
    fileName,
    relativePath,
    rawXml: content,
  };
}

// 8c. DVM Parser (.dvm) - Domain Value Map
export function parseDvmXml(content: string, fileName: string, relativePath: string): import('../types/jca').DvmInfo {
  const doc = parseXmlSafe(content);
  let name = fileName.replace(/\.dvm$/i, '');
  const columns: string[] = [];
  let rowsCount = 0;
  if (doc) {
    const dvmEl = doc.getElementsByTagName('dvm')[0] || doc.documentElement;
    if (dvmEl) name = dvmEl.getAttribute('name') || name;
    const colEls = Array.from(doc.getElementsByTagName('column'));
    colEls.forEach((c) => {
      const cn = c.getAttribute('name') || c.textContent?.trim();
      if (cn) columns.push(cn);
    });
    const rowEls = Array.from(doc.getElementsByTagName('row'));
    rowsCount = rowEls.length;
    // fallback: conta <rows>/<row>
    if (rowsCount === 0) {
      const rowsEl = doc.getElementsByTagName('rows')[0];
      if (rowsEl) rowsCount = rowsEl.getElementsByTagName('row').length;
    }
  }
  return {
    id: (() => { let h=0; const s=relativePath+fileName; for(let i=0;i<s.length;i++) h=((h<<5)-h+s.charCodeAt(i))|0; return `dvm-${(relativePath||fileName).replace(/[^a-zA-Z0-9]/g,"-").slice(0,48)}-${Math.abs(h).toString(36)}`; })(),
    name,
    columns,
    rowsCount,
    fileName,
    relativePath,
    rawXml: content,
  };
}

// 9. Master Ecosystem Analysis Builder - ottimizzato per dataset di grandi dimensioni
export function buildOracleEcosystem(
  files: Array<{ name: string; relativePath: string; content: string }>
): OracleEcosystem {
  const extensionCounts: Record<string, number> = {};
  const composites: CompositeConfig[] = [];
  const componentTypes: import('../types/jca').ComponentTypeInfo[] = [];
  const dvms: import('../types/jca').DvmInfo[] = [];
  const jcaAdapters: JCAAdapterConfig[] = [];
  const bpelProcesses: BpelProcessInfo[] = [];
  const bpmnProcesses: BpmnProcessInfo[] = [];
  const mediators: MediatorInfo[] = [];
  const humanTasks: HumanTaskInfo[] = [];
  const wsdlContracts: WsdlContractInfo[] = [];
  const xsdSchemas: XsdSchemaInfo[] = [];
  const xsltTransforms: XsltInfo[] = [];
  const dataControls: DataControlInfo[] = [];
  const scripts: ScriptInfo[] = [];
  const workspaces: WorkspaceInfo[] = [];
  const projects: ProjectInfo[] = [];
  const rawFiles: OracleEcosystem['rawFiles'] = [];

  const BINARY_EXTS = new Set(['.jar', '.ear', '.zip', '.pack', '.rev', '.idx', '.gif', '.mf', '.lck', '.log', '.jdb', '.lst', '.agdl', '.adfc_diagram']);
  // Helper ID deterministico
  const stableId = (prefix: string, rel: string, name: string) => {
    const base = `${rel}::${name}`.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 64);
    let h = 0;
    const s = `${rel}${name}`;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return `${prefix}-${base}-${Math.abs(h).toString(36)}`;
  };
  files.forEach((file) => {
    const lowerName = file.name.toLowerCase();
    // Estrazione estensione robusta (C-06): gestisce _copy e .sample
    let ext: string;
    if (lowerName.endsWith('.sample')) {
      ext = '.sample';
    } else {
      const normalized = lowerName.replace(/_copy$/, '');
      const m = normalized.match(/\.([a-z0-9]+)$/);
      ext = m ? `.${m[1]}` : 'none';
      // Normalizza .componenttype case
      if (normalized.endsWith('.componenttype')) ext = '.componenttype';
    }
    extensionCounts[ext] = (extensionCounts[ext] || 0) + 1;

    rawFiles.push({
      name: file.name,
      relativePath: file.relativePath,
      extension: ext,
      size: new Blob([file.content]).size,
      content: file.content,
    });

    if (BINARY_EXTS.has(ext)) return;

    // Composite - check veloce poi parse robusto
    if (lowerName === 'composite.xml') {
      const doc = parseXmlSafe(file.content);
      if (doc && isCompositeDocument(doc)) {
        composites.push(parseCompositeXml(file.content, file.name, file.relativePath));
        return;
      }
      // fallback su nome file comunque
      composites.push(parseCompositeXml(file.content, file.name, file.relativePath));
      return;
    }
    if (ext === '.xml' && file.content.includes('<composite')) {
      const doc = parseXmlSafe(file.content);
      if (doc && isCompositeDocument(doc)) {
        composites.push(parseCompositeXml(file.content, file.name, file.relativePath));
        return;
      }
    }
    if (ext === '.componenttype' || lowerName.endsWith('.componenttype')) {
      componentTypes.push(parseComponentTypeXml(file.content, file.name, file.relativePath));
    } else if (ext === '.dvm') {
      dvms.push(parseDvmXml(file.content, file.name, file.relativePath));
    } else if (ext === '.jca') {
      jcaAdapters.push(parseJcaContent(file.content, file.name, file.relativePath));
    } else if (ext === '.bpel') {
      bpelProcesses.push(parseBpelXml(file.content, file.name, file.relativePath));
    } else if (ext === '.bpmn') {
      bpmnProcesses.push(parseBpmnXml(file.content, file.name, file.relativePath));
    } else if (ext === '.mplan') {
      mediators.push(parseMediatorXml(file.content, file.name, file.relativePath));
    } else if (ext === '.task') {
      humanTasks.push(parseHumanTaskXml(file.content, file.name, file.relativePath));
    } else if (ext === '.wsdl') {
      wsdlContracts.push(parseWsdlXml(file.content, file.name, file.relativePath));
    } else if (ext === '.xsd') {
      xsdSchemas.push(parseXsdXml(file.content, file.name, file.relativePath));
    } else if (ext === '.xsl' || ext === '.xslt') {
      xsltTransforms.push(parseXslt(file.content, file.name, file.relativePath));
    } else if (ext === '.dcx' || ext === '.cpx') {
      dataControls.push({
        id: stableId('dc', file.relativePath, file.name),
        name: file.name.replace(/\.(dcx|cpx)$/i, ''),
        type: ext === '.dcx' ? 'dcx' : 'cpx',
        bindings: [],
        fileName: file.name,
        relativePath: file.relativePath,
        rawXml: file.content,
      });
    } else if (ext === '.sh' || ext === '.py' || ext === '.sql' || ext === '.properties' || ext === '.tcl' || ext === '.ctl' || ext === '.java' || ext === '.jspx') {
      const rawType = ext.replace('.', '');
      const type = (['sh', 'py', 'sql', 'properties'].includes(rawType) ? rawType : rawType === 'tcl' || rawType === 'ctl' ? 'tcl' as any : rawType === 'java' || rawType === 'jspx' ? 'java' as any : 'other') as ScriptInfo['type'];
      let purpose = 'Script di automazione';
      if (type === 'py' || rawType === 'py') purpose = 'Script WLST per automazione WebLogic & SOA';
      else if (type === 'sh' || rawType === 'sh') purpose = 'Shell script per build, deploy o avvio container';
      else if (type === 'sql' || rawType === 'sql') purpose = 'Script SQL / DDL / DML database';
      else if (type === 'properties' || rawType === 'properties') purpose = 'File di configurazione runtime / environment properties';
      else if (rawType === 'tcl') purpose = 'Script TCL (SOA config / WLST)';
      else if (rawType === 'ctl') purpose = 'Control file SQL*Loader / ETL';
      else if (rawType === 'java' || rawType === 'jspx') purpose = 'Sorgente Java / ADF UI';

      scripts.push({
        id: stableId('script', file.relativePath, file.name),
        name: file.name,
        type: type as any,
        purpose,
        linesCount: file.content.split('\n').length,
        fileName: file.name,
        relativePath: file.relativePath,
        rawContent: file.content,
      });
    } else if (ext === '.jws') {
      workspaces.push({
        id: stableId('jws', file.relativePath, file.name),
        name: file.name.replace(/\.jws$/i, ''),
        projects: [],
        fileName: file.name,
        relativePath: file.relativePath,
      });
    } else if (ext === '.jpr') {
      projects.push({
        id: stableId('jpr', file.relativePath, file.name),
        name: file.name.replace(/\.jpr$/i, ''),
        technologyScope: ['SOA', 'ADF', 'Java'],
        sourceDirectories: [],
        dependencies: [],
        fileName: file.name,
        relativePath: file.relativePath,
      });
    } else if (ext === '.sample' || ext === 'none') {
      // .sample + file senza estensione: conteggiati in inventory, non parsati come XML per performance
      // Se contenuto è XML (sample payload), registra come raw ma non appesantisce parser
      if (file.content.trimStart().startsWith('<') && file.content.includes('</')) {
        // potrebbe essere sample XML payload: opzionale parsing leggero non effettuato per now
      }
    }
  });

  return {
    analyzedAt: new Date().toISOString(),
    totalFiles: files.length,
    fileCountByExtension: extensionCounts,
    workspaces,
    projects,
    composites,
    componentTypes,
    dvms,
    jcaAdapters,
    bpelProcesses,
    bpmnProcesses,
    mediators,
    humanTasks,
    wsdlContracts,
    xsdSchemas,
    xsltTransforms,
    dataControls,
    scripts,
    rawFiles,
  };
}
