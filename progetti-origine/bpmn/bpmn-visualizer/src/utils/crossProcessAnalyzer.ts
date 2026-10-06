import { ParsedBpmn, IntegratedFolderDoc, CrossProcessLink, SharedRoleInfo, RaciItem } from '../types';
import { calculateCyclomaticComplexity } from './complexityCalculator';

export function generateIntegratedFolderDoc(files: Array<{ fileName: string; parsed: ParsedBpmn }>, language: string = 'it'): IntegratedFolderDoc {
  const processSummaries = files.map(f => {
    const complexity = calculateCyclomaticComplexity(f.parsed, language);
    const callActivities = f.parsed.elements.filter(e => e.rawType === 'callActivity');
    return {
      fileName: f.fileName,
      processId: f.parsed.processId,
      processName: f.parsed.processName,
      tasksCount: f.parsed.stats.tasksCount,
      gatewaysCount: f.parsed.stats.gatewaysCount,
      eventsCount: f.parsed.stats.eventsCount,
      lanesCount: f.parsed.stats.lanesCount,
      callActivitiesCount: callActivities.length,
      cyclomaticScore: complexity.score,
      cyclomaticRating: complexity.rating,
    };
  });

  const processComplexityRanking = [...processSummaries]
    .sort((a, b) => (b.cyclomaticScore || 0) - (a.cyclomaticScore || 0))
    .map(p => ({
      processName: p.processName, processId: p.processId, fileName: p.fileName,
      score: p.cyclomaticScore || 0, rating: p.cyclomaticRating || 'low',
      ratingLabel: p.cyclomaticRating || 'low',
    }));

  const averageComplexity = processSummaries.length > 0
    ? Math.round(processSummaries.reduce((s, p) => s + (p.cyclomaticScore || 0), 0) / processSummaries.length * 10) / 10
    : 0;

  const crossLinks: CrossProcessLink[] = [];
  for (const f of files) {
    const callActivities = f.parsed.elements.filter(e => e.rawType === 'callActivity');
    for (const ca of callActivities) {
      const targetName = ca.name || ca.id;
      const targetFile = files.find(tf =>
        tf.parsed.processName.toLowerCase() === targetName.toLowerCase() ||
        tf.parsed.processId.toLowerCase() === targetName.toLowerCase() ||
        tf.fileName.toLowerCase().includes(targetName.toLowerCase())
      );
      crossLinks.push({
        sourceProcessId: f.parsed.processId, sourceProcessName: f.parsed.processName,
        sourceFileName: f.fileName, sourceElementId: ca.id, sourceElementName: ca.name || ca.id,
        targetProcessId: targetFile?.parsed.processId,
        targetProcessName: targetFile?.parsed.processName,
        targetFileName: targetFile?.fileName,
        linkType: 'CallActivity',
        description: `Il processo "${f.parsed.processName}" chiama "${ca.name || ca.id}"${targetFile ? '' : ' (destinazione non trovata nel portafoglio)'}`,
      });
    }
  }

  const sharedRoles: SharedRoleInfo[] = [];
  const roleProcessMap = new Map<string, Set<string>>();
  for (const f of files) {
    for (const lane of f.parsed.lanes) {
      if (!roleProcessMap.has(lane.name)) roleProcessMap.set(lane.name, new Set());
      roleProcessMap.get(lane.name)!.add(f.parsed.processName);
    }
  }
  for (const [roleName, processes] of roleProcessMap) {
    if (processes.size >= 2) {
      sharedRoles.push({ roleName, participatingProcesses: Array.from(processes), totalTasksAcrossFolder: 0 });
    }
  }
  for (const sr of sharedRoles) {
    sr.totalTasksAcrossFolder = files.filter(f => sr.participatingProcesses.includes(f.parsed.processName))
      .reduce((s, f) => s + f.parsed.elements.filter(e => e.laneName === sr.roleName).length, 0);
  }

  const consolidatedRaci: RaciItem[] = [];
  for (const f of files) {
    for (const elem of f.parsed.elements) {
      if (['task', 'userTask', 'serviceTask', 'sendTask', 'receiveTask', 'manualTask', 'scriptTask', 'businessRuleTask', 'callActivity'].includes(elem.rawType)) {
        const laneName = elem.laneName || 'N/D';
        consolidatedRaci.push({
          taskName: `[${f.parsed.processName}] ${elem.name || elem.id}`,
          elementId: elem.id,
          responsible: laneName,
          accountable: laneName,
          consulted: 'N/D',
          informed: 'N/D',
        });
      }
    }
  }

  const endToEndValueStream: IntegratedFolderDoc['endToEndValueStream'] = [];
  files.forEach((f, idx) => {
    const hasStart = f.parsed.elements.some(e => e.rawType === 'startEvent');
    endToEndValueStream.push({
      stepNumber: idx + 1,
      processId: f.parsed.processId,
      processName: f.parsed.processName,
      phaseName: f.parsed.processName,
      keyInputs: [],
      keyOutputs: [],
      handoverTo: idx < files.length - 1 ? files[idx + 1].parsed.processName : undefined,
    });
  });

  const crossProcessRisks: IntegratedFolderDoc['crossProcessRisks'] = [];
  if (crossLinks.some(l => !l.targetFileName)) {
    crossProcessRisks.push({
      risk: 'Chiamate a processi esterni non trovati nel portafoglio',
      involvedProcesses: crossLinks.filter(l => !l.targetFileName).map(l => l.sourceProcessName),
      impact: 'Le CallActivity potrebbero puntare a processi non disponibili, causando errori a runtime',
      mitigation: 'Verificare che tutti i processi chiamati siano inclusi nel portafoglio o creare stub/documentazione dei processi esterni',
    });
  }
  if (sharedRoles.length > 0) {
    crossProcessRisks.push({
      risk: 'Ruoli condivisi tra processi',
      involvedProcesses: sharedRoles.map(sr => sr.roleName),
      impact: 'Task assegnati agli stessi ruoli in processi diversi possono creare conflitti di priorità',
      mitigation: 'Coordinare la pianificazione tra i processi che condividono gli stessi attori',
    });
  }

  const integratedOperationalGuide = `# Guida Operativa Integrata - Portafoglio Processi\n\n` +
    `## Panoramica\nIl portafoglio contiene ${files.length} processi BPMN.\n\n` +
    `## Processi\n${processSummaries.map(p => `- **${p.processName}**: ${p.tasksCount} attività, ${p.gatewaysCount} gateway, complessità ${p.cyclomaticRating || 'N/D'}`).join('\n')}\n\n` +
    `## Dipendenze\n${crossLinks.length > 0 ? crossLinks.map(l => `- ${l.sourceProcessName} → ${l.targetProcessName || l.sourceElementName}`).join('\n') : 'Nessuna dipendenza incrociata rilevata.'}\n\n` +
    `## Ruoli Condivisi\n${sharedRoles.length > 0 ? sharedRoles.map(r => `- **${r.roleName}**: presente in ${r.participatingProcesses.join(', ')}`).join('\n') : 'Nessun ruolo condiviso.'}`;

  return {
    folderName: 'Portafoglio Processi',
    totalFiles: files.length,
    generatedAt: new Date().toISOString(),
    language: language as any,
    executiveSummary: `Il portafoglio contiene ${files.length} processi BPMN complessivamente, con un indice di complessità medio di ${averageComplexity}. Sono state identificate ${crossLinks.length} dipendenze incrociate e ${sharedRoles.length} ruoli condivisi tra processi.`,
    averageComplexity,
    processComplexityRanking,
    processSummaries,
    crossLinks,
    sharedRoles,
    consolidatedRaci,
    endToEndValueStream,
    crossProcessRisks,
    integratedOperationalGuide,
  };
}
