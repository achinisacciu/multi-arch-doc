// util.js — helper condivisi (niente dipendenze).

export const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]),
  );

export const basename = (p) => String(p || "").split(/[\\/]/).filter(Boolean).pop() || String(p || "");

export const debounce = (fn, ms = 150) => {
  let t = 0;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};
