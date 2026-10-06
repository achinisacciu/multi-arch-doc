// main.js — Client Dossier Studio: stepper Sorgenti -> Analisi -> Risultati.
// Vanilla JS + Vite, zero dipendenze runtime.

import "./style.css";
import { apiBrowse, apiRunUpload, apiUploadStart, apiUploadChunk, apiHealth, apiHealthDetail, API_WANT, apiDownloadZipUrl } from "./api.js";
import { state, load, save, addFolder, removeFolder, byId, moveFolder, hasPath, resolvedPaths } from "./store.js";
import { readDroppedFolders, collectFolderPayload, inspectHandle, readDroppedJson } from "./dnd.js";
import { openExplorer, initExplorer } from "./explorer.js";
import { gradeClass, renderSummary, renderMatrix, renderEdges, isValidCrosslink } from "./matrix.js";
import { esc, basename, debounce } from "./util.js";

const $ = (id) => document.getElementById(id);

/** true se l'utente ha scelto la modalità completa (radio). Default: veloce. */
function isFull() {
  const r = $("opt-full");
  return !!(r && r.checked);
}

// Contenuti letti dal browser per le card "upload" (solo memoria: mai in localStorage).
const payloads = new Map();

// ---------- toast ----------

function toast(msg, kind = "") {
  const t = document.createElement("div");
  t.className = `toast ${kind}`;
  t.textContent = msg;
  $("toasts").appendChild(t);
  setTimeout(() => t.classList.add("is-out"), 3600);
  setTimeout(() => t.remove(), 4100);
}

// ---------- stepper ----------

function gotoStep(name) {
  for (const s of ["sources", "run", "results"]) {
    $("step-" + s).hidden = s !== name;
    $("stepbtn-" + s).classList.toggle("is-active", s === name);
  }
}

// ---------- comandi CLI equivalenti ----------

function paintCommands() {
  const c = state.client || "clientone";
  const q = (s) => `"${String(s).replace(/"/g, "")}"`;
  const fs = resolvedPaths().map(q).join(" ");
  $("cmd-collect").textContent = `python multirepo/collect.py --client ${c} --folders ${fs}${isFull() ? "" : " --fast"}`;
  $("cmd-crosslink").textContent = `python multirepo/crosslink.py --client ${c} ${fs}`;
  $("cmd-report").textContent = `python multirepo/report.py --client ${c}`;
  const nUp = state.folders.filter((f) => f.kind === "upload" && payloads.has(f.id)).length;
  if (nUp && !fs) {
    $("cmd-collect").textContent = "# cartelle via drop nel browser: nessun comando path (l'upload passa da /api/run-upload)";
    $("cmd-crosslink").textContent = "";
    $("cmd-report").textContent = "";
  }
}

// ---------- card sorgenti ----------

function statusBadge(f) {
  if (f.kind === "path") return `<span class="badge b-ok">✅ path server</span>`;
  if (f.reading) return `<span class="badge b-prob">⏳ lettura…</span>`;
  if (payloads.has(f.id)) return `<span class="badge b-ok">📦 pronta</span>`;
  return `<span class="badge b-prob">⚠ ritrascina</span>`;
}

function paintCards() {
  const box = $("folder-cards");
  if (!state.folders.length) {
    box.innerHTML = `<div class="muted pad">nessuna cartella: trascinane una qui sopra, incolla un path o usa Sfoglia.</div>`;
  } else {
    box.innerHTML = state.folders.map((f) => {
      const title = esc(f.path ? basename(f.path) : f.dropName || "(senza nome)");
      const sub = f.path ? `<div class="card-path" title="${esc(f.path)}">${esc(f.path)}</div>` : "";
      const ready = f.kind === "upload" && payloads.has(f.id);
      const meta = [
        f.kind === "upload" && ready ? `${payloads.get(f.id).files.length} file inviati` : "",
        f.kind === "upload" && !ready && !f.reading ? `visti ${f.files} file · ${f.dirs} sottocartelle` : "",
        f.kind === "upload" && f.reading ? `letti ${f.files} file · ${f.dirs} sottocartelle…` : "",
        f.skipInfo ? esc(f.skipInfo) : "",
        f.note ? esc(f.note) : "",
      ].filter(Boolean).join(" · ");
      return `<article class="card" draggable="true" data-id="${f.id}">
        <div class="card-top"><b>${title}</b>${statusBadge(f)}
          <span class="spacer"></span>
          <button class="iconbtn" data-act="del" data-id="${f.id}" type="button" title="Rimuovi">✕</button>
        </div>${sub}
        ${meta ? `<div class="muted small">${meta}</div>` : ""}
        ${f.kind === "upload" && !ready && !f.reading ? `<div class="muted small">contenuto perso (ricarica pagina?) — trascina di nuovo la cartella.</div>` : ""}
      </article>`;
    }).join("");
  }
  $("count-folders").textContent = String(runnableFolders().length);
  paintCommands();

  box.querySelectorAll('[data-act="del"]').forEach((b) => {
    b.onclick = () => {
      payloads.delete(+b.dataset.id);
      removeFolder(+b.dataset.id);
      paintCards();
    };
  });
  // Riordino card via drag interno
  box.querySelectorAll(".card").forEach((card) => {
    card.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/x-card-id", card.dataset.id);
      e.dataTransfer.effectAllowed = "move";
    });
    card.addEventListener("dragover", (e) => {
      if ([...e.dataTransfer.types].includes("text/x-card-id")) {
        e.preventDefault();
        card.classList.add("is-target");
      }
    });
    card.addEventListener("dragleave", () => card.classList.remove("is-target"));
    card.addEventListener("drop", (e) => {
      const id = e.dataTransfer.getData("text/x-card-id");
      if (!id) return;
      e.preventDefault();
      const ids = state.folders.map((f) => String(f.id));
      const to = ids.indexOf(card.dataset.id);
      moveFolder(+id, to);
      paintCards();
    });
  });
}

