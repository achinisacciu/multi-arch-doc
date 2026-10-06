import { ParsedComposite, CompositeNode, CompositeWire } from '../types';

/**
 * Parser per i file Oracle SOA composite.xml.
 * Estrae servizi, componenti, riferimenti e wires mantenendo le URI
 * originali dei collegamenti (source.uri / target.uri).
 */

function cleanTag(name: string): string {
  return name.includes(':') ? name.split(':')[1] : name;
}

function getChildren(parent: Element, tag: string): Element[] {
  return Array.from(parent.children).filter((c) => cleanTag(c.tagName) === tag);
}

function firstChildText(parent: Element, tag: string): string {
  return getChildren(parent, tag)[0]?.textContent?.trim() || '';
}

export function parseCompositeXml(xmlContent: string, fileName: string): ParsedComposite {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'text/xml');
  const compositeEl = doc.documentElement;

  const compositeName = compositeEl?.getAttribute('name') || fileName.replace(/\.xml$/i, '');
  const applicationName = compositeEl?.getAttribute('applicationName') || undefined;
  const revision = compositeEl?.getAttribute('revision') || undefined;

  const nodes: CompositeNode[] = [];
  const nodeIds = new Set<string>();

  const addNode = (node: CompositeNode) => {
    if (nodeIds.has(node.id)) return;
    nodeIds.add(node.id);
    nodes.push(node);
  };

  // Servizi esposti (ingressi)
  for (const el of Array.from(doc.getElementsByTagName('service'))) {
    const name = el.getAttribute('name') || 'service';
    const bindingEl = el.querySelector('binding.ws, binding.sca, binding.http');
    addNode({
      id: `service_${name}`,
      name,
      type: 'service',
      binding: bindingEl?.tagName ? cleanTag(bindingEl.tagName) : undefined,
      wsdlLocation: el.getAttribute('ui:wsdlLocation') || undefined,
      properties: [],
    });
  }

  // Componenti interni
  for (const el of Array.from(doc.getElementsByTagName('component'))) {
    const name = el.getAttribute('name') || 'component';
    const implEl = Array.from(el.children).find((c) => cleanTag(c.tagName).startsWith('implementation.'));
    const implType = implEl ? cleanTag(implEl.tagName).replace('implementation.', '') : undefined;
    const src = implEl?.getAttribute('src') || undefined;
    const properties = getChildren(el, 'property').map((p) => ({
      name: p.getAttribute('name') || '',
      value: p.textContent?.trim() || '',
    }));
    addNode({
      id: `component_${name}`,
      name,
      type: 'component',
      implementation: implType,
      src,
      properties,
    });
  }

  // Riferimenti esterni (uscite)
  for (const el of Array.from(doc.getElementsByTagName('reference'))) {
    const name = el.getAttribute('name') || 'reference';
    const bindingEl = el.querySelector('binding.ws, binding.sca, binding.http');
    addNode({
      id: `reference_${name}`,
      name,
      type: 'reference',
      binding: bindingEl?.tagName ? cleanTag(bindingEl.tagName) : undefined,
      wsdlLocation: el.getAttribute('ui:wsdlLocation') || undefined,
      properties: [],
    });
  }

  // Wires: collega source.uri -> target.uri.
  // Le URI hanno forma "Componente/Percorso" oppure "Componente.service".
  // Il primo segmento identifica il nodo: se combacia con un servizio,
  // componente o riferimento usiamo quel nodo; altrimenti creiamo un nodo "unknown".
  const wires: CompositeWire[] = [];
  const wiresEls = Array.from(doc.getElementsByTagName('wire'));
  wiresEls.forEach((wire, index) => {
    const sourceUri = firstChildText(wire, 'source.uri');
    const targetUri = firstChildText(wire, 'target.uri');
    if (!sourceUri && !targetUri) return;

    const resolveNode = (uri: string, fallbackKind: 'service' | 'component' | 'reference' | 'unknown'): string => {
      const firstSegment = uri.split('/')[0];
      if (!firstSegment) return '';

      const candidates = [
        `service_${firstSegment}`,
        `component_${firstSegment}`,
        `reference_${firstSegment}`,
      ];
      for (const c of candidates) {
        if (nodeIds.has(c)) return c;
      }
      // Nodo non dichiarato esplicitamente (es. task interno)
      const unknownId = `unknown_${firstSegment}`;
      addNode({ id: unknownId, name: firstSegment, type: 'unknown', properties: [] });
      return unknownId;
    };

    const sourceId = resolveNode(sourceUri, 'component');
    const targetId = resolveNode(targetUri, 'reference');
    if (!sourceId || !targetId) return;

    wires.push({
      id: `wire_${index}`,
      source: sourceId,
      target: targetId,
      sourceUri,
      targetUri,
    });
  });

  return {
    fileName,
    fileSize: xmlContent.length,
    rawXml: xmlContent,
    compositeName,
    applicationName,
    revision,
    nodes,
    wires,
    stats: {
      servicesCount: nodes.filter((n) => n.type === 'service').length,
      componentsCount: nodes.filter((n) => n.type === 'component').length,
      referencesCount: nodes.filter((n) => n.type === 'reference').length,
      wiresCount: wires.length,
      importsCount: doc.getElementsByTagName('import').length,
    },
  };
}

/**
 * True se il file è un composite.xml Oracle SOA.
 */
export function isCompositeXml(name: string, content: string): boolean {
  return (
    name.toLowerCase().endsWith('.xml') &&
    (content.includes('<composite') || content.includes('sca:component') || content.includes('<service') && content.includes('<reference') && content.includes('<wire'))
  );
}
