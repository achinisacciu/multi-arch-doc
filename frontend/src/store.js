// store.js — stato locale + persistenza (localStorage, mai path remoti).
// Folder:
//   {kind: "upload"} = trascinata, contenuto letto nel browser (payload in memoria)
//   {kind: "path"}   = path già sul PC (repo enormi: niente upload)
//   {id, path|null, dropName, files, dirs, sample[], reading, skipInfo, note}

const KEY = "client-dossier-v2";
let seq = 1;

export const state = {
  client: "clientone",
  folders: [],
  crosslink: null,
};

export function save() {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ client: state.client, folders: state.folders }),
    );
  } catch {
    /* storage pieno o bloccato: si continua senza persistenza */
  }
}

export function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!d) return;
    state.client = typeof d.client === "string" && d.client.trim() ? d.client : "clientone";
    state.folders = (Array.isArray(d.folders) ? d.folders : []).map((f) => ({
      kind: "path",
      files: 0,
      dirs: 0,
      sample: [],
      reading: false,
      ...f,
    }));
    seq = state.folders.reduce((m, f) => Math.max(m, f.id || 0), 0) + 1;
  } catch {
    /* dati corrotti: si riparte puliti */
  }
}

export function addFolder(init = {}) {
  const item = {
    id: seq++,
    kind: "upload",
    path: null,
    dropName: "",
    files: 0,
    dirs: 0,
    sample: [],
    reading: false,
    skipInfo: "",
    note: "",
    ...init,
  };
  state.folders.push(item);
  save();
  return item;
}

export function removeFolder(id) {
  state.folders = state.folders.filter((f) => f.id !== id);
  save();
}

export function byId(id) {
  return state.folders.find((f) => f.id === id);
}

export function moveFolder(id, toIndex) {
  const from = state.folders.findIndex((f) => f.id === id);
  if (from < 0) return;
  const [it] = state.folders.splice(from, 1);
  state.folders.splice(Math.max(0, Math.min(toIndex, state.folders.length)), 0, it);
  save();
}

export function hasPath(path) {
  return state.folders.some((f) => f.path === path);
}

/** Solo i path collegati partono nell'analisi. */
export function resolvedPaths() {
  return state.folders.filter((f) => f.path).map((f) => f.path);
}
