import { ParsedBpmn, BpmnDocumentation, ProcessStepDoc, GatewayDoc, RaciItem, RiskExceptionDoc, TestScenarioDoc, LanguageOption } from '../types';
import { getFriendlyTypeName } from './bpmnParser';
import { calculateCyclomaticComplexity } from './complexityCalculator';

/**
 * Genera in modo deterministico ed esaustivo la documentazione completa del processo BPMN 2.0
 * suddivisa nelle 8 sezioni principali:
 * 1. Sintesi e obiettivi
 * 2. Fasi del processo
 * 3. Matrice RACI
 * 4. Ruoli
 * 5. Gateway
 * 6. Rischi e ottimizzazioni
 * 7. Casi di test
 * 8. Guida utente operativa
 */
export function generateBpmnDocumentation(
  parsedBpmn: ParsedBpmn,
  language: LanguageOption = 'it',
  detailLevel: 'high' | 'medium' | 'executive' = 'high'
): BpmnDocumentation {
  const isIt = language === 'it';
  const isEn = language === 'en';

  // 1. Sintesi & Obiettivi
  const totalTasks = parsedBpmn.stats.tasksCount;
  const totalGateways = parsedBpmn.stats.gatewaysCount;
  const totalLanes = parsedBpmn.stats.lanesCount || 1;

  const rolesList = parsedBpmn.lanes.length > 0 
    ? parsedBpmn.lanes.map(l => l.name).join(', ')
    : (parsedBpmn.pools.length > 0 ? parsedBpmn.pools.map(p => p.name).join(', ') : 'Operatore di Processo');

  const executiveSummary = parsedBpmn.documentation || (
    isIt
      ? `Il processo aziendale "${parsedBpmn.processName}" (ID: ${parsedBpmn.processId}) struttura una sequenza operativa composta da ${totalTasks} attività e ${totalGateways} punti decisionali coordinati tra ${totalLanes} ruoli organizzativi (${rolesList}). Il flusso garantisce l'esecuzione controllata del workflow dall'evento d'inizio fino al completamento dei risultati previsti.`
      : `The business process "${parsedBpmn.processName}" (ID: ${parsedBpmn.processId}) models an operational sequence composed of ${totalTasks} tasks and ${totalGateways} decision points coordinated across ${totalLanes} organizational roles (${rolesList}). The workflow ensures controlled execution from start event to final process outcomes.`
  );

  const targetAudience = isIt
    ? `Process Owner, Business Analyst, Team Operativi (${rolesList}), Auditor di Processo e Sviluppatori Integration / Automation.`
    : `Process Owner, Business Analysts, Operational Teams (${rolesList}), Process Auditors, and Integration Engineers.`;

  const businessObjectives = [
    isIt ? `Digitalizzare e automatizzare la gestione del flusso "${parsedBpmn.processName}".` : `Digitize and automate workflow execution for "${parsedBpmn.processName}".`,
    isIt ? `Garantire la tracciabilità delle responsabilità tramite suddivisione chiara dei ruoli (${totalLanes} corsie/lanes).` : `Ensure accountability across clear role divisions (${totalLanes} lanes/pools).`,
    isIt ? `Ridurre tempi morti e colli di bottiglia attraverso la gestione strutturata di ${totalGateways} gateway decisionali.` : `Reduce bottlenecks by streamlining execution across ${totalGateways} decision gateways.`,
    isIt ? `Standardizzare le procedure operative riducendo il rischio di errore umano.` : `Standardize operational procedures to minimize human error and variance.`
  ];

  // 2. Fasi del Processo (Step-by-Step Sequenced Path)
  const processSteps: ProcessStepDoc[] = [];
  
  // Logical ordering traversal: start events -> tasks -> gateways -> end events
  const sortedElements = [...parsedBpmn.elements].sort((a, b) => {
    const typeOrder = (t: string) => {
      if (t.includes('StartEvent')) return 1;
      if (t.includes('Task')) return 2;
      if (t.includes('Gateway')) return 3;
      if (t.includes('EndEvent')) return 4;
      return 5;
    };
    return typeOrder(a.type) - typeOrder(b.type);
  });

  let stepCounter = 1;

  sortedElements.forEach((el) => {
    const actorRole = el.laneName || el.poolName || el.camundaCandidateGroups || el.camundaAssignee || (
      el.type.includes('ServiceTask') || el.type.includes('ScriptTask') || el.type.includes('BusinessRuleTask')
        ? (isIt ? 'Sistema Automatico' : 'Automated System')
        : (isIt ? 'Operatore Incaricato' : 'Assigned Operator')
    );

    // Build inputs / outputs based on incoming / outgoing sequence flows
    const inputs = el.incoming.map(inId => {
      const sourceEl = parsedBpmn.elements.find(e => e.outgoing.includes(inId) || e.id === inId);
      return sourceEl ? (sourceEl.name || sourceEl.id) : inId;
    });

    const outputs = el.outgoing.map(outId => {
      const targetEl = parsedBpmn.elements.find(e => e.incoming.includes(outId) || e.id === outId);
      return targetEl ? (targetEl.name || targetEl.id) : outId;
    });

    let description = el.documentation || '';
    if (!description) {
      if (el.type.includes('StartEvent')) {
        description = isIt ? 'Evento di avvio che innesca l\'esecuzione del processo.' : 'Start event initiating process execution.';
      } else if (el.type.includes('EndEvent')) {
        description = isIt ? 'Evento finale che conclude con successo il flusso del processo.' : 'End event marking successful completion of the workflow.';
      } else if (el.type.includes('UserTask')) {
        description = isIt ? `Attività manuale eseguita da "${actorRole}" per la gestione di ${el.name || 'operazione'}.` : `Manual task executed by "${actorRole}" for managing ${el.name || 'operation'}.`;
      } else if (el.type.includes('ServiceTask')) {
        description = isIt ? `Integrazione automatica di sistema (${el.camundaTopic || 'API'}) per l'elaborazione dei dati.` : `Automated system integration (${el.camundaTopic || 'API'}) processing required data.`;
      } else if (el.type.includes('ExclusiveGateway')) {
        description = isIt ? 'Gateway di deviazione esclusiva (XOR) in base alle condizioni verificate.' : 'Exclusive decision gateway (XOR) branching on logic conditions.';
      } else if (el.type.includes('ParallelGateway')) {
        description = isIt ? 'Gateway parallelo (AND) per sincronizzazione o split di attività simultanee.' : 'Parallel gateway (AND) splitting or joining simultaneous threads.';
      } else {
        description = isIt ? `Fase operativa del processo (${getFriendlyTypeName(el.type)}).` : `Operational step (${getFriendlyTypeName(el.type)}).`;
      }
    }

    processSteps.push({
      stepNumber: stepCounter++,
      elementId: el.id,
      name: el.name || `${getFriendlyTypeName(el.type)} (${el.id})`,
      type: el.type,
      actorRole,
      description,
      inputs: inputs.length > 0 ? inputs : [isIt ? 'Trigger Precedente' : 'Preceding Trigger'],
      outputs: outputs.length > 0 ? outputs : [isIt ? 'Flusso Successivo' : 'Subsequent Flow'],
      decisionRules: el.conditionExpression ? `${isIt ? 'Condizione' : 'Condition'}: ${el.conditionExpression}` : undefined,
    });
  });

  // 3. Matrice RACI
  const raciMatrix: RaciItem[] = sortedElements
    .filter(el => el.type.includes('Task') || el.type.includes('Event'))
    .map(el => {
      const taskName = el.name || `${getFriendlyTypeName(el.type)} (${el.id})`;
      const responsible = el.laneName || el.poolName || el.camundaCandidateGroups || (
        el.type.includes('Service') ? (isIt ? 'Sistema IT' : 'IT System') : (isIt ? 'Operatore Responsabile' : 'Responsible Operator')
      );

      const accountable = parsedBpmn.pools[0]?.name || (isIt ? 'Process Owner / Responsabile di Processo' : 'Process Owner');
      const consulted = el.camundaCandidateGroups ? `${el.camundaCandidateGroups} (SME)` : (isIt ? 'Supervisore / Sistema Inserimento' : 'Supervisor / Data Provider');
      const informed = isIt ? 'Stakeholder / Log di Processo' : 'Stakeholders / Process Logs';

      return {
        taskName,
        elementId: el.id,
        responsible,
        accountable,
        consulted,
        informed,
      };
    });

  // 4. Ruoli & Partecipanti
  const rolesAndParticipants: Array<{
    name: string;
    type: 'Pool' | 'Lane' | 'Actor';
    description: string;
    assignedTasksCount: number;
  }> = [];

  if (parsedBpmn.lanes.length > 0) {
    parsedBpmn.lanes.forEach(lane => {
      const assignedCount = parsedBpmn.elements.filter(el => el.laneId === lane.id || el.laneName === lane.name).length;
      rolesAndParticipants.push({
        name: lane.name,
        type: 'Lane',
        description: isIt 
          ? `Ruolo organizzativo specifico responsabile dell'esecuzione di ${assignedCount} attività nel processo.`
          : `Specific organizational role responsible for executing ${assignedCount} tasks in the process.`,
        assignedTasksCount: assignedCount,
      });
    });
  } else if (parsedBpmn.pools.length > 0) {
    parsedBpmn.pools.forEach(pool => {
      const assignedCount = parsedBpmn.elements.filter(el => el.poolId === pool.id || el.poolName === pool.name).length;
      rolesAndParticipants.push({
        name: pool.name,
        type: 'Pool',
        description: isIt ? `Entità / Partecipante aziendale principale del processo.` : `Primary business participant entity of the process.`,
        assignedTasksCount: assignedCount,
      });
    });
  } else {
    rolesAndParticipants.push({
      name: isIt ? 'Operatore Generale' : 'General Operator',
      type: 'Actor',
      description: isIt ? 'Utente responsabile per le attività manuali del processo.' : 'User assigned to process manual tasks.',
      assignedTasksCount: parsedBpmn.elements.filter(el => el.type.includes('UserTask')).length,
    });
  }

  // Add Automated System role if service tasks exist
  const serviceTasksCount = parsedBpmn.elements.filter(el => el.type.includes('ServiceTask') || el.type.includes('ScriptTask')).length;
  if (serviceTasksCount > 0) {
    rolesAndParticipants.push({
      name: isIt ? 'Sistema Automatico / API' : 'Automated System / API',
      type: 'Actor',
      description: isIt ? 'Motore di esecuzione o servizio backend automatico.' : 'Automated backend execution service.',
      assignedTasksCount: serviceTasksCount,
    });
  }

  // 5. Gateway & Regole Decisionali
  const gateways: GatewayDoc[] = parsedBpmn.elements
    .filter(el => el.type.includes('Gateway'))
    .map(gw => {
      const outgoingFlows = gw.outgoing;
      const branches = outgoingFlows.map(flowId => {
        const targetEl = parsedBpmn.elements.find(e => e.incoming.includes(flowId) || e.id === flowId);
        const condition = targetEl?.conditionExpression || (isIt ? 'Ramo predefinito / Condizione di flusso' : 'Default path / Flow condition');
        return {
          condition,
          target: targetEl ? `${targetEl.name || targetEl.id} (${getFriendlyTypeName(targetEl.type)})` : flowId,
        };
      });

      return {
        id: gw.id,
        name: gw.name || `${getFriendlyTypeName(gw.type)} (${gw.id})`,
        type: gw.type,
        branches,
      };
    });

  // 6. Rischi e Ottimizzazioni
  const risksAndExceptions: RiskExceptionDoc[] = [];
  const optimizationSuggestions: string[] = [];

  // Algorithmic risk rules
  const manualTasks = parsedBpmn.elements.filter(el => el.type.includes('UserTask') || el.type.includes('ManualTask'));
  if (manualTasks.length > 0) {
    const sampleTask = manualTasks[0];
    risksAndExceptions.push({
      risk: isIt ? `Rischio di collo di bottiglia umano su task manuali (${manualTasks.length} attività manuali).` : `Risk of human bottleneck on manual tasks (${manualTasks.length} manual activities).`,
      location: sampleTask.name || sampleTask.id,
      mitigation: isIt ? 'Definire SLA precisi e notifiche di sollecito per l\'operatore.' : 'Establish strict SLAs and automated notification reminders.',
    });
    optimizationSuggestions.push(
      isIt 
        ? `Automatizzare il task manuale "${sampleTask.name || sampleTask.id}" integrando un Service Task via API per ridurre i tempi di attraversamento.`
        : `Automate manual task "${sampleTask.name || sampleTask.id}" via background API integrations to minimize lead time.`
    );
  }

  const unassignedTasks = parsedBpmn.elements.filter(el => el.type.includes('Task') && !el.laneName && !el.camundaCandidateGroups);
  if (unassignedTasks.length > 0) {
    risksAndExceptions.push({
      risk: isIt ? 'Attività senza corsia (Lane) o gruppo candidato esplicito.' : 'Tasks without explicit assigned Lane or candidate group.',
      location: unassignedTasks[0].name || unassignedTasks[0].id,
      mitigation: isIt ? 'Assegnare in modo univoco una Lane o una camunda:candidateGroups in fase di modellazione.' : 'Explicitly bind a Lane or candidateGroup during modeling.',
    });
  }

  const complexGateways = parsedBpmn.elements.filter(el => el.type.includes('ExclusiveGateway') && el.outgoing.length > 2);
  if (complexGateways.length > 0) {
    const gw = complexGateways[0];
    risksAndExceptions.push({
      risk: isIt ? `Elevata complessità decisionale sul Gateway "${gw.name || gw.id}".` : `High decision complexity on Gateway "${gw.name || gw.id}".`,
      location: gw.name || gw.id,
      mitigation: isIt ? 'Esternalizzare la logica decisionale su una tabella di decisione DMN (Decision Model and Notation).' : 'Externalize logic into a DMN (Decision Model & Notation) rule table.',
    });
  }

  // Ensure default risk/optimizations if empty
  if (risksAndExceptions.length === 0) {
    risksAndExceptions.push({
      risk: isIt ? 'Possibile ritardo nelle risposte dai sistemi esterni.' : 'Potential latency in external system integrations.',
      location: 'Service Tasks / Integration Nodes',
      mitigation: isIt ? 'Implementare meccanismi di retry automatico e timeout di sicurezza.' : 'Implement automatic retries and fallback timeout handlers.',
    });
  }

  if (optimizationSuggestions.length === 0) {
    optimizationSuggestions.push(
      isIt ? 'Monitorare la durata media di ciascun task mediante dashboard KPI di processo.' : 'Monitor average task cycle times using process KPI dashboards.',
      isIt ? 'Standardizzare le condizioni sui gateway decisionali rendendole esplicite in formato DMN.' : 'Standardize gateway branching rules into explicit DMN decision matrices.'
    );
  }

  // 7. Casi di Test Funzionali
  const testScenarios: TestScenarioDoc[] = [];
  
  // Test Scenario 1: Happy Path
  const happySteps = processSteps.map(s => `${s.stepNumber}. ${s.name} (${s.actorRole})`);
  testScenarios.push({
    id: 'TC-01',
    title: isIt ? 'Flusso Principale Lineare (Happy Path)' : 'Main Happy Path Execution',
    preconditions: isIt ? 'Dati di input validi, utente autenticato e ruoli operativi attivi.' : 'Valid input payload, authenticated user, active roles.',
    pathSteps: happySteps.slice(0, 6),
    expectedResult: isIt ? 'Completamento con successo del processo e generazione dell\'evento finale.' : 'Process finishes successfully, reaching the end event.',
  });

  // Test Scenario 2: Alternative Branch / Gateway Path
  if (gateways.length > 0) {
    const firstGw = gateways[0];
    testScenarios.push({
      id: 'TC-02',
      title: isIt ? `Verifica Diramazione Gateway: ${firstGw.name}` : `Gateway Decision Branch: ${firstGw.name}`,
      preconditions: isIt ? `Impostazione condizione per ramo alternativo su ${firstGw.id}.` : `Alternative branch trigger condition evaluated at ${firstGw.id}.`,
      pathSteps: [
        isIt ? `Avvio processo e raggiungimento gateway ${firstGw.id}` : `Start process and reach gateway ${firstGw.id}`,
        isIt ? `Attivazione condizione: ${firstGw.branches[0]?.condition || 'Condizione B'}` : `Evaluate condition: ${firstGw.branches[0]?.condition || 'Condition B'}`,
        isIt ? `Instradamento su ramo alternativo ${firstGw.branches[0]?.target || 'Nodo Target'}` : `Route to alternative branch target ${firstGw.branches[0]?.target || 'Target Node'}`
      ],
      expectedResult: isIt ? 'Instradamento corretto verso il ramo di eccezione/alternativo previsto.' : 'Correct routing to expected alternative or exception path.',
    });
  }

  // Test Scenario 3: Exception / Error Handling
  testScenarios.push({
    id: 'TC-03',
    title: isIt ? 'Gestione Errore o Timeout di Sistema' : 'System Error / Timeout Fallback',
    preconditions: isIt ? 'Simulazione di un errore di rete o di mancata approvazione entro lo SLA.' : 'Simulate network failure or missing approval within SLA window.',
    pathSteps: [
      isIt ? 'Esecuzione attività fino al punto d\'integrazione o approvazione' : 'Run tasks up to integration point or approval step',
      isIt ? 'Simulazione errore o scadenza timer' : 'Trigger simulated error or timer expiration',
      isIt ? 'Verifica attivazione via di fuga o notifica di errore' : 'Verify fallback route or error alert notification'
    ],
    expectedResult: isIt ? 'Stato del processo gestito in sicurezza senza perdita di tracciabilità.' : 'Process state handled gracefully without data loss.',
  });

  // 8. Guida Utente Operativa
  const userManualGuide = isIt
    ? `# Guida Utente Operativa: ${parsedBpmn.processName}
**ID Processo:** \`${parsedBpmn.processId}\`

---

### 1. Introduzione & Scopo
La presente guida illustra le modalità operative per la corretta esecuzione del processo **"${parsedBpmn.processName}"**.
Il processo coinvolge **${totalLanes} ruoli aziendali** e si articola in **${totalTasks} passaggi**.

---

### 2. Tabella di Marcia per Ruolo Operativo

${rolesAndParticipants.map(r => `#### 👤 Ruolo: ${r.name} (${r.type})
- **Task Assegnati (${r.assignedTasksCount}):**
${processSteps.filter(s => s.actorRole === r.name).map(s => `  - **Fase ${s.stepNumber} [${s.name}]:** ${s.description}`).join('\n') || '  - Partecipa alla supervisione e coordinamento del flusso.'}
`).join('\n')}

---

### 3. Istruzioni Passo-Passo per l'Esecuzione

${processSteps.map(s => `#### Passaggio ${s.stepNumber}: ${s.name}
- **ID Elemento:** \`${s.elementId}\`
- **Tipo Operazione:** ${getFriendlyTypeName(s.type)}
- **Attore Incaricato:** **${s.actorRole}**
- **Cosa fare:** ${s.description}
${s.decisionRules ? `- **Regola da verificare:** ${s.decisionRules}` : ''}
`).join('\n')}

