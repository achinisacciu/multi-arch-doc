// explorer.js — finestra "Sfoglia sul server": esplora le cartelle del PC
// dove gira server.py (breadcrumbs, filtro, doppio click per entrare).
// Uso: openExplorer({title, forName, startPath}) -> Promise<path|null>.

import { apiBrowse } from "./api.js";
import { esc, basename, debounce } from "./util.js";

const $ = (id) => document.getElementById(id);

let current = "";
let resolvePick = null;
let allDirs = [];

function crumbs(path) {
  if (!path) return `<span class="crumb">(radici)</span>`;
  const parts = String(path).split(/[\\/]/).filter(Boolean);
  let acc = /^[A-Za-z]:$/.test(parts[0] || "") ? parts[0] + "\\" : "";
  let h = `<button class="crumb" data-p="" type="button">radici</button>`;
  parts.forEach((p, i) => {
    acc = i === 0 && acc ? acc : acc ? acc + "\\" + p : p;
    h += ` <span class="sep">›</span> <button class="crumb" data-p="${esc(acc)}" type="button">${esc(p)}</button>`;
  });
  return h;
}

function paintList(filter) {
  const q = (filter || "").toLowerCase();
  const rows = allDirs.filter((d) => d.toLowerCase().includes(q));
  $("explorer-list").innerHTML =
    rows.map((d) => `<button class="exp-row" data-d="${esc(d)}" type="button" title="doppio click per entrare">📁 ${esc(d)}</button>`).join("") ||
    `<div class="muted pad">nessuna sottocartella${q ? ` per «${esc(filter)}»` : ""}.</div>`;
  document.querySelectorAll(".exp-row").forEach((b) => {
    b.onclick = () => {
      document.querySelectorAll(".exp-row").forEach((x) => x.classList.remove("is-sel"));
      b.classList.add("is-sel");
    };
    b.ondblclick = () => load(join(current, b.dataset.d));
  });
}

function join(cur, name) {
  if (!cur) return name; // radice tipo "C:\" o home già assoluta
  return cur.endsWith("\\") || cur.endsWith("/") ? cur + name : cur + "\\" + name;
}

async function load(path) {
  $("explorer-list").innerHTML = `<div class="muted pad">caricamento…</div>`;
  try {
    const d = await apiBrowse(path || "");
    current = d.path ?? path ?? "";
    allDirs = d.dirs || [];
    $("explorer-crumbs").innerHTML = crumbs(d.path);
    $("explorer-cur").textContent = d.path || "(radici)";
    $("explorer-cur").title = d.path || "";
    if (d.error) $("explorer-list").innerHTML = `<div class="err pad">⚠ ${esc(d.error)}</div>`;
    else paintList($("explorer-search").value);
    document.querySelectorAll("#explorer-crumbs .crumb[data-p]").forEach((b) => {
      b.onclick = () => load(b.dataset.p);
    });
  } catch (e) {
    $("explorer-list").innerHTML = `<div class="err pad">⚠ backend non raggiungibile: ${esc(e.message || e)} (server.py avviato?)</div>`;
  }
}

export function openExplorer({ title, forName, startPath } = {}) {
  $("explorer-title").textContent = title || "Sfoglia cartelle";
  $("explorer-for").textContent = forName ? `per «${forName}»` : "(sul PC del server)";
  $("explorer-search").value = "";
  $("explorer").hidden = false;
  load(startPath || "");
  return new Promise((resolve) => {
    resolvePick = resolve;
  });
}

function close(value) {
  $("explorer").hidden = true;
  if (resolvePick) {
    const r = resolvePick;
    resolvePick = null;
    r(value);
  }
}

export function initExplorer() {
  $("explorer-close").onclick = () => close(null);
  $("explorer-pick").onclick = () => close(current || null);
  $("explorer-up").onclick = async () => {
    if (!current) return;
    try {
      const d = await apiBrowse(current);
      load(d.parent && d.path ? d.parent : "");
    } catch {
      load("");
    }
  };
  $("explorer-search").oninput = debounce((e) => paintList(e.target.value), 120);
  $("explorer").addEventListener("mousedown", (e) => {
    if (e.target === $("explorer")) close(null);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("explorer").hidden) close(null);
  });
}

export { basename };
