import { describe, it, expect } from 'vitest';
import { findDanglingRefs, findOrphans, buildLineage, findHygiene } from '../analysis';
import { getSampleOracleEcosystem } from '../../data/sampleEcosystem';
import { buildDocsPackage } from '../docsPackageGenerator';

describe('Fase E: integrity + lineage + igiene', () => {
  const eco = getSampleOracleEcosystem();

  it('dangling: XSLT/referenze assenti rilevate, oramds escluso', () => {
    const d = findDanglingRefs(eco);
    expect(d.some((x) => x.ref.includes('OrderToApprovalTask.xsl'))).toBe(true);
    expect(d.some((x) => x.ref.startsWith('oramds:'))).toBe(false);
  });

  it('lineage: tabelle ORDERS e coda JMS mappate', () => {
    const lin = buildLineage(eco);
    const tables = lin.filter((l) => l.resourceType === 'table').map((l) => l.resource);
    expect(tables).toContain('ORDERS');
    expect(lin.some((l) => l.resourceType === 'queue' && l.resource.includes('OrderProcessingQueue'))).toBe(true);
    expect(lin.find((l) => l.resource === 'ORDERS')?.artifact).toBe('OrderDbAdapter');
  });

  it('igiene: nessun segreto nel sample, orfani segnalati', () => {
    expect(findHygiene(eco).filter((h) => h.kind === 'cleartext-secret').length).toBe(0);
    expect(findOrphans(eco).length).toBeGreaterThan(0);
  });

  it('documenti: integrity.csv + lineage.csv + findings con conteggi', () => {
    const pkg = buildDocsPackage(eco, { language: 'it' });
    expect(pkg['docs/inventory/integrity.csv']).toContain('OrderToApprovalTask.xsl');
    expect(pkg['docs/inventory/lineage.csv']).toContain('ORDERS');
    expect(pkg['docs/reverse/findings.md']).toContain('Riferimenti pendenti:');
    expect(pkg['docs/reverse/open-questions.md']).toContain('riferimento pendente');
  });
});
