export type OracleFileType =
  | 'jws'
  | 'jpr'
  | 'composite'
  | 'componentType'
  | 'jca'
  | 'bpmn'
  | 'bpel'
  | 'mplan'
  | 'task'
  | 'wsdl'
  | 'xsd'
  | 'xsl'
  | 'dcx'
  | 'cpx'
  | 'sql'
  | 'sh'
  | 'py'
  | 'xml'
  | 'other';

export type AdapterType = 'db' | 'jms' | 'file' | 'ftp' | 'aq' | 'socket' | 'rest' | 'apps' | 'mq' | 'custom' | 'unknown';

export type EndpointType = 'interaction' | 'activation';

export interface JCAProperty {
  name: string;
  value: string;
  category: 'core' | 'sql' | 'transaction' | 'performance' | 'security' | 'path' | 'general';
  description: string;
  isCritical?: boolean;
}

export interface JCASqlAnalysis {
  sqlString?: string;
  sqlType?: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'MERGE' | 'CALL' | 'UNKNOWN';
  tables: string[];
  parameters: string[];
  procedureName?: string;
  packageName?: string;
  schemaName?: string;
  dmlType?: string;
  descriptorName?: string;
}

export interface JCAMessagingAnalysis {
  destinationName?: string;
  destinationType?: 'Queue' | 'Topic' | 'Unknown';
  messageSelector?: string;
  payloadType?: string;
  deliveryMode?: string;
  acknowledgeMode?: string;
  useMessageListener?: boolean;
}

export interface JCAFileAnalysis {
  physicalDirectory?: string;
  logicalDirectory?: string;
  fileName?: string;
  fileNamingConvention?: string;
  pollingFrequency?: string;
  deleteAfterRead?: boolean;
  archiveDirectory?: string;
  maxRaiseSize?: string;
  minimumAge?: string;
  host?: string;
  port?: string;
  secureStorage?: string;
}

export interface JCATransactionAnalysis {
  getActiveUnitOfWork?: string;
  detectOmissions?: string;
  optimizeMerge?: string;
  returnSingleResultSet?: string;
  useBatchWriting?: string;
  maxRows?: string;
}

export interface JCAEndpoint {
  id: string;
  type: EndpointType;
  portType: string;
  operation: string;
  specClassName: string;
  specCategory: string;
  properties: JCAProperty[];
  sqlAnalysis?: JCASqlAnalysis;
  messagingAnalysis?: JCAMessagingAnalysis;
  fileAnalysis?: JCAFileAnalysis;
  transactionAnalysis?: JCATransactionAnalysis;
}

export interface JCAConnectionFactory {
  location: string;
  uiConnectionName?: string;
  uiQueryResultConfiguration?: string;
  otherAttributes: Record<string, string>;
}

export interface JCAAdapterConfig {
  id: string;
  name: string;
  adapter: AdapterType;
  adapterRaw: string;
  wsdlLocation: string;
  xmlns?: string;
  targetNamespace?: string;
  connectionFactory: JCAConnectionFactory;
  endpoints: JCAEndpoint[];
  rawXml: string;
  fileName: string;
  relativePath: string;
  fileSize: number;
  parsedAt: string;
  validationWarnings: string[];
  selectedForExport: boolean;
}

// Composite SCA Elements
export interface CompositeService {
  name: string;
  uiWsdlLocation?: string;
  interfaceWsdl?: string;
  interfacePortType?: string;
  bindingType?: 'ws' | 'jca' | 'direct' | 'rest' | 'other';
  bindingConfig?: string;
  jcaLocation?: string;
}

export interface CompositeComponent {
  name: string;
  type: 'bpel' | 'bpmn' | 'mediator' | 'human-task' | 'decision' | 'spring' | 'unknown';
  implementationSource?: string;
  services: string[];
  references: string[];
  description?: string;
}

