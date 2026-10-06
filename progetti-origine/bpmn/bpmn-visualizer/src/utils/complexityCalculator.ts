import { ParsedBpmn, CyclomaticComplexityInfo } from '../types';

export function calculateCyclomaticComplexity(parsed: ParsedBpmn, language: string = 'it'): CyclomaticComplexityInfo {
  const gatewayTypes = ['exclusiveGateway', 'inclusiveGateway', 'parallelGateway', 'eventBasedGateway', 'complexGateway'];
  const gatewayDecisionPoints = parsed.elements.filter(e => gatewayTypes.includes(e.rawType)).length;

  const flows = parsed.elements.filter(e => e.rawType === 'sequenceFlow');
  const flowNodeElements = parsed.elements.filter(e => e.rawType !== 'sequenceFlow');
  const elements = parsed.elements.filter(e => !['sequenceFlow', 'dataObject', 'dataStore', 'textAnnotation'].includes(e.rawType));

  const edgesCount = flows.length;
  const nodesCount = elements.length;
  const connectedComponents = Math.max(1, parsed.pools.length || 1);

  const vg = edgesCount - nodesCount + 2 * connectedComponents;
  const score = Math.max(1, vg);

  const maxBranching: { count: number; id: string; name: string } = { count: 0, id: '', name: '' };
  const gatewayElements = parsed.elements.filter(e => gatewayTypes.includes(e.rawType));
  for (const gw of gatewayElements) {
    const outgoingCount = gw.outgoing.length;
    if (outgoingCount > maxBranching.count) {
      maxBranching.count = outgoingCount;
      maxBranching.id = gw.id;
      maxBranching.name = gw.name || gw.id;
    }
  }

  const densityRatio = nodesCount > 0 ? Math.round((gatewayDecisionPoints / nodesCount) * 100) : 0;

  const rating = score <= 5 ? 'low' : score <= 10 ? 'moderate' : score <= 20 ? 'high' : 'very_high';
  const ratingLabels: Record<string, string> = { low: 'Bassa', moderate: 'Moderata', high: 'Alta', very_high: 'Molto Alta' };
  const ratingColors: Record<string, string> = { low: '#22c55e', moderate: '#eab308', high: '#f97316', very_high: '#ef4444' };
  const ratingLabel = language === 'it' ? ratingLabels[rating] : rating;
  const ratingColor = ratingColors[rating];

  const contributions: Array<{ category: string; count: number; contribution: number; description: string }> = [
    { category: 'Gateway di decisione', count: gatewayDecisionPoints, contribution: gatewayDecisionPoints, description: 'Punti di diramazione nel flusso' },
    { category: 'Flussi di sequenza', count: edgesCount, contribution: edgesCount, description: 'Connessioni tra elementi' },
    { category: 'Nodi del grafo', count: nodesCount, contribution: -nodesCount, description: 'Elementi di processo' },
    { category: 'Componenti connesse', count: connectedComponents, contribution: 2 * connectedComponents, description: 'Pool/processi indipendenti' },
  ];

  const explanation = `La complessità ciclomatica di McCabe è calcolata come v(G) = E - N + 2P, dove E = ${edgesCount} (archi/flussi), N = ${nodesCount} (nodi/elementi), P = ${connectedComponents} (componenti connesse). Risultato: v(G) = ${edgesCount} - ${nodesCount} + 2*${connectedComponents} = ${score}.`;

  const recommendations: string[] = [];
  if (score <= 5) recommendations.push('Il processo ha una complessità bassa, facile da mantenere e testare.');
  if (score > 5 && score <= 10) recommendations.push('Complessità moderata. Si consiglia di documentare bene i percorsi alternativi.');
  if (score > 10 && score <= 20) recommendations.push('Complessità alta. Valutare la suddivisione in sotto-processi per migliorare la manutenibilità.');
  if (score > 20) recommendations.push('Complessità molto alta. Si raccomanda una revisione strutturale e la scomposizione in più sotto-processi.');
  if (gatewayDecisionPoints > 5) recommendations.push(`Sono presenti ${gatewayDecisionPoints} gateway di decisione. Valutare se alcuni possono essere consolidati.`);
  if (maxBranching.count > 3) recommendations.push(`Il gateway "${maxBranching.name}" ha ${maxBranching.count} flussi uscenti. Considerare l'introduzione di un gateway intermediario.`);

  return {
    score, rating, ratingLabel, ratingColor,
    edgesCount, nodesCount, connectedComponents,
    gatewayDecisionPoints, gatewayDensityRatio: densityRatio,
    maxBranchingFactor: maxBranching.count,
    maxBranchingElement: maxBranching.count > 0 ? { id: maxBranching.id, name: maxBranching.name, branchesCount: maxBranching.count } : undefined,
    explanation, recommendations, breakdown: contributions,
  };
}
