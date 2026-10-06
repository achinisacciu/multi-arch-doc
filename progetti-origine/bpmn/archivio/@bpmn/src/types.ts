export interface BpmnFileItem {
  id: string;
  name: string;
  relativePath: string;
  folderPath: string;
  content: string;
  size: number;
  lastModified?: number;
  isValid?: boolean;
  error?: string;
  stats?: {
    totalElements: number;
    tasksCount: number;
    gatewaysCount: number;
    eventsCount: number;
    subprocessesCount: number;
    startEvents: number;
    endEvents: number;
    callActivities: number;
  };
}

export interface BpmnElement {
  id: string;
  name: string;
  type: string;
  rawType: string;
  documentation?: string;
  laneName?: string;
  poolName?: string;
  incoming: string[];
  outgoing: string[];
  conditionExpression?: string;
  elementId?: string;
  targetRef?: string;
  sourceRef?: string;
}

export interface BpmnPool {
  id: string;
  name: string;
  lanes: BpmnLane[];
}

export interface BpmnLane {
  id: string;
  name: string;
  flowNodeRefs: string[];
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
  hasOracleExtensions: boolean;
  crossRefs: CrossReference[];
}

export interface CrossReference {
  elementId: string;
  refType: 'callActivity' | 'messageFlow' | 'sharedRole' | 'messageEvent';
  refElementId?: string;
  refProcessId?: string;
  refFileName?: string;
  refRoleName?: string;
  description: string;
}

export interface CrossProcessAnalysis {
  totalProcesses: number;
  totalElements: number;
  callActivityRefs: CallActivityRef[];
  sharedRoles: SharedRole[];
  messageFlows: MessageFlowRef[];
  processInteractions: Array<{
    fromProcessId: string;
    fromFileName: string;
    toProcessId: string;
    toFileName: string;
    type: 'callActivity' | 'messageEvent';
    description: string;
  }>;
}

export interface CallActivityRef {
  sourceId: string;
  sourceName: string;
  sourceFile: string;
  targetProcessId?: string;
  targetProcessName?: string;
  targetFile?: string;
}

export interface SharedRole {
  roleName: string;
  participatingProcesses: string[];
  totalTasks: number;
}

export interface MessageFlowRef {
  id: string;
  sourceRef: string;
  targetRef: string;
  sourceFile: string;
  targetFile?: string;
  messageRef?: string;
  name?: string;
}

export interface SimulationStep {
  id: string;
  elementId: string;
  elementName: string;
  elementType: string;
  type: 'element' | 'flow' | 'gateway';
  order: number;
}

export type ViewMode = 'viewer' | 'editor' | 'simulation';
export type AppView = 'diagram' | 'analysis' | 'stepbystep';