export interface CompositeReference {
  name: string;
  uiWsdlLocation?: string;
  interfaceWsdl?: string;
  interfacePortType?: string;
  bindingType?: 'ws' | 'jca' | 'direct' | 'rest' | 'other';
  bindingConfig?: string;
  jcaLocation?: string;
  jndiLocation?: string;
}

export interface CompositeWire {
  source: string;
  target: string;
}

export interface CompositeConfig {
  id: string;
  name: string;
  revision?: string;
  mode?: string;
  state?: string;
  targetNamespace?: string;
  services: CompositeService[];
  components: CompositeComponent[];
  references: CompositeReference[];
  wires: CompositeWire[];
  rawXml: string;
  fileName: string;
  relativePath: string;
  fileSize: number;
}

// Orchestration (BPEL / BPMN / Mediator / Human Task)
export interface BpelProcessInfo {
  id: string;
  name: string;
  partnerLinks: Array<{ name: string; partnerLinkType: string; myRole?: string; partnerRole?: string }>;
  variables: Array<{ name: string; messageType?: string; element?: string; type?: string }>;
  invokes: Array<{ name?: string; partnerLink: string; portType?: string; operation: string; inputVariable?: string; outputVariable?: string }>;
  receives: Array<{ name?: string; partnerLink: string; portType?: string; operation: string; variable?: string; createInstance?: boolean }>;
  faultHandlers: string[];
  fileName: string;
  relativePath: string;
  rawXml: string;
}

export interface BpmnProcessInfo {
  id: string;
  name: string;
  processType?: string;
  swimlanes: string[];
  userTasks: Array<{ name: string; id: string; documentation?: string }>;
  serviceTasks: Array<{ name: string; id: string; implementation?: string }>;
  gateways: Array<{ name: string; type: string }>;
  events: Array<{ name: string; type: string }>;
  fileName: string;
  relativePath: string;
  rawXml: string;
}

export interface MediatorRoutingRule {
  operation?: string;
  targetService?: string;
  filterExpression?: string;
  transformations: string[];
  actionType?: 'invoke' | 'reply' | 'echo' | 'fault';
}

export interface MediatorInfo {
  id: string;
  name: string;
  wsdlLocation?: string;
  operations: Array<{ name: string; routingRules: MediatorRoutingRule[] }>;
  fileName: string;
  relativePath: string;
  rawXml: string;
}

export interface HumanTaskInfo {
  id: string;
  name: string;
  title?: string;
  priority?: string;
  outcomes: string[];
  participants: string[];
  payloadElements: string[];
  expiration?: string;
  fileName: string;
  relativePath: string;
  rawXml: string;
}

// Contracts & Transformations
export interface WsdlOperation {
  name: string;
  inputMessage?: string;
  outputMessage?: string;
  faultMessages: string[];
}

export interface WsdlPortType {
  name: string;
  operations: WsdlOperation[];
}

export interface WsdlContractInfo {
  id: string;
  name: string;
  targetNamespace?: string;
  portTypes: WsdlPortType[];
  imports: string[];
  serviceName?: string;
  soapAddress?: string;
  fileName: string;
  relativePath: string;
  rawXml: string;
}

export interface XsdSchemaInfo {
  id: string;
  name: string;
  targetNamespace?: string;
  elements: Array<{ name: string; type?: string }>;
  complexTypes: Array<{ name: string; elementCount: number }>;
  simpleTypes: string[];
  imports: string[];
  includes: string[];
  fileName: string;
  relativePath: string;
  rawXml: string;
}

export interface XsltInfo {
  id: string;
  name: string;
  sourceType?: string;
  targetType?: string;
  sourceNamespaces: Record<string, string>;
  targetNamespaces: Record<string, string>;
  templateMatches: string[];
  fileName: string;
  relativePath: string;
  rawContent: string;
}

// ADF / Data Controls
export interface DataControlInfo {
  id: string;
  name: string;
  type: 'dcx' | 'cpx';
  adapterClass?: string;
  package?: string;
  bindings: Array<{ id: string; path?: string; usageId?: string }>;
  fileName: string;
  relativePath: string;
  rawXml: string;
}

