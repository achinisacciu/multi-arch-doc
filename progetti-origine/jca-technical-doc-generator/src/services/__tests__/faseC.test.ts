import { describe, it, expect } from 'vitest';
import { parseConfigPlanXml } from '../ecosystemParser';
import { getSampleOracleEcosystem } from '../../data/sampleEcosystem';
import { buildDocsPackage } from '../docsPackageGenerator';

const PLAN = `<?xml version="1.0"?><SOAConfigPlan xmlns="http://xmlns.oracle.com/soa/configplan"><composite name="C"><service name="S"><binding type="ws"><attribute name="location"><searchReplace><search>http://dev/x</search><replace>http://prod/x</replace></searchReplace></attribute></binding></service></composite></SOAConfigPlan>`;

describe('Fase 6: ConfigPlan', () => {
  it('parseConfigPlanXml estrae env/scope/target/replace', () => {
    const p = parseConfigPlanXml(PLAN, 'C_ConfigPlan_PROD.xml', 'SOA/C_ConfigPlan_PROD.xml');
    expect(p.env).toBe('PROD');
    expect(p.compositeName).toBe('C');
    expect(p.replacements.length).toBe(1);
    expect(p.replacements[0].scope).toBe('service');
    expect(p.replacements[0].target).toBe('S');
    expect(p.replacements[0].replace).toBe('http://prod/x');
  });

  it('ConfigPlan non è classificato come composite', () => {
    const eco = getSampleOracleEcosystem();
    expect(eco.configPlans.length).toBe(1);
    expect(eco.composites.length).toBe(1);
  });

  it('endpoints.yaml usa i replace del plan PROD', () => {
    const pkg = buildDocsPackage(getSampleOracleEcosystem(), { language: 'it' });
    const yaml = pkg['docs/inventory/endpoints.yaml'];
    expect(yaml).toContain('http://prod-host:8001/soa-infra/services/default/OrderProcessingService/OrderService_ep');
    expect(yaml).toContain('eis/DB/SOADataSourcePROD');
    expect(pkg['docs/inventory/configplans.csv']).toContain('OrderDbAdapter');
  });
});
