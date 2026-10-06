import { BpmnFileItem } from '../types';

const tableNameRegex = /\b(?:FROM|JOIN|INSERT\s+INTO|UPDATE|MERGE\s+INTO)\s+([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)?)/gi;
const nodeNameCleanRegex = /[^a-zA-Z0-9_\-]/g;

export type LineageEdge = { source: string; target: string; rel: string };

function cleanNode(name: string): string {
  return name.replace(nodeNameCleanRegex, '_').replace(/^_+|_+$/g, '') || 'node';
}

function normalizeText(text?: string): string {
  return (text || '').trim();
}

export function generateLineageMermaid(files: BpmnFileItem[]): string {
  const { nodes, edges } = extractLineage(files);

  const headerLines = [
    '%% Auto-generated Process Lineage Diagram',
    'graph TD',
    '  classDef component fill:#f3f4f6,stroke:#334155,stroke-width:1px;',
    '  classDef table fill:#e0f2fe,stroke:#1d4ed8,stroke-width:1px,stroke-dasharray: 3 2;',
    '  classDef process fill:#dcfce7,stroke:#15803d,stroke-width:1px;',
    '  classDef relation fill:#e2e8f0,stroke:#64748b,stroke-width:1px;'
  ];

  const edgeLines: string[] = [];
  for (const edge of edges) {
    edgeLines.push(`  ${edge.source} -->|${edge.rel}| ${edge.target}`);
  }

  const classAssignments = Array.from(nodes).sort().map(node => {
    if (node.startsWith('TABLE_')) {
      return `  class ${node} table;`;
    }
    return `  class ${node} process;`;
  });

  return [...headerLines, ...edgeLines, '', ...classAssignments].join('\n');
}

export function extractLineage(files: BpmnFileItem[]): { nodes: string[]; edges: LineageEdge[] } {
  const nodeSet = new Set<string>();
  const edgeSet = new Map<string, LineageEdge>();

  const addEdge = (source: string, target: string, rel: string) => {
    const src = cleanNode(source);
    const tgt = cleanNode(target);
    if (!src || !tgt || src === tgt) return;
    nodeSet.add(src);
    nodeSet.add(tgt);
    const key = `${src}->${tgt}`;
    if (!edgeSet.has(key)) edgeSet.set(key, { source: src, target: tgt, rel });
  };

  for (const file of files) {
    const fileBase = file.name.replace(/\.(bpmn|xml|bpel|sql|pls|pkb)$/i, '');
    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith('.xml') && file.content.includes('<composite')) {
      const projectName = cleanNode(fileBase);
      const componentRegex = /<sca:component[^>]*name=["']([^"']+)["'][^>]*>/gi;
      let compMatch;
      while ((compMatch = componentRegex.exec(file.content)) !== null) {
        addEdge(projectName, compMatch[1], 'contains');
      }
      const wireRegex = /<sca:wire[^>]*>.*?<sca:source[^>]*>(.*?)<\/sca:source>.*?<sca:target[^>]*>(.*?)<\/sca:target>.*?<\/sca:wire>/gis;
      let wireMatch;
      while ((wireMatch = wireRegex.exec(file.content)) !== null) {
        const source = wireMatch[1].split('/')[0];
        const target = wireMatch[2].split('/')[0];
        addEdge(source, target, 'invokes');
      }
      continue;
    }

    if (lowerName.endsWith('.bpel')) {
      const componentName = cleanNode(fileBase);
      const invokeRegex = /<(?:bpel:invoke|invoke)[^>]*partnerLink=["']([^"']+)["'][^>]*operation=["']([^"']+)["'][^>]*>/gi;
      let invokeMatch;
      while ((invokeMatch = invokeRegex.exec(file.content)) !== null) {
        addEdge(componentName, `${invokeMatch[1]}.${invokeMatch[2]}`, 'invokes');
      }
      const invokeNoOpRegex = /<(?:bpel:invoke|invoke)[^>]*partnerLink=["']([^"']+)["'][^>]*>/gi;
      while ((invokeMatch = invokeNoOpRegex.exec(file.content)) !== null) {
        addEdge(componentName, invokeMatch[1], 'invokes');
      }
      continue;
    }

    if (lowerName.endsWith('.sql') || lowerName.endsWith('.pls') || lowerName.endsWith('.pkb')) {
      const processName = cleanNode(fileBase);
      let match;
      while ((match = tableNameRegex.exec(file.content)) !== null) {
        const table = match[1].toUpperCase();
        if (!['SELECT', 'WHERE', 'SET', 'DUAL', 'TABLE', 'VALUES', 'AND', 'OR'].includes(table.toUpperCase())) {
          addEdge(processName, `TABLE_${table}`, 'reads_writes');
        }
      }
      continue;
    }

    if (lowerName.endsWith('.bpmn') || lowerName.endsWith('.xml')) {
      const processName = cleanNode(fileBase);
      const callActivityRegex = /<callActivity[^>]*name=["']([^"']+)["'][^>]*>/gi;
      let callMatch;
      while ((callMatch = callActivityRegex.exec(file.content)) !== null) {
        addEdge(processName, callMatch[1], 'calls');
      }

      const invokeRegex = /<(?:bpel:invoke|invoke)[^>]*partnerLink=["']([^"']+)["'][^>]*>/gi;
      let invokeMatch2;
      while ((invokeMatch2 = invokeRegex.exec(file.content)) !== null) {
        addEdge(processName, invokeMatch2[1], 'invokes');
      }
    }
  }

  return { nodes: Array.from(nodeSet), edges: Array.from(edgeSet.values()) };
}
