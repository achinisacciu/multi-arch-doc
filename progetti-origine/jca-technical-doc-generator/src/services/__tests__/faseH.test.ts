import { describe, it, expect } from 'vitest';
import { buildOracleEcosystem, isConfigPlanFile, parseConfigPlanXml } from '../ecosystemParser';
import { buildDocsPackage } from '../docsPackageGenerator';

const composite = (orderName: string) => `<composite name="${orderName}" revision="1.0" targetNamespace="http://example.com">
  <service name="OrderSvc"><interface.wsdl interface="http://example.com#wsdl.interface(OrderPort)"/><binding.ws port="p"/></service>
  <component name="Cmp"><implementation.bpel src="x.bpel"/></component>
  <reference name="OutRef"><interface.wsdl interface="http://example.com#wsdl.interface(OutPort)"/><binding.jca config="a.jca"/></reference>
</composite>`;

describe('fase H - omonimi composite + cfgplan', () => {
  it('3 composite.xml omonimi generano 3 documenti ZIP distinti', () => {
    const eco = buildOracleEcosystem([
      { name: 'composite.xml', relativePath: 'projA/SOA/composite.xml', content: composite('OrderA') },
      { name: 'composite.xml', relativePath: 'projB/SOA/composite.xml', content: composite('OrderB') },
      { name: 'composite.xml', relativePath: 'projC/SOA/composite.xml', content: composite('OrderC') },
    ]);
    expect(eco.composites).toHaveLength(3);
    const pkg = buildDocsPackage(eco, { language: 'it' });
    const compDocs = Object.keys(pkg).filter((k) => k.startsWith('docs/technical/composites/') && k !== 'docs/technical/composites/INDEX.md');
    expect(compDocs).toHaveLength(3);
    expect(new Set(compDocs).size).toBe(3);
  });

  it('riconosce *cfgplan* e Plan.xml con env dal path', () => {
    const planXml = `<SOAConfigPlan name="OrderA"><composite name="OrderA"><service name="OrderSvc"><searchReplace><search>http://dev</search><replace>http://prod</replace></searchReplace></service></composite></SOAConfigPlan>`;
    expect(isConfigPlanFile('OrderA_cfgplan_dev.xml', 'projA/cfg/OrderA_cfgplan_dev.xml', planXml)).toBe(true);
    expect(isConfigPlanFile('Plan.xml', 'projA/dev/Plan.xml', planXml)).toBe(true);
    const eco = buildOracleEcosystem([
      { name: 'OrderA_cfgplan_dev.xml', relativePath: 'projA/dev/OrderA_cfgplan_dev.xml', content: planXml },
    ]);
    expect(eco.configPlans).toHaveLength(1);
    expect(eco.configPlans[0].env).toBe('DEV');
    const parsed = parseConfigPlanXml(planXml, 'Plan.xml', 'projB/prod/Plan.xml');
    expect(parsed.env).toBe('PROD');
  });

  it('endpoints.yaml: match esatto, nessun fuzzy Order->OrderCancel', () => {
    const eco = buildOracleEcosystem([
      { name: 'composite.xml', relativePath: 'p1/composite.xml', content: composite('Order') },
      { name: 'composite.xml', relativePath: 'p2/composite.xml', content: composite('OrderCancel') },
    ]);
    // Forza nomi distinti come da composite reali
    eco.composites[0].services[0].name = 'OrderSvc';
    eco.composites[1].services[0].name = 'OrderSvc';
    eco.configPlans.push({
      id: 'cfgplan-x', compositeName: 'Order', env: 'DEV', replacements: [
        { scope: 'service', target: 'OrderSvc', search: 'http://dev', replace: 'http://order-dev' },
      ], fileName: 'Order_cfgplan_dev.xml', relativePath: 'p1/Order_cfgplan_dev.xml', rawXml: '',
    });
    const pkg = buildDocsPackage(eco, { language: 'it' });
    const yaml = pkg['docs/inventory/endpoints.yaml'];
    expect(yaml).toContain('http://order-dev');
    // OrderCancel non deve ereditare l'endpoint di Order
    const blocks = yaml.split('  - id: ');
    const cancelBlock = blocks.find((b) => b.includes('OrderCancel'));
    expect(cancelBlock).toBeDefined();
    expect(cancelBlock).toContain('TO_BE_MAPPED');
  });
});