/** Card che possono partire nell'analisi: path server, o upload con contenuto in memoria. */
function runnableFolders() {
  return state.folders.filter((f) => (f.kind === "path" && f.path) || (f.kind === "upload" && payloads.has(f.id)));
}

// Invio di una cartella: piccola -> inline in /api/run-upload,
// grande -> sessione a pezzi con UNA sola barra di avanzamento sulla card.
// Pezzi grandi (500 file / 12MB): 10.000 file = ~20 invii, non 50+.
// Oltre ~60MB di body il server risponde 413: restiamo ben sotto.
const INLINE_BYTES = 12 * 1024 * 1024;
const CHUNK_FILES = 500;
const CHUNK_BYTES = 12 * 1024 * 1024;

function splitChunks(files) {
  const out = [];
  let cur = [];
  let bytes = 0;
  for (const f of files) {
    const sz = f.content?.length || 0;
    if ((cur.length >= CHUNK_FILES || bytes + sz > CHUNK_BYTES) && cur.length) {
      out.push(cur);
      cur = [];
      bytes = 0;
    }
    // Un singolo file oltre il tetto viaggia da solo (il server lo accetta
    // finche il body resta sotto UPLOAD_MAX_BODY).
    cur.push(f);
    bytes += sz;
  }
  if (cur.length) out.push(cur);
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function postChunk(uploadId, chunk, label) {
  let last;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await apiUploadChunk(uploadId, chunk);
    } catch (e) {
      last = e;
      await sleep(800 * attempt);
    }
  }
  throw new Error(`invio ${label} fallito dopo 3 tentativi: ${last?.message || last}`);
}

async function prepareUpload(client, item, payload) {
  const bytes = payload.files.reduce((n, f) => n + (f.content?.length || 0), 0);
  if (bytes < INLINE_BYTES && payload.files.length <= 500) {
    return { name: payload.name, files: payload.files };
  }
  const st = await apiUploadStart(client, payload.name);
  if (!st.uploadId) throw new Error(st.log || "upload-start fallito");
  const chunks = splitChunks(payload.files);
  const total = payload.files.length;
  let sent = 0;
  for (let ci = 0; ci < chunks.length; ci++) {
    const r = await postChunk(st.uploadId, chunks[ci], `chunk ${ci + 1}/${chunks.length}`);
    if (!r.ok) throw new Error(r.log || "upload-chunk fallito");
    sent += chunks[ci].length;
    item.note = `invio ${sent}/${total} file… (chunk ${ci + 1}/${chunks.length})`;
    paintCards();
  }
  item.note = "";
  return { uploadId: st.uploadId };
}
async function collectDrop(item, source) {
  try {
    const p = await collectFolderPayload(source, (n) => {
      const it = byId(item.id);
      if (it) {
        it.reading = true;
        it.note = `lettura ${n} file…`;
        paintCards();
      }
    });
    if (!byId(item.id)) return; // card rimossa nel frattempo
    if (!p.files.length) {
      item.reading = false;
      item.note = "nessun file di testo leggibile (solo binari?)";
    } else {
      payloads.set(item.id, { name: item.dropName, files: p.files });
      item.reading = false;
      item.skipInfo = p.skipped ? `${p.skipped} binari scartati` : "";
      item.note = "";
    }
  } catch {
    if (byId(item.id)) {
      item.reading = false;
      item.note = "lettura fallita (permessi browser?)";
    }
  }
  save();
  paintCards();
}

