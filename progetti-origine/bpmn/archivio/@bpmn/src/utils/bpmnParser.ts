import type { BpmnFileItem, ParsedBpmn, BpmnElement, BpmnPool, BpmnLane, CrossReference } from '../types';

export async function processFileList(files: FileList | File[]): Promise<BpmnFileItem[]> {
  const result: BpmnFileItem[] = [];
  for (const file of Array.from(files)) {
    if (!file.name.toLowerCase().match(/\.(bpmn|xml)$/)) continue;
    const content = await file.text();
    result.push({
      id: file.name + '_' + file.lastModified,
      name: file.name,
      relativePath: file.webkitRelativePath || file.name,
      folderPath: (file as any).webkitRelativePath
        ? (file as any).webkitRelativePath.split('/').slice(0, -1).join('/')
        : '',
      content,
      size: file.size,
      lastModified: file.lastModified,
    });
  }
  return validateAndEnrich(result);
}

export async function processDroppedItems(items: DataTransferItemList): Promise<BpmnFileItem[]> {
  const result: BpmnFileItem[] = [];
  for (const item of Array.from(items)) {
    if (item.kind === 'file') {
      const entry = item.webkitGetAsEntry();
      if (entry?.isDirectory) {
        const files = await readDir(entry as any);
        for (const file of files) {
          if (!file.name.toLowerCase().match(/\.(bpmn|xml)$/)) continue;
          const content = await file.text();
          result.push({
            id: file.name + '_' + file.lastModified,
            name: file.name,
            relativePath: file.webkitRelativePath || file.name,
            folderPath: file.webkitRelativePath ? file.webkitRelativePath.split('/').slice(0, -1).join('/') : '',
            content,
            size: file.size,
            lastModified: file.lastModified,
          });
        }
      } else if (entry?.isFile) {
        const file = item.asFile();
        if (!file.name.toLowerCase().match(/\.(bpmn|xml)$/)) continue;
        const content = await file.text();
        result.push({
          id: file.name + '_' + file.lastModified,
          name: file.name,
          relativePath: file.webkitRelativePath || file.name,
          folderPath: '',
          content,
          size: file.size,
          lastModified: file.lastModified,
        });
      }
    }
  }
  return validateAndEnrich(result);
}

async function readDir(entry: any): Promise<File[]> {
  const files: File[] = [];
  const reader = entry.createReader();
  let results: any[] = [];
  do {
    results = await new Promise<any[]>((resolve) => reader.readEntries(resolve));
    for (const child of results) {
      if (child.isFile) {
        files.push(await new Promise<File>((resolve) => child.file(resolve)));
      } else if (child.isDirectory) {
        files.push(...await readDir(child));
      }
    }
  } while (results.length > 0);
  return files;
}

function validateAndEnrich(files: BpmnFileItem[]): BpmnFileItem[] {
  return files.map(f => {
    const isValid = isValidBpmn(f.content);
    if (!isValid) {
      return { ...f, isValid: false, error: 'File non valido o non contiene BPMN' };
    }
    const parsed = parseBpmnXml(f.content, f.name);
    return { ...f, isValid: true, stats: parsed.stats };
  });
}

function isValidBpmn(content: string): boolean {
  return content.includes('<process') || content.includes('<bpmn:process') ||
         content.includes('<definitions') || content.includes('<bpmn:definitions');
}

function cleanTagName(name: string): string {
  return name.includes(':') ? name.split(':')[1] : name;
}

function getChildText(el: Element, tag: string): string | undefined {
  const child = Array.from(el.children).find(c => cleanTagName(c.tagName) === tag);
  return child?.textContent || undefined;
}

function getElementsByTagName(xml: string, tag: string): Element[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  return Array.from(doc.querySelectorAll(tag));
}

