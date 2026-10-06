import { BpmnFileItem, BpmnFolderNode, ParsedBpmn, BpmnElement, BpmnLane, BpmnPool } from '../types';

export function getFriendlyTypeName(rawType: string): string {
  const map: Record<string, string> = {
    'startEvent': 'Evento di Avvio', 'endEvent': 'Evento di Fine', 'intermediateCatchEvent': 'Evento Intermedio di Catch', 'intermediateThrowEvent': 'Evento Intermedio di Throw', 'boundaryEvent': 'Evento di Confine',
    'task': 'Attività', 'userTask': 'Attività Utente', 'serviceTask': 'Attività di Servizio', 'sendTask': 'Attività di Invio', 'receiveTask': 'Attività di Ricezione', 'manualTask': 'Attività Manuale', 'scriptTask': 'Attività Script', 'businessRuleTask': 'Attività Regola di Business',
    'exclusiveGateway': 'Gateway Esclusivo (XOR)', 'inclusiveGateway': 'Gateway Inclusivo (OR)', 'parallelGateway': 'Gateway Parallelo (AND)', 'eventBasedGateway': 'Gateway Basato su Eventi', 'complexGateway': 'Gateway Complesso',
    'subProcess': 'Sotto-Processo', 'transaction': 'Transazione', 'adHocSubProcess': 'Sotto-Processo Ad-Hoc', 'callActivity': 'Chiamata ad altro Processo',
    'sequenceFlow': 'Flusso di Sequenza', 'messageFlow': 'Flusso di Messaggio', 'association': 'Associazione',
    'dataObject': 'Oggetto Dato', 'dataStore': 'Archivio Dati', 'textAnnotation': 'Annotazione',
  };
  return map[rawType] || rawType;
}

function cleanTagName(nodeName: string): string {
  return nodeName.includes(':') ? nodeName.split(':')[1] : nodeName;
}

function getAttribute(node: Element, ...names: string[]): string | undefined {
  for (const name of names) {
    const v = node.getAttribute(name);
    if (v !== null && v !== undefined) return v;
    if (name.includes(':')) {
      const [ns, local] = name.split(':');
      const attr = node.attributes.getNamedItem(name) || node.attributes.getNamedItem(local);
      if (attr) return attr.value;
    }
  }
  return undefined;
}

function getChildren(parent: Element, tagName: string): Element[] {
  return Array.from(parent.children).filter(c => cleanTagName(c.tagName) === tagName);
}

export function parseBpmnXml(xmlContent: string, fileName: string): ParsedBpmn {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'text/xml');
  const processEl = doc.querySelector('process') || doc.querySelector('[processType]');
  const definitions = doc.querySelector('definitions');

  const processId = processEl?.getAttribute('id') || 'unknown';
  const processName = processEl?.getAttribute('name') || fileName.replace(/\.(bpmn|xml)$/i, '');
  const docEl = processEl ? getChildren(processEl, 'documentation')[0] : null;

  const pools: BpmnPool[] = [];
  const lanes: BpmnLane[] = [];
  const elements: BpmnElement[] = [];
  const laneMap = new Map<string, string>();
  const laneIdMap = new Map<string, string>();
  const poolMap = new Map<string, string>();

  const collaborations = doc.querySelectorAll('collaboration, participant');
  for (const collab of collaborations) {
    const participants = getChildren(collab, 'participant');
    for (const p of participants) {
      const pid = p.getAttribute('id') || '';
      const pname = p.getAttribute('name') || '';
      poolMap.set(pid, pname);
    }
  }

  const laneElements = doc.querySelectorAll('lane');
  for (const laneEl of Array.from(laneElements)) {
    const lid = laneEl.getAttribute('id') || '';
    const lname = laneEl.getAttribute('name') || '';
    const refs = getChildren(laneEl, 'flowNodeRef').map(r => r.textContent || '');
    laneMap.set(lid, lname);
    laneIdMap.set(lid, lid);
    lanes.push({ id: lid, name: lname, flowNodeRefs: refs });
  }

  const processNodes = processEl ? Array.from(processEl.children) : [];
  for (const node of processNodes) {
    const tag = cleanTagName(node.tagName);
    if (['extensionElements', 'laneSet', 'documentation'].includes(tag) || tag.includes(':')) continue;
    if (tag === 'sequenceFlow') {
      elements.push({
        id: node.getAttribute('id') || '', name: node.getAttribute('name') || '',
        type: 'sequenceFlow', rawType: 'sequenceFlow',
        documentation: getAttribute(node, 'documentation'),
        incoming: [node.getAttribute('sourceRef') || ''], outgoing: [node.getAttribute('targetRef') || ''],
        conditionExpression: getChildren(node, 'conditionExpression')[0]?.textContent || undefined,
      });
      continue;
    }
    const incoming = getChildren(node, 'incoming').map(el => el.textContent || '');
    const outgoing = getChildren(node, 'outgoing').map(el => el.textContent || '');
    const docEl2 = getChildren(node, 'documentation')[0];
    const camundaAssignee = getAttribute(node, 'camunda:assignee', 'assignee');
    const camundaGroups = getAttribute(node, 'camunda:candidateGroups', 'candidateGroups');
    const camundaTopic = getAttribute(node, 'camunda:topic', 'topic');

    const formFields: Array<{ id: string; label: string; type: string }> = [];
    const extEl = getChildren(node, 'extensionElements')[0];
    if (extEl) {
      const formData = extEl.querySelector('formData');
      if (formData) {
        getChildren(formData, 'formField').forEach(f => {
          formFields.push({ id: f.getAttribute('id') || '', label: f.getAttribute('label') || '', type: f.getAttribute('type') || 'string' });
        });
      }
    }

    let timerDef: string | undefined;
    const timer = getChildren(node, 'timerEventDefinition')[0];
    if (timer) {
      timerDef = timer.textContent || timer.innerHTML || 'definito';
    }

    let laneName = '';
    let poolName = '';
    for (const [lid, lname] of laneMap) {
      if (laneIdMap.get(lid) && (laneMap.get(lid) === lname)) {
        const lane = lanes.find(l => l.id === lid);
        if (lane?.flowNodeRefs.includes(node.getAttribute('id') || '')) {
          laneName = lname;
          break;
        }
      }
    }

    elements.push({
      id: node.getAttribute('id') || '',
      name: node.getAttribute('name') || '',
      type: getFriendlyTypeName(tag),
      rawType: tag,
      documentation: docEl2?.textContent || undefined,
      laneId: undefined,
      laneName: laneName || undefined,
      poolId: undefined,
      poolName: poolName || undefined,
      incoming, outgoing,
      conditionExpression: undefined,
      camundaAssignee: camundaAssignee || undefined,
      camundaCandidateGroups: camundaGroups || undefined,
      camundaTopic: camundaTopic || undefined,
      formFields: formFields.length > 0 ? formFields : undefined,
      timerEventDefinition: timerDef,
    });
  }

  const tasksCount = elements.filter(e => ['task', 'userTask', 'serviceTask', 'sendTask', 'receiveTask', 'manualTask', 'scriptTask', 'businessRuleTask', 'callActivity'].includes(e.rawType)).length;
  const gatewaysCount = elements.filter(e => ['exclusiveGateway', 'parallelGateway', 'inclusiveGateway', 'eventBasedGateway', 'complexGateway'].includes(e.rawType)).length;
  const eventsCount = elements.filter(e => ['startEvent', 'endEvent', 'intermediateCatchEvent', 'intermediateThrowEvent', 'boundaryEvent'].includes(e.rawType)).length;

  return {
    fileName, fileSize: xmlContent.length, rawXml: xmlContent,
    processId, processName,
    documentation: docEl?.textContent || undefined,
    pools, lanes, elements,
    stats: { totalElements: elements.length, tasksCount, gatewaysCount, eventsCount, poolsCount: pools.length, lanesCount: lanes.length },
  };
}

