// dnd.js — lettura client-side con UN solo gesto (drag&drop semplice).
// Il browser NON espone mai il path assoluto: si leggono NOMI + CONTENUTI
// (solo testo) e si inviano al server a pezzi. Ricorsione TOTALE, nessuna
// cartella esclusa; cartelle e file sciolti si possono mescolare nello stesso
// drop. I file BINARI si scartano (non analizzabili come testo).
// La raccolta contenuti rende progress via onProgress(n) e cede il turno
// alla UI ogni 50 file (niente freeze fino a 10.000 XML).

const MAX_SAMPLE = 8; // solo anteprima card, non un tetto

// Fast-path per i binari ovvi (la sniff \0 sul contenuto decide comunque).
const BINARY_EXT = new Set([
  "png", "jpg", "jpeg", "gif", "bmp", "ico", "webp", "mp4", "mp3", "avi",
  "mov", "pdf", "zip", "jar", "war", "ear", "class", "pyc", "pyo", "o",
  "exe", "dll", "so", "dylib", "ttf", "woff", "woff2", "eot", "sqlite", "db",
]);

function newAcc() {
  return { files: 0, dirs: 0, sample: [] };
}

const extOf = (name) => String(name).split(".").pop().toLowerCase();

// --- via legacy webkitGetAsEntry (drag da Esplora risorse: Chrome/Edge) ---

function readBatch(reader) {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
}

async function walkEntry(entry, acc) {
  if (!entry) return;
  if (entry.isFile) {
    acc.files += 1;
    if (acc.sample.length < MAX_SAMPLE) acc.sample.push(entry.fullPath || entry.name);
  } else if (entry.isDirectory) {
    acc.dirs += 1;
    const reader = entry.createReader();
    for (;;) {
      const batch = await readBatch(reader);
      if (!batch.length) break;
      for (const child of batch) await walkEntry(child, acc);
    }
  }
}

