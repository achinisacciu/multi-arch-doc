import { ParsedBpmn, BpmnDocumentation, ProcessStepDoc, RaciItem, RiskExceptionDoc, TestScenarioDoc, GatewayDoc } from '../types';
import { calculateCyclomaticComplexity } from './complexityCalculator';

const LANG = {
  it: {
    summary: (n: string) => `Il processo BPMN "${n}" descrive un flusso di lavoro aziendale strutturato. Di seguito vengono documentati obiettivi, attori, fasi operative, matrici di responsabilità, rischi e casi di test.`,
    audience: 'Analisti di processo, sviluppatori, architetti SOA, responsabili qualità, team di test',
    objective: (n: string) => `Definire e standardizzare il flusso di lavoro per "${n}"`,
    stepDesc: (t: string, n: string) => t === 'startEvent' ? `Il processo ha inizio con l'evento di avvio "${n}"` : `Esecuzione dell'attività "${n}"`,
    riskNoGateways: 'Assenza di gateway decisionali: il processo potrebbe essere eccessivamente lineare',
    riskNoLanes: 'Assenza di corsie/ruoli: le responsabilità non sono formalizzate',
    opt: 'Valutare l\'introduzione di KPI per il monitoraggio delle performance del processo',
    testHappy: (n: string) => `Percorso felice di "${n}"`,
    testAlt: (n: string) => `Percorso alternativo di "${n}"`,
    testError: (n: string) => `Scenario di errore di "${n}"`,
  },
  en: {
    summary: (n: string) => `The BPMN process "${n}" describes a structured business workflow. Objectives, actors, operational phases, responsibility matrices, risks and test cases are documented below.`,
    audience: 'Process analysts, developers, SOA architects, quality managers, test team',
    objective: (n: string) => `Define and standardize the workflow for "${n}"`,
    stepDesc: (t: string, n: string) => t === 'startEvent' ? `The process starts with the "${n}" start event` : `Execution of activity "${n}"`,
    riskNoGateways: 'No decision gateways: the process may be excessively linear',
    riskNoLanes: 'No lanes/roles: responsibilities are not formalized',
    opt: 'Evaluate introducing KPIs to monitor process performance',
    testHappy: (n: string) => `Happy path of "${n}"`,
    testAlt: (n: string) => `Alternative path of "${n}"`,
    testError: (n: string) => `Error scenario of "${n}"`,
  },
  de: {
    summary: (n: string) => `Der BPMN-Prozess "${n}" beschreibt einen strukturierten Geschäftsablauf. Nachfolgend werden Ziele, Akteure, Betriebsphasen, Verantwortungsmatrizen, Risiken und Testfälle dokumentiert.`,
    audience: 'Prozessanalysten, Entwickler, SOA-Architekten, Qualitätsmanager, Testteam',
    objective: (n: string) => `Definieren und standardisieren Sie den Workflow für "${n}"`,
    stepDesc: (t: string, n: string) => t === 'startEvent' ? `Der Prozess beginnt mit dem Startereignis "${n}"` : `Ausführung der Aktivität "${n}"`,
    riskNoGateways: 'Keine Entscheidungs-Gateways: Der Prozess könnte übermäßig linear sein',
    riskNoLanes: 'Keine Spuren/Rollen: Verantwortlichkeiten sind nicht formalisiert',
    opt: 'Bewerten Sie die Einführung von KPIs zur Überwachung der Prozessleistung',
    testHappy: (n: string) => `Erfolgspfad von "${n}"`,
    testAlt: (n: string) => `Alternativpfad von "${n}"`,
    testError: (n: string) => `Fehlerszenario von "${n}"`,
  },
  fr: {
    summary: (n: string) => `Le processus BPMN "${n}" décrit un flux de travail structuré. Les objectifs, acteurs, phases opérationnelles, matrices de responsabilité, risques et cas de test sont documentés ci-dessous.`,
    audience: 'Analystes processus, développeurs, architectes SOA, responsables qualité, équipe test',
    objective: (n: string) => `Définir et standardiser le flux de travail pour "${n}"`,
    stepDesc: (t: string, n: string) => t === 'startEvent' ? `Le processus commence avec l'événement de démarrage "${n}"` : `Exécution de l'activité "${n}"`,
    riskNoGateways: 'Absence de passerelles de décision : le processus pourrait être trop linéaire',
    riskNoLanes: 'Absence de couloirs/rôles : les responsabilités ne sont pas formalisées',
    opt: 'Évaluer l\'introduction de KPI pour le suivi des performances du processus',
    testHappy: (n: string) => `Chemin heureux de "${n}"`,
    testAlt: (n: string) => `Chemin alternatif de "${n}"`,
    testError: (n: string) => `Scénario d'erreur de "${n}"`,
  },
  es: {
    summary: (n: string) => `El proceso BPMN "${n}" describe un flujo de trabajo estructurado. A continuación se documentan objetivos, actores, fases operativas, matrices de responsabilidad, riesgos y casos de prueba.`,
    audience: 'Analistas de procesos, desarrolladores, arquitectos SOA, responsables de calidad, equipo de pruebas',
    objective: (n: string) => `Definir y estandarizar el flujo de trabajo para "${n}"`,
    stepDesc: (t: string, n: string) => t === 'startEvent' ? `El proceso comienza con el evento de inicio "${n}"` : `Ejecución de la actividad "${n}"`,
    riskNoGateways: 'Ausencia de compuertas de decisión: el proceso podría ser excesivamente lineal',
    riskNoLanes: 'Ausencia de carriles/roles: las responsabilidades no están formalizadas',
    opt: 'Evaluar la introducción de KPI para el monitoreo del rendimiento del proceso',
    testHappy: (n: string) => `Camino feliz de "${n}"`,
    testAlt: (n: string) => `Camino alternativo de "${n}"`,
    testError: (n: string) => `Escenario de error de "${n}"`,
  },
};

