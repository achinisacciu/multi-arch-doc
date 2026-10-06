import { ParsedBpmn, BpmnElement, BpmnLane, BpmnPool } from '../types';

/**
 * Utility function to clean tag names by stripping prefixes like bpmn:, bpmn2:, semantic: etc.
 */
function cleanTagName(name: string): string {
  const parts = name.split(':');
  return parts.length > 1 ? parts[1] : parts[0];
}

/**
 * Get text content of a child element matching target tag name (ignoring namespace prefix)
 */
function getChildText(element: Element, targetTag: string): string {
  for (let i = 0; i < element.children.length; i++) {
    const child = element.children[i];
    if (cleanTagName(child.tagName).toLowerCase() === targetTag.toLowerCase()) {
      return child.textContent?.trim() || '';
    }
  }
  return '';
}

/**
 * Get all child elements matching target tag name (ignoring namespace prefix)
 */
function getChildrenByTag(element: Element, targetTag: string): Element[] {
  const result: Element[] = [];
  for (let i = 0; i < element.children.length; i++) {
    const child = element.children[i];
    if (cleanTagName(child.tagName).toLowerCase() === targetTag.toLowerCase()) {
      result.push(child);
    }
  }
  return result;
}

/**
 * Extract human-readable type label for BPMN element
 */
export function getFriendlyTypeName(rawType: string): string {
  const type = cleanTagName(rawType);
  switch (type) {
    case 'startEvent': return 'Evento di Inizio (Start Event)';
    case 'endEvent': return 'Evento di Fine (End Event)';
    case 'userTask': return 'Attività Utente (User Task)';
    case 'serviceTask': return 'Servizio Automatico (Service Task)';
    case 'scriptTask': return 'Script Task';
    case 'businessRuleTask': return 'Regola di Business (Business Rule Task)';
    case 'sendTask': return 'Invio Messaggio (Send Task)';
    case 'receiveTask': return 'Ricezione Messaggio (Receive Task)';
    case 'manualTask': return 'Attività Manuale (Manual Task)';
    case 'task': return 'Attività Generica (Task)';
    case 'subProcess': return 'Sotto-Processo (Sub-Process)';
    case 'callActivity': return 'Chiamata Processo (Call Activity)';
    case 'exclusiveGateway': return 'Gateway Esclusivo (XOR)';
    case 'parallelGateway': return 'Gateway Parallelo (AND)';
    case 'inclusiveGateway': return 'Gateway Inclusivo (OR)';
    case 'eventBasedGateway': return 'Gateway Basato su Eventi';
    case 'intermediateCatchEvent': return 'Evento Intermedio (Catch)';
    case 'intermediateThrowEvent': return 'Evento Intermedio (Throw)';
    case 'boundaryEvent': return 'Evento di Confine (Boundary Event)';
    case 'dataObjectReference': return 'Oggetto Dati (Data Object)';
    case 'textAnnotation': return 'Annotazione di Testo';
    default: return type;
  }
}

/**
 * Parse BPMN XML string into structured ParsedBpmn object
 */
