"""db_inventory.py — inventario risorse DB da tutte le tecnologie (stdlib-only).

Per ogni repo estrae:
- file .sql/.pls/.pkb/.ddl: DDL (CREATE TABLE con colonne+tipi, VIEW, TRIGGER
  con tabella target ed evento, PROCEDURE/FUNCTION/PACKAGE, INDEX, SEQUENCE),
- adapter .jca: tabelle referenziate dagli SQL + tipo statement (port del
  `jcaParser.ts`: extractSqlTables / detectSqlType / extractSqlParameters),
- export ODI: sources/targets SCHEMA.TABELLA dei mapping.

Record: {repo, file, line, schema, name, kind, columns[], detail, source} con
kind in table|view|trigger|procedure|function|package|index|sequence|table_ref.
Ogni risorsa cita file:riga (dubbio = assente, mai inventato).
"""
from __future__ import annotations

import os
import re

DDL_EXTS = (".sql", ".pls", ".pkb", ".pks", ".ddl")
MAX_SQL_BYTES = 5_000_000

_WS = r"\s+"
_IDENT = r"(?:\"[^\"]+\"|`[^`]+`|\[[^\]]+\]|[A-Za-z_][\w$#]*)"
_QNAME = rf"(?P<qname>{_IDENT}(?:\s*\.\s*{_IDENT})?)"

RE_TABLE = re.compile(
    rf"CREATE{_WS}(?:OR{_WS}REPLACE{_WS})?(?:GLOBAL{_WS}TEMPORARY{_WS})?TABLE"
    rf"{_WS}(?:IF{_WS}NOT{_WS}EXISTS{_WS})?{_QNAME}", re.IGNORECASE)
RE_VIEW = re.compile(
    rf"CREATE{_WS}(?:OR{_WS}REPLACE{_WS})?(?:MATERIALIZED{_WS})?VIEW"
    rf"{_WS}(?:IF{_WS}NOT{_WS}EXISTS{_WS})?{_QNAME}"
    rf"(?:{_WS}\((?P<cols>[^;]{{1,2000}}?)\))?{_WS}AS{_WS}", re.IGNORECASE | re.DOTALL)
RE_TRIGGER = re.compile(
    rf"CREATE{_WS}(?:OR{_WS}REPLACE{_WS})?TRIGGER{_WS}(?:IF{_WS}NOT{_WS}EXISTS{_WS})?"
    rf"{_QNAME}{_WS}(?P<timing>BEFORE|AFTER|INSTEAD{_WS}OF){_WS}"
    rf"(?P<event>(?:INSERT|UPDATE|DELETE)(?:{_WS}OR{_WS}(?:INSERT|UPDATE|DELETE))*)"
    rf"{_WS}ON{_WS}(?P<target>{_IDENT}(?:\s*\.\s*{_IDENT})?)",
    re.IGNORECASE | re.DOTALL)
RE_PROC = re.compile(
    rf"CREATE{_WS}(?:OR{_WS}REPLACE{_WS})?(?:EDITIONABLE{_WS}|NONEDITIONABLE{_WS})?"
    rf"(?P<kind>PROCEDURE|FUNCTION|PACKAGE(?:{_WS}BODY)?){_WS}{_QNAME}",
    re.IGNORECASE)
RE_INDEX = re.compile(
    rf"CREATE{_WS}(?:UNIQUE{_WS})?INDEX{_WS}(?:IF{_WS}NOT{_WS}EXISTS{_WS})?"
    rf"{_QNAME}{_WS}ON{_WS}(?P<target>{_IDENT}(?:\s*\.\s*{_IDENT})?)",
    re.IGNORECASE | re.DOTALL)
RE_SEQUENCE = re.compile(
    rf"CREATE{_WS}(?:OR{_WS}REPLACE{_WS})?SEQUENCE{_WS}"
    rf"(?:IF{_WS}NOT{_WS}EXISTS{_WS})?{_QNAME}", re.IGNORECASE)

