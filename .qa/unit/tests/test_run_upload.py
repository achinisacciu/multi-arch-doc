# data: 2026-09-17 · categoria: unit · sorgente: server.py materialize_uploads
# Upload da drop: il browser invia contenuti (mai path), il server materializza in temp.
"""Test /api/run-upload (reale, niente mock)."""
from __future__ import annotations

import json
import os
import shutil
import sys
import threading
import urllib.request
from http.server import ThreadingHTTPServer

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))
from server import UPLOAD_BASE, API_VERSION, Handler, materialize_uploads  # noqa: E402

CLIENT = "__test_upload"


def _teardown():
    shutil.rmtree(os.path.join(UPLOAD_BASE, CLIENT), ignore_errors=True)
    shutil.rmtree(os.path.join(os.path.dirname(__file__), "..", "..", "..",
                               "dossier-clienti", CLIENT), ignore_errors=True)


def _upload(name="demo", files=(("app.py", "import os\n"), ("conf/app.properties", "db.host=h\n"))):
    return {"name": name, "files": [{"path": p, "content": c} for p, c in files]}


def test_materialize_scrive_workspace():
    _teardown()
    try:
        dirs = materialize_uploads(CLIENT, [_upload()])
        assert len(dirs) == 1 and dirs[0].endswith("demo")
        with open(os.path.join(dirs[0], "app.py"), encoding="utf-8") as fh:
            assert fh.read() == "import os\n"
        assert os.path.isfile(os.path.join(dirs[0], "conf", "app.properties"))
    finally:
        _teardown()


def test_materialize_sanitizza_nomi_windows():
    # Repo reali: ? : < > | riservati CON, punti/spazi finali — mai OSError.
    _teardown()
    try:
        dirs = materialize_uploads(CLIENT, [_upload(files=(
            ("a?b.txt", "1"), ("a:b.txt", "2"), ("CON.txt", "3"),
            ("trail. ", "4"), ("sub/dir|x.md", "5"),
        ))])
        got = []
        for root, _, files in os.walk(dirs[0]):
            got += [os.path.relpath(os.path.join(root, f), dirs[0]) for f in files]
        assert len(got) == 5, got  # tutti scritti, collisioni deduplicate
        assert all("?" not in g and ":" not in g and "|" not in g for g in got)
        assert not any(os.path.basename(g).upper().startswith("CON.") for g in got)
    finally:
        _teardown()


def test_materialize_rifiuta_traversal_e_nomi():
    for bad in ("../evil.txt", "/assoluto.txt", "a/../../b.txt"):
        try:
            materialize_uploads(CLIENT, [_upload(files=((bad, "x"),))])
        except ValueError:
            pass
        else:
            raise AssertionError(f"accettato path proibito: {bad}")
    for bad_client in ("", "../x", "a/b", "x" * 65):
        try:
            materialize_uploads(bad_client, [_upload()])
        except ValueError:
            pass
        else:
            raise AssertionError(f"accettato cliente proibito: {bad_client!r}")
    _teardown()


def test_materialize_senza_tetti_contenuto():
    # Niente tetti: tanti file, file grandi, annidamento profondo, node_modules dentro.
    _teardown()
    try:
        deep = "/".join(f"lv{i}" for i in range(12)) + "/fondo.py"
        files = [(f"f{i:03d}.py", f"# {i}\n") for i in range(150)]
        files += [("big.txt", "x" * (300 * 1024)), (deep, "y=1\n"),
                  ("node_modules/dep/index.js", "z=2\n"), (".git/hooks/h.txt", "w\n")]
        dirs = materialize_uploads(CLIENT, [_upload(files=files)])
        assert os.path.isfile(os.path.join(dirs[0], deep))
        assert os.path.isfile(os.path.join(dirs[0], "node_modules", "dep", "index.js"))
        assert os.path.getsize(os.path.join(dirs[0], "big.txt")) == 300 * 1024
    finally:
        _teardown()


def test_materialize_dimentica_tra_run():
    # Stessa cartella ricaricata in due run: mai suffissi _2/_3.
    _teardown()
    try:
        first = materialize_uploads(CLIENT, [_upload()])
        second = materialize_uploads(CLIENT, [_upload()])
        assert first[0].endswith("demo") and second[0].endswith("demo")
        assert first[0] != second[0]
        assert os.path.isfile(os.path.join(second[0], "app.py"))
    finally:
        _teardown()