// ---------- dropzone unica: drag&drop semplice OPPURE click ----------
// UN solo gesto: trascini cartelle/file qui sopra, oppure clicchi la zona
// e scegli dal PC (stesso selettore nativo del bottone). Niente due strade.

function addSources(found) {
  for (const d of found) {
    const item = addFolder({ kind: "upload", dropName: d.dropName, files: d.files, dirs: d.dirs, sample: d.sample, reading: true, note: "lettura 0 file…" });
    paintCards();
    collectDrop(item, d.source);
    toast(`«${d.dropName}»: lettura contenuti…`);
  }
}

function wireFolderDrop() {
  const dz = $("dropzone-folders");
  const on = (e) => { e.preventDefault(); dz.classList.add("is-over"); };
  dz.addEventListener("dragenter", on);
  dz.addEventListener("dragover", on);
  dz.addEventListener("dragleave", () => dz.classList.remove("is-over"));
  dz.addEventListener("drop", async (e) => {
    e.preventDefault();
    dz.classList.remove("is-over");
    let found = await readDroppedFolders(e.dataTransfer);
    if (!found.length && e.dataTransfer?.files?.length) {
      // Fallback browser senza entries (solo FileList): file sciolti.
      const list = [...e.dataTransfer.files];
      found = [{ dropName: "(file sciolti)", files: list.length, dirs: 0, sample: list.slice(0, 8).map((f) => f.name), source: { loose: list } }];
    }
    if (!found.length) {
      toast("niente da importare: trascina cartelle o file", "warn");
      return;
    }
    addSources(found);
    gotoStep("sources");
  });
  // Click = scegli dal PC (stessa strada del bottone: un solo gesto).
  dz.addEventListener("click", (e) => {
    if (e.target.closest("button")) return;
    pickNative();
  });
  dz.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pickNative(); }
  });
}

// ---------- aggiunta manuale / Sfoglia ----------

// ---------- selettore nativo: finestra Esplora risorse del PC ----------

async function pickNative() {
  if (typeof window.showDirectoryPicker === "function") {
    // Chrome/Edge: finestra di sistema, navigazione completa, cartelle ovunque.
    let handle;
    try {
      handle = await window.showDirectoryPicker();
    } catch (e) {
      if (e?.name !== "AbortError") toast(`selezione annullata (${e?.message || e})`, "warn");
      return;
    }
    const info = await inspectHandle(handle);
    const item = addFolder({
      kind: "upload", dropName: info.dropName,
      files: info.files, dirs: info.dirs, sample: info.sample, reading: true,
    });
    paintCards();
    toast(`«${info.dropName}»: lettura contenuti… (premi di nuovo per aggiungerne altre)`);
    collectDrop(item, { handle });
  } else {
    // Firefox/Safari: niente picker di sistema, fallback via input cartella.
    $("native-dir-input").click();
  }
}

function onNativeInput(fileList) {
  const files = [...fileList];
  if (!files.length) return;
  const groups = new Map();
  for (const f of files) {
    const rel = f.webkitRelativePath || f.name || "";
    const top = rel.split("/").filter(Boolean)[0] || "(file sciolti)";
    if (!groups.has(top)) groups.set(top, []);
    groups.get(top).push(f);
  }
  for (const [top, list] of groups) {
    const item = addFolder({
      kind: "upload", dropName: top, files: list.length, dirs: 0,
      sample: list.slice(0, 8).map((f) => f.webkitRelativePath || f.name),
      reading: true,
    });
    paintCards();
    collectDrop(item, { loose: list });
  }
  $("native-dir-input").value = ""; // riusabile per la stessa cartella
}

function wireManual() {
  $("btn-pick-native").onclick = pickNative;
  $("native-dir-input").onchange = (e) => onNativeInput(e.target.files);
  const fi = $("native-file-input");
  if (fi) fi.onchange = (e) => onNativeInput(e.target.files);
  $("btn-add-path").onclick = async () => {
    const v = $("manual-path").value.trim().replace(/^"|"$/g, "");
    if (!v) return;
    try {
      const d = await apiBrowse(v);
      if (d.error) {
        toast(`path non leggibile: ${d.error}`, "err");
        return;
      }
      if (hasPath(d.path || v)) {
        toast("cartella già in lista", "warn");
        return;
      }
      addFolder({ kind: "path", path: d.path || v, dropName: basename(d.path || v) });
      $("manual-path").value = "";
      paintCards();
      toast(`aggiunta: ${d.path || v}`);
    } catch (err) {
      toast(`backend non raggiungibile (${err.message || err})`, "err");
    }
  };
  $("manual-path").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("btn-add-path").click();
  });
  $("btn-browse-server").onclick = async () => {
    const picked = await openExplorer({ title: "Aggiungi cartella", startPath: "" });
    if (!picked) return;
    if (hasPath(picked)) {
      toast("cartella già in lista", "warn");
      return;
    }
    addFolder({ kind: "path", path: picked, dropName: basename(picked) });
    paintCards();
    toast(`aggiunta: ${picked}`);
  };
}

