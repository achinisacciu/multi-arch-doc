import { describe, it, expect } from 'vitest';
import { getSampleOracleEcosystem } from '../../data/sampleEcosystem';
import { buildDocsPackage } from '../docsPackageGenerator';

describe('Fase D: BPEL profondo + MDS + cardinalità', () => {
  const eco = getSampleOracleEcosystem();
  const bpel = eco.bpelProcesses[0];

  it('reply/assign/if/sequenza estratti', () => {
    expect(bpel.replies.length).toBe(1);
    expect(bpel.assigns.length).toBe(1);
    expect(bpel.assigns[0].toVariables).toContain('dbInsertInput');
    expect(bpel.controlFlow.some((c) => c.kind === 'if')).toBe(true);
    expect(bpel.activitySequence[0]).toBe('receive:receiveInput');
    expect(bpel.activitySequence).toContain('reply:replyOutput');
  });

  it('import MDS rilevato sul composite', () => {
    const comp = eco.composites[0];
    const mds = comp.imports.filter((i) => i.isMds);
    expect(mds.length).toBe(1);
    expect(mds[0].location).toBe('oramds:/apps/XSD/OrderCanonical.xsd');
  });

  it('scheda BPEL con flusso numerato + scheda composite con MDS', () => {
    const pkg = buildDocsPackage(eco, { language: 'it' });
    const key = Object.keys(pkg).find((k) => k.includes('BPEL-001'))!;
    expect(pkg[key]).toContain('1. receive:receiveInput');
    expect(pkg[key]).toContain('HighValueCheck');
    const compKey = Object.keys(pkg).find((k) => k.includes('composites/') && k.endsWith('.md') && !k.endsWith('INDEX.md'))!;
    expect(pkg[compKey]).toContain('MDS condiviso');
  });
});