export function generateBpmnDocumentation(parsed: ParsedBpmn, language: string = 'it', detailLevel: string = 'high'): BpmnDocumentation {
  const lang = (LANG as any)[language] || LANG.it;
  const complexity = calculateCyclomaticComplexity(parsed, language);

  const objective = lang.objective(parsed.processName);
  const businessObjectives = [objective];
  if (parsed.lanes.length > 0) {
    businessObjectives.push(`Coinvolgere i ruoli: ${parsed.lanes.map(l => l.name).join(', ')}`);
  }

  const stepTaskTypes = ['startEvent', 'task', 'userTask', 'serviceTask', 'sendTask', 'receiveTask', 'manualTask', 'scriptTask', 'businessRuleTask', 'callActivity', 'subProcess', 'intermediateCatchEvent', 'intermediateThrowEvent', 'boundaryEvent', 'endEvent'];
  const steps: ProcessStepDoc[] = [];
  let stepNum = 0;
  const visited = new Set<string>();
  const startElements = parsed.elements.filter(e => e.rawType === 'startEvent');
  const sortedElements = startElements.length > 0 ? [...startElements] : [];
  const remaining = parsed.elements.filter(e => !startElements.includes(e));

  for (const se of sortedElements) {
    if (!visited.has(se.id)) {
      visited.add(se.id);
      stepNum++;
      steps.push({ stepNumber: stepNum, elementId: se.id, name: se.name || se.id, type: se.type, actorRole: se.laneName || 'N/D', description: `${se.type}: ${se.name || se.id}`, inputs: [], outputs: [] });
    }
    for (const outId of se.outgoing) {
      const flow = parsed.elements.find(e => e.id === outId && e.rawType === 'sequenceFlow');
      if (flow) {
        for (const targetId of flow.outgoing) {
          const target = parsed.elements.find(e => e.id === targetId);
          if (target && !visited.has(target.id) && stepTaskTypes.includes(target.rawType)) {
            visited.add(target.id);
            stepNum++;
            const element = target;
            steps.push({
              stepNumber: stepNum, elementId: element.id, name: element.name || element.id,
              type: element.type, actorRole: element.laneName || 'N/D',
              description: lang.stepDesc(element.rawType, element.name || element.id),
              inputs: ['Dati in ingresso'], outputs: ['Risultato elaborazione'],
              decisionRules: element.conditionExpression,
              triggerOrTimer: element.timerEventDefinition,
            });
          }
        }
      }
    }
  }
  for (const elem of remaining) {
    if (!visited.has(elem.id) && stepTaskTypes.includes(elem.rawType)) {
      visited.add(elem.id);
      stepNum++;
      steps.push({
        stepNumber: stepNum, elementId: elem.id, name: elem.name || elem.id,
        type: elem.type, actorRole: elem.laneName || 'N/D',
        description: `${elem.type}: ${elem.name || elem.id}`,
      });
    }
  }

  const rolesAndParticipants: BpmnDocumentation['rolesAndParticipants'] = [];
  for (const lane of parsed.lanes) {
    const count = parsed.elements.filter(e => e.laneName === lane.name).length;
    rolesAndParticipants.push({ name: lane.name, type: 'Lane', description: `Corsia di processo`, assignedTasksCount: count });
  }
  if (rolesAndParticipants.length === 0) {
    rolesAndParticipants.push({ name: parsed.processName, type: 'Actor', description: 'Esecutore del processo', assignedTasksCount: parsed.stats.tasksCount });
  }

  const raciMatrix: RaciItem[] = [];
  for (const step of steps) {
    if (['startEvent', 'endEvent', 'intermediateCatchEvent', 'intermediateThrowEvent', 'boundaryEvent'].includes(step.type) && !step.name) continue;
    raciMatrix.push({
      taskName: step.name,
      elementId: step.elementId,
      responsible: step.actorRole,
      accountable: step.actorRole,
      consulted: 'N/D',
      informed: 'N/D',
    });
  }

  const gateways: GatewayDoc[] = [];
  for (const elem of parsed.elements) {
    if (['exclusiveGateway', 'parallelGateway', 'inclusiveGateway', 'eventBasedGateway', 'complexGateway'].includes(elem.rawType)) {
      const branches = elem.outgoing.map(outId => {
        const flow = parsed.elements.find(e => e.id === outId);
        return { condition: flow?.conditionExpression || `Flusso verso ${flow?.name || outId}`, target: flow?.name || outId };
      });
      gateways.push({ id: elem.id, name: elem.name || elem.id, type: elem.type, branches });
    }
  }

  const risksAndExceptions: RiskExceptionDoc[] = [];
  if (parsed.stats.gatewaysCount === 0) {
    risksAndExceptions.push({ risk: lang.riskNoGateways, location: 'Struttura processo', mitigation: 'Valutare se il processo necessita di punti di decisione formali' });
  }
  if (parsed.stats.lanesCount === 0) {
    risksAndExceptions.push({ risk: lang.riskNoLanes, location: 'Organizzazione processo', mitigation: 'Introdurre corsie per assegnare responsabilità agli attori coinvolti' });
  }
  for (const gw of gateways) {
    if (gw.branches.length > 3) {
      risksAndExceptions.push({ risk: `Gateway "${gw.name}" ha ${gw.branches.length} rami: alta complessità decisionale`, location: gw.id, mitigation: 'Valutare la suddivisione in gateway nidificati' });
    }
  }

  const optimizationSuggestions = [lang.opt];
  if (parsed.stats.tasksCount > 10) {
    optimizationSuggestions.push(`Il processo ha ${parsed.stats.tasksCount} attività: valutare l'introduzione di sotto-processi`);
  }
  if (complexity.score > 10) {
    optimizationSuggestions.push(`Complessità ciclomatica ${complexity.score}: considerare la rifattorizzazione del processo`);
  }

  const testScenarios: TestScenarioDoc[] = [];
  testScenarios.push({
    id: 'TC-HP-01', title: lang.testHappy(parsed.processName),
    preconditions: 'Il processo è avviato con i parametri corretti',
    pathSteps: steps.filter(s => s.type !== 'Gateway').map(s => s.name),
    expectedResult: 'Il processo completa con successo tutte le attività',
  });
  if (gateways.length > 0) {
    testScenarios.push({
      id: 'TC-ALT-01', title: lang.testAlt(parsed.processName),
      preconditions: 'Il processo è avviato con parametri che attivano percorsi alternativi',
      pathSteps: [`Attivazione gateway: ${gateways[0].name}`, 'Percorso alternativo'],
      expectedResult: 'Il processo gestisce correttamente percorsi alternativi',
    });
  }
  testScenarios.push({
    id: 'TC-ERR-01', title: lang.testError(parsed.processName),
    preconditions: 'Il processo è avviato con dati mancanti o errati',
    pathSteps: ['Evento di errore', 'Gestione eccezione'],
    expectedResult: 'Il processo gestisce l\'errore o termina con un evento di errore appropriato',
  });

  const manualGuideSections = [
    `# Manuale Operativo: ${parsed.processName}`,
    '',
    '## Panoramica',
    lang.summary(parsed.processName),
    '',
    '## Attori Coinvolti',
    ...rolesAndParticipants.map(r => `- **${r.name}**: ${r.description} (${r.assignedTasksCount} attività)`),
    '',
    '## Fasi del Processo',
    ...steps.map(s => `### ${s.stepNumber}. ${s.name}\n- **Tipo**: ${s.type}\n- **Attore**: ${s.actorRole}\n- **Descrizione**: ${s.description}`),
    '',
    '## Matrice RACI',
    '| Attività | Responsabile | Accountable | Consultato | Informato |',
    '|----------|-------------|-------------|------------|-----------|',
    ...raciMatrix.map(r => `| ${r.taskName} | ${r.responsible} | ${r.accountable} | ${r.consulted} | ${r.informed} |`),
    '',
    '## Gateway di Decisione',
    ...gateways.map(g => `### ${g.name} (${g.type})\n${g.branches.map(b => `- Se: ${b.condition} → ${b.target}`).join('\n')}`),
  ];

  return {
    processName: parsed.processName, processId: parsed.processId, version: '1.0',
    executiveSummary: lang.summary(parsed.processName),
    targetAudience: lang.audience,
    businessObjectives,
    rolesAndParticipants,
    processSteps: steps,
    gateways,
    raciMatrix,
    functionalRequirements: businessObjectives,
    risksAndExceptions,
    optimizationSuggestions,
    testScenarios,
    userManualGuide: manualGuideSections.join('\n'),
    cyclomaticComplexity: complexity,
    generatedAt: new Date().toISOString(),
    language: language as any,
  };
}
