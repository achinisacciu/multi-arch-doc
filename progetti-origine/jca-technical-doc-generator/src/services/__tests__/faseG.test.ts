import { describe, it, expect } from 'vitest';
import { buildEcosystemAsync, WORKER_THRESHOLD } from '../ecosystemWorkerClient';
import { buildOracleEcosystem } from '../ecosystemParser';
import { getSampleOracleEcosystem } from '../../data/sampleEcosystem';
import { buildDocsPackage } from '../docsPackageGenerator';

describe('Fase G: worker client + pacchetto finale', () => {
  it('sotto soglia: risultato identico al builder sincrono', async () => {
    const files = getSampleOracleEcosystem().rawFiles.map((f) => ({
      content: f.content,
      name: f.name,
      relativePath: f.relativePath,
    }));
    expect(files.length).toBeLessThan(WORKER_THRESHOLD);
    const [a, b] = await Promise.all([buildEcosystemAsync(files), Promise.resolve(buildOracleEcosystem(files))]);
    expect(a.composites.length).toBe(b.composites.length);
    expect(a.totalFiles).toBe(b.totalFiles);
  });

  it('pacchetto finale: corpo completo e coerente', () => {
    const pkg = buildDocsPackage(getSampleOracleEcosystem(), { language: 'it' });
    const keys = Object.keys(pkg);
    expect(keys.length).toBeGreaterThan(50);
    for (const must of [
      'README.md',
      'docs/00-INDEX.md',
      'docs/03-REPOSITORY-MAP.md',
      'docs/inventory/projects.csv',
      'docs/inventory/osb.csv',
      'docs/inventory/configplans.csv',
      'docs/inventory/events.csv',
      'docs/inventory/xref.csv',
      'docs/inventory/faults.csv',
      'docs/inventory/integrity.csv',
      'docs/inventory/lineage.csv',
      'docs/inventory/endpoints.yaml',
      'docs/inventory/traceability-matrix.csv',
      'docs/reverse/coverage.md',
      'docs/technical/deployment-order.md',
      'docs/technical/data/dictionary.md',
    ]) {
      expect(keys, must).toContain(must);
    }
    const all = keys.join() + Object.values(pkg).join();
    // Guardia anti-leak: il pacchetto di esempio non deve contenere percorsi locali.
    expect(all.match(/tirocinio/i)).toBeNull();
    expect(all.match(/C:\\Users\\/)).toBeNull();
  });
});
