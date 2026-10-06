"""crosslink.py — motore connessioni N×N (F0, stdlib-only). Vedi report.py per il report."""
from __future__ import annotations

import argparse
import datetime
import hashlib
import json
import os
import re
import subprocess
import sys

DEFAULT_CLIENT = "clientone"
DEFAULT_OUTBASE = "dossier-clienti"

DB_RE = re.compile(r"(?i)\b(db[\w.-]*host|db[\w.-]*name|database|dbname)\s*[:=]\s*([A-Za-z0-9_.\-]+)")
COMPOSE_NAMES = {"docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"}
MAX_READ = 200_000
# Anti-timeout 10.000 XML: tetto testi tenuti in memoria per repo (oltre si
# campionano i primi, con flag onesto). 10k XML passano interi.
MAX_TEXT_FILES = 25_000


def import_pattern(other: str) -> "re.Pattern[str]":
    # Solo veri import (non bare mention in docstring): import/from/require/include
    # che citano la sorella, oppure path relativo ../<sorella>.
    # A3.1: '-'/'_'/'.' equivalenti (repo-b == repo_b: hyphen illegale nei package).
    flex = "".join(r"[-_.]" if c in "-_." else re.escape(c) for c in other)
    return re.compile(
        r"(?i)(import\s+[^\n]*{n}|from\s+[^\n]*{n}|require\s*[^\n]*{n}|"
        r"include\s*[^\n]*{n}|\.\./{n}\b)".format(n=flex)
    )


def read_text(path: str) -> str | None:
    try:
        if os.path.getsize(path) > MAX_READ:
            return None
        with open(path, "r", encoding="utf-8", errors="strict") as fh:
            return fh.read()
    except Exception:
        return None


def sha256_file(path: str) -> str | None:
    try:
        h = hashlib.sha256()
        with open(path, "rb") as fh:
            for chunk in iter(lambda: fh.read(65536), b""):
                h.update(chunk)
        return h.hexdigest()
    except Exception:
        return None


def scan_folder(root: str) -> dict:
    files: list[str] = []
    texts: dict[str, str] = {}
    hashes: dict[str, str] = {}
    truncated = False
    n = 0
    for dirpath, dirs, names in os.walk(root):
        dirs[:] = [d for d in dirs if d not in {".git", ".svn", ".hg", "__pycache__", ".pytest_cache", ".ruff_cache", "node_modules", ".idea", ".vscode"}]
        for nm in names:
            fp = os.path.join(dirpath, nm)
            rel = os.path.relpath(fp, root)
            files.append(rel)
            n += 1
            if n % 2000 == 0:
                print(f"[{os.path.basename(os.path.abspath(root))}] crosslink scan: {n} file…", flush=True)
            t = read_text(fp)
            if t is not None:
                if len(texts) < MAX_TEXT_FILES:
                    texts[rel] = t
                else:
                    truncated = True
            hh = sha256_file(fp)
            if hh:
                hashes[rel] = hh
    if truncated:
        print(f"[{os.path.basename(os.path.abspath(root))}] ATTENZIONE: oltre {MAX_TEXT_FILES} testi, "
              "crosslink campiona i primi (flag truncated).", flush=True)
    return {"root": os.path.abspath(root), "name": os.path.basename(os.path.abspath(root)),
            "files": files, "texts": texts, "hashes": hashes, "truncated": truncated}


def git_info(root: str) -> dict:
    try:
        top = subprocess.run(["git", "-C", root, "rev-parse", "--show-toplevel"],
                             capture_output=True, text=True, timeout=5)
        rem = subprocess.run(["git", "-C", root, "remote", "-v"],
                             capture_output=True, text=True, timeout=5)
        if top.returncode == 0:
            return {"top": top.stdout.strip(), "remote": rem.stdout.strip() if rem.returncode == 0 else ""}
    except Exception:
        pass
    return {"top": "", "remote": ""}


