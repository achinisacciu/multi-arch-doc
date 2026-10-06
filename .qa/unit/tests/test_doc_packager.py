# data: 2026-09-18 · categoria: unit · sorgente: multirepo/doc_packager.py
# TDD: Generazione documentazione multi-audience e archivio ZIP scaricabile.
"""Unit: packaging documentazione per target (Architetti, Programmatori, Business, Governance) + ZIP."""
from __future__ import annotations

import io
import json
import os
import shutil
import sys
import threading
import urllib.request
import zipfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
sys.path.insert(0, ROOT)
from multirepo.doc_packager import package_documentation  # noqa: E402
from server import Handler, ThreadingHTTPServer  # noqa: E402
from conftest import run  # noqa: E402

CLIENT = "__test_packager"
OUTBASE = os.path.join(ROOT, "dossier-clienti")
OUTDIR = os.path.join(OUTBASE, CLIENT)


def setup_module():
    shutil.rmtree(OUTDIR, ignore_errors=True)
    # Esegui pipeline su fixture per avere i dati di base
    run([sys.executable, "multirepo/collect.py", "--client", CLIENT,
         "--folders", "fixtures/repo-a", "fixtures/repo-b", "fixtures/repo-c"], check=True)
    run([sys.executable, "multirepo/crosslink.py", "--client", CLIENT, "--ignore-git",
         "fixtures/repo-a", "fixtures/repo-b", "fixtures/repo-c"], check=True)
    run([sys.executable, "multirepo/report.py", "--client", CLIENT], check=True)


def teardown_module():
    shutil.rmtree(OUTDIR, ignore_errors=True)


def test_package_documentation_creates_zip_and_target_folders():
    zip_path = package_documentation(CLIENT, outbase=OUTBASE)
    assert os.path.isfile(zip_path), f"File zip non creato: {zip_path}"
    assert zipfile.is_zipfile(zip_path), "Il file creato non è uno zip valido"

    with zipfile.ZipFile(zip_path, "r") as zf:
        namelist = set(zf.namelist())

        # 1. Indice principale
        assert "00_INDICE_E_GUIDA_DOCUMENTAZIONE.md" in namelist
        content_indice = zf.read("00_INDICE_E_GUIDA_DOCUMENTAZIONE.md").decode("utf-8")
        assert "Architetti" in content_indice
        assert "Programmatori" in content_indice
        assert "Business" in content_indice
        assert "Governance" in content_indice

        # 2. Architetti / Ingegneri / Analisti
        assert any(n.startswith("01_Architettura_e_System_Design/01_TOPOLOGIA") for n in namelist)
        assert any(n.startswith("01_Architettura_e_System_Design/02_DATA_FLOW") for n in namelist)
        assert any(n.startswith("01_Architettura_e_System_Design/03_CONTRATTI") for n in namelist)
        assert "01_Architettura_e_System_Design/04_MATRICE_DIPENDENZE.csv" in namelist
        assert "01_Architettura_e_System_Design/05_GRAFO_RELAZIONI.json" in namelist
        assert "01_Architettura_e_System_Design/diagrammi_flusso.mmd" in namelist

        # 3. Sviluppo, DevOps e Database
        assert any(n.startswith("02_Sviluppo_DevOps_e_Database/01_SCHEDE_TECNICHE") for n in namelist)
        assert any(n.startswith("02_Sviluppo_DevOps_e_Database/02_CONFIGURAZIONI") for n in namelist)
        assert any(n.startswith("02_Sviluppo_DevOps_e_Database/03_DATABASE") for n in namelist)
        assert any(n.startswith("02_Sviluppo_DevOps_e_Database/04_TRASFORMAZIONI") for n in namelist)
        assert "02_Sviluppo_DevOps_e_Database/05_MAPPING_RULES.csv" in namelist
        assert "02_Sviluppo_DevOps_e_Database/06_MASTER_INPUT_OUTPUT.csv" in namelist
        assert "02_Sviluppo_DevOps_e_Database/07_INVENTARIO_TECNOLOGICO.json" in namelist
        assert "02_Sviluppo_DevOps_e_Database/08_INVENTARIO_DB.json" in namelist
        db_inv = json.loads(zf.read(
            "02_Sviluppo_DevOps_e_Database/08_INVENTARIO_DB.json").decode("utf-8"))
        assert "by_schema" in db_inv and "resources" in db_inv

        # 3b. Inventario DB, dipendenze, config generica (P3: sezioni piene)
        db_doc = zf.read(
            "02_Sviluppo_DevOps_e_Database/03_DATABASE_E_ADAPTER_SQL.md").decode("utf-8")
        assert "Inventario Risorse DB" in db_doc
        gov_doc = zf.read(
            "04_Governance_e_Audit/01_CONFORMITA_LICENZE_E_RISCHI.md").decode("utf-8")
        assert "Inventario dipendenze" in gov_doc
        assert "requests" in gov_doc  # da requirements.txt repo-a/repo-b
        assert "Versioni divergenti" in gov_doc  # requests 2.31.0 vs 2.28.0
        cfg_doc = zf.read(
            "02_Sviluppo_DevOps_e_Database/02_CONFIGURAZIONI_E_VARIABILI.md").decode("utf-8")
        assert "server.port" in cfg_doc  # repo-b/server.properties
        assert "SuperSegreta" not in cfg_doc

        # 4. Business e Processi
        assert any(n.startswith("03_Business_e_Processi/01_SINTESI_ESECUTIVA") for n in namelist)
        assert any(n.startswith("03_Business_e_Processi/02_MAPPA_PROCESSI") for n in namelist)
        assert any(n.startswith("03_Business_e_Processi/03_GLOSSARIO") for n in namelist)

        # 5. Governance e Audit
        assert any(n.startswith("04_Governance_e_Audit/01_CONFORMITA") for n in namelist)
        assert "04_Governance_e_Audit/02_REGISTRO_EVIDENZE_AUDIT.csv" in namelist
        assert "04_Governance_e_Audit/03_VERIFICA_INTEGRITA.txt" in namelist


