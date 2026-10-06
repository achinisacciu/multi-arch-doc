// api.js — wrapper sottili sulle API del backend locale (server.py).

export const API_WANT = 6; // deve coincidere con API_VERSION di server.py

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} su ${url}`);
  return r.json();
}

/** POST JSON con diagnosi: se arriva HTML, il backend è vecchio/spento. */
async function postJSON(url, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const ctype = r.headers.get("content-type") || "";
  if (!ctype.includes("application/json")) {
    throw new Error(
      `STALE_BACKEND: ${url} ha risposto ${r.status} non-JSON — ` +
      "backend vecchio o spento: chiudi il vecchio server.py e rilancia `npm run dev`",
    );
  }
  return r.json();
}

/** Solo cartelle, navigazione server-side: {path, parent, dirs[], error?} */
export const apiBrowse = (path) =>
  getJSON("/api/browse?path=" + encodeURIComponent(path || ""));

/** URL per scaricare lo ZIP della documentazione multi-audience. */
export const apiDownloadZipUrl = (client) =>
  "/api/download-zip?client=" + encodeURIComponent(client || "clientone");

/** Pipeline su path già presenti sul PC: {ok, log, crosslink?} */
export async function apiRun(client, folders, opts = {}) {
  return postJSON("/api/run", { client, folders, fast: opts.fast !== false });
}

/** Pipeline su cartelle da OVUNQUE: contenuto via browser + path server opzionali. */
export async function apiRunUpload(client, uploads, paths, opts = {}) {
  return postJSON("/api/run-upload", {
    client, uploads, paths,
    fast: opts.fast !== false,
    timeout_s: opts.timeout_s || 1800,
  });
}

/** Apre una sessione di upload a chunk (cartelle grandi): {uploadId, name} */
export async function apiUploadStart(client, name) {
  return postJSON("/api/upload-start", { client, name });
}

/** Un chunk di file per una sessione: {ok, received} */
export async function apiUploadChunk(uploadId, files) {
  return postJSON("/api/upload-chunk", { uploadId, files });
}

/** true se il backend risponde, false altrimenti (mai eccezioni). */
export async function apiHealth(timeoutMs = 3000) {
  return (await apiHealthDetail(timeoutMs)) !== null;
}

/** Dettaglio /api/health ({ok, api}) o null se offline. Mai eccezioni. */
export async function apiHealthDetail(timeoutMs = 3000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const r = await fetch("/api/health", { signal: c.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