function entryFile(entry) {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

/** Legge il testo di un File web; null se illeggibile/troppo grande/binario.
 * I file oltre 8MB si scartano qui (li leggerebbe il path/Sfoglia server-side). */
async function readTextFile(file) {
  try {
    if (file && typeof file.size === "number" && file.size > 8 * 1024 * 1024) return null;
    const text = await file.text();
    if (text.includes("\0")) return null;
    return text;
  } catch {
    return null; // limite fisico del browser, mai un crash
  }
}

/** Cede il turno alla UI (niente freeze durante drop da 10.000 file). */
const yieldUI = () => new Promise((r) => setTimeout(r, 0));

/** Raccoglie {path, content} testuali da una directory-entry, tutto dentro. */
async function collectEntry(entry, out, stats, prefix, onProgress) {
  if (!entry) return;
  if (entry.isFile) {
    stats.seen += 1;
    const rel = prefix + entry.name;
    if (BINARY_EXT.has(extOf(entry.name))) {
      stats.skipped += 1;
      return;
    }
    let file;
    try {
      file = await entryFile(entry);
    } catch {
      stats.skipped += 1;
      return;
    }
    const text = await readTextFile(file);
    if (text === null) {
      stats.skipped += 1;
      return;
    }
    out.files.push({ path: rel, content: text });
    if (onProgress && out.files.length % 50 === 0) {
      onProgress(out.files.length);
      await yieldUI();
    }
  } else if (entry.isDirectory) {
    const reader = entry.createReader();
    for (;;) {
      const batch = await readBatch(reader);
      if (!batch.length) break;
      for (const child of batch) {
        const sub = entry.isRoot ? "" : prefix + entry.name + "/";
        await collectEntry(child, out, stats, sub, onProgress);
      }
    }
  }
}

// --- via File System Access API (fallback moderno) ---

async function walkHandle(handle, acc, prefix) {
  if (!handle) return;
  if (handle.kind === "file") {
    acc.files += 1;
    if (acc.sample.length < MAX_SAMPLE) acc.sample.push(prefix + handle.name);
  } else if (handle.kind === "directory") {
    acc.dirs += 1;
    for await (const [, child] of handle.values()) {
      await walkHandle(child, acc, prefix + handle.name + "/");
    }
  }
}

async function collectHandle(handle, out, stats, prefix, onProgress) {
  if (!handle) return;
  if (handle.kind === "file") {
    stats.seen += 1;
    const rel = prefix + handle.name;
    if (BINARY_EXT.has(extOf(handle.name))) {
      stats.skipped += 1;
      return;
    }
    let file;
    try {
      file = await handle.getFile();
    } catch {
      stats.skipped += 1;
      return;
    }
    const text = await readTextFile(file);
    if (text === null) {
      stats.skipped += 1;
      return;
    }
    out.files.push({ path: rel, content: text });
    if (onProgress && out.files.length % 50 === 0) {
      onProgress(out.files.length);
      await yieldUI();
    }
  } else if (handle.kind === "directory") {
    for await (const [, child] of handle.values()) {
      await collectHandle(child, out, stats, handle.isRoot ? "" : prefix + handle.name + "/", onProgress);
    }
  }
}

/**
 * Ispezione veloce di un handle da selettore nativo (showDirectoryPicker):
 * nomi + conteggi, senza leggere contenuti.
 */
export async function inspectHandle(handle) {
  const acc = newAcc();
  await walkHandle(handle, acc, "");
  acc.dirs = Math.max(0, acc.dirs - 1); // escludi la radice scelta
  return { dropName: handle.name, ...acc };
}

/**
 * Prima passata veloce: nomi + conteggi + handle per la raccolta contenuti.
 * @returns [{dropName, files, dirs, sample[], source}]
 * Non lancia mai: al peggio ritorna [].
 */
export async function readDroppedFolders(dataTransfer) {
  const out = [];
  try {
    const items = [...(dataTransfer?.items || [])].filter((i) => i.kind === "file");
    const loose = [];
    for (const item of items) {
      const entry = typeof item.webkitGetAsEntry === "function" ? item.webkitGetAsEntry() : null;
      if (entry && entry.isDirectory) {
        const acc = newAcc();
        await walkEntry(entry, acc);
        acc.dirs = Math.max(0, acc.dirs - 1); // escludi la radice trascinata
        out.push({ dropName: entry.name, ...acc, source: { entry } });
      } else if (entry && entry.isFile) {
        loose.push(entry);
      } else if (typeof item.getAsFileSystemHandle === "function") {
        try {
          const h = await item.getAsFileSystemHandle();
          if (h && h.kind === "directory") {
            const acc = newAcc();
            await walkHandle(h, acc, "");
            acc.dirs = Math.max(0, acc.dirs - 1);
            out.push({ dropName: h.name, ...acc, source: { handle: h } });
          }
        } catch {
          /* handle non leggibile: si ignora */
        }
      } else {
        const f = item.getAsFile?.();
        if (f) loose.push(f);
      }
    }
    if (loose.length) {
      // File sciolti: sempre accettati — anche insieme alle cartelle —
      // raggruppati per prima cartella relativa (drag&drop semplice).
      const groups = new Map();
      for (const f of loose) {
        const rel = f.webkitRelativePath || f.fullPath || f.name || "";
        const top = rel.split("/").filter(Boolean)[0] || "(file sciolti)";
        if (!groups.has(top)) groups.set(top, { acc: newAcc(), files: [] });
        const g = groups.get(top);
        g.acc.files += 1;
        if (g.acc.sample.length < MAX_SAMPLE) g.acc.sample.push(rel);
        g.files.push(f);
      }
      for (const [top, g] of groups) {
        out.push({ dropName: top, files: g.acc.files, dirs: 0, sample: g.acc.sample, source: { loose: g.files } });
      }
    }
  } catch {
    /* drop illeggibile: il chiamante mostra un toast */
  }
  return out;
}

/**
 * Seconda passata: legge i CONTENUTI testuali da una source di readDroppedFolders.
 * onProgress(n) chiamato ogni 50 file letti (barra avanzamento semplice).
 * @returns {files[{path, content}], skipped}
 */
export async function collectFolderPayload(source, onProgress) {
  const out = { files: [] };
  const stats = { seen: 0, skipped: 0 };
  if (!source) return { files: [], ...stats };
  if (source.entry) {
    const root = source.entry;
    root.isRoot = true;
    await collectEntry(root, out, stats, "", onProgress);
  } else if (source.handle) {
    const root = source.handle;
    root.isRoot = true;
    await collectHandle(root, out, stats, "", onProgress);
  } else if (source.loose) {
    let n = 0;
    for (const f of source.loose) {
      const raw = f.webkitRelativePath || f.fullPath || f.name || "";
      const parts = raw.split("/").filter(Boolean);
      const rel = parts.length > 1 ? parts.slice(1).join("/") : parts[0] || f.name;
      if (!rel || BINARY_EXT.has(extOf(rel))) {
        stats.skipped += 1;
        continue;
      }
      const file = typeof f.text === "function" ? f : await entryFile(f).catch(() => null);
      if (!file) {
        stats.skipped += 1;
        continue;
      }
      const text = await readTextFile(file);
      if (text === null) {
        stats.skipped += 1;
        continue;
      }
      out.files.push({ path: rel, content: text });
      if (onProgress && (++n % 50 === 0)) {
        onProgress(out.files.length);
        await yieldUI();
      }
    }
  }
  if (onProgress) onProgress(out.files.length);
  return { files: out.files, ...stats };
}

/** Legge un file .json trascinato (per la zona crosslink). Ritorna {name, data} o lancia. */
export function readDroppedJson(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("lettura file fallita"));
    r.onload = () => {
      try {
        resolve({ name: file.name, data: JSON.parse(r.result) });
      } catch {
        reject(new Error(`«${file.name}» non è un JSON valido`));
      }
    };
    r.readAsText(file);
  });
}
