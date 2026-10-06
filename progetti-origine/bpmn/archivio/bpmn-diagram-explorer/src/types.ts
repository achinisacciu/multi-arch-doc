export interface BpmnFileItem {
  id: string;
  name: string;
  relativePath: string;
  folderPath: string;
  content: string;
  size: number;
  lastModified?: number;
  isSample?: boolean;
  isValid?: boolean;
  error?: string;
  stats?: {
    tasksCount: number;
    gatewaysCount: number;
    eventsCount: number;
    subprocessesCount: number;
  };
}

export interface BpmnFolderNode {
  name: string;
  path: string;
  files: BpmnFileItem[];
  subfolders: Record<string, BpmnFolderNode>;
}

export interface SelectedElementInfo {
  id: string;
  type: string;
  name?: string;
  documentation?: string;
  incoming: Array<{ id: string; name?: string; sourceId?: string }>;
  outgoing: Array<{ id: string; name?: string; targetId?: string }>;
  businessProperties?: Record<string, string>;
}

export type ViewMode = 'viewer' | 'editor' | 'simulation';
export type CanvasTheme = 'default' | 'blueprint' | 'dark' | 'contrast';

export interface PdfExportOptions {
  pageSize: 'a4' | 'a3' | 'a2' | 'fit';
  orientation: 'landscape' | 'portrait';
  includeHeader: boolean;
  includeStats: boolean;
  highQuality: boolean;
  backgroundColor: string;
}

export interface SimulationStep {
  elementId: string;
  elementName: string;
  elementType: string;
}