export function parseBpmnXml(xmlContent: string, fileName: string): ParsedBpmn {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'text/xml');
  const definitions = doc.querySelector('definitions') || doc.querySelector('[xmlns*="bpmn"]');
  const processEl = doc.querySelector('process');
  const laneSetEl = processEl ? Array.from(processEl.children).find(c => cleanTagName(c.tagName) === 'laneSet') : null;
  const participantEls = Array.from(doc.querySelectorAll('process[processRef], participant'));

  const processId = processEl?.getAttribute('id') || 'unknown';
  const processName = processEl?.getAttribute('name') || fileName.replace(/\.(bpmn|xml)$/i, '');
  const docEl = processEl ? getChildText(processEl, 'documentation') : undefined;

  // Parse pools (participants)
  const pools: BpmnPool[] = [];
  for (const p of participantEls) {
    const pid = p.getAttribute('id') || '';
    const pname = p.getAttribute('name') || '';
    const procref = p.getAttribute('processRef') || '';
    if (procref === processId || !procref) {
      // Self-contained process without explicit participant refs
      break;
    }
    pools.push({ id: pid, name: pname, lanes: [] });
  }

  // Parse lanes
  const lanes: BpmnLane[] = [];
  if (laneSetEl) {
    const laneEls = Array.from(laneSetEl.children).filter(c => cleanTagName(c.tagName) === 'lane');
    for (const lel of laneEls) {
      const lid = lel.getAttribute('id') || '';
      const lname = lel.getAttribute('name') || '';
      const refs = lel.getAttribute('flowNodeRefs') || lel.getAttribute('nodeRefs') || '';
      const flowNodeRefs = refs ? refs.split(/\s+/).filter(Boolean) : [];
      lanes.push({ id: lid, name: lname, flowNodeRefs });
    }
  }

  // Build lane -> element ID map
  const laneOfElement = new Map<string, string>();
  for (const lane of lanes) {
    for (const ref of lane.flowNodeRefs) {
      laneOfElement.set(ref, lane.name);
    }
  }

  // Parse elements
  const elements: BpmnElement[] = [];
  const flowNodeTags = new Set([
    'startEvent', 'endEvent', 'intermediateCatchEvent', 'intermediateThrowEvent', 'boundaryEvent',
    'task', 'userTask', 'serviceTask', 'sendTask', 'receiveTask', 'manualTask', 'scriptTask', 'businessRuleTask',
    'subProcess', 'callActivity', 'transaction',
    'exclusiveGateway', 'parallelGateway', 'inclusiveGateway', 'eventBasedGateway', 'complexGateway',
    'textAnnotation', 'dataObject', 'dataStoreReference'
  ]);
  const sequenceFlows: Array<{ id: string; src: string; tgt: string; cond?: string; name?: string }> = [];

  if (processEl) {
    for (const child of Array.from(processEl.children)) {
      const tag = cleanTagName(child.tagName);
      if (['extensionElements', 'laneSet', 'documentation'].includes(tag)) continue;

      if (tag === 'sequenceFlow') {
        const id = child.getAttribute('id') || '';
        const src = child.getAttribute('sourceRef') || '';
        const tgt = child.getAttribute('targetRef') || '';
        const cond = getChildText(child, 'conditionExpression');
        sequenceFlows.push({ id, src, tgt, cond, name: child.getAttribute('name') || undefined });
        continue;
      }

      if (flowNodeTags.has(tag)) {
        const id = child.getAttribute('id') || '';
        const name = child.getAttribute('name') || '';
        const documentation = getChildText(child, 'documentation');
        const incoming = getChildren(child, 'incoming').map(el => el.textContent || '');
        const outgoing = getChildren(child, 'outgoing').map(el => el.textContent || '');
        const cond = getChildText(child, 'conditionExpression');
        elements.push({
          id, name, type: getFriendlyTypeName(tag), rawType: tag,
          documentation, laneName: laneOfElement.get(id), poolName: undefined,
          incoming, outgoing, conditionExpression: cond || undefined,
        });
      }
    }
  }

  // Build flow map
  const flowMap = new Map<string, { src: string; tgt: string; cond?: string; name?: string }>();
  for (const sf of sequenceFlows) flowMap.set(sf.id, sf);

  // Resolve outgoing target IDs
  const resolvedElements = elements.map(el => ({
    ...el,
    outgoing: el.outgoing
      .map(fid => {
        const f = flowMap.get(fid);
        return f ? f.tgt : fid;
      })
      .filter(Boolean),
    incoming: el.incoming
      .map(fid => {
        const f = flowMap.get(fid);
        return f ? f.src : fid;
      })
      .filter(Boolean),
  }));

  // Cross-references (CallActivity, message events)
  const crossRefs: CrossReference[] = [];
  for (const el of resolvedElements) {
    const rt = (el.rawType || '').toLowerCase();
    if (rt === 'callactivity') {
      const calledEl = Array.from(doc.querySelectorAll('calledElement'))[0];
      const calledProcess = calledEl?.getAttribute('name') || calledEl?.getAttribute('processRef') || '';
      crossRefs.push({
        elementId: el.id,
        refType: 'callActivity',
        refProcessId: calledProcess,
        description: `Chiama processo: ${calledProcess || 'sconosciuto'}`,
      });
    }
    if (rt === 'startEvent' || rt.includes('intermediate')) {
      const msgEl = Array.from(el.rawType ? doc.querySelectorAll('messageEventDefinition') : []).find(e => e.closest('*[id]')?.getAttribute('id') === el.id);
      if (msgEl) {
        const msgRef = msgEl.getAttribute('messageRef') || '';
        if (msgRef) {
          crossRefs.push({
            elementId: el.id,
            refType: 'messageEvent',
            refElementId: msgRef,
            description: `Evento messaggio: ${msgRef}`,
          });
        }
      }
    }
  }

  // Check for Oracle extensions
  const hasOracle = xmlContent.includes('OracleExtensions') || xmlContent.includes('oracle:');

  const tasksCount = resolvedElements.filter(e => 
    ['task', 'usertask', 'servicetask', 'sendtask', 'receivetask', 'manualtask', 'scripttask', 'businessruletask'].includes(e.rawType)
  ).length;
  const gatewaysCount = resolvedElements.filter(e => 
    ['exclusivegateway', 'parallelgateway', 'inclusivegateway', 'eventbasedgateway', 'complexgateway'].includes(e.rawType)
  ).length;
  const eventsCount = resolvedElements.filter(e => 
    ['startevent', 'endevent', 'intermediatecatchevent', 'intermediatethrowevent', 'boundaryevent'].includes(e.rawType)
  ).length;
  const startEvents = resolvedElements.filter(e => e.rawType === 'startEvent').length;
  const endEvents = resolvedElements.filter(e => e.rawType === 'endEvent').length;
  const callActivities = resolvedElements.filter(e => e.rawType === 'callActivity').length;

  return {
    fileName, fileSize: xmlContent.length, rawXml: xmlContent,
    processId, processName, documentation: docEl,
    pools, lanes,
    elements: resolvedElements,
    stats: {
      totalElements: resolvedElements.length, tasksCount, gatewaysCount, eventsCount,
      poolsCount: pools.length, lanesCount: lanes.length,
    },
    hasOracleExtensions: hasOracle,
    crossRefs,
    startEvents, endEvents, callActivities,
  };
}