def test_http_oversize_drain_senza_abort():
    # Body oltre UPLOAD_MAX_BODY: 413 JSON pulito, mai connessione troncata
    # (prima: RST -> vite `http proxy error: ECONNABORTED`).
    import server as server_mod
    old, server_mod.UPLOAD_MAX_BODY = server_mod.UPLOAD_MAX_BODY, 1024
    srv = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    try:
        big = {"uploadId": "x" * 16, "files": [{"path": "f.txt", "content": "y" * 2048}]}
        code, d = _post(f"http://127.0.0.1:{srv.server_port}", "/api/upload-chunk", big)
        assert code == 413, (code, d)
        assert d.get("ok") is False and "troppo grande" in d.get("log", "")
        # Il server e ancora vivo e risponde (connessione non abortita).
        with urllib.request.urlopen(
                f"http://127.0.0.1:{srv.server_port}/api/health", timeout=15) as r:
            assert r.status == 200
    finally:
        server_mod.UPLOAD_MAX_BODY = old
        srv.shutdown()


def _post(base, route, payload):
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(base + route, data=body,
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return r.status, json.loads(r.read().decode("utf-8"))
    except Exception as e:
        assert hasattr(e, "read"), e
        return e.code, json.loads(e.read().decode("utf-8"))


def test_http_health_con_versione():
    srv = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    try:
        base = f"http://127.0.0.1:{srv.server_port}"
        with urllib.request.urlopen(base + "/api/health", timeout=15) as r:
            d = json.loads(r.read().decode("utf-8"))
        assert d == {"ok": True, "api": API_VERSION}
    finally:
        srv.shutdown()


def test_http_sessione_chunk_e_run():
    # Cartella grande: start -> 2 chunk -> run con uploadId.
    _teardown()
    srv = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    try:
        base = f"http://127.0.0.1:{srv.server_port}"
        code, st = _post(base, "/api/upload-start", {"client": CLIENT, "name": "grossa"})
        assert code == 200 and st.get("uploadId"), st
        uid = st["uploadId"]
        deep = "/".join(f"lv{i}" for i in range(10)) + "/f.py"
        chunk1 = [{"path": f"a{i}.py", "content": f"# {i}\n"} for i in range(50)]
        chunk2 = [{"path": deep, "content": "y=1\n"},
                  {"path": "node_modules/d/index.js", "content": "z\n"}]
        for ch in (chunk1, chunk2):
            code, r = _post(base, "/api/upload-chunk", {"uploadId": uid, "files": ch})
            assert code == 200 and r.get("ok"), r
        code, d = _post(base, "/api/run-upload",
                        {"client": CLIENT, "uploads": [{"uploadId": uid}]})
        assert code == 200, d
        assert d["ok"], d["log"][-1000:]
        assert d["crosslink"]["names"] == ["grossa"]
        # Sessione consumata: riuso -> 400, non crash.
        code, d = _post(base, "/api/run-upload",
                        {"client": CLIENT, "uploads": [{"uploadId": uid}]})
        assert code == 400
    finally:
        srv.shutdown()
        _teardown()


def test_http_nomi_ostici_rispondono_json():
    # Regressione: OSError su nomi Windows chiudeva la connessione (Failed to fetch).
    _teardown()
    srv = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    try:
        base = f"http://127.0.0.1:{srv.server_port}"
        tricky = _upload(name="ostica", files=(
            ("a?b.txt", "x=1"), ("CON.txt", "y=2"), ("trail. ", "z=3")))
        code, d = _post(base, "/api/run-upload", {"client": CLIENT, "uploads": [tricky]})
        assert code == 200, d
        assert d["ok"], d["log"][-1000:]
    finally:
        srv.shutdown()
        _teardown()


def test_http_stessa_cartella_due_run_senza_suffissi():
    # Due analisi con la stessa cartella: nomi originali entrambe le volte.
    _teardown()
    srv = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    try:
        base = f"http://127.0.0.1:{srv.server_port}"
        for _ in range(2):
            code, d = _post(base, "/api/run-upload", {"client": CLIENT, "uploads": [_upload()]})
            assert code == 200, d
            assert d["ok"], d["log"][-1000:]
            assert d["crosslink"]["names"] == ["demo"], d["crosslink"]["names"]
    finally:
        srv.shutdown()
        _teardown()


def test_http_run_upload_end_to_end():
    _teardown()
    srv = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    try:
        base = f"http://127.0.0.1:{srv.server_port}"
        code, d = _post(base, "/api/run-upload", {"client": CLIENT, "uploads": [_upload()]})
        assert code == 200, d
        assert d["ok"], d["log"][-1000:]
        assert d["crosslink"]["names"] == ["demo"]
        code, d = _post(base, "/api/run-upload", {"client": CLIENT, "uploads": []})
        assert code == 400
    finally:
        srv.shutdown()
        _teardown()