---

### 4. Risoluzione dei Problemi ed Eccezioni

- **Blocco dell'Attività:** Se una fase rimane in attesa per oltre 24 ore, contattare il **Process Owner** (${raciMatrix.find(r => r.accountable)?.accountable || rolesAndParticipants[0]?.name || 'Responsabile di Processo'}).
- **Errore di Integrazione IT:** In caso di errore su Service Task, verificare i log di sistema e riavviare l'istanza dal punto di fallimento.
- **Eccezione sulle Condizioni:** Assicurarsi che i dati inseriti nei form soddisfino le condizioni dei Gateway decisionali.
`
    : `# Operational User Manual: ${parsedBpmn.processName}
**Process ID:** \`${parsedBpmn.processId}\`

---

### 1. Overview & Purpose
This operational manual provides step-by-step instructions for executing the process **"${parsedBpmn.processName}"**.
It involves **${totalLanes} organizational roles** and **${totalTasks} sequential steps**.

---

### 2. Operational Guide by Role

${rolesAndParticipants.map(r => `#### 👤 Role: ${r.name} (${r.type})
- **Assigned Tasks (${r.assignedTasksCount}):**
${processSteps.filter(s => s.actorRole === r.name).map(s => `  - **Step ${s.stepNumber} [${s.name}]:** ${s.description}`).join('\n') || '  - Coordinates overall process flow.'}
`).join('\n')}

---

### 3. Step-by-Step Execution Instructions

${processSteps.map(s => `#### Step ${s.stepNumber}: ${s.name}
- **Element ID:** \`${s.elementId}\`
- **Operation Type:** ${getFriendlyTypeName(s.type)}
- **Assigned Actor:** **${s.actorRole}**
- **Action Required:** ${s.description}
${s.decisionRules ? `- **Rule to verify:** ${s.decisionRules}` : ''}
`).join('\n')}

---

### 4. Troubleshooting & Exception Handling

- **Task Stagnation:** If a task remains pending beyond SLA limit, notify **Process Owner** (${raciMatrix.find(r => r.accountable)?.accountable || rolesAndParticipants[0]?.name || 'Process Owner'}).
- **System Integration Error:** Check backend logs for API failure and re-trigger execution.
`;

  return {
    processName: parsedBpmn.processName,
    processId: parsedBpmn.processId,
    version: '1.0',
    executiveSummary,
    targetAudience,
    businessObjectives,
    rolesAndParticipants,
    processSteps,
    gateways,
    raciMatrix,
    functionalRequirements: businessObjectives,
    risksAndExceptions,
    optimizationSuggestions,
    testScenarios,
    userManualGuide,
    cyclomaticComplexity: calculateCyclomaticComplexity(parsedBpmn, language),
    generatedAt: new Date().toISOString(),
    language,
  };
}