function getChildren(parent: Element, tagName: string): Element[] {
  return Array.from(parent.children).filter(c => cleanTagName(c.tagName) === tagName);
}

function getFriendlyTypeName(rawType: string): string {
  const map: Record<string, string> = {
    'startEvent': 'Start Event', 'endEvent': 'End Event',
    'intermediateCatchEvent': 'Intermediate Catch Event', 'intermediateThrowEvent': 'Intermediate Throw Event',
    'boundaryEvent': 'Boundary Event', 'task': 'Task', 'userTask': 'User Task',
    'serviceTask': 'Service Task', 'sendTask': 'Send Task', 'receiveTask': 'Receive Task',
    'manualTask': 'Manual Task', 'scriptTask': 'Script Task', 'businessRuleTask': 'Business Rule Task',
    'subProcess': 'SubProcess', 'callActivity': 'Call Activity',
    'exclusiveGateway': 'Exclusive Gateway', 'parallelGateway': 'Parallel Gateway',
    'inclusiveGateway': 'Inclusive Gateway', 'eventBasedGateway': 'Event-based Gateway', 'complexGateway': 'Complex Gateway',
    'textAnnotation': 'Text Annotation', 'dataObject': 'Data Object', 'dataStoreReference': 'Data Store',
  };
  return map[rawType] || rawType;
}
