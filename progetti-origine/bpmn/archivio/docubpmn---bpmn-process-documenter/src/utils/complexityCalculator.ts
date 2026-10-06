import { ParsedBpmn, CyclomaticComplexityInfo, LanguageOption } from '../types';

/**
 * Calcola l'Indice di Complessità Ciclomatica (McCabe Cyclomatic Complexity v(G))
 * per un diagramma di processo BPMN 2.0.
 *
 * Formula di McCabe per grafi orientati di flusso:
 * v(G) = E - N + 2P
 *
 * Dove:
 * - E = Numero di Archi / Sequence Flows (Connessioni di flusso)
 * - N = Numero di Nodi / Elementi del Processo (Task, Gateway, Eventi)
 * - P = Numero di Componenti Connesse (Pool / Processi disgiunti, di norma P = 1)
 */
export function calculateCyclomaticComplexity(
  parsedBpmn: ParsedBpmn,
  language: LanguageOption = 'it'
): CyclomaticComplexityInfo {
  const isIt = language === 'it';
  const elements = parsedBpmn.elements || [];
  const nodesCount = elements.length;

  // Conta gli archi / Sequence Flows totali
  let edgesCount = elements.reduce((sum, el) => sum + (el.outgoing ? el.outgoing.length : 0), 0);

  // Fallback difensivo se il parser non ha catturato tutte le connessioni esplicite
  if (edgesCount === 0 && nodesCount > 0) {
    const tasks = parsedBpmn.stats.tasksCount || 0;
    const gateways = parsedBpmn.stats.gatewaysCount || 0;
    const events = parsedBpmn.stats.eventsCount || 0;
    edgesCount = Math.max(nodesCount - 1, tasks + gateways * 2 + events - 1);
  }

  const connectedComponents = Math.max(1, parsedBpmn.pools.length || 1);

  // Calcolo della formula di McCabe: v(G) = E - N + 2P
  const rawScore = edgesCount - nodesCount + 2 * connectedComponents;
  const score = Math.max(1, rawScore);

  // Calcolo punti decisionali dei Gateway (XOR, OR, Event-Based, Complex)
  let gatewayDecisionPoints = 0;
  let maxBranchingFactor = 1;
  let maxBranchingElement: { id: string; name: string; branchesCount: number } | undefined = undefined;

  elements.forEach((el) => {
    if (el.type.includes('Gateway')) {
      const branches = el.outgoing ? el.outgoing.length : 0;
      if (branches > 1) {
        // Ogni ramo oltre il primo aggiunge un percorso decisionale alternativo
        gatewayDecisionPoints += branches - 1;
      }

      if (branches > maxBranchingFactor) {
        maxBranchingFactor = branches;
        maxBranchingElement = {
          id: el.id,
          name: el.name || `${el.type} (${el.id})`,
          branchesCount: branches,
        };
      }
    }
  });

  const gatewayCount = parsedBpmn.stats.gatewaysCount || 0;
  const gatewayDensityRatio = nodesCount > 0 ? Math.round((gatewayCount / nodesCount) * 100) : 0;

  // Classificazione del livello di complessità
  let rating: 'low' | 'moderate' | 'high' | 'very_high' = 'low';
  let ratingLabel = isIt ? 'Bassa (Processo Semplice & Lineare)' : 'Low (Linear & Simple Process)';
  let ratingColor = 'emerald';
  let explanation = '';

  if (score <= 10) {
    rating = 'low';
    ratingLabel = isIt ? 'Bassa (Processo Ottimale & Mantenibile)' : 'Low (Optimal & Maintainable Process)';
    ratingColor = 'emerald';
    explanation = isIt
      ? `Il processo presenta un punteggio ciclomatico v(G) = ${score}. Il flusso è lineare, ben strutturato e con pochi punti di deviazione decisionale. Rischio di errore umano o mancata manutenzione molto basso.`
      : `The process has a cyclomatic complexity v(G) = ${score}. The flow is linear, well-structured, and has minimal decision branching. Very low risk of human error or maintenance bottlenecks.`;
  } else if (score <= 20) {
    rating = 'moderate';
    ratingLabel = isIt ? 'Moderata (Flusso Standard Controllato)' : 'Moderate (Standard Business Flow)';
    ratingColor = 'amber';
    explanation = isIt
      ? `Il processo presenta un punteggio ciclomatico v(G) = ${score}. Contiene un livello di branching decisionale standard (${gatewayDecisionPoints} punti decisionali) adeguato alla complessità di business.`
      : `The process has a cyclomatic complexity v(G) = ${score}. It contains a standard decision branching level (${gatewayDecisionPoints} decision points) appropriate for standard operations.`;
  } else if (score <= 50) {
    rating = 'high';
    ratingLabel = isIt ? 'Elevata (Complessità Decisionale Alta)' : 'High (Complex Decision Logic)';
    ratingColor = 'orange';
    explanation = isIt
      ? `Il processo presenta un punteggio ciclomatico v(G) = ${score}. L'elevato numero di diramazioni e gateway (${gatewayCount} gateway) rende il flusso complesso da testare e monitorare.`
      : `The process has a cyclomatic complexity v(G) = ${score}. The high number of branching nodes (${gatewayCount} gateways) makes the flow complex to validate and maintain.`;
  } else {
    rating = 'very_high';
    ratingLabel = isIt ? 'Critica (Processo Iper-Complesso)' : 'Critical (Overly Complex Process)';
    ratingColor = 'rose';
    explanation = isIt
      ? `ATTENZIONE: Il processo ha un punteggio v(G) = ${score}. Supera la soglia critica di 50. Presenta un'elevata probabilità di bug operativi, condizioni non gestite e colli di bottiglia.`
      : `WARNING: The process has a cyclomatic complexity v(G) = ${score}, exceeding the critical threshold of 50. High probability of operational bottlenecks and unhandled edge cases.`;
  }

  // Raccomandazioni per ridurre la complessità
  const recommendations: string[] = [];

  if (score > 20) {
    recommendations.push(
      isIt
        ? `Scomporre il processo in sotto-processi riutilizzabili tramite Call Activity o Sub-Process BPMN per ridurre il carico sul diagramma principale.`
        : `Decompose the process into reusable sub-processes via Call Activities or BPMN Sub-Processes to streamline the primary diagram.`
    );
  }

  if (maxBranchingFactor >= 3 && maxBranchingElement) {
    recommendations.push(
      isIt
        ? `Esternalizzare la logica del gateway multipath "${maxBranchingElement.name}" (${maxBranchingElement.branchesCount} rami) utilizzando una tabella di decisione DMN (Decision Model & Notation).`
        : `Externalize decision logic from multi-branch gateway "${maxBranchingElement.name}" (${maxBranchingElement.branchesCount} branches) into a DMN (Decision Model & Notation) rule table.`
    );
  }

  if (gatewayDensityRatio > 25) {
    recommendations.push(
      isIt
        ? `Semplificare la densità dei gateway (${gatewayDensityRatio}% di tutti i nodi): accorpare gateway esclusivi sequenziali ridondanti.`
        : `Simplify gateway density (${gatewayDensityRatio}% of nodes): consolidate redundant sequential exclusive gateways.`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      isIt
        ? `Il livello di complessità è ottimale. Mantenere l'approccio modulare e monitorare i KPI di esecuzione.`
        : `Complexity level is optimal. Retain current modular structure and monitor execution KPIs.`
    );
  }

  // Breakdown contributivo
  const tasksCount = parsedBpmn.stats.tasksCount || 0;
  const eventsCount = parsedBpmn.stats.eventsCount || 0;
  const lanesCount = parsedBpmn.stats.lanesCount || 1;

  const breakdown = [
    {
      category: isIt ? 'Archi di Flusso (Sequence Flows - E)' : 'Sequence Flows (Edges - E)',
      count: edgesCount,
      contribution: edgesCount,
      description: isIt ? 'Transizioni dirette tra elementi BPMN' : 'Direct transitions between BPMN elements',
    },
    {
      category: isIt ? 'Nodi del Processo (Elements - N)' : 'Process Elements (Nodes - N)',
      count: nodesCount,
      contribution: -nodesCount,
      description: isIt ? 'Totale Task, Gateway ed Eventi nel modello' : 'Total Tasks, Gateways, and Events in model',
    },
    {
      category: isIt ? 'Componenti Connesse (Pools - P)' : 'Connected Components (Pools - P)',
      count: connectedComponents,
      contribution: 2 * connectedComponents,
      description: isIt ? 'Pool / Processi disgiunti nel file (moltiplicatore 2P)' : 'Separate Pools/Processes (2P multiplier)',
    },
    {
      category: isIt ? 'Attività & Task Operativi' : 'Tasks & Operational Steps',
      count: tasksCount,
      contribution: tasksCount,
      description: isIt ? 'Passaggi funzionali di lavoro umano o automatico' : 'Human or automated business steps',
    },
    {
      category: isIt ? 'Gateway Decisionali (Branching)' : 'Decision Gateways (Branching)',
      count: gatewayCount,
      contribution: gatewayDecisionPoints,
      description: isIt ? `Punti di deviazione o scelta alternativa (${gatewayDecisionPoints} percorsi alternativi)` : `Decision branch split points (${gatewayDecisionPoints} alternative paths)`,
    },
    {
      category: isIt ? 'Corsie e Ruoli (Lanes)' : 'Lanes & Organizational Roles',
      count: lanesCount,
      contribution: lanesCount > 1 ? lanesCount - 1 : 0,
      description: isIt ? 'Attraversamenti di responsabilità tra ruoli' : 'Role responsibility boundary crossings',
    },
  ];

  return {
    score,
    rating,
    ratingLabel,
    ratingColor,
    edgesCount,
    nodesCount,
    connectedComponents,
    gatewayDecisionPoints,
    gatewayDensityRatio,
    maxBranchingFactor,
    maxBranchingElement,
    explanation,
    recommendations,
    breakdown,
  };
}