_COL_SKIP = ("constraint", "primary", "foreign", "unique", "check", "key",
             "like", "period", "supplemental")


def clean_ident(s: str) -> str:
    return s.strip().strip('"').strip("`").strip("[]").strip()


def split_schema(qname: str) -> tuple[str, str]:
    parts = [clean_ident(p) for p in re.split(r"\s*\.\s*", qname.strip())]
    parts = [p for p in parts if p]
    if len(parts) >= 2:
        return parts[-2], parts[-1]
    return "", parts[-1] if parts else ""


def strip_sql_comments(text: str) -> str:
    out: list[str] = []
    i, n = 0, len(text)
    quote = ""
    while i < n:
        c = text[i]
        nxt = text[i + 1] if i + 1 < n else ""
        if quote:
            out.append(c)
            if c == quote and text[i - 1] != "\\":
                quote = ""
            i += 1
        elif c in ("'", '"'):
            quote = c
            out.append(c)
            i += 1
        elif c == "-" and nxt == "-":
            while i < n and text[i] != "\n":
                out.append(" ")  # preserva offset/righe: commento -> spazi
                i += 1
        elif c == "/" and nxt == "*":
            out.append("  ")
            i += 2
            while i + 1 < n and not (text[i] == "*" and text[i + 1] == "/"):
                out.append("\n" if text[i] == "\n" else " ")
                i += 1
            out.append("  ")
            i += 2
        else:
            out.append(c)
            i += 1
    return "".join(out)


def split_top_commas(body: str) -> list[str]:
    parts, depth, quote, cur = [], 0, "", []
    for i, c in enumerate(body):
        if quote:
            cur.append(c)
            if c == quote and body[i - 1] != "\\":
                quote = ""
        elif c in ("'", '"'):
            quote = c
            cur.append(c)
        elif c == "(":
            depth += 1
            cur.append(c)
        elif c == ")":
            depth = max(0, depth - 1)
            cur.append(c)
        elif c == "," and depth == 0:
            parts.append("".join(cur))
            cur = []
        else:
            cur.append(c)
    tail = "".join(cur).strip()
    if tail:
        parts.append(tail)
    return parts


def parse_columns(body: str) -> list[str]:
    cols = []
    for item in split_top_commas(body):
        t = item.strip()
        if not t or t.lower().split(None, 1)[0].rstrip("(") in _COL_SKIP:
            continue
        toks = t.split()
        if not toks:
            continue
        name = clean_ident(toks[0].rstrip(",").rstrip("("))
        if not name or "(" in name:
            continue
        typ = toks[1].rstrip(",") if len(toks) > 1 else ""
        cols.append(f"{name} {typ}".strip())
    return cols


def balanced_paren(text: str, open_idx: int) -> str:
    depth, quote, i, n = 0, "", open_idx, len(text)
    while i < n:
        c = text[i]
        if quote:
            if c == quote and text[i - 1] != "\\":
                quote = ""
        elif c in ("'", '"'):
            quote = c
        elif c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
            if depth == 0:
                return text[open_idx + 1:i]
        i += 1
    return ""