def detect(folders: list[str], ignore_git: bool = False,
           db_resources: list | None = None) -> dict:
    scanned = {f: scan_folder(f) for f in folders}
    names = [scanned[f]["name"] for f in folders]
    edges: list[dict] = []

    def add(da: str, a: str, tipo: str, grado: str, prove: list[str]):
        if da == a:
            return
        for e in edges:
            if (e["da"], e["a"], e["tipo"]) == (da, a, tipo):
                for p in prove:
                    if p not in e["prove"]:
                        e["prove"].append(p)
                return
        edges.append({"da": da, "a": a, "tipo": tipo, "grado": grado, "prove": prove})

    # S1: stesso repo git. I2.6: scatta solo se il top E' una delle cartelle;
    # se e' un antenato comune (monorepo, fixture nel repo contenitore) si tace.
    def _norm(p: str) -> str:
        return os.path.normcase(os.path.normpath(p)) if p else ""
    gits = {f: ({"top": "", "remote": ""} if ignore_git else git_info(f)) for f in folders}
    for i in range(len(folders)):
        for j in range(i + 1, len(folders)):
            gi, gj = gits[folders[i]], gits[folders[j]]
            ni, nj = names[i], names[j]
            if gi["top"] and _norm(gi["top"]) == _norm(gj["top"]) and (
                    _norm(gi["top"]) == _norm(scanned[folders[i]]["root"])
                    or _norm(gi["top"]) == _norm(scanned[folders[j]]["root"])):
                add(ni, nj, "stesso-repo-git", "✅ accertato",
                    [f"{ni}: git top={gi['top']}", f"{nj}: git top={gj['top']}"])
            elif gi["remote"] and gi["remote"] == gj["remote"]:
                add(ni, nj, "stesso-remote-git", "✅ accertato", [f"{ni}: remote uguale", f"{nj}: remote uguale"])

    # Pattern import precompilati UNA volta (non per-file: con 10k file
    # la compilazione per (file × cartella) da sola andava in timeout).
    pats = {other: import_pattern(other) for other in names}
    for f in folders:
        me = scanned[f]["name"]
        for rel, text in scanned[f]["texts"].items():
            if os.path.basename(rel) in COMPOSE_NAMES:
                continue  # compose = S5, non S3
            for other in names:
                if other == me:
                    continue
                m = pats[other].search(text)
                if m:
                    line = text[:m.start()].count("\n") + 1
                    add(me, other, "import-cross-cartella", "✅ accertato", [f"{me}/{rel}:{line}"])

    for f in folders:
        me = scanned[f]["name"]
        for rel in scanned[f]["files"]:
            if os.path.basename(rel) in COMPOSE_NAMES and rel in scanned[f]["texts"]:
                text = scanned[f]["texts"][rel]
                for other in [n for n in names if n != me and n in text]:
                    ln = text[:text.index(other)].count("\n") + 1
                    add(me, other, "compose-multi-servizio", "✅ accertato", [f"{me}/{rel}:{ln}"])

    db_by_folder: dict[str, set[str]] = {}
    db_proof: dict[str, dict[str, str]] = {}
    for f in folders:
        me = scanned[f]["name"]
        vals: set[str] = set()
        for rel, text in scanned[f]["texts"].items():
            for m in DB_RE.finditer(text):
                v = m.group(2).strip().lower()
                vals.add(v)
                line = text[:m.start()].count("\n") + 1
                db_proof.setdefault(me, {}).setdefault(v, f"{me}/{rel}:{line}")
        db_by_folder[me] = vals
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            for v in sorted(db_by_folder[names[i]] & db_by_folder[names[j]]):
                add(names[i], names[j], "db-condiviso", "🔶 probabile",
                    [db_proof[names[i]][v], db_proof[names[j]][v]])

    hash_owner: dict[str, list[tuple[str, str]]] = {}
    for f in folders:
        me = scanned[f]["name"]
        for rel, hh in scanned[f]["hashes"].items():
            hash_owner.setdefault(hh, []).append((me, rel))
    for hh, owners in hash_owner.items():
        uniq = sorted({m for m, _ in owners})
        for i in range(len(uniq)):
            for j in range(i + 1, len(uniq)):
                prove = [f"{m}/{r} sha256:{hh[:12]}" for m, r in owners if m in (uniq[i], uniq[j])]
                add(uniq[i], uniq[j], "file-identico", "✅ accertato", prove)

    # S9: orchestrazione condivisa — stesso ScenName in XML di >=2 cartelle.
    # ponytail: regex su Field ScenName; upgrade: OdiLoadPlanParser.to_dict se serve.
    scen_re = re.compile(r'<Field\s+name="ScenName"\s*>([^<]+)</Field>')
    scen_by_folder: dict[str, dict[str, str]] = {}
    for f in folders:
        me = scanned[f]["name"]
        scen_by_folder[me] = {}
        for rel, text in scanned[f]["texts"].items():
            if not rel.lower().endswith(".xml"):
                continue
            for m in scen_re.finditer(text):
                v = m.group(1).strip()
                if v:
                    line = text[: m.start()].count("\n") + 1
                    scen_by_folder[me].setdefault(v, f"{me}/{rel}:{line} (ScenName={v})")
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            for v in sorted(set(scen_by_folder[names[i]]) & set(scen_by_folder[names[j]])):
                add(names[i], names[j], "orchestrazione-condivisa", "🔶 probabile",
                    [scen_by_folder[names[i]][v], scen_by_folder[names[j]][v]])

    # S2: dipendenze condivise — stesso package in requirements.txt/package.json.
    # ponytail: naive requirements+package.json; upgrade: pom.xml/gradle/package-lock se serve.
    dep_re = re.compile(r"^\s*([A-Za-z0-9_.\-]+)")
    deps_by_folder: dict[str, dict[str, str]] = {}
    for f in folders:
        me = scanned[f]["name"]
        deps_by_folder[me] = {}
        for rel, text in scanned[f]["texts"].items():
            base = os.path.basename(rel)
            if base == "package.json":
                try:
                    pj = json.loads(text)
                except Exception:
                    continue
                for section in ("dependencies", "devDependencies"):
                    for k, v in ((pj.get(section) or {}).items()):
                        deps_by_folder[me].setdefault(
                            str(k).lower(), f"{me}/{rel} {k}@{v}")
            elif base == "requirements.txt" or (base.startswith("requirements") and base.endswith(".txt")):
                for i, line in enumerate(text.splitlines(), 1):
                    s = line.strip()
                    if not s or s.startswith("#") or s.startswith("-"):
                        continue
                    m = dep_re.match(s)
                    if m:
                        dep = m.group(1).lower()
                        ver = s[m.end():].strip(" ;") or "(qualsiasi)"
                        deps_by_folder[me].setdefault(dep, f"{me}/{rel}:{i} {dep}{ver}")
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            for dep in sorted(set(deps_by_folder[names[i]]) & set(deps_by_folder[names[j]])):
                pi, pj = deps_by_folder[names[i]][dep], deps_by_folder[names[j]][dep]
                prove = [pi, pj]
                if pi != pj:
                    prove.append("⚠ versioni divergenti (rischio)")
                add(names[i], names[j], "dipendenza-condivisa", "🔶 probabile", prove)

    # S4: chiamate rete — URL con porta di A = porta dichiarata da B (max 🔶:
    # la porta in ascolto non si verifica leggendo file).
    # ponytail: match su porta; upgrade: match host+porta e dial-check se serve.
    port_decl_re = re.compile(r"(?im)^\s*(server\.port|port)\s*[:=]\s*(\d{2,5})\s*$")
    url_port_re = re.compile(r"https?://[^\s/:]+:(\d{2,5})(?!\d)")
    decl: dict[str, dict[str, str]] = {}
    refs: dict[str, dict[str, str]] = {}
    for f in folders:
        me = scanned[f]["name"]
        decl[me], refs[me] = {}, {}
        for rel, text in scanned[f]["texts"].items():
            for m in port_decl_re.finditer(text):
                line = text[: m.start()].count("\n") + 1
                decl[me].setdefault(m.group(2), f"{me}/{rel}:{line} dichiara porta {m.group(2)}")
            for m in url_port_re.finditer(text):
                line = text[: m.start()].count("\n") + 1
                refs[me].setdefault(m.group(1), f"{me}/{rel}:{line} chiama porta {m.group(1)}")
    for i in range(len(names)):
        for j in range(len(names)):
            if i == j:
                continue
            for port in sorted(set(refs[names[i]]) & set(decl[names[j]])):
                add(names[i], names[j], "chiamate-rete", "🔶 probabile",
                    [refs[names[i]][port], decl[names[j]][port],
                     "porta in ascolto non verificata (max 🔶)"])

    # S7: entita condivise — stesso token SCHEMA.TABELLA maiuscolo in >=2 cartelle.
    # ponytail: euristica maiuscole; upgrade: extractSqlTables JCA / OdiMappingParser se serve.
    ent_re = re.compile(r"\b([A-Z][A-Z0-9_]{2,}\.[A-Z][A-Z0-9_]{2,})\b")
    ent_by_folder: dict[str, dict[str, str]] = {}
    for f in folders:
        me = scanned[f]["name"]
        ent_by_folder[me] = {}
        for rel, text in scanned[f]["texts"].items():
            for m in ent_re.finditer(text):
                v = m.group(1)
                line = text[: m.start()].count("\n") + 1
                ent_by_folder[me].setdefault(v, f"{me}/{rel}:{line} ({v})")
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            for v in sorted(set(ent_by_folder[names[i]]) & set(ent_by_folder[names[j]])):
                add(names[i], names[j], "entita-condivise", "🔍 indizio",
                    [ent_by_folder[names[i]][v], ent_by_folder[names[j]][v]])

    # S10: risorsa DB condivisa — stessa SCHEMA.risorsa (table/view/trigger
    # da db_inventory di collect) definita/usata in >=2 repo → dati condivisi.
    by_res: dict[tuple, dict[str, str]] = {}
    for r in db_resources or []:
        if r.get("kind") not in ("table", "view", "trigger"):
            continue
        key = ((r.get("schema") or "").upper(), str(r.get("name", "")).upper(),
               r.get("kind"))
        qn = f"{r.get('schema') + '.' if r.get('schema') else ''}{r.get('name')}"
        proof = (f"{r.get('repo')}/{r.get('file')}:{r.get('line', 0)} "
                 f"({r.get('kind')} {qn})")
        by_res.setdefault(key, {}).setdefault(str(r.get("repo", "")), proof)
    for key in sorted(by_res):
        owners = sorted(by_res[key])
        for i in range(len(owners)):
            for j in range(i + 1, len(owners)):
                add(owners[i], owners[j], "risorsa-db-condivisa",
                    "🔶 probabile", [by_res[key][owners[i]],
                                     by_res[key][owners[j]]])

    return {"names": names, "edges": edges}


