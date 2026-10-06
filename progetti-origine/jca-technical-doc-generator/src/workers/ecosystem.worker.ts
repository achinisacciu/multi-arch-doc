import { buildOracleEcosystem } from '../services/ecosystemParser';

interface WorkerInput {
  files: Array<{ content: string; name: string; relativePath: string }>;
}

// ATTENZIONE: i Web Worker NON hanno DOMParser (solo Blob). Questo worker resta
// disabilitato per il parsing XML finché non adotta un parser isomorfo.
// Vedi ecosystemWorkerClient.buildEcosystemAsync che usa buildBatched sul main thread.
self.onmessage = (e: MessageEvent<WorkerInput>) => {
  const { files } = e.data || { files: [] };
  try {
    const ecosystem = buildOracleEcosystem(files);
    self.postMessage(ecosystem);
  } catch (err) {
    self.postMessage({ __workerError: err instanceof Error ? err.message : String(err) });
  }
};

export {};
