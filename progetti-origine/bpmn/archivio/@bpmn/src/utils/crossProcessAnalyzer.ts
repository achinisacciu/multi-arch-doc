import type { ParsedBpmn, BpmnFileItem, CrossProcessAnalysis, CallActivityRef, SharedRole, MessageFlowRef } from '../types';

export function analyzeCrossProcess(files: BpmnFileItem[], parsed: Record<string, ParsedBpmn>): CrossProcessAnalysis {
  const callActivityRefs: CallActivityRef[] = [];
  const sharedRoles = new Map<string, SharedRole>();
  const messageFlows: MessageFlowRef[] = [];
  const processInteractions: CrossProcessAnalysis['processInteractions'] = [];

  const processMap = new Map<string, { name: string; file: string }>();
  for (const [id, p] of Object.entries(parsed)) {
    processMap.set(p.processId, { name: p.processName, file: p.fileName });
  }

  for (const [fileId, p] of Object.entries(parsed)) {
    const fileName = p.fileName;

    // Call Activities
    for (const el of p.elements) {
      if (el.rawType === 'callActivity') {
        const calledElement = p.rawXml.match(`calledElement="([^"]+)"`)?.match?.[1];
        let targetProcessId = calledElement;

        // Try to find matching process by name
        if (!targetProcessId) {
          const calledByName = el.name || '';
          for (const [pid, pinfo] of processMap) {
            if (pinfo.name.toLowerCase().includes(calledByName.toLowerCase())) {
              targetProcessId = pid;
              break;
            }
          }
        }

        const targetInfo = targetProcessId ? processMap.get(targetProcessId) : undefined;
        const targetFile = targetInfo ? files.find(f => f.name === targetInfo.file)?.name : undefined;

        callActivityRefs.push({
          sourceId: el.id,
          sourceName: el.name || el.id,
          sourceFile: fileName,
          targetProcessId,
          targetProcessName: targetInfo?.name || targetProcessId,
          targetFile,
        });

        processInteractions.push({
          fromProcessId: p.processId,
          fromFileName: fileName,
          toProcessId: targetProcessId,
          toFileName: targetFile,
          type: 'callActivity',
          description: `${el.name || el.id} → ${targetInfo?.name || targetProcessId || 'processo sconosciuto'}`,
        });
      }
    }

    // Shared roles (participant names / lane names / resource roles)
    for (const el of p.elements) {
      if ((el.rawType || '').toLowerCase().includes('task')) {
        // Check for resource roles, assignee, candidate groups in XML
        const resourceMatch = p.rawXml.match(`<resourceParameter.*?${el.id}.*?>.*?<resourceParameterBinding`, 's');
        const assignee = p.rawXml.match(`camunda:assignee="([^"]+)"`)?.[1];
        const candidateGroups = p.rawXml.match(`camunda:candidateGroups="([^"]+)"`)?.[1];

        // Extract any role-like attributes
        const rolePatterns = [assignee, candidateGroups, resourceMatch].filter(Boolean) as string[];
        for (const role of rolePatterns) {
          if (role && role.length > 0) {
            if (!sharedRoles.has(role)) {
              sharedRoles.set(role, { roleName: role, participatingProcesses: [], totalTasks: 0 });
            }
            const sr = sharedRoles.get(role)!;
            if (!sr.participatingProcesses.includes(fileName)) {
              sr.participatingProcesses.push(fileName);
            }
            sr.totalTasks++;
          }
        }
      }
    }

    // Message flows (in definitions, not process level)
    const msgFlowPattern = /<messageFlow[^>]*id="([^"]+)"[^>]*sourceRef="([^"]+)"[^>]*targetRef="([^"]+)"[^>]*>/g;
    let msgMatch;
    while ((msgMatch = msgFlowPattern.exec(p.rawXml)) !== null) {
      const [, flowId, sourceRef, targetRef] = msgMatch;
      messageFlows.push({
        id: flowId,
        sourceRef,
        targetRef,
        sourceFile: fileName,
        targetFile: files.find(f => f.content.includes(targetRef))?.name,
        messageRef: undefined,
        name: undefined,
      });

      processInteractions.push({
        fromProcessId: p.processId,
        fromFileName: fileName,
        toProcessId: undefined,
        toFileName: files.find(f => f.content.includes(targetRef))?.name,
        type: 'messageEvent',
        description: `Messaggio da ${fileName} a ${files.find(f => f.content.includes(targetRef))?.name || 'altro processo'}`,
      });
    }
  }

  return {
    totalProcesses: files.length,
    totalElements: Object.values(parsed).reduce((sum, p) => sum + p.elements.length, 0),
    callActivityRefs,
    sharedRoles: Array.from(sharedRoles.values()),
    messageFlows,
    processInteractions,
  };
}