export function buildFolderTree(files: BpmnFileItem[]): BpmnFolderNode {
  const root: BpmnFolderNode = { name: 'root', path: '', files: [], subfolders: {} };
  for (const file of files) {
    const parts = file.relativePath.split('/').filter(Boolean);
    let current = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const folderName = parts[i];
      if (!current.subfolders[folderName]) {
        current.subfolders[folderName] = { name: folderName, path: parts.slice(0, i + 1).join('/'), files: [], subfolders: {} };
      }
      current = current.subfolders[folderName];
    }
    current.files.push(file);
  }
  return root;
}

export function parseBpmnStats(xmlContent: string) {
  try {
    const parsed = parseBpmnXml(xmlContent, '');
    return { isValid: true, ...parsed.stats, error: undefined };
  } catch {
    return { isValid: false, tasksCount: 0, gatewaysCount: 0, eventsCount: 0, subprocessesCount: 0, error: 'Errore nel parsing XML' };
  }
}

export async function processDroppedItems(items: DataTransferItemList): Promise<BpmnFileItem[]> {
  const files: BpmnFileItem[] = [];
  const queue: { entry: any; basePath: string }[] = [];

  const supportedExtensions = ['.bpmn', '.xml', '.bpel', '.sql', '.pls', '.pkb'];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
    if (entry) {
      if (entry.isDirectory) {
        queue.push({ entry, basePath: entry.name });
      } else if (entry.isFile && supportedExtensions.some(ext => entry.name.toLowerCase().endsWith(ext))) {
        queue.push({ entry, basePath: entry.name });
      }
    } else {
      const file = item.getAsFile();
      if (file && supportedExtensions.some(ext => file.name.toLowerCase().endsWith(ext))) {
        const content = await file.text();
        files.push(createFileItem(file.name, file.name, content, file.size, file.lastModified));
      }
    }
  }

  while (queue.length > 0) {
    const { entry, basePath } = queue.shift()!;
    if (entry.isDirectory) {
      const reader = entry.createReader();
      const entries = await new Promise<any[]>((resolve) => {
        reader.readEntries((results: any[]) => resolve(results));
      });
      for (const child of entries) {
        queue.push({ entry: child, basePath: `${basePath}/${child.name}` });
      }
    } else if (entry.isFile && supportedExtensions.some(ext => entry.name.toLowerCase().endsWith(ext))) {
      const file = await new Promise<File>((resolve) => entry.file(resolve));
      const content = await file.text();
      files.push(createFileItem(entry.name, basePath, content, file.size, file.lastModified));
    }
  }

  return files;
}

export async function processFileList(fileList: FileList): Promise<BpmnFileItem[]> {
  const files: BpmnFileItem[] = [];
  const supportedExtensions = ['.bpmn', '.xml', '.bpel', '.sql', '.pls', '.pkb'];
  for (let i = 0; i < fileList.length; i++) {
    const f = fileList[i];
    if (!supportedExtensions.some(ext => f.name.toLowerCase().endsWith(ext))) continue;
    const content = await f.text();
    const relativePath = (f as any).webkitRelativePath || f.name;
    files.push(createFileItem(f.name, relativePath, content, f.size, f.lastModified));
  }
  return files;
}

function createFileItem(name: string, relativePath: string, content: string, size: number, lastModified?: number): BpmnFileItem {
  const id = `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const pathParts = relativePath.split('/');
  const folderPath = pathParts.slice(0, -1).join('/');
  const stats = parseBpmnStats(content);
  return { id, name, relativePath, folderPath, content, size, lastModified, ...stats };
}