// SCA ComponentType & DVM (domain value maps) - presenti in dataset di grandi dimensioni
export interface ComponentTypeInfo {
  id: string;
  name: string;
  targetNamespace?: string;
  services: Array<{ name: string; interfacePortType?: string; interfaceWsdl?: string }>;
  references: Array<{ name: string; interfacePortType?: string; interfaceWsdl?: string }>;
  properties: Array<{ name: string; type?: string }>;
  fileName: string;
  relativePath: string;
  rawXml: string;
}

export interface DvmInfo {
  id: string;
  name: string;
  columns: string[];
  rowsCount: number;
  fileName: string;
  relativePath: string;
  rawXml: string;
}

// DevOps & Scripts - esteso per dataset di grandi dimensioni (tcl, ctl, agdl, mdl, java, etc.)
export interface ScriptInfo {
  id: string;
  name: string;
  type: 'sh' | 'py' | 'sql' | 'properties' | 'tcl' | 'ctl' | 'java' | 'other';
  purpose: string;
  linesCount: number;
  fileName: string;
  relativePath: string;
  rawContent: string;
}

// Master Project / Workspace Repository
export interface ProjectInfo {
  id: string;
  name: string;
  technologyScope: string[];
  sourceDirectories: string[];
  dependencies: string[];
  fileName: string;
  relativePath: string;
}

export interface WorkspaceInfo {
  id: string;
  name: string;
  projects: string[];
  fileName: string;
  relativePath: string;
}

export interface OracleEcosystem {
  analyzedAt: string;
  totalFiles: number;
  fileCountByExtension: Record<string, number>;
  workspaces: WorkspaceInfo[];
  projects: ProjectInfo[];
  composites: CompositeConfig[];
  componentTypes: ComponentTypeInfo[];
  dvms: DvmInfo[];
  jcaAdapters: JCAAdapterConfig[];
  bpelProcesses: BpelProcessInfo[];
  bpmnProcesses: BpmnProcessInfo[];
  mediators: MediatorInfo[];
  humanTasks: HumanTaskInfo[];
  wsdlContracts: WsdlContractInfo[];
  xsdSchemas: XsdSchemaInfo[];
  xsltTransforms: XsltInfo[];
  dataControls: DataControlInfo[];
  scripts: ScriptInfo[];
  rawFiles: Array<{ name: string; relativePath: string; extension: string; size: number; content: string }>;
}

export interface DocSectionOptions {
  includeSummary: boolean;
  includeArchitectureTopology: boolean;
  includeCompositesMatrix: boolean;
  includeProcessesBpmnBpel: boolean;
  includeMediatorsCatalog: boolean;
  includeHumanTasksCatalog: boolean;
  includeJcaMatrix: boolean;
  includeWsdlXsdCatalog: boolean;
  includeXsltCatalog: boolean;
  includeComponentTypeCatalog?: boolean;
  includeDvmCatalog?: boolean;
  includeAdfBindings: boolean;
  includeDevOpsChecklist: boolean;
  includeMermaidDiagrams: boolean;
}

export interface JcaDocSectionOptions {
  includeSummary: boolean;
  includeJndiSpecs: boolean;
  includeEndpoints: boolean;
  includeSqlAnalysis: boolean;
  includePropertiesCatalog: boolean;
  includeTransactionProfile: boolean;
  includeMermaid: boolean;
  includeDevOpsChecklist: boolean;
  includeRawSnippet: boolean;
}

export interface MarkdownGenOptions {
  language: 'it' | 'en';
  docTitle?: string;
  sections?: JcaDocSectionOptions;
  includeRawXml?: boolean;
}

export interface MasterDocGenOptions {
  language: 'it' | 'en';
  sections: DocSectionOptions;
  docTitle?: string;
  applicationName?: string;
}
