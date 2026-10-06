export type LanguageOption = 'it' | 'en' | 'de' | 'fr' | 'es';

export interface BpmnElement {
  id: string;
  name: string;
  type: string; // e.g. 'bpmn:UserTask', 'bpmn:ExclusiveGateway', 'bpmn:StartEvent', etc.
  rawType: string;
  documentation?: string;
  laneId?: string;
  laneName?: string;
  poolId?: string;
  poolName?: string;
  incoming: string[];
  outgoing: string[];
  conditionExpression?: string;
  camundaCandidateGroups?: string;
  camundaAssignee?: string;
  camundaTopic?: string;
  formFields?: Array<{ id: string; label: string; type: string }>;
  timerEventDefinition?: string;
}

export interface BpmnLane {
  id: string;
  name: string;
  flowNodeRefs: string[];
}

export interface BpmnPool {
  id: string;
  name: string;
  processRef?: string;
  lanes: BpmnLane[];
}

export interface ParsedBpmn {
  fileName: string;
  fileSize: number;
  rawXml: string;
  processId: string;
  processName: string;
  documentation?: string;
  pools: BpmnPool[];
  lanes: BpmnLane[];
  elements: BpmnElement[];
  stats: {
    totalElements: number;
    tasksCount: number;
    gatewaysCount: number;
    eventsCount: number;
    poolsCount: number;
    lanesCount: number;
  };
}

export interface RaciItem {
  taskName: string;
  elementId: string;
  responsible: string;
  accountable: string;
  consulted: string;
  informed: string;
}

export interface ProcessStepDoc {
  stepNumber: number;
  elementId: string;
  name: string;
  type: string;
  actorRole: string;
  description: string;
  inputs?: string[];
  outputs?: string[];
  decisionRules?: string;
  triggerOrTimer?: string;
  notes?: string;
}

export interface GatewayDoc {
  id: string;
  name: string;
  type: string;
  branches: Array<{ condition: string; target: string }>;
}

export interface RiskExceptionDoc {
  risk: string;
  location: string;
  mitigation: string;
}

export interface TestScenarioDoc {
  id: string;
  title: string;
  preconditions: string;
  pathSteps: string[];
  expectedResult: string;
}

export interface CyclomaticComplexityInfo {
  score: number; // McCabe Score v(G) = E - N + 2P
  rating: 'low' | 'moderate' | 'high' | 'very_high';
  ratingLabel: string;
  ratingColor: string;
  edgesCount: number;
  nodesCount: number;
  connectedComponents: number;
  gatewayDecisionPoints: number;
  gatewayDensityRatio: number; // percentage of elements that are gateways
  maxBranchingFactor: number;
  maxBranchingElement?: { id: string; name: string; branchesCount: number };
  explanation: string;
  recommendations: string[];
  breakdown: Array<{
    category: string;
    count: number;
    contribution: number;
    description: string;
  }>;
}

export interface BpmnDocumentation {
  processName: string;
  processId: string;
  version?: string;
  executiveSummary: string;
  targetAudience: string;
  businessObjectives: string[];
  rolesAndParticipants: Array<{
    name: string;
    type: 'Pool' | 'Lane' | 'Actor';
    description: string;
    assignedTasksCount: number;
  }>;
  processSteps: ProcessStepDoc[];
  gateways: GatewayDoc[];
  raciMatrix: RaciItem[];
  functionalRequirements: string[];
  risksAndExceptions: RiskExceptionDoc[];
  optimizationSuggestions: string[];
  testScenarios: TestScenarioDoc[];
  userManualGuide: string;
  cyclomaticComplexity: CyclomaticComplexityInfo;
  generatedAt: string;
  language: LanguageOption;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export interface LoadedBpmnFile {
  id: string;
  fileName: string;
  fileSize: number;
  rawXml: string;
  parsed: ParsedBpmn;
  documentation: BpmnDocumentation;
}

export interface CrossProcessLink {
  sourceProcessId: string;
  sourceProcessName: string;
  sourceFileName: string;
  sourceElementId: string;
  sourceElementName: string;
  targetProcessId?: string;
  targetProcessName?: string;
  targetFileName?: string;
  linkType: 'CallActivity' | 'MessageTrigger' | 'SequentialFlow' | 'SharedRole';
  description: string;
}

export interface SharedRoleInfo {
  roleName: string;
  participatingProcesses: string[]; // List of process names
  totalTasksAcrossFolder: number;
}

export interface IntegratedFolderDoc {
  folderName: string;
  totalFiles: number;
  generatedAt: string;
  language: LanguageOption;
  executiveSummary: string;
  averageComplexity: number;
  processComplexityRanking: Array<{
    processName: string;
    processId: string;
    fileName: string;
    score: number;
    rating: 'low' | 'moderate' | 'high' | 'very_high';
    ratingLabel: string;
  }>;
  processSummaries: Array<{
    fileName: string;
    processId: string;
    processName: string;
    tasksCount: number;
    gatewaysCount: number;
    eventsCount: number;
    lanesCount: number;
    callActivitiesCount: number;
    cyclomaticScore?: number;
    cyclomaticRating?: string;
    description?: string;
  }>;
  crossLinks: CrossProcessLink[];
  sharedRoles: SharedRoleInfo[];
  consolidatedRaci: RaciItem[];
  endToEndValueStream: Array<{
    stepNumber: number;
    processId: string;
    processName: string;
    phaseName: string;
    keyInputs: string[];
    keyOutputs: string[];
    handoverTo?: string;
  }>;
  crossProcessRisks: Array<{
    risk: string;
    involvedProcesses: string[];
    impact: string;
    mitigation: string;
  }>;
  integratedOperationalGuide: string;
}
