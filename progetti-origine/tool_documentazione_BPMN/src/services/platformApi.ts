/**
 * Platform API — unified single-entry point
 * Dev: Vite proxy /api -> 127.0.0.1:8000 (python)
 * Prod: python serve dist on 8000, same origin
 * Override with VITE_API_BASE env if needed.
 */
function getDefaultBase(): string {
  // @ts-ignore Vite env
  const envBase = (import.meta as any)?.env?.VITE_API_BASE as string | undefined;
  if (envBase) return envBase.replace(/\/$/, "");
  // In dev, relative "" will be proxied by Vite; in prod same-origin
  // Detect if we are served on :8000 (python) → use relative
  if (typeof window !== "undefined") {
    const { protocol, hostname, port } = window.location;
    // If frontend is on 8000 (python serve), use same origin (relative)
    if (port === "8000") return "";
    // If frontend is on 3000 (vite dev), relative "" hits vite proxy → 8000
    if (port === "3000" || port === "5173") return "";
    // Fallback absolute only if not proxied
    if (hostname === "127.0.0.1" || hostname === "localhost") return `${protocol}//${hostname}:8000`;
  }
  return "";
}

const DEFAULT_BASE = getDefaultBase();

/** Resolve base: empty string → relative /api , otherwise absolute */
function apiUrl(base: string, path: string): string {
  if (!base) return path; // relative
  return `${base}${path}`;
}

export function resolveBase(explicit?: string): string {
  if (explicit && explicit.trim()) return explicit.trim().replace(/\/$/, "");
  return DEFAULT_BASE;
}

export { DEFAULT_BASE };

export async function fetchHealth(base = DEFAULT_BASE) {
  const b = resolveBase(base);
  const r = await fetch(apiUrl(b, `/api/health`));
  if (!r.ok) throw new Error(`health ${r.status}`);
  return r.json();
}

export async function postScan(base: string, projectPath: string) {
  const b = resolveBase(base);
  const r = await fetch(apiUrl(b, `/api/scan`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_path: projectPath }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<{ job_id: string; registry: any }>;
}

export async function postAnalyze(base: string, projectPath: string) {
  const b = resolveBase(base);
  const r = await fetch(apiUrl(b, `/api/analyze`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_path: projectPath }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getRegistry(base: string, jobId: string) {
  const b = resolveBase(base);
  const r = await fetch(apiUrl(b, `/api/registry?job=${jobId}`));
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getGraph(base: string, jobId: string) {
  const b = resolveBase(base);
  const r = await fetch(apiUrl(b, `/api/graph?job=${jobId}`));
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getLineage(base: string, jobId: string) {
  const b = resolveBase(base);
  const r = await fetch(apiUrl(b, `/api/lineage?job=${jobId}`));
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getTrace(base: string, jobId: string, from: string, to?: string) {
  const b = resolveBase(base);
  const qs = new URLSearchParams({ from, job: jobId, maxDepth: "10" });
  if (to) qs.set("to", to);
  const r = await fetch(apiUrl(b, `/api/trace?${qs.toString()}`));
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getImpact(base: string, jobId: string, artifact: string) {
  const b = resolveBase(base);
  const qs = new URLSearchParams({ artifact, job: jobId });
  const r = await fetch(apiUrl(b, `/api/impact?${qs.toString()}`));
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getCanonical(base: string, jobId: string) {
  const b = resolveBase(base);
  const r = await fetch(apiUrl(b, `/api/canonical?job=${jobId}`));
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