def sanitize_mermaid(s: str) -> str:
    # I2.7: nomi/cartelle con []{}"|#<> rompono il diagramma (lezione JCA C-10).
    return re.sub(r'["\[\]{}|#<>]', "_", s).replace("\n", " ")


def mermaid_md(names: list[str], edges: list[dict]) -> str:
    # I2.7: flowchart inter-cartella; id stabili N<i>, label sanificate.
    ids = {n: f"N{i}" for i, n in enumerate(names)}
    lines = ["flowchart LR"]
    for n in names:
        lines.append(f'    {ids[n]}["{sanitize_mermaid(n)}"]')
    for e in edges:
        label = sanitize_mermaid(f"{e['tipo']} {e['grado']}")
        lines.append(f"    {ids[e['da']]} -->|{label}| {ids[e['a']]}")
    return "\n".join(lines)


def matrix_md(names: list[str], edges: list[dict]) -> str:
    grouped: dict[tuple[str, str], list[str]] = {}
    for e in edges:
        grouped.setdefault((e["da"], e["a"]), []).append(f"{e['tipo']} {e['grado']}")
    lines = ["|  | " + " | ".join(names) + " |",
             "|" + "|".join(["---"] * (len(names) + 1)) + "|"]
    for r in names:
        row = [r] + ["<br/>".join(grouped.get((r, c), ["(nessuna evidenza)" if r != c else "—"])) for c in names]
        lines.append("| " + " | ".join(row) + " |")
    return "\n".join(lines)


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Crosslink N×N su fixture o cartelle reali (F0).")
    p.add_argument("folders", nargs="*", help="Cartelle da confrontare.")
    p.add_argument("--client", default=DEFAULT_CLIENT,
                   help=f"Nome cliente (default: {DEFAULT_CLIENT}). Solo per output/intestazioni.")
    p.add_argument("--out", default=DEFAULT_OUTBASE, help="Base output.")
    p.add_argument("--ignore-git", action="store_true",
                   help="Forza skip S1 (regola I2.6 ignora gia i repo contenitore).")
    return p