// ---------- analisi ----------

let runTimer = 0;

async function runAnalysis() {
  const stale = state.folders.filter((f) => f.kind === "upload" && !f.reading && !payloads.has(f.id));
  if (stale.length) {
    toast("contenuto perso per una card (ricarica pagina?) — ritrascina la cartella", "warn");
    gotoStep("sources");
    return;
  }
  const reading = state.folders.some((f) => f.reading);
  if (reading) {
    toast("aspetta la fine della lettura contenuti…", "warn");
    return;
  }
  const runnable = runnableFolders();
  if (!runnable.length) {
    toast("trascina almeno una cartella prima di analizzare", "warn");
    gotoStep("sources");
    return;
  }
  const health = await apiHealthDetail(3000);
  if (!health) {
    $("runlog").textContent =
      "backend offline: apri un terminale ed esegui `python server.py` dalla root del progetto, poi riprova.";
    $("run-status").textContent = "backend offline";
    toast("backend offline: avvia `python server.py`", "err");
    gotoStep("run");
    return;
  }
  if ((health.api || 0) < API_WANT) {
    $("runlog").textContent =
      `backend VECCHIO in ascolto (api ${health.api || "?"}): chiudi il vecchio server.py ` +
      "(Ctrl+C nel suo terminale, o chiudi quel terminale) e rilancia `npm run dev`, poi riprova.";
    $("run-status").textContent = "backend da riavviare";
    toast("backend vecchio: riavvia server.py", "err");
    gotoStep("run");
    return;
  }
  const btn = $("btn-run");
  btn.disabled = true;
  const t0 = performance.now();
  $("run-status").textContent = "analisi in corso…";
  clearInterval(runTimer);
  runTimer = setInterval(() => {
    $("run-status").textContent = `analisi in corso… ${((performance.now() - t0) / 1000).toFixed(0)}s`;
  }, 500);
  $("runlog").textContent = "analisi in corso…";
  gotoStep("run");
  try {
    const client = state.client || "clientone";
    const uploads = [];
    for (const f of runnable.filter((f) => f.kind === "upload")) {
      uploads.push(await prepareUpload(client, f, payloads.get(f.id)));
    }
    const paths = runnable.filter((f) => f.kind === "path").map((f) => f.path);
    const fast = !isFull();
    // Timeout anti-10k: scala coi file E con la modalità.
    // Veloce: base 30min + 1min/1000 file. Completa: base 30min +
    // 5min/1000 file (doc full per export), tetto 12h: senza limite di tempo.
    const nFiles = runnable
      .filter((f) => f.kind === "upload")
      .reduce((n, f) => n + ((payloads.get(f.id)?.files.length) || f.files || 0), 0);
    const perK = fast ? 60 : 300;
    const timeout_s = Math.min(43200, 1800 + Math.ceil(nFiles / 1000) * perK);
    $("run-status").textContent = `analisi in corso… (${nFiles} file, timeout ${Math.round(timeout_s / 60)}min)`;
    const d = await apiRunUpload(client, uploads, paths, { fast, timeout_s });
    $("runlog").textContent = d.log || "(log vuoto)";
    if (d.ok && isValidCrosslink(d.crosslink)) {
      state.crosslink = d.crosslink;
      showResults(d.crosslink);
      $("run-status").textContent = `completata in ${((performance.now() - t0) / 1000).toFixed(1)}s`;
      toast("analisi completata");
      gotoStep("results");
    } else {
      $("run-status").textContent = "fallita — vedi log";
      toast("analisi fallita, vedi log", "err");
    }
  } catch (e) {
    const msg = String(e.message || e);
    if (msg.includes("STALE_BACKEND")) {
      $("runlog").textContent =
        "backend VECCHIO in ascolto (ha risposto HTML invece di JSON): chiudi il vecchio " +
        "server.py (Ctrl+C nel suo terminale) e rilancia `npm run dev`, poi riprova.";
      $("run-status").textContent = "backend da riavviare";
      toast("backend vecchio: riavvia server.py", "err");
      return;
    }
    const online = await apiHealth(2000);
    $("runlog").textContent = online
      ? `connessione caduta durante l'analisi: guarda il terminale di server.py e riporta le ultime righe (errore: ${e.message || e})`
      : "backend offline: avvia `python server.py` dalla root del progetto e riprova.";
    $("run-status").textContent = "errore di rete";
    toast("errore di rete, vedi log", "err");
  } finally {
    clearInterval(runTimer);
    btn.disabled = false;
  }
}