export function parseBpmnXml(xmlString: string, fileName: string = 'process.bpmn', fileSize: number = 0): ParsedBpmn {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

  // Check for XML parsing error
  const parserError = xmlDoc.getElementsByTagName('parsererror');
  if (parserError.length > 0) {
    throw new Error(`Errore nel formato del file XML BPMN: ${parserError[0].textContent || 'Sintassi non valida'}`);
  }

  const rootNode = xmlDoc.documentElement;
  
  // Find definitions
  let processId = 'Process_1';
  let processName = fileName.replace(/\.bpmn$/i, '');
  let processDoc = '';

  const pools: BpmnPool[] = [];
  const lanes: BpmnLane[] = [];
  const elementsMap = new Map<string, BpmnElement>();

  // Extract Collaboration / Participants (Pools)
  const collaborations = rootNode.getElementsByTagName('*');
  for (let i = 0; i < collaborations.length; i++) {
    const el = collaborations[i];
    const tagName = cleanTagName(el.tagName);
    if (tagName === 'participant') {
      const pId = el.getAttribute('id') || `Participant_${i}`;
      const pName = el.getAttribute('name') || pId;
      const processRef = el.getAttribute('processRef') || undefined;
      pools.push({
        id: pId,
        name: pName,
        processRef,
        lanes: []
      });
    }
  }

  // Extract Processes
  const allElements = rootNode.getElementsByTagName('*');
  
  // Maps to connect flow nodes with sequence flows
  const sequenceFlows: Array<{ id: string; name: string; sourceRef: string; targetRef: string; condition: string }> = [];

  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i];
    const rawTag = el.tagName;
    const tag = cleanTagName(rawTag);

    // Process Level Info
    if (tag === 'process') {
      const pId = el.getAttribute('id');
      const pName = el.getAttribute('name');
      if (pId) processId = pId;
      if (pName) processName = pName;
      const doc = getChildText(el, 'documentation');
      if (doc) processDoc = doc;

      // Extract LaneSets
      const laneSets = getChildrenByTag(el, 'laneSet');
      for (const laneSet of laneSets) {
        const laneEls = getChildrenByTag(laneSet, 'lane');
        for (const laneEl of laneEls) {
          const lId = laneEl.getAttribute('id') || `Lane_${lanes.length + 1}`;
          const lName = laneEl.getAttribute('name') || lId;
          const flowNodeRefs: string[] = [];
          
          const fnRefs = getChildrenByTag(laneEl, 'flowNodeRef');
          for (const fn of fnRefs) {
            if (fn.textContent?.trim()) {
              flowNodeRefs.push(fn.textContent.trim());
            }
          }

          const laneObj: BpmnLane = { id: lId, name: lName, flowNodeRefs };
          lanes.push(laneObj);

          // Associate lane with pool if available
          if (pools.length > 0) {
            // Put in matching pool or first pool
            pools[0].lanes.push(laneObj);
          }
        }
      }
    }

    // Sequence Flows
    if (tag === 'sequenceFlow') {
      const sfId = el.getAttribute('id') || `SF_${sequenceFlows.length}`;
      const sfName = el.getAttribute('name') || '';
      const sourceRef = el.getAttribute('sourceRef') || '';
      const targetRef = el.getAttribute('targetRef') || '';
      const condition = getChildText(el, 'conditionExpression');

      sequenceFlows.push({ id: sfId, name: sfName, sourceRef, targetRef, condition });
    }

    // BPMN Flow Nodes / Tasks / Gateways / Events
    const isFlowNode = [
      'startEvent', 'endEvent', 'userTask', 'serviceTask', 'scriptTask', 
      'businessRuleTask', 'sendTask', 'receiveTask', 'manualTask', 'task',
      'subProcess', 'callActivity', 'exclusiveGateway', 'parallelGateway',
      'inclusiveGateway', 'eventBasedGateway', 'intermediateCatchEvent',
      'intermediateThrowEvent', 'boundaryEvent', 'dataObjectReference', 'textAnnotation'
    ].includes(tag);

    if (isFlowNode) {
      const id = el.getAttribute('id');
      if (!id) continue;

      const name = el.getAttribute('name') || id;
      const documentation = getChildText(el, 'documentation');

      // Camunda attributes
      const camundaCandidateGroups = el.getAttribute('camunda:candidateGroups') || el.getAttribute('candidateGroups') || undefined;
      const camundaAssignee = el.getAttribute('camunda:assignee') || el.getAttribute('assignee') || undefined;
      const camundaTopic = el.getAttribute('camunda:topic') || el.getAttribute('topic') || undefined;

      // Form fields check
      const formFields: Array<{ id: string; label: string; type: string }> = [];
      const extensionElements = getChildrenByTag(el, 'extensionElements');
      for (const ext of extensionElements) {
        const formData = getChildrenByTag(ext, 'formData');
        for (const fd of formData) {
          const fields = getChildrenByTag(fd, 'formField');
          for (const f of fields) {
            formFields.push({
              id: f.getAttribute('id') || '',
              label: f.getAttribute('label') || f.getAttribute('id') || '',
              type: f.getAttribute('type') || 'string'
            });
          }
        }
      }

      // Timer definitions
      let timerEventDefinition: string | undefined = undefined;
      const timerDef = getChildrenByTag(el, 'timerEventDefinition');
      if (timerDef.length > 0) {
        const timeDuration = getChildText(timerDef[0], 'timeDuration');
        const timeCycle = getChildText(timerDef[0], 'timeCycle');
        const timeDate = getChildText(timerDef[0], 'timeDate');
        timerEventDefinition = timeDuration || timeCycle || timeDate || 'Timer impostato';
      }

      elementsMap.set(id, {
        id,
        name,
        type: rawTag,
        rawType: tag,
        documentation,
        incoming: [],
        outgoing: [],
        camundaCandidateGroups,
        camundaAssignee,
        camundaTopic,
        formFields: formFields.length > 0 ? formFields : undefined,
        timerEventDefinition
      });
    }
  }

  // Connect incoming / outgoing flows
  for (const sf of sequenceFlows) {
    if (sf.sourceRef && elementsMap.has(sf.sourceRef)) {
      const sourceEl = elementsMap.get(sf.sourceRef)!;
      sourceEl.outgoing.push(sf.targetRef);
    }
    if (sf.targetRef && elementsMap.has(sf.targetRef)) {
      const targetEl = elementsMap.get(sf.targetRef)!;
      targetEl.incoming.push(sf.sourceRef);
    }
  }

  // Assign lane names to elements
  for (const lane of lanes) {
    for (const refId of lane.flowNodeRefs) {
      if (elementsMap.has(refId)) {
        const item = elementsMap.get(refId)!;
        item.laneId = lane.id;
        item.laneName = lane.name;
      }
    }
  }

  const elements = Array.from(elementsMap.values());

  // Statistics
  const tasksCount = elements.filter(e => e.rawType.toLowerCase().includes('task') || e.rawType === 'subProcess' || e.rawType === 'callActivity').length;
  const gatewaysCount = elements.filter(e => e.rawType.toLowerCase().includes('gateway')).length;
  const eventsCount = elements.filter(e => e.rawType.toLowerCase().includes('event')).length;

  return {
    fileName,
    fileSize,
    rawXml: xmlString,
    processId,
    processName,
    documentation: processDoc,
    pools,
    lanes,
    elements,
    stats: {
      totalElements: elements.length,
      tasksCount,
      gatewaysCount,
      eventsCount,
      poolsCount: pools.length,
      lanesCount: lanes.length,
    }
  };
}