def safe_print(s: str) -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    try:
        print(s)
    except UnicodeEncodeError:
        print(s.encode("ascii", "replace").decode())


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    if not args.folders:
        print("errore: indica almeno 2 cartelle", file=sys.stderr)
        return 2
    client = (args.client or DEFAULT_CLIENT).strip() or DEFAULT_CLIENT
    outdir = os.path.join(args.out, client)
    os.makedirs(outdir, exist_ok=True)
    # S10: inventario DB da collect (se la pipeline ha gia girato).
    db_resources: list = []
    try:
        with open(os.path.join(outdir, "per-cartella.json"),
                  encoding="utf-8") as fh:
            per = json.load(fh)
        for cart in per.get("cartelle", []):
            db_resources.extend(cart.get("db_inventory", []))
    except Exception:
        pass
    res = detect(args.folders, ignore_git=args.ignore_git,
                 db_resources=db_resources)
    payload = {"client": client,
               "created": datetime.datetime.now().isoformat(timespec="seconds"),
               "folders": [os.path.abspath(f) for f in args.folders],
               **res,
               "mermaid": mermaid_md(res["names"], res["edges"])}
    dest = os.path.join(outdir, "crosslink.json")
    with open(dest, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, ensure_ascii=False)
    safe_print(f"ok: client '{client}' -> {dest} ({len(res['edges'])} archi)")
    safe_print(matrix_md(res["names"], res["edges"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
