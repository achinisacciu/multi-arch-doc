import { describe, it, expect } from 'vitest';
import { getSampleOracleEcosystem } from '../../data/sampleEcosystem';
import { buildDocsPackage } from '../docsPackageGenerator';

describe('Fase F: wire/coverage/dictionary/deploy-order', () => {
  const pkg = buildDocsPackage(getSampleOracleEcosystem(), { language: 'it' });

  it('scheda composite con wire mermaid', () => {
    const key = Object.keys(pkg).find((k) => k.includes('composites/') && !k.endsWith('INDEX.md'))!;
    expect(pkg[key]).toContain('flowchart LR');
    expect(pkg[key]).toContain('OrderService_ep');
  });

  it('coverage + dictionary + deploy-order presenti', () => {
    expect(pkg['docs/reverse/coverage.md']).toContain('Copertura');
    expect(pkg['docs/technical/data/dictionary.md']).toContain('OrderRequest');
    expect(pkg['docs/technical/deployment-order.md']).toContain('OrderProcessingService');
  });

  it('indice completo senza 404 interni', () => {
    const index = pkg['docs/00-INDEX.md'];
    const linked = [...index.matchAll(/`([^`]+)`/g)].map((m) => m[1]).filter((p) => p.startsWith('docs/') || p.startsWith('inventory/'));
    const missing = linked.filter((p) =>
      !Object.keys(pkg).some((k) => k === p || k === `docs/${p}` || p.endsWith(k.split('/').pop()!))
      && !['docs/00-INDEX.md'].includes(p)
    );
    expect(missing).toEqual([]);
  });
});
