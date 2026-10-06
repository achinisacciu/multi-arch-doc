import { LoadedBpmnFile, IntegratedFolderDoc, CrossProcessLink, SharedRoleInfo, RaciItem, LanguageOption } from '../types';

/**
 * Genera la documentazione incrociata e integrata per un portafoglio / cartella di file BPMN.
 * Analizza le interconnessioni, Call Activity, ruoli condivisi, matrice RACI globale,
 * catena del valore End-to-End e rischi di integrazione tra i vari processi.
 */
export function generateIntegratedFolderDoc(
  files: LoadedBpmnFile[],
  folderName: string = 'Cartella Processi Aziendali',
  language: LanguageOption = 'it'
): IntegratedFolderDoc {
  const generatedAt = new Date().toISOString();

  // 1. Process Summaries & Complexity Calculation
  const processSummaries = files.map((f) => {
    const callActivitiesCount = f.parsed.elements.filter(
      (el) => el.type.toLowerCase().includes('callactivity') || el.type === 'bpmn:CallActivity'
    ).length;

    const cyclomaticScore = f.documentation.cyclomaticComplexity.score;
    const cyclomaticRating = f.documentation.cyclomaticComplexity.ratingLabel;

    return {
      fileName: f.fileName,
      processId: f.parsed.processId,
      processName: f.parsed.processName,
      tasksCount: f.parsed.stats.tasksCount,
      gatewaysCount: f.parsed.stats.gatewaysCount,
      eventsCount: f.parsed.stats.eventsCount,
      lanesCount: f.parsed.stats.lanesCount,
      callActivitiesCount,
      cyclomaticScore,
      cyclomaticRating,
      description: f.parsed.documentation || f.documentation.executiveSummary,
    };
  });

  // Calculate Average Complexity & Ranking
  const totalComplexitySum = files.reduce((sum, f) => sum + f.documentation.cyclomaticComplexity.score, 0);
  const averageComplexity = files.length > 0 ? Math.round((totalComplexitySum / files.length) * 10) / 10 : 0;

  const processComplexityRanking = files.map((f) => ({
    processName: f.parsed.processName,
    processId: f.parsed.processId,
    fileName: f.fileName,
    score: f.documentation.cyclomaticComplexity.score,
    rating: f.documentation.cyclomaticComplexity.rating,
    ratingLabel: f.documentation.cyclomaticComplexity.ratingLabel,
  })).sort((a, b) => b.score - a.score);

  // 2. Cross-Process Links (Call Activities & Inter-process Messages)
  const crossLinks: CrossProcessLink[] = [];

  files.forEach((file) => {
    const srcProcessName = file.parsed.processName;
    const srcProcessId = file.parsed.processId;

    file.parsed.elements.forEach((el) => {
      const isCallActivity = el.type.toLowerCase().includes('callactivity') || el.rawType.toLowerCase().includes('callactivity');
      const isExternalTask = el.name.toLowerCase().includes('processo') || el.name.toLowerCase().includes('approvazione') || el.name.toLowerCase().includes('invocazione');

      if (isCallActivity || (el.type.includes('Task') && isExternalTask)) {
        // Try to find matching target process in folder
        const target = files.find(
          (other) =>
            other.parsed.processId !== srcProcessId &&
            (other.parsed.processName.toLowerCase().includes(el.name.toLowerCase()) ||
              el.name.toLowerCase().includes(other.parsed.processName.toLowerCase()) ||
              other.parsed.processId.toLowerCase().includes(el.id.toLowerCase()))
        );

        crossLinks.push({
          sourceProcessId: srcProcessId,
          sourceProcessName: srcProcessName,
          sourceFileName: file.fileName,
          sourceElementId: el.id,
          sourceElementName: el.name,
          targetProcessId: target?.parsed.processId,
          targetProcessName: target?.parsed.processName,
          targetFileName: target?.fileName,
          linkType: isCallActivity ? 'CallActivity' : 'SequentialFlow',
          description: target
            ? `Il processo "${srcProcessName}" invoca direttamente il sottoprocesso "${target.parsed.processName}" tramite l'elemento "${el.name}".`
            : `Attività di chiamata o integrazione verso un modulo o processo esterno ("${el.name}").`,
        });
      }
    });
  });

  // 3. Shared Roles & Responsibilities across Folder
  const roleMap = new Map<string, { processes: Set<string>; taskCount: number }>();

  files.forEach((file) => {
    file.documentation.rolesAndParticipants.forEach((role) => {
      const normalizedName = role.name.trim();
      if (!normalizedName) return;

      if (!roleMap.has(normalizedName)) {
        roleMap.set(normalizedName, { processes: new Set(), taskCount: 0 });
      }

      const entry = roleMap.get(normalizedName)!;
      entry.processes.add(file.parsed.processName);
      entry.taskCount += role.assignedTasksCount;
    });
  });

  const sharedRoles: SharedRoleInfo[] = Array.from(roleMap.entries()).map(([roleName, data]) => ({
    roleName,
    participatingProcesses: Array.from(data.processes),
    totalTasksAcrossFolder: data.taskCount,
  }));

  // Sort shared roles by number of processes involved
  sharedRoles.sort((a, b) => b.participatingProcesses.length - a.participatingProcesses.length);

  // 4. Consolidated RACI Matrix across all files
  const consolidatedRaci: RaciItem[] = [];
  files.forEach((file) => {
    file.documentation.raciMatrix.forEach((raci) => {
      consolidatedRaci.push({
        ...raci,
        taskName: `[${file.parsed.processName}] ${raci.taskName}`,
      });
    });
  });

  // 5. End-to-End Enterprise Value Stream
  const endToEndValueStream = files.map((file, idx) => {
    const mainInputs = file.documentation.processSteps[0]?.inputs || ['Avvio evento di processo'];
    const lastStep = file.documentation.processSteps[file.documentation.processSteps.length - 1];
    const mainOutputs = lastStep?.outputs || ['Completamento stato processo'];

    const nextFile = files[idx + 1];

    return {
      stepNumber: idx + 1,
      processId: file.parsed.processId,
      processName: file.parsed.processName,
      phaseName: `Fase Enterprise ${idx + 1}: ${file.parsed.processName}`,
      keyInputs: mainInputs,
      keyOutputs: mainOutputs,
      handoverTo: nextFile ? nextFile.parsed.processName : undefined,
    };
  });

  // 6. Cross-Process Integration Risks
  const crossProcessRisks = [
    {
      risk: 'Disallineamento dei tempi di hand-off tra processi correlati',
      involvedProcesses: files.map((f) => f.parsed.processName),
      impact: 'Possibile accumulo di richieste in attesa o colli di bottiglia tra i passaggi di consegna delle varie unità aziendali.',
      mitigation: 'Implementare Service Level Agreements (SLA) definiti sui punti di integrazione ed abilitare notifiche automatiche di escalation.',
    },
    {
      risk: 'Duplicazione di ruoli o ruoli definiti in modo difforme nei vari file BPMN',
      involvedProcesses: sharedRoles.filter((r) => r.participatingProcesses.length > 1).map((r) => r.roleName),
      impact: 'Rischio di ambiguita operativa se lo stesso ruolo aziendale ha responsabilità sovrapposte o non uniformi tra i diversi processi.',
      mitigation: 'Centralizzare la matrice RACI globale e formalizzare le mansionari per ciascun ruolo aziendale nei vari moduli.',
    },
    {
      risk: 'Mancanza di gestione delle eccezioni sulle Call Activity / Invocazioni Esterne',
      involvedProcesses: crossLinks.map((l) => l.sourceProcessName),
      impact: 'Se un processo figlio fallisce o va in timeout, il processo padre potrebbe rimanere bloccato in stato di attesa indefinita.',
      mitigation: 'Aggiungere Boundary Timer Event e Boundary Error Event su tutte le Call Activity e sulle chiamate a servizi esterni.',
    },
  ];

  // 7. Integrated Executive Summary
  const totalTasks = files.reduce((acc, f) => acc + f.parsed.stats.tasksCount, 0);
  const totalGateways = files.reduce((acc, f) => acc + f.parsed.stats.gatewaysCount, 0);
  const totalLanes = files.reduce((acc, f) => acc + f.parsed.stats.lanesCount, 0);

  const executiveSummary = `Analisi integrata e documentazione incrociata del portafoglio processi della cartella "${folderName}". Il portafoglio si compone di ${files.length} processi BPMN 2.0 interconnessi (${files.map((f) => f.parsed.processName).join(', ')}), per un totale complessivo di ${totalTasks} attività (Task), ${totalGateways} punti decisionali (Gateway), ${totalLanes} ruoli/corsie operativi e ${crossLinks.length} collegamenti o invocazioni tra processi. La documentazione incrociata assicura la tracciabilità delle responsabilità end-to-end e l'allineamento tra i diversi reparti aziendali.`;

  // 8. Integrated Operational Guide
  const integratedOperationalGuide = `### Guida Operativa di Portafoglio Processi (${folderName})

#### 1. Architettura Generale dei Processi
La cartella contiene ${files.length} moduli di processo BPMN 2.0 che descrivono il flusso operativo aziendale. 
Ciascun processo gestisce una specifica fase del ciclo di vita operativo:
${files.map((f, i) => `${i + 1}. **${f.parsed.processName}** (File: \`${f.fileName}\`): comprende ${f.parsed.stats.tasksCount} task e ${f.parsed.stats.lanesCount} ruoli operativi.`).join('\n')}

#### 2. Punti di Contatto e Interazioni tra Processi
${crossLinks.length > 0
  ? crossLinks.map((l, i) => `${i + 1}. **Invocazione/Flusso:** "${l.sourceProcessName}" &rarr; "${l.targetProcessName || 'Processo Esterno'}" (Elemento: \`${l.sourceElementName}\`).`).join('\n')
  : 'Tutti i processi operano in modalità modulare integrata con condivisione dei ruoli aziendali primari e passaggio di consegne sequenziale.'
}

#### 3. Raccomandazioni per i Responsible e gli Operational Lead
- Consultare la **Matrice RACI Consolidata** per verificare le responsabilità dirette sui singoli task.
- Assicurarsi che per ogni punto di passaggio di consegne (handover) tra un processo e l'altro vengano rispettati gli standard di verifica input/output.
- Per qualsiasi anomalia o blocco su un sotto-processo, fare riferimento ai casi di test integrati ed alla guida al troubleshooting del singolo modulo.`;

  return {
    folderName,
    totalFiles: files.length,
    generatedAt,
    language,
    executiveSummary,
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
