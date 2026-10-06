export interface DocumentationTopic {
  elementId: string;
  labels: Array<{ locale: string; text: string }>;
  descriptions: Array<{ locale: string; text: string }>;
}

export interface ParsedProcessDocumentation {
  fileName: string;
  componentName: string;
  topics: DocumentationTopic[];
}

function pickLocale(items: Array<{ locale: string; text: string }>, locales: string[], fallback: string): string {
  for (const loc of locales) {
    const found = items.find((i) => i.locale.toLowerCase() === loc.toLowerCase());
    if (found && found.text.trim()) return found.text.trim();
  }
  for (const item of items) {
    if (item.text.trim()) return item.text.trim();
  }
  return fallback;
}

/**
 * Parser dei file Oracle SOA `<Componente>Documentation.xml`
 * (namespace `.../processDocumentation`). Contengono per ogni elemento del
 * processo (topicDocumentation) i label e le descrizioni localizzate.
 */
export function parseProcessDocumentation(xmlContent: string, fileName: string): ParsedProcessDocumentation {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'text/xml');
  const root = doc.documentElement;

  const componentEl = root.getElementsByTagName('component')[0];
  const componentName = componentEl?.getAttribute('name') || fileName.replace(/Documentation\.xml$/i, '');

  const topics: DocumentationTopic[] = [];
  const topicEls = Array.from(doc.getElementsByTagName('topicDocumentation'));
  for (const el of topicEls) {
    const elementId = el.getAttribute('name') || '';

    const labels: Array<{ locale: string; text: string }> = [];
    for (const label of Array.from(el.getElementsByTagName('label'))) {
      labels.push({ locale: label.getAttribute('locale') || 'en', text: label.textContent?.trim() || '' });
    }

    const descriptions: Array<{ locale: string; text: string }> = [];
    for (const desc of Array.from(el.getElementsByTagName('description'))) {
      descriptions.push({ locale: desc.getAttribute('locale') || 'en', text: desc.textContent?.trim() || '' });
    }

    if (elementId || labels.length > 0 || descriptions.length > 0) {
      topics.push({ elementId, labels, descriptions });
    }
  }

  return { fileName, componentName, topics };
}

/**
 * Estratto comodo per il display: mappa elementId → label preferita
 * (ordine locale, fallback a qualunque locale disponibile, poi elementId).
 */
export function buildLabelMap(
  parsed: ParsedProcessDocumentation,
  locales: string[] = ['it', 'en']
): Map<string, string> {
  const map = new Map<string, string>();
  for (const t of parsed.topics) {
    const label = pickLocale(t.labels, locales, t.elementId);
    map.set(t.elementId, label);
  }
  return map;
}

/**
 * Estratto comodo per il display: mappa elementId → descrizione preferita.
 */
export function buildDescriptionMap(
  parsed: ParsedProcessDocumentation,
  locales: string[] = ['it', 'en']
): Map<string, string> {
  const map = new Map<string, string>();
  for (const t of parsed.topics) {
    const desc = pickLocale(t.descriptions, locales, '');
    if (desc) map.set(t.elementId, desc);
  }
  return map;
}

/**
 * True se il file sembra un Documentazione.xml Oracle SOA.
 */
export function isDocumentationXml(name: string, content: string): boolean {
  return (
    name.toLowerCase().endsWith('.xml') &&
    (content.includes('processDocumentation') ||
      (content.includes('<topicDocumentation') && content.includes('<component')))
  );
}

/**
 * Dal nome file `ComponenteDocumentation.xml` ricava il nome componente.
 */
export function componentNameFromDocumentationFile(fileName: string): string {
  return fileName.replace(/Documentation\.xml$/i, '');
}