def line_of(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def parse_ddl(text: str, rel: str, repo: str) -> list[dict]:
    """Risorsa DDL da un testo SQL (commenti già tollerati)."""
    res: list[dict] = []
    code = strip_sql_comments(text)
    for m in RE_TABLE.finditer(code):
        schema, name = split_schema(m.group("qname"))
        par = code.find("(", m.end())
        cols = parse_columns(balanced_paren(code, par)) if par != -1 else []
        res.append({"repo": repo, "file": rel, "line": line_of(text, m.start()),
                    "schema": schema, "name": name, "kind": "table",
                    "columns": cols, "detail": "", "source": "ddl"})
    for m in RE_VIEW.finditer(code):
        schema, name = split_schema(m.group("qname"))
        cols = [clean_ident(c) for c in (m.group("cols") or "").split(",")
                if clean_ident(c)]
        after_as = code[m.end():m.end() + 4000]
        depends = sorted({t for t in extract_sql_tables(after_as)
                          if t != f"{schema}.{name}".upper()})
        res.append({"repo": repo, "file": rel, "line": line_of(text, m.start()),
                    "schema": schema, "name": name, "kind": "view",
                    "columns": cols, "detail": "", "source": "ddl",
                    "depends_on": depends})
    for m in RE_TRIGGER.finditer(code):
        schema, name = split_schema(m.group("qname"))
        tsch, tname = split_schema(m.group("target"))
        timing = re.sub(r"\s+", " ", m.group("timing")).strip().upper()
        event = re.sub(r"\s+", " ", m.group("event")).strip().upper()
        target = f"{tsch}.{tname}" if tsch else tname
        res.append({"repo": repo, "file": rel, "line": line_of(text, m.start()),
                    "schema": schema, "name": name, "kind": "trigger",
                    "columns": [],
                    "detail": f"{timing} {event} ON {target}",
                    "target": target,
                    "source": "ddl"})
    for m in RE_PROC.finditer(code):
        schema, name = split_schema(m.group("qname"))
        kind = m.group("kind").split()[0].lower()
        res.append({"repo": repo, "file": rel, "line": line_of(text, m.start()),
                    "schema": schema, "name": name, "kind": kind,
                    "columns": [], "detail": "", "source": "ddl"})
    for m in RE_INDEX.finditer(code):
        schema, name = split_schema(m.group("qname"))
        tsch, tname = split_schema(m.group("target"))
        target = f"{tsch}.{tname}" if tsch else tname
        res.append({"repo": repo, "file": rel, "line": line_of(text, m.start()),
                    "schema": schema, "name": name, "kind": "index",
                    "columns": [], "detail": f"ON {target}",
                    "target": target, "source": "ddl"})
    for m in RE_SEQUENCE.finditer(code):
        schema, name = split_schema(m.group("qname"))
        res.append({"repo": repo, "file": rel, "line": line_of(text, m.start()),
                    "schema": schema, "name": name, "kind": "sequence",
                    "columns": [], "detail": "", "source": "ddl"})
    return res


# --- Port di jcaParser.ts: extractSqlTables / detectSqlType / params ---

_SQL_SKIP = frozenset({"SELECT", "WHERE", "SET", "VALUES", "DUAL", "ON",
                       "CASE", "WHEN", "THEN", "ELSE", "END"})
RE_SQL_TABLE = re.compile(
    r"(?i)\b(?:FROM|JOIN|INTO|UPDATE|MERGE\s+INTO|USING)\s+"
    r"(?:\"[^\"]+\"|`[^`]+`|\[[^\]]+\]|[\w$#]+)(?:\s*\.\s*"
    r"(?:\"[^\"]+\"|`[^`]+`|\[[^\]]+\]|[\w$#]+)){0,2}")


def extract_sql_tables(sql: str) -> list[str]:
    code = re.sub(r"--[^\n]*", " ", sql)
    code = re.sub(r"/\*.*?\*/", " ", code, flags=re.DOTALL)
    found = []
    for m in RE_SQL_TABLE.finditer(code):
        tail = m.group(0).split(None, 1)[1]
        parts = [clean_ident(p) for p in re.split(r"\s*\.\s*", tail)]
        parts = [p.split()[0] for p in parts if p]
        if not parts:
            continue
        name = parts[-1].upper()
        if name in _SQL_SKIP or len(name) < 2:
            continue
        qname = ".".join(parts).upper()
        if qname not in found:
            found.append(qname)
    return found


def detect_sql_type(sql: str) -> str:
    code = sql.lstrip("\ufeff \t\r\n(").lstrip()
    code = re.sub(r"^(--[^\n]*\n|/\*.*?\*/\s*)+", "", code,
                  flags=re.DOTALL).upper()
    if code.startswith("WITH"):
        return "SELECT"
    for kw in ("SELECT", "INSERT", "UPDATE", "DELETE", "MERGE"):
        if code.startswith(kw):
            return kw
    if code.startswith(("CALL", "BEGIN", "EXEC", "EXECUTE")):
        return "CALL"
    return "UNKNOWN"


def extract_sql_params(sql: str) -> list[str]:
    return sorted(set(re.findall(r"[#:](\w+)", sql)))


def inventory_jca(jca_adapters: list, repo: str) -> list[dict]:
    res = []
    for j in jca_adapters or []:
        for sql in j.get("sqls", []):
            for qname in extract_sql_tables(sql):
                schema, name = split_schema(qname)
                res.append({"repo": repo, "file": j.get("file", ""),
                            "line": 0, "schema": schema, "name": name,
                            "kind": "table_ref",
                            "columns": extract_sql_params(sql),
                            "detail": f"{detect_sql_type(sql)} via {j.get('adapter', '')}",
                            "source": "jca"})
    return res


def inventory_odi(odi_exports: list, repo: str) -> list[dict]:
    res = []
    for exp in odi_exports or []:
        for m in exp.get("mappings", []):
            for kind, vals in (("input", m.get("sources", [])),
                               ("output", m.get("targets", []))):
                for v in vals:
                    if isinstance(v, str) and "." in v:
                        schema, name = split_schema(v)
                        res.append({"repo": repo, "file": exp.get("file", ""),
                                    "line": 0, "schema": schema, "name": name,
                                    "kind": "table_ref", "columns": [],
                                    "detail": f"{kind} di {m.get('name', '')}",
                                    "source": "odi"})
    return res


def inventory_folder_db(root: str, repo: str, jca_adapters: list,
                        odi_exports: list) -> list[dict]:
    res: list[dict] = []
    for dirpath, dirs, names in os.walk(root):
        dirs[:] = [d for d in dirs if d not in
                   {".git", ".svn", ".hg", "__pycache__", ".pytest_cache",
                    ".ruff_cache", "node_modules", ".idea", ".vscode"}]
        for n in names:
            if os.path.splitext(n)[1].lower() not in DDL_EXTS:
                continue
            fp = os.path.join(dirpath, n)
            rel = os.path.relpath(fp, root).replace(os.sep, "/")
            try:
                if os.path.getsize(fp) > MAX_SQL_BYTES:
                    continue
                with open(fp, encoding="utf-8", errors="strict") as fh:
                    text = fh.read()
            except Exception:
                continue
            res.extend(parse_ddl(text, rel, repo))
    res.extend(inventory_jca(jca_adapters, repo))
    res.extend(inventory_odi(odi_exports, repo))
    return sorted(res, key=lambda r: (r["file"], r["line"], r["name"]))


def aggregate_by_schema(resources: list) -> dict:
    agg: dict[str, dict] = {}
    for r in resources:
        key = (r.get("schema") or "(nessuno schema)").upper()
        bucket = agg.setdefault(key, {"tables": [], "views": [],
                                      "triggers": [], "routines": [],
                                      "other": [], "refs": []})
        entry = {"name": r["name"], "repo": r.get("repo", ""),
                 "file": r.get("file", ""), "line": r.get("line", 0),
                 "columns": r.get("columns", []), "detail": r.get("detail", ""),
                 "source": r.get("source", "")}
        kind = r.get("kind", "")
        if kind == "table":
            bucket["tables"].append(entry)
        elif kind == "view":
            bucket["views"].append(entry)
        elif kind == "trigger":
            bucket["triggers"].append(entry)
        elif kind in ("procedure", "function", "package"):
            bucket["routines"].append(entry)
        elif kind == "table_ref":
            bucket["refs"].append(entry)
        else:
            bucket["other"].append(entry)
    return agg
