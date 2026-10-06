// matrix.js — matrice N×N + dettaglio connessioni da crosslink.json.
// Formato atteso: {names[], edges[{da, a, tipo, grado, prove[]}], ...}

import { esc, basename } from "./util.js";

export function gradeClass(grado) {
  const g = String(grado || "");
  if (g.includes("accertato")) return "b-ok";
  if (g.includes("probabile")) return "b-prob";
  if (g.includes("indizio")) return "b-hint";
  return "b-none";
}

export function gradeShort(grado) {
  const g = String(grado || "");
  if (g.includes("accertato")) return "✅";
  if (g.includes("probabile")) return "🔶";
  if (g.includes("indizio")) return "🔍";
  return "·";
}

export function isValidCrosslink(d) {
  return d && Array.isArray(d.names) && Array.isArray(d.edges);
}

export function renderSummary(el, data) {
  const edges = data.edges || [];
  const by = { accertato: 0, probabile: 0, indizio: 0 };
  for (const e of edges) {
    const g = String(e.grado || "");
    if (g.includes("accertato")) by.accertato += 1;
    else if (g.includes("probabile")) by.probabile += 1;
    else if (g.includes("indizio")) by.indizio += 1;
  }
  el.innerHTML =
    `<span class="chip">📁 ${(data.names || []).length} cartelle</span>` +
    `<span class="chip">🔗 ${edges.length} connessioni</span>` +
    `<span class="chip b-ok">✅ ${by.accertato} accertate</span>` +
    `<span class="chip b-prob">🔶 ${by.probabile} probabili</span>` +
    `<span class="chip b-hint">🔍 ${by.indizio} indizi</span>`;
}

/** Click su una cella con connessioni -> onPair(da, a) per filtrare il dettaglio. */
export function renderMatrix(el, data, onPair) {
  const names = data.names || [];
  const cell = new Map();
  for (const x of data.edges || []) {
    const k = x.da + "\0" + x.a;
    if (!cell.has(k)) cell.set(k, []);
    cell.get(k).push(x);
  }
  let h = `<table class="mx"><tr><th></th>${names.map((n) => `<th title="${esc(n)}">${esc(basename(n))}</th>`).join("")}</tr>`;
  for (const a of names) {
    h += `<tr><th title="${esc(a)}">${esc(basename(a))}</th>`;
    for (const b of names) {
      if (a === b) {
        h += `<td class="diag">—</td>`;
        continue;
      }
      const list = cell.get(a + "\0" + b) || [];
      if (!list.length) {
        h += `<td class="empty"><span class="b-none">nessuna evidenza</span></td>`;
      } else {
        h += `<td><button class="cellbtn" data-da="${esc(a)}" data-a="${esc(b)}" type="button">` +
          list.map((x) => `<span class="badge ${gradeClass(x.grado)}">${gradeShort(x.grado)} ${esc(x.tipo)}</span>`).join("") +
          `</button></td>`;
      }
    }
    h += `</tr>`;
  }
  el.innerHTML = h + `</table>`;
  el.querySelectorAll(".cellbtn").forEach((btn) => {
    btn.onclick = () => onPair && onPair(btn.dataset.da, btn.dataset.a);
  });
}

export function renderEdges(el, data, { q = "", grade = "", pair = null } = {}) {
  const needle = q.trim().toLowerCase();
  const rows = (data.edges || []).filter((x) => {
    if (grade && !String(x.grado || "").includes(grade)) return false;
    if (pair && !(x.da === pair[0] && x.a === pair[1])) return false;
    if (!needle) return true;
    return [x.da, x.a, x.tipo, x.grado, ...(x.prove || [])].join("\n").toLowerCase().includes(needle);
  });
  el.innerHTML =
    (pair ? `<div class="pairbar">coppia <b>${esc(basename(pair[0]))} → ${esc(basename(pair[1]))}</b> <button id="pair-clear" type="button" class="ghost">mostra tutte</button></div>` : "") +
    (rows.map((x) =>
      `<div class="edge"><div class="edge-head"><b>${esc(basename(x.da))} → ${esc(basename(x.a))}</b> ` +
      `<span class="badge ${gradeClass(x.grado)}">${gradeShort(x.grado)} ${esc(x.tipo)} · ${esc(x.grado)}</span></div>` +
      `<div class="prove">${(x.prove || []).map((p) => `<code>${esc(p)}</code>`).join("") || `<span class="muted">senza prove citate</span>`}</div></div>`,
    ).join("") || `<div class="muted pad">nessuna connessione con questi filtri.</div>`);
  const clear = document.getElementById("pair-clear");
  if (clear) clear.onclick = () => renderEdges(el, data, { q, grade, pair: null });
}
