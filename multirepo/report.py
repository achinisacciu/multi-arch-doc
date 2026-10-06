"""report.py — CLIENT-REPORT alto+tecnico da crosslink.json (F0, stdlib-only).

Il cliente e' parametrico (--client, default "clientone").
Per riusare su un altro cliente basta cambiare --client (e --crosslink):
  python multirepo/report.py --client clientone --crosslink dossier-clienti/clientone/crosslink.json
  python multirepo/report.py --client pippo --crosslink dossier-clienti/pippo/crosslink.json
"""
from __future__ import annotations

import argparse
import csv
import datetime
import io
import json
import os
import sys

DEFAULT_CLIENT = "clientone"
DEFAULT_OUTBASE = "dossier-clienti"


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Genera CLIENT-REPORT.md + CSV audit da crosslink.json.")
    p.add_argument("--client", default=DEFAULT_CLIENT, help="Nome cliente (default: clientone).")
    p.add_argument("--crosslink", default="", help="Path crosslink.json (default: <out>/<client>/crosslink.json).")
    p.add_argument("--out", default=DEFAULT_OUTBASE, help="Base output.")
    return p


def redact(s: str) -> str:
    # F0: redazione minima dimostrativa (host/credenziali mai in chiaro nel report uitvoer).
    # I valori DB grezzi restano solo in crosslink.json locale, mai nel .md se contengono 'pass|pwd|secret'.
    low = s.lower()
    if any(k in low for k in ("pass", "pwd", "secret", "token")):
        return "***redatto***"
    return s


def master_rows(per: dict) -> list:
    # Port minima di master-csv/run.py:extract_rows; progetto = nome cartella.
    # Solo valori SCHEMA.TABELLA (altri ignorati, come l'originale).
    rows = []
    for cart in per.get("cartelle", []):
        proj = cart.get("name", "")
        for exp in cart.get("odi_exports", []):
            for m in exp.get("mappings", []):
                for kind, vals in (("input", m.get("sources", [])), ("output", m.get("targets", []))):
                    for v in vals:
                        if isinstance(v, str) and "." in v:
                            schema, table = v.split(".", 1)
                            rows.append((proj, m.get("name", ""), schema, table, kind))
    return rows


