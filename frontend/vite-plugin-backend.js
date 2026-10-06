// vite-plugin-backend.js — avvia server.py quando parte `vite dev`.
// Zero dipendenze: se il backend è già online lo riusa, altrimenti lo lancia
// come figlio e lo spegne alla chiusura. Solo dev (mai in build/preview).

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.resolve(here, "..", "server.py");

async function healthy(port, timeoutMs = 1500) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: c.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function waitHealthy(port, tries = 40, want = 0) {
  for (let i = 0; i < tries; i++) {
    const h = await healthy(port, 500);
    if (h && (h.api || 0) >= want) return h;
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

export function backendPlugin({ port = 8091, apiWant = 6 } = {}) {
  let child = null;
  const stop = () => {
    if (child && !child.killed) {
      child.kill();
      child = null;
    }
  };
  return {
    name: "client-dossier-backend",
    apply: "serve",
    async configureServer(server) {
      const info = (m) => server.config.logger.info(m, { timestamp: true });
      const err = (m) => server.config.logger.error(m, { timestamp: true });
      const h = await healthy(port);
      if (h && (h.api || 0) >= apiWant) {
        info(`backend già online su http://127.0.0.1:${port} (lo riuso)`);
        return;
      }
      if (h) {
        err(
          `backend VECCHIO su :${port} (api ${h.api || "?"}): chiudilo (Ctrl+C nel suo ` +
          "terminale) e rilancia `npm run dev`, altrimenti l'analisi fallisce.",
        );
        return; // non ne avvio un secondo sulla stessa porta
      }
      const python = process.env.PYTHON || "python";
      child = spawn(python, [SERVER, "--port", String(port)], { stdio: "inherit" });
      child.on("exit", (code) => {
        child = null;
        if (code) server.config.logger.error(`server.py uscito con codice ${code}`, { timestamp: true });
      });
      const ok = await waitHealthy(port, 40, apiWant);
      server.config.logger.info(
        ok
          ? `backend avviato su http://127.0.0.1:${port}`
          : `backend NON partito: avvialo a mano con \`python server.py\``,
        { timestamp: true },
      );
      server.httpServer?.on("close", stop);
      process.on("SIGINT", stop);
      process.on("SIGTERM", stop);
    },
    closeBundle: stop,
  };
}