def test_collect_lp_doc_copied_in_tools_output():
    # P2 (bug sezioni vuote): lp_doc_test/run.py non ha --output-dir, i .md
    # devono essere copiati in tools_output/<repo>/ (reale, niente mock).
    lp_client = "__test_lp_copy"
    lp_out = os.path.join(OUTBASE, lp_client)
    shutil.rmtree(lp_out, ignore_errors=True)
    try:
        r = run([sys.executable, "multirepo/collect.py", "--client", lp_client,
                 "--folders", "fixtures/repo-b"], check=True)
        assert r.returncode == 0, r.stderr
        data = json.load(open(os.path.join(lp_out, "collect.json"),
                              encoding="utf-8"))
        lp_runs = [t for t in data["tool_runs"] if t["tool"] == "lp_doc"]
        assert lp_runs and all(t["status"] == "ok" for t in lp_runs)
        assert any(t.get("copied") for t in lp_runs), "nessun .md copiato"
        dest_md = os.path.join(lp_out, "tools_output", "repo-b",
                               "LP_MAIN_LOADPLAN.md")
        assert os.path.isfile(dest_md), f"manca {dest_md}"
        assert "LP_MAIN" in open(dest_md, encoding="utf-8").read()
    finally:
        shutil.rmtree(lp_out, ignore_errors=True)


def test_server_download_zip_http():
    srv = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    try:
        url = f"http://127.0.0.1:{srv.server_port}/api/download-zip?client={CLIENT}"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=15) as r:
            assert r.status == 200
            assert "application/zip" in r.headers.get("Content-Type")
            assert f"{CLIENT}_documentazione.zip" in r.headers.get("Content-Disposition")
            body = r.read()
            assert len(body) > 100
            assert zipfile.is_zipfile(io.BytesIO(body))

        # Test validazione nome client (niente path traversal)
        url_bad = f"http://127.0.0.1:{srv.server_port}/api/download-zip?client=../../etc"
        try:
            urllib.request.urlopen(url_bad, timeout=10)
            assert False, "Doveva fallire con 400"
        except urllib.error.HTTPError as err:
            assert err.code == 400
    finally:
        srv.shutdown()
