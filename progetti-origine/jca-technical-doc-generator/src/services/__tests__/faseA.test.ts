import { describe, it, expect } from 'vitest';
import { buildOracleEcosystem, parseJwsXml, parseJprXml, parseOsbXml } from '../ecosystemParser';
import { parseJcaContent } from '../jcaParser';
import { getSampleOracleEcosystem } from '../../data/sampleEcosystem';
import { buildDocsPackage } from '../docsPackageGenerator';

const JWS = `<?xml version="1.0"?><application n="App"><list n="listOfProjects"><hash><value n="URL" v="SOA/A.jpr"/></hash><hash><value n="URL" v="OSB/B.jpr"/></hash></list></application>`;
const JPR = `<?xml version="1.0"?><jpr:project n="A" xmlns:jpr="x"><list n="technologyScope"><value v="SOA"/></list><hash n="classPath"><value n="url" v="../lib/a.jar"/></hash><hash n="deploymentProfiles"><profile n="P" name="SAR"/></hash></jpr:project>`;
const PROXY = `<?xml version="1.0"?><proxy-service name="P" type="SOAP"><endpointURI>/osb/x</endpointURI></proxy-service>`;

describe('Fase 1: workspace/progetti/OSB', () => {
  it('parseJwsXml censisce i .jpr', () => {
    const w = parseJwsXml(JWS, 'App.jws', 'App.jws');
    expect(w.name).toBe('App');
    expect(w.projects).toEqual(['SOA/A.jpr', 'OSB/B.jpr']);
  });

  it('parseJprXml estrae scope/classpath/profile', () => {
    const p = parseJprXml(JPR, 'A.jpr', 'SOA/A.jpr');
    expect(p.technologyScope).toContain('SOA');
    expect(p.classpathLibs).toContain('a.jar');
    expect(p.deploymentProfiles.length).toBeGreaterThan(0);
    expect(p.projectKind).toBe('soa');
  });

  it('parseOsbXml classifica proxy + endpoint', () => {
    const o = parseOsbXml(PROXY, 'P.proxy', 'OSB/P.proxy', '.proxy');
    expect(o.kind).toBe('proxy');
    expect(o.endpointUri).toBe('/osb/x');
  });

  it('sample: workspace+progetti+osb presenti e progetti classificati', () => {
    const eco = getSampleOracleEcosystem();
    expect(eco.workspaces.length).toBe(1);
    expect(eco.workspaces[0].projects.length).toBe(2);
    expect(eco.projects.length).toBe(1);
    expect(eco.osbArtifacts.length).toBe(1);
    const soaPrj = eco.projects.find((p) => p.name === 'OrderProcessing');
    expect(soaPrj?.projectKind).toBe('soa');
    expect(soaPrj?.jwsSource).toContain('DemoOrders.jws');
  });

  it('docs: projects.csv + osb.csv + repository-map con Fase 1', () => {
    const pkg = buildDocsPackage(getSampleOracleEcosystem(), { language: 'it' });
    expect(pkg['docs/inventory/projects.csv']).toContain('OrderProcessing');
    expect(pkg['docs/inventory/osb.csv']).toContain('OrderProxy');
    expect(pkg['docs/03-REPOSITORY-MAP.md']).toContain('DemoOrders');
  });

  it('C-02: nessun endpoint fantasma su file non-JCA', () => {
    expect(parseJcaContent('', 'x.jca', 'x.jca').endpoints.length).toBe(0);
    expect(parseJcaContent('<foo>hello</foo>', 'y.xml', 'y.xml').endpoints.length).toBe(0);
  });
});
