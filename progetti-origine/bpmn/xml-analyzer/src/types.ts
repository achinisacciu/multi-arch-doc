export interface XMLAttributeSummary {
  name: string;
  valueSample: string;
  count: number;
  type: string;
}

export interface XMLNodeSummary {
  id: string; // Absolute XPath
  name: string;
  path: string;
  parentPath: string;
  type: "element" | "attribute";
  dataType: "string" | "number" | "boolean" | "date" | "complex" | "empty";
  depth: number;
  occurrenceCount: number;
  attributes: XMLAttributeSummary[];
  childrenPaths: string[];
  sampleValues: string[];
  isOptional?: boolean;
}

export interface XMLValidationResult {
  isValid: boolean;
  error?: {
    line?: number;
    column?: number;
    message: string;
  };
}

export interface XMLAnalysisStats {
  totalElements: number;
  uniqueElements: number;
  totalAttributes: number;
  maxDepth: number;
  deepestPath: string;
  elementCountsByDepth: Record<number, number>;
  topTags: { tag: string; count: number }[];
}

export interface XMLTreeVisualNode {
  id: string;
  name: string;
  type: "element" | "attribute";
  dataType: string;
  path: string;
  depth: number;
  attributes: { name: string; value: string }[];
  children: XMLTreeVisualNode[];
  value?: string;
  occurrenceCount: number;
}
