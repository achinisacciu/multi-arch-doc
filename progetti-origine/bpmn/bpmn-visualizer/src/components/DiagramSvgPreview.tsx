import { DrawioNodeSpec, DrawioEdgeSpec } from '../utils/drawioGenerator';
import { InteractiveDiagram } from './InteractiveDiagram';

export function DiagramSvgPreview({
  nodes,
  edges,
  xmlContent,
}: {
  nodes: DrawioNodeSpec[];
  edges: DrawioEdgeSpec[];
  xmlContent?: string;
}) {
  return <InteractiveDiagram nodes={nodes} edges={edges} xmlContent={xmlContent} />;
}
