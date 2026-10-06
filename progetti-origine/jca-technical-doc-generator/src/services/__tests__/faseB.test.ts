import { describe, it, expect } from 'vitest';
import { getSampleOracleEcosystem } from '../../data/sampleEcosystem';
import { buildDocsPackage } from '../docsPackageGenerator';

describe('Fase B: EDN/XREF/fault/rules/security', () => {
  const eco = getSampleOracleEcosystem();

  it('artefatti rilevati', () => {
    expect(eco.ednEvents.length).toBe(1);
    expect(eco.ednEvents[0].name).toBe('OrderCreatedEvent');
    expect(eco.ednEvents[0].subscribers).toContain('AuditComposite');
    expect(eco.xrefs.length).toBe(1);
    expect(eco.xrefs[0].columns).toEqual(['ECOM_ID', 'ERP_ID', 'MDM_ID']);
    expect(eco.faultPolicies.length).toBe(2);
    const pol = eco.faultPolicies.find((f) => f.name === 'OrderRetryPolicy')!;
    expect(pol.conditions[0].retryCount).toBe('3');
    const bind = eco.faultPolicies.find((f) => f.bindings.length > 0)!;
    expect(bind.bindings[0].policy).toBe('OrderRetryPolicy');
    expect(eco.businessRules.length).toBe(1);
    expect(eco.businessRules[0].decisionFunctions).toContain('ComputeDiscount');
  });

  it('security refs: policy OWSM dal composite', () => {
    const pol = eco.securityRefs.find((s) => s.kind === 'policy');
    expect(pol?.value).toBe('oracle/wss_username_token_service_policy');
  });

  it('documenti generati senza WIP', () => {
    const pkg = buildDocsPackage(eco, { language: 'it' });
    expect(pkg['docs/technical/events.md']).toContain('OrderCreatedEvent');
    expect(pkg['docs/technical/rules.md']).toContain('ComputeDiscount');
    expect(pkg['docs/technical/policies/fault-policies.md']).toContain('OrderRetryPolicy');
    expect(pkg['docs/technical/policies/fault-policies.md']).not.toContain('work in progress');
    expect(pkg['docs/technical/policies/security-policies.md']).toContain('oracle/wss_username_token_service_policy');
    expect(pkg['docs/technical/data/translations.md']).toContain('CustomerXref');
    expect(pkg['docs/inventory/events.csv']).toContain('OrderCreatedEvent');
    expect(pkg['docs/inventory/xref.csv']).toContain('XREF_CUSTOMER');
    expect(pkg['docs/inventory/faults.csv']).toContain('remoteFault');
  });
});
