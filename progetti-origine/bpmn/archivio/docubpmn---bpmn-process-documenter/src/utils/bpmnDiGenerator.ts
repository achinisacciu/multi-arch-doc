/**
 * Utility to ensure that a BPMN XML string contains diagram layout information (<bpmndi:BPMNDiagram>).
 * If missing, it parses process nodes and sequence flows, calculates visual layout coordinates,
 * and appends a valid <bpmndi:BPMNDiagram> structure so bpmn-js can render the diagram cleanly.
 */
export function ensureBpmnDiagramDI(xmlString: string): string {
  if (!xmlString || typeof xmlString !== 'string') return xmlString;

  // If XML already contains diagram info, verify BPMNPlane bpmnElement attribute
  if (/<[a-z0-9:]*BPMNDiagram/i.test(xmlString) || /<[a-z0-9:]*BPMNPlane/i.test(xmlString)) {
    return xmlString;
  }

  try {
    let processedXml = xmlString;

    // Ensure required namespaces exist in <definitions> tag
    if (!/xmlns:bpmndi=/i.test(processedXml)) {
      processedXml = processedXml.replace(/(<[a-z0-9:]*definitions)/i, '$1 xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"');
    }
    if (!/xmlns:dc=/i.test(processedXml)) {
      processedXml = processedXml.replace(/(<[a-z0-9:]*definitions)/i, '$1 xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"');
    }
    if (!/xmlns:di=/i.test(processedXml)) {
      processedXml = processedXml.replace(/(<[a-z0-9:]*definitions)/i, '$1 xmlns:di="http://www.omg.org/spec/DD/20100524/DI"');
    }

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(processedXml, 'text/xml');
    
    // Check for parse errors
    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
      return xmlString;
    }

    const rootNode = xmlDoc.documentElement;
    
    // Find target element id (Process or Collaboration)
    let targetElementId: string | null = null;
    let participantId: string | null = null;

    const allNodes = rootNode.getElementsByTagName('*');
    for (let i = 0; i < allNodes.length; i++) {
      const tag = allNodes[i].tagName.replace(/.*:/, '').toLowerCase();
      if (tag === 'collaboration' && !targetElementId) {
        targetElementId = allNodes[i].getAttribute('id');
      } else if (tag === 'participant' && !participantId) {
        participantId = allNodes[i].getAttribute('id');
      } else if (tag === 'process' && !targetElementId) {
        targetElementId = allNodes[i].getAttribute('id');
      }
    }

    // Fallback if no explicit ID was on process/collaboration
    if (!targetElementId) {
      targetElementId = 'Process_Auto_1';
      // Find process tag and add ID if missing
      for (let i = 0; i < allNodes.length; i++) {
        const tag = allNodes[i].tagName.replace(/.*:/, '').toLowerCase();
        if (tag === 'process') {
          allNodes[i].setAttribute('id', targetElementId);
          const serializer = new XMLSerializer();
          processedXml = serializer.serializeToString(xmlDoc);
          break;
        }
      }
    }

    // Collect flow nodes and sequence flows
    const shapesInfo: Array<{ id: string; type: string; x: number; y: number; width: number; height: number }> = [];
    const edgesInfo: Array<{ id: string; sourceRef: string; targetRef: string }> = [];
    const nodesMap = new Map<string, { x: number; y: number; width: number; height: number }>();

    let currentX = 180;
    const defaultY = 160;
    let maxWidth = 0;

    for (let i = 0; i < allNodes.length; i++) {
      const el = allNodes[i];
      const tag = el.tagName.replace(/.*:/, '');
      const id = el.getAttribute('id');

      if (!id) continue;

      if (tag === 'sequenceFlow') {
        const sourceRef = el.getAttribute('sourceRef') || '';
        const targetRef = el.getAttribute('targetRef') || '';
        edgesInfo.push({ id, sourceRef, targetRef });
        continue;
      }

      const lowerTag = tag.toLowerCase();
      const isEvent = lowerTag.includes('event');
      const isGateway = lowerTag.includes('gateway');
      const isTask = lowerTag.includes('task') || lowerTag.includes('activity') || lowerTag.includes('subprocess');

      if (isEvent || isGateway || isTask) {
        let width = 100;
        let height = 80;
        let yOffset = 0;

        if (isEvent) {
          width = 36;
          height = 36;
          yOffset = 22;
        } else if (isGateway) {
          width = 50;
          height = 50;
          yOffset = 15;
        }

        const nodeBounds = {
          id,
          type: tag,
          x: currentX,
          y: defaultY + yOffset,
          width,
          height,
        };

        shapesInfo.push(nodeBounds);
        nodesMap.set(id, nodeBounds);

        currentX += width + 70;
        maxWidth = currentX;
      }
    }

    if (shapesInfo.length === 0) {
      return xmlString;
    }

    // Build BPMNDiagram XML block
    let diXml = `\n  <bpmndi:BPMNDiagram id="BPMNDiagram_Generated_1">\n`;
    diXml += `    <bpmndi:BPMNPlane id="BPMNPlane_Generated_1" bpmnElement="${targetElementId}">\n`;

    // Add Participant shape if collaboration exists
    if (participantId) {
      diXml += `      <bpmndi:BPMNShape id="${participantId}_di" bpmnElement="${participantId}" isHorizontal="true">\n`;
      diXml += `        <dc:Bounds x="120" y="80" width="${Math.max(maxWidth - 40, 600)}" height="240" />\n`;
      diXml += `      </bpmndi:BPMNShape>\n`;
    }

    // Add Node Shapes
    for (const shape of shapesInfo) {
      diXml += `      <bpmndi:BPMNShape id="${shape.id}_di" bpmnElement="${shape.id}">\n`;
      diXml += `        <dc:Bounds x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" />\n`;
      diXml += `      </bpmndi:BPMNShape>\n`;
    }

    // Add Edges
    for (const edge of edgesInfo) {
      const source = nodesMap.get(edge.sourceRef);
      const target = nodesMap.get(edge.targetRef);

      diXml += `      <bpmndi:BPMNEdge id="${edge.id}_di" bpmnElement="${edge.id}">\n`;
      if (source && target) {
        const startX = source.x + source.width;
        const startY = source.y + Math.round(source.height / 2);
        const endX = target.x;
        const endY = target.y + Math.round(target.height / 2);

        diXml += `        <di:waypoint x="${startX}" y="${startY}" />\n`;
        diXml += `        <di:waypoint x="${endX}" y="${endY}" />\n`;
      } else {
        diXml += `        <di:waypoint x="100" y="100" />\n`;
        diXml += `        <di:waypoint x="200" y="100" />\n`;
      }
      diXml += `      </bpmndi:BPMNEdge>\n`;
    }

    diXml += `    </bpmndi:BPMNPlane>\n`;
    diXml += `  </bpmndi:BPMNDiagram>\n`;

    // Insert before closing tag of definitions
    const closingTagMatch = processedXml.match(/<\/([^>]+)>\s*$/);
    if (closingTagMatch) {
      const closingTagIndex = processedXml.lastIndexOf(closingTagMatch[0]);
      return processedXml.substring(0, closingTagIndex) + diXml + processedXml.substring(closingTagIndex);
    }

    return processedXml + diXml;
  } catch (err) {
    console.warn('Impossibile autogenerare layout BPMNDiagram:', err);
    return xmlString;
  }
}