def verifica_text(per: dict, rows: list) -> str:
    # Port minima di master-csv/verifica.py:generate_report.
    by_proj: dict = {}
    for proj, mapping, schema, table, kind in rows:
        d = by_proj.setdefault(proj, {"mappings": set(), "schemi": set(), "tabelle": set(),
                                      "source": 0, "target": 0})
        d["mappings"].add(mapping)
        d["schemi"].add(schema)
        d["tabelle"].add(table)
        d["source" if kind == "input" else "target"] += 1
    lines = ["VERIFICA MAPPING", f"cliente: {per.get('client', '')}",
             f"progetti: {len(by_proj)}", f"righe master: {len(rows)}", ""]
    for proj in sorted(by_proj):
        d = by_proj[proj]
        lines.append(f"{proj}: mapping={len(d['mappings'])} schemi={len(d['schemi'])} "
                     f"tabelle={len(d['tabelle'])} (source: {d['source']}, target: {d['target']})")
        for m in sorted(d["mappings"]):
            lines.append(f"  - {m}")
    if not by_proj:
        lines.append("nessun export ODI rilevato (per-cartella.json senza odi_exports)")
    return "\n".join(lines) + "\n"


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    client = (args.client or DEFAULT_CLIENT).strip() or DEFAULT_CLIENT
    outdir = os.path.join(args.out, client)
    os.makedirs(outdir, exist_ok=True)
    xlink_path = args.crosslink or os.path.join(outdir, "crosslink.json")
    if not os.path.exists(xlink_path):
        print(f"errore: manca {xlink_path} (esegui prima crosslink.py --client {client})", file=sys.stderr)
        return 2
    with open(xlink_path, encoding="utf-8") as fh:
        data = json.load(fh)
    names = data.get("names", [])
    edges = data.get("edges", [])

    header = "|  | " + " | ".join(names) + " |" if names else "|  | — |"
    sep = "|" + "|".join(["---"] * (len(names) + 1)) + "|" if names else "|---|---|"
    grouped: dict = {}
    for e in edges:
        grouped.setdefault((e["da"], e["a"]), []).append(f"{e['tipo']} {e['grado']}")
    rows = []
    for r in names:
        rows.append("| " + " | ".join(
            [r] + ["<br/>".join(grouped.get((r, c), ["(nessuna evidenza)" if r != c else "—"])) for c in names]) + " |")

    now = datetime.datetime.now().isoformat(timespec="seconds")
    per_path = os.path.join(outdir, "per-cartella.json")
    try:
        with open(per_path, encoding="utf-8") as fh:
            per = json.load(fh)
    except Exception:
        per = {"client": client, "cartelle": []}
    lp_lines = ["| Cartella | LoadPlan | Scenari |", "|---|---|---|"]
    for cart in per.get("cartelle", []):
        lps = ", ".join(sorted({n for lp in cart.get("lp_files", []) for n in lp.get("loadplan_names", [])}))
        if not lps:
            lps = ", ".join(f"`{os.path.basename(lp.get('file', ''))}`" for lp in cart.get("lp_files", [])) or "—"
        scens = ", ".join(sorted({s for sf in cart.get("scen_files", []) for s in sf.get("scen_names", [])})) or "—"
        lp_lines.append(f"| {cart.get('name', '')} | {lps} | {scens} |")
    if not per.get("cartelle"):
        lp_lines.append("(nessun LoadPlan/scenario rilevato — NON confermato)")
    mrows = master_rows(per)
    sec6_lines = ["| Tabella | Input | Output | Progetti |", "|---|---|---|---|"]
    agg: dict = {}
    for proj, _map, schema, table, kind in mrows:
        key = f"{schema}.{table}"
        d = agg.setdefault(key, {"i": 0, "o": 0, "p": set()})
        d["i" if kind == "input" else "o"] += 1
        d["p"].add(proj)
    for key in sorted(agg):
        d = agg[key]
        sec6_lines.append(f"| {key} | {d['i']} | {d['o']} | {', '.join(sorted(d['p']))} |")
    if not agg:
        sec6_lines.append("(nessun mapping con tabelle SCHEMA.TABELLA — NON confermato)")
    gloss_lines = ["| Termine | Tipo | Evidenza | Stato |", "|---|---|---|---|"]
    seen = 0
    for key in sorted(agg):
        if seen >= 20:
            break
        projs = sorted({p for p, _m, s, t, _k in mrows if f"{s}.{t}" == key})
        maps = sorted({m for p, m, s, t, _k in mrows if f"{s}.{t}" == key})
        gloss_lines.append(f"| {key} | tabella | {', '.join(maps)} ({', '.join(projs)}) | "
                           "rilevato (significato business da confermare) |")
        seen += 1
    for cart in per.get("cartelle", []):
        for exp in cart.get("odi_exports", []):
            for m in exp.get("mappings", []):
                if seen >= 20:
                    break
                gloss_lines.append(f"| {m.get('name', '')} | mapping ODI | {exp.get('file', '')} "
                                   f"({cart.get('name', '')}) | rilevato (significato business da confermare) |")
                seen += 1
        for sf in cart.get("scen_files", []):
            for s in sf.get("scen_names", []):
                if seen >= 20:
                    break
                gloss_lines.append(f"| {s} | scenario ODI | {sf.get('file', '')} "
                                   f"({cart.get('name', '')}) | rilevato (significato business da confermare) |")
                seen += 1
        for lp in cart.get("lp_files", []):
            for n in lp.get("loadplan_names", []):
                if seen >= 20:
                    break
                gloss_lines.append(f"| {n} | load plan ODI | {lp.get('file', '')} "
                                   f"({cart.get('name', '')}) | rilevato (significato business da confermare) |")
                seen += 1
    md = [
        f"# CLIENT-REPORT — {client}",
        "",
        f"_Generato: {now} · crosslink: `{xlink_path}` · F0 scaffold_",
        "",
        "## 1. Sintesi esecutiva (1 pagina)",
        f"Cliente `{client}`: {len(names)} repo analizzate ({', '.join(names) if names else '—'}).",
        "Dettaglio prove in §4. Celle vuote = nessuna evidenza (dubbio = NON confermato).",
        "",
        "## 2. Mappa ruoli",
        "| Cartella | Cosa è | Tecnologie / Prova |",
        "|---|---|---|",
    ]
    cart_map = {c.get("name"): c for c in per.get("cartelle", [])}
    for n in names:
        c = cart_map.get(n, {})
        role = c.get("role_description") or c.get("archetype") or "Componente Software"
        tech_list = ", ".join(c.get("tech", [])) or "NON confermato"
        md.append(f"| {n} | {role} | {tech_list} |")
    md += ["", "## 3. Matrice connessioni N×N", header, sep, *rows, "",
           "```mermaid", data.get("mermaid", "flowchart LR"), "```", "",
           "## 4. Dettaglio connessioni (prove citate)"]
    if not edges:
        md.append("(nessuna evidenza tra le cartelle)")
    for e in edges:
        md.append(f"### {e['da']} → {e['a']} — {e['tipo']} {e['grado']}")
        for p in e["prove"]:
            md.append(f"- `{redact(p)}`")
    tech_table = ["| Cartella | Stack / Linguaggi | N. File | Manifest Rilevati |",
                  "|---|---|---|---|"]
    for n in names:
        c = cart_map.get(n, {})
        tech_list = ", ".join(c.get("tech", [])) or "—"
        n_files = len(c.get("files", []))
        mans = ", ".join(c.get("manifests", {}).keys()) or "—"
        tech_table.append(f"| {n} | {tech_list} | {n_files} | {mans} |")
    md += ["",
           "## 5. Tecnologie/linguaggi",
           *tech_table,
           "## 6. Dati & trasformazioni (tabelle da master_csv, dettaglio in `mapping_sources_targets.json`)",
           *sec6_lines,
           "",
           "Dove risiede cosa (schemi, colonne, repo, `file:riga`, chi scrive/legge): "
           "dossier `02_Sviluppo_DevOps_e_Database/09_INDICE_DB.md` + `09_INVENTARIO_DB.csv`.",
           "## 7. Flussi & processi (LoadPlan, BPMN/BPEL/Mediator)",
           *lp_lines,
           "## 8. Servizi condivisi & rischi",
           "- Versioni divergenti, segreti redatti, duplicati SHA-256: vedi §4.",
           "## 9. Glossario (deriva dalle evidenze; il significato business va confermato a mano)",
           *gloss_lines,
           "## 10. Limiti & da verificare a mano",
           "- Porte in ascolto e DB raggiungibili non si provano leggendo file → max 🔶.",
           "- Import dinamici/reflection/service-discovery → non verificati.",
           "## 11. Appendice per-cartella — _link ai dossier singoli (F1)_",
           ""]
    dest_md = os.path.join(outdir, "CLIENT-REPORT.md")
    with open(dest_md, "w", encoding="utf-8") as fh:
        fh.write("\n".join(md))

    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(["da", "a", "tipo", "grado", "prove"])
    for e in edges:
        w.writerow([e["da"], e["a"], e["tipo"], e["grado"], " | ".join(e["prove"])])
    dest_csv = os.path.join(outdir, "crosslink_rules.csv")
    with open(dest_csv, "w", encoding="utf-8-sig", newline="") as fh:
        fh.write(buf.getvalue())

    # per-cartella.json e mrows gia calcolati sopra (servono a master + verifica).
    dest_master = os.path.join(outdir, "master_csv_input_output.csv")
    with open(dest_master, "w", encoding="utf-8-sig", newline="") as fh:
        mw = csv.writer(fh, lineterminator="\n")
        mw.writerow(["progetto", "mapping", "schema", "table", "tipo"])
        mw.writerows(mrows)
    dest_ver = os.path.join(outdir, "verifica_mapping.txt")
    with open(dest_ver, "w", encoding="utf-8") as fh:
        fh.write(verifica_text(per, mrows))

    try:
        try:
            from multirepo.doc_packager import package_documentation
        except ImportError:
            # Esecuzione come script (python multirepo/report.py): sys.path[0]
            # e' multirepo/, il top-level package non e' importabile.
            from doc_packager import package_documentation
        zip_path = package_documentation(client, args.out)
        print(f"ok: client '{client}' -> {dest_md} + {dest_csv} + {dest_master} + {dest_ver} + {zip_path}")
    except Exception as e:
        print(f"ok: client '{client}' -> {dest_md} + {dest_csv} + {dest_master} + {dest_ver} (zip packaging notice: {e})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