function wireRun() {
  $("btn-run").onclick = runAnalysis;
  $("btn-copy-log").onclick = async () => {
    try {
      await navigator.clipboard.writeText($("runlog").textContent);
      toast("log copiato");
    } catch {
      toast("copia fallita (permessi browser)", "warn");
    }
  };
  $("btn-clear-log").onclick = () => {
    $("runlog").textContent = "nessuna analisi ancora.";
    $("run-status").textContent = "in attesa";
  };
}

// ---------- risultati ----------

let pairFilter = null;

function showResults(data) {
  renderSummary($("result-summary"), data);
  renderMatrix($("matrix"), data, (da, a) => {
    pairFilter = [da, a];
    paintEdges();
  });
  pairFilter = null;
  $("edge-search").value = "";
  paintEdges();
  $("count-edges").textContent = String((data.edges || []).length);
}

function paintEdges() {
  if (!state.crosslink) {
    $("edges").innerHTML = `<div class="muted pad">nessun risultato: lancia l'analisi o trascina un crosslink.json.</div>`;
    return;
  }
  renderEdges($("edges"), state.crosslink, {
    q: $("edge-search").value,
    grade: $("edge-filter").value,
    pair: pairFilter,
  });
}

function wireResults() {
  const dz = $("dropzone-crosslink");
  const on = (e) => { e.preventDefault(); dz.classList.add("is-over"); };
  dz.addEventListener("dragenter", on);
  dz.addEventListener("dragover", on);
  dz.addEventListener("dragleave", () => dz.classList.remove("is-over"));
  dz.addEventListener("drop", async (e) => {
    e.preventDefault();
    dz.classList.remove("is-over");
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (!f) return;
    try {
      const { data } = await readDroppedJson(f);
      if (!isValidCrosslink(data)) {
        toast("JSON valido ma non è un crosslink (mancano names/edges)", "err");
        return;
      }
      state.crosslink = data;
      showResults(data);
      toast(`visualizzato: ${data.names.length} cartelle, ${data.edges.length} connessioni`);
    } catch (err) {
      toast(err.message || String(err), "err");
    }
  });
  $("edge-search").oninput = debounce(paintEdges, 120);
  $("edge-filter").onchange = paintEdges;
  const btnZip = $("btn-download-zip");
  if (btnZip) {
    btnZip.onclick = async () => {
      // Il download naviga via href (niente JSON): un backend VECCHIO
      // risponderebbe con una pagina 404. Pre-check guidato, mai 404 muta.
      const h = await apiHealthDetail(3000);
      if (!h) {
        toast("backend offline: avvia `python server.py` dalla root", "err");
        return;
      }
      if ((h.api || 0) < API_WANT) {
        toast("backend VECCHIO: chiudi il vecchio server.py e rilancialo, poi riscarica", "err");
        return;
      }
      const client = state.client || "clientone";
      window.location.href = apiDownloadZipUrl(client);
      toast(`Download avviato: ${client}_documentazione.zip`);
    };
  }
}

// ---------- backend status ----------

async function refreshHealth() {
  const ok = await apiHealth();
  const pill = $("backend-status");
  pill.classList.toggle("is-off", !ok);
  pill.classList.toggle("is-on", ok);
  pill.textContent = ok ? "● backend online" : "● offline";
}

// ---------- init ----------

load();
$("client").value = state.client;
$("client").oninput = () => {
  state.client = $("client").value.trim() || "clientone";
  save();
  paintCommands();
};
$("stepbtn-sources").onclick = () => gotoStep("sources");
$("stepbtn-run").onclick = () => gotoStep("run");
$("stepbtn-results").onclick = () => gotoStep("results");
for (const id of ["opt-fast", "opt-full"]) {
  const r = $(id);
  if (r) r.onchange = paintCommands;
}

initExplorer();
wireFolderDrop();
wireManual();
wireRun();
wireResults();
paintCards();
paintEdges();
refreshHealth();
setInterval(refreshHealth, 20000);
