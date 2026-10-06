"""Mini frontend web — LEGACY (deprecated).
Usa Unified Server: soa-reverse-engineer/web/server.py + frontend src/ (Vite).
Questo server rimane solo per `bpmn-reverse-engineer serve` standalone su port 8001 (via npm run bpmn:serve:legacy).
Preferisci sempre: npm run dev  (Vite :3000 + API :8000).

Endpoints (legacy):
  GET  /                -> index.html
  GET  /api/health      -> json health
  GET  /api/download/<job_id> -> zip download
  POST /api/analyze     -> JSON {options, files:[{name, content}]}
"""

from __future__ import annotations

import base64
import hashlib
import io
import json
import sys
import tempfile
import uuid
import zipfile
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, unquote

from ..analyzers import compute_metrics, compute_paths, compute_warnings
from ..analyzers.enrich_flows import enrich_flows
from ..analyzers.extension_semantics import enrich_extensions
from ..exporters import export_graph_json, export_graphml, export_json, export_markdown
from ..graph import build_graph
from ..parser import parse_bpmn
from .. import __version__

# In-memory job store: job_id -> {zip_path: Path, work_dir: Path, results: list, zip_bytes: maybe}
JOBS: dict[str, dict] = {}

INDEX_HTML = r"""<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BPMN Reverse Engineer — Web</title>
<style>
  :root{--bg:#0f172a;--card:#1e293b;--accent:#38bdf8;--muted:#94a3b8;--ok:#22c55e;--warn:#f59e0b;--err:#ef4444}
  *{box-sizing:border-box}
  body{margin:0;font-family:Inter,system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:linear-gradient(135deg,#0f172a,#1e293b);color:#e2e8f0;min-height:100vh}
  header{padding:28px 24px;text-align:center;border-bottom:1px solid #334155}
  header h1{margin:0;font-size:28px;letter-spacing:.3px}
  header p{margin:8px 0 0;color:var(--muted)}
  .container{max-width:1100px;margin:0 auto;padding:24px}
  .card{background:rgba(30,41,59,0.9);border:1px solid #334155;border-radius:14px;padding:20px;margin-bottom:18px;backdrop-filter:blur(6px)}
  .card h2{margin:0 0 12px;font-size:17px;color:#f1f5f9}
  #dropZone{border:2px dashed #38bdf8;border-radius:12px;padding:32px;text-align:center;background:#0b1220;cursor:pointer;transition:.2s}
  #dropZone.dragover{background:#0f2436;border-color:#7dd3fc}
  #dropZone p{margin:6px 0;color:var(--muted)}
  .btn{background:var(--accent);color:#0f172a;border:none;padding:10px 16px;border-radius:8px;font-weight:700;cursor:pointer;transition:.15s}
  .btn:hover{filter:brightness(1.08)}
  .btn:disabled{opacity:.5;cursor:not-allowed}
  .btn-ghost{background:transparent;color:var(--accent);border:1px solid #334155}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  @media(max-width:800px){.grid{grid-template-columns:1fr}}
  label{font-size:13px;color:var(--muted);display:block;margin-bottom:6px}
  input[type="number"], select{width:100%;padding:9px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#e2e8f0}
  .checkbox{display:flex;align-items:center;gap:8px;padding:8px 0}
  .checkbox input{accent-color:var(--accent)}
  .file-list{margin-top:14px;max-height:220px;overflow:auto;border:1px solid #334155;border-radius:10px;background:#0f172a}
  .file-item{display:flex;justify-content:space-between;padding:9px 12px;border-bottom:1px solid #1e293b;font-size:13px}
  .file-item:last-child{border:none}
  .tag{padding:2px 7px;border-radius:999px;font-size:11px;font-weight:700}
  .tag-ok{background:rgba(34,197,94,.15);color:#22c55e}
  .tag-err{background:rgba(239,68,68,.15);color:#ef4444}
  .tag-warn{background:rgba(245,158,11,.14);color:#f59e0b}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th{color:var(--muted);text-align:left;padding:8px 10px;border-bottom:1px solid #334155}
  td{padding:8px 10px;border-bottom:1px solid #1e293b}
  .muted{color:var(--muted)}
  .preview{max-height:340px;overflow:auto;background:#0b1220;border:1px solid #334155;border-radius:10px;padding:12px;white-space:pre-wrap;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px}
  .badge{font-size:11px;padding:4px 8px;border-radius:999px;background:#0f172a;border:1px solid #334155;color:var(--muted)}
  .hidden{display:none}
  .actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
  .pill{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;background:#0f172a;border:1px solid #334155;font-size:12px}
</style>
</head>
<body>
<header>
  <h1>⚙️ BPMN Reverse Engineer</h1>
  <p>Mini frontend — trascina file <b>.bpmn</b> o una <b>cartella</b> intera e avvia l'analisi senza riga di comando</p>
</header>
<div class="container">
  <div class="card">
    <h2>1. Seleziona input</h2>
    <div id="dropZone">
      <p style="font-size:18px">📂 Trascina qui i file <code>.bpmn</code> oppure una <b>cartella</b></p>
      <p>oppure clicca per selezionare</p>
      <p class="muted" style="font-size:12px">Supporta selezione multipla e cartelle — solo file <code>.bpmn</code></p>
      <div class="actions" style="justify-content:center;margin-top:14px">
        <button type="button" class="btn" id="btnFile">Scegli file</button>
        <button type="button" class="btn btn-ghost" id="btnFolder">Scegli cartella</button>
      </div>
    </div>
    <input id="fileInput" type="file" multiple accept=".bpmn" style="display:none">
    <input id="folderInput" type="file" multiple webkitdirectory directory style="display:none">
    <div id="fileList" class="file-list hidden"></div>
    <div class="actions" style="margin-top:10px">
      <button id="clearBtn" class="btn btn-ghost hidden">Pulisci</button>
      <span id="fileCount" class="muted"></span>
    </div>
  </div>

  <div class="card">
    <h2>2. Opzioni analisi</h2>
    <div class="grid">
      <div>
        <label>Path limit</label>
        <input id="pathLimit" type="number" value="100" min="1" max="5000">
      </div>
      <div>
        <label>Ricerca (solo info, il frontend invia già tutti i file selezionati)</label>
        <select id="patternInfo" disabled><option>*.bpmn rilevati automaticamente</option></select>
      </div>
    </div>
    <div class="grid" style="margin-top:12px">
      <div>
        <div class="checkbox"><input id="optJson" type="checkbox" checked><label for="optJson" style="margin:0">Esporta JSON</label></div>
        <div class="checkbox"><input id="optMd" type="checkbox" checked><label for="optMd" style="margin:0">Esporta Markdown</label></div>
        <div class="checkbox"><input id="optGraph" type="checkbox" checked><label for="optGraph" style="margin:0">Esporta grafo (JSON + GraphML)</label></div>
      </div>
      <div>
        <div class="checkbox"><input id="optAnonymize" type="checkbox"><label for="optAnonymize" style="margin:0">Anonimizza (wrap in <code>``</code>)</label></div>
        <div class="checkbox"><input id="optBoth" type="checkbox"><label for="optBoth" style="margin:0">Both — genera sia normali che anonimizzati</label></div>
        <div class="checkbox"><input id="optVerbose" type="checkbox"><label for="optVerbose" style="margin:0">Verbose (mostra dettagli warning)</label></div>
      </div>
    </div>
  </div>

  <div class="card" style="text-align:center">
    <button id="analyzeBtn" class="btn" style="font-size:16px;padding:12px 26px" disabled>▶ Avvia analisi</button>
    <p id="status" class="muted" style="margin-top:10px"></p>
  </div>

  <div id="resultsCard" class="card hidden">
    <h2>3. Risultati</h2>
    <div id="summary" style="margin-bottom:12px"></div>
    <div id="downloadArea" class="actions"></div>
    <div id="resultsTableWrap" style="margin-top:14px"></div>
    <div id="detailArea" style="margin-top:18px"></div>
  </div>
</div>

<script>
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const folderInput = document.getElementById('folderInput');
const fileList = document.getElementById('fileList');
const fileCount = document.getElementById('fileCount');
const clearBtn = document.getElementById('clearBtn');
const analyzeBtn = document.getElementById('analyzeBtn');
const statusEl = document.getElementById('status');
let selectedFiles = []; // {name, content, relativePath}

function refreshFileList(){
  if(selectedFiles.length===0){ fileList.classList.add('hidden'); clearBtn.classList.add('hidden'); analyzeBtn.disabled=true; fileCount.textContent=''; return;}
  fileList.classList.remove('hidden'); clearBtn.classList.remove('hidden'); analyzeBtn.disabled=false;
  fileCount.textContent = `${selectedFiles.length} file selezionati`;
  fileList.innerHTML = selectedFiles.map((f,i)=> `<div class="file-item"><span>📄 ${f.name}</span><span class="muted">${(f.content.length/1024).toFixed(1)} KB</span></div>`).join('');
}

function isBpmnName(name){
  const lower = name.toLowerCase();
  return lower.endsWith('.bpmn');
}

async function addFiles(fileListObj){
  if(!fileListObj || fileListObj.length===0){
    statusEl.textContent = 'Nessun file rilevato.';
    return;
  }
  const jobs = [];
  let skipped = 0;
  for(const f of fileListObj){
    const rawName = f.webkitRelativePath || f._relativePath || f.name;
    const name = rawName; // keep folder path if present
    if(!isBpmnName(name)){
      // per selezione cartella: ignora silenziosamente non-bpmn, ma per selezione file singolo avvisa
      // se almeno un file è stato selezionato via fileInput, il filtro accept dovrebbe già limitare, quindi skip solo se da cartella
      if(f.webkitRelativePath || f._relativePath){
        skipped++;
        continue;
      } else {
        // file singolo non-bpmn: includi comunque e lascia il parser decidere (mostrerà errore chiaro)
        // ma avvisa
      }
    }
    jobs.push(f.text().then(text=> ({name: name, content: text})).catch(err=> ({name: name, content: "", error: String(err)})));
  }
  if(jobs.length===0){
    statusEl.textContent = `Nessun file .bpmn trovato${skipped?` (${skipped} file ignorati)` : ''}. Verifica la cartella.`;
    return;
  }
  const results = await Promise.all(jobs);
  const existing = new Set(selectedFiles.map(s=>s.name));
  let added = 0;
  for(const r of results){
    if(r.content==null) continue;
    if(!existing.has(r.name)){
      selectedFiles.push(r);
      existing.add(r.name);
      added++;
    }
  }
  if(skipped>0) statusEl.textContent = `Aggiunti ${added} file .bpmn (${skipped} ignorati)`;
  else if(added>0) statusEl.textContent = `Aggiunti ${added} file`;
  refreshFileList();
}

// --- drag & drop con supporto cartelle (webkitGetAsEntry) ---
async function traverseEntry(entry, path, out){
  if(entry.isFile){
    const file = await new Promise((res, rej)=> entry.file(res, rej));
    // preserva path relativo
    const rel = path + file.name;
    // crea nuovo File con path relativo leggibile via custom prop
    try{ Object.defineProperty(file, 'webkitRelativePath', {value: rel}); }catch(e){ file._relativePath = rel; }
    if(!file._relativePath) file._relativePath = rel;
    out.push(file);
  } else if(entry.isDirectory){
    const reader = entry.createReader();
    const readAll = ()=> new Promise((res, rej)=>{
      const all = [];
      const readBatch = ()=>{
        reader.readEntries(async (entries)=>{
          if(entries.length===0) res(all);
          else { all.push(...entries); readBatch(); }
        }, rej);
      };
      readBatch();
    });
    const entries = await readAll();
    for(const e of entries){
      await traverseEntry(e, path + entry.name + "/", out);
    }
  }
}

async function getFilesFromDrop(dataTransfer){
  const files = [];
  if(dataTransfer.items && dataTransfer.items.length){
    const entries = [];
    let hasEntry = false;
    for(let i=0;i<dataTransfer.items.length;i++){
      const item = dataTransfer.items[i];
      if(item.kind==='file'){
        const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
        if(entry){
          hasEntry = true;
          entries.push(entry);
        } else {
          const f = item.getAsFile();
          if(f) files.push(f);
        }
      }
    }
    if(hasEntry){
      for(const e of entries){
        await traverseEntry(e, "", files);
      }
      return files;
    }
  }
  // fallback
  return Array.from(dataTransfer.files || []);
}

// click sui bottoni
document.getElementById('btnFile').addEventListener('click', (e)=>{ e.stopPropagation(); fileInput.click(); });
document.getElementById('btnFolder').addEventListener('click', (e)=>{ e.stopPropagation(); folderInput.click(); });
// click su dropZone (ma non sui bottoni) -> apri file
dropZone.addEventListener('click', (e)=>{
  if(e.target.closest('button')) return;
  fileInput.click();
});
dropZone.addEventListener('dragover', e=>{ e.preventDefault(); dropZone.classList.add('dragover');});
dropZone.addEventListener('dragleave', ()=> dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', async e=>{
  e.preventDefault(); dropZone.classList.remove('dragover');
  try{
    const files = await getFilesFromDrop(e.dataTransfer);
    if(files.length) await addFiles(files);
    else if(e.dataTransfer.files && e.dataTransfer.files.length) await addFiles(e.dataTransfer.files);
    else statusEl.textContent = 'Drop vuoto: prova con "Scegli cartella"';
  }catch(err){
    console.error('drop error', err);
    if(e.dataTransfer.files && e.dataTransfer.files.length) await addFiles(e.dataTransfer.files);
  }
});
fileInput.addEventListener('change', async e=>{ if(e.target.files.length) await addFiles(e.target.files); e.target.value=''; });
folderInput.addEventListener('change', async e=>{ if(e.target.files.length) await addFiles(e.target.files); else statusEl.textContent='Nessuna cartella selezionata o cartella vuota'; e.target.value=''; });
clearBtn.addEventListener('click', ()=>{ selectedFiles=[]; refreshFileList(); document.getElementById('resultsCard').classList.add('hidden'); statusEl.textContent=''; });

document.getElementById('optBoth').addEventListener('change', e=>{ if(e.target.checked) document.getElementById('optAnonymize').checked=false; });
document.getElementById('optAnonymize').addEventListener('change', e=>{ if(e.target.checked) document.getElementById('optBoth').checked=false; });

let lastJobId = null;
analyzeBtn.addEventListener('click', async ()=>{
  if(selectedFiles.length===0) return;
  analyzeBtn.disabled=true;
  statusEl.textContent = '⏳ Analisi in corso...';
  const options = {
    do_json: document.getElementById('optJson').checked,
    do_md: document.getElementById('optMd').checked,
    do_graph: document.getElementById('optGraph').checked,
    path_limit: parseInt(document.getElementById('pathLimit').value||'100',10),
    anonymize: document.getElementById('optAnonymize').checked,
    both_mode: document.getElementById('optBoth').checked,
    verbose: document.getElementById('optVerbose').checked,
  };
  try{
    const res = await fetch('/api/analyze', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({options, files: selectedFiles})
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || 'Errore analisi');
    lastJobId = data.job_id;
    renderResults(data);
    statusEl.textContent = `✅ Completato: ${data.success} OK, ${data.failed} errori su ${data.total} file`;
  }catch(err){
    statusEl.textContent = `❌ Errore: ${err.message}`;
    console.error(err);
  }finally{
    analyzeBtn.disabled=false;
  }
});

function renderResults(data){
  const card = document.getElementById('resultsCard');
  card.classList.remove('hidden');
  const summary = document.getElementById('summary');
  summary.innerHTML = `<div style="display:flex;gap:10px;flex-wrap:wrap"><span class="pill">Totale: <b>${data.total}</b></span><span class="pill" style="border-color:#22c55e;color:#22c55e">OK: <b>${data.success}</b></span><span class="pill" style="border-color:#ef4444;color:#ef4444">Errori: <b>${data.failed}</b></span><span class="badge">job ${data.job_id.slice(0,8)}</span></div>`;
  const dl = document.getElementById('downloadArea');
  dl.innerHTML = '';
  if(data.download_url){
    const a = document.createElement('a');
    a.href = data.download_url;
    a.textContent = '⬇️ Scarica ZIP (tutti gli output)';
    a.className = 'btn';
    a.style.textDecoration='none';
    dl.appendChild(a);
  }
  if(data.results && data.results.length){
    let html = '<table><thead><tr><th>File</th><th>Status</th><th>Processes</th><th>Activities</th><th>Gateways</th><th>Paths</th><th>Warnings</th><th></th></tr></thead><tbody>';
    for(const r of data.results){
      const m = r.metrics || {};
      const fname = r.filename.split('/').pop();
      const statusTag = r.status==='ok' ? '<span class="tag tag-ok">OK</span>' : '<span class="tag tag-err">ERR</span>';
      const warn = r.warnings ? r.warnings.length : 0;
      html += `<tr><td>${fname}</td><td>${statusTag}</td><td>${m.num_processes ?? '—'}</td><td>${m.num_activities ?? '—'}</td><td>${m.num_gateways ?? '—'}</td><td>${r.paths_count ?? '—'}</td><td>${warn}</td><td><button class="btn btn-ghost" onclick='showDetail(${JSON.stringify(JSON.stringify(r)).replace(/'/g,"&#39;")})' style="padding:6px 10px">Dettaglio</button></td></tr>`;
    }
    html += '</tbody></table>';
    document.getElementById('resultsTableWrap').innerHTML = html;
  }
  document.getElementById('detailArea').innerHTML = '<p class="muted">Clicca “Dettaglio” per vedere preview Markdown/JSON e warnings.</p>';
}

function showDetail(jsonStr){
  const r = JSON.parse(jsonStr);
  const area = document.getElementById('detailArea');
  let html = `<div class="card" style="background:#0b1220;border-color:#334155"><h3 style="margin:0 0 8px">${r.filename}</h3>`;
  if(r.status!=='ok'){ html += `<p style="color:var(--err)">Errore: ${r.error||'sconosciuto'}</p>`; }
  else{
    if(r.warnings && r.warnings.length){
      html += `<p class="muted">${r.warnings.length} warnings:</p><ul>`;
      for(const w of r.warnings.slice(0,15)){ html+= `<li><code>${w.code}</code> — ${w.message}</li>`; }
      html += '</ul>';
      if(r.warnings.length>15) html+= `<p class="muted">+${r.warnings.length-15} altri...</p>`;
    } else { html+= '<p class="muted">Nessun warning.</p>'; }
    if(r.preview_md){ html+= `<h4>Markdown preview</h4><div class="preview">${escapeHtml(r.preview_md.slice(0,5000))}</div>`; }
    if(r.preview_json){ html+= `<h4>JSON preview</h4><div class="preview">${escapeHtml(r.preview_json.slice(0,5000))}</div>`; }
    if(r.outputs && r.outputs.length){
      html+= '<h4>Files generati</h4><ul>';
      for(const o of r.outputs) html+= `<li><code>${o}</code></li>`;
      html+= '</ul>';
    }
    // individual file download buttons if available
    if(r.downloads){
      html+= '<div class="actions">';
      for(const [label, url] of Object.entries(r.downloads)){
        html+= `<a class="btn btn-ghost" href="${url}" style="text-decoration:none">${label}</a>`;
      }
      html+= '</div>';
    }
  }
  html+='</div>';
  area.innerHTML = html;
  area.scrollIntoView({behavior:'smooth'});
}
function escapeHtml(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// expose for inline onclick
window.showDetail = showDetail;
</script>
</body>
</html>
"""


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # quiet but print to stderr for visibility
        sys.stderr.write(f"{self.client_address[0]} - - [{self.log_date_time_string()}] {format%args}\n")

    def _set_headers(self, status=200, content_type="text/html; charset=utf-8", extra=None):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        # CORS for local dev
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        if extra:
            for k, v in extra.items():
                self.send_header(k, v)
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(204)
        self.wfile.write(b"")

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        if path in ("/", "/index.html"):
            self._set_headers(200, "text/html; charset=utf-8")
            self.wfile.write(INDEX_HTML.encode("utf-8"))
            return
        if path == "/api/health":
            self._set_headers(200, "application/json")
            self.wfile.write(json.dumps({"status": "ok", "version": __version__}).encode())
            return
        if path.startswith("/api/download/"):
            job_id = unquote(path.split("/api/download/")[-1].split("?")[0].split("/")[0])
            job = JOBS.get(job_id)
            if not job:
                self._set_headers(404, "application/json")
                self.wfile.write(json.dumps({"error": "job not found"}).encode())
                return
            zip_path = job.get("zip_path")
            if not zip_path or not Path(zip_path).exists():
                self._set_headers(404, "application/json")
                self.wfile.write(json.dumps({"error": "zip not ready"}).encode())
                return
            data = Path(zip_path).read_bytes()
            self._set_headers(200, "application/zip", extra={
                "Content-Disposition": f'attachment; filename="bpmn_results_{job_id[:8]}.zip"',
                "Content-Length": str(len(data))
            })
            self.wfile.write(data)
            return
        # 404
        self._set_headers(404, "text/plain")
        self.wfile.write(b"Not found")

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/analyze":
            length = int(self.headers.get("Content-Length", 0))
            if length == 0:
                self._set_headers(400, "application/json")
                self.wfile.write(json.dumps({"error": "empty body"}).encode())
                return
            body = self.rfile.read(length)
            try:
                payload = json.loads(body.decode("utf-8"))
            except Exception as e:
                self._set_headers(400, "application/json")
                self.wfile.write(json.dumps({"error": f"invalid json: {e}"}).encode())
                return

            options = payload.get("options", {})
            files = payload.get("files", [])
            if not files:
                self._set_headers(400, "application/json")
                self.wfile.write(json.dumps({"error": "nessun file inviato"}).encode())
                return

            # sanitize options
            do_json = options.get("do_json", True)
            do_md = options.get("do_md", True)
            do_graph = options.get("do_graph", True)
            path_limit = int(options.get("path_limit", 100))
            anonymize = bool(options.get("anonymize", False))
            both_mode = bool(options.get("both_mode", False))

            job_id = str(uuid.uuid4())
            work_dir = Path(tempfile.mkdtemp(prefix=f"bpmn_web_{job_id[:8]}_"))
            input_dir = work_dir / "input"
            output_dir = work_dir / "output"
            input_dir.mkdir(parents=True, exist_ok=True)
            output_dir.mkdir(parents=True, exist_ok=True)

            # write uploaded files to disk, preserve relative paths
            sanitized: list[Path] = []
            for f in files:
                name = f.get("name", f"file_{uuid.uuid4().hex[:6]}.bpmn")
                # sanitize: remove .. and make relative
                # name may contain webkitRelativePath like "folder/sub/file.bpmn"
                # Keep only basename + subfolder structure but prevent traversal
                safe_parts = [p for p in Path(name).parts if p not in ("/", "\\", "..")]
                if not safe_parts:
                    safe_parts = [f"file_{uuid.uuid4().hex[:6]}.bpmn"]
                rel = Path(*safe_parts)
                dest = input_dir / rel
                dest.parent.mkdir(parents=True, exist_ok=True)
                content = f.get("content", "")
                # Ensure content is string
                if not isinstance(content, str):
                    content = str(content)
                dest.write_text(content, encoding="utf-8")
                sanitized.append(dest)

            results = []
            success = 0
            failed = 0
            # Collect all actual files (after writing, use rglob to include nested) — solo .bpmn
            all_input_files = sorted(input_dir.rglob("*"))
            bpmn_candidates = [p for p in all_input_files if p.is_file() and p.suffix.lower() == ".bpmn"]

            # Crea due cartelle top-level come richiesto: analisi e analisi anonimi
            # Se batch (piu' file o cartella) generiamo sempre entrambe per avere zip con due cartelle
            is_batch = len(bpmn_candidates) > 1 or any("/" in f.get("name","") or "\\" in f.get("name","") for f in files)

            output_analisi = output_dir / "analisi"
            output_anonimi = output_dir / "analisi anonimi"
            output_analisi.mkdir(parents=True, exist_ok=True)
            output_anonimi.mkdir(parents=True, exist_ok=True)

            for bpmn_path in bpmn_candidates:
                rel_name = str(bpmn_path.relative_to(input_dir))
                # preserva struttura cartella: es. myFolder/sub/file -> analisi/myFolder/sub/file/
                try:
                    rel_no_suffix = bpmn_path.relative_to(input_dir).with_suffix("")
                except Exception:
                    rel_no_suffix = Path(bpmn_path.stem)

                # Confermato: sempre due cartelle anche per singolo file (default), ma rispetta flag --anonymize/--both per singolo
                if is_batch:
                    gen_normal, gen_anon = True, True
                else:
                    if both_mode:
                        gen_normal, gen_anon = True, True
                    elif anonymize:
                        gen_normal, gen_anon = False, True
                    else:
                        gen_normal, gen_anon = True, True

                cur_out_normal = output_analisi / rel_no_suffix
                cur_out_anon = output_anonimi / rel_no_suffix

                try:
                    doc = parse_bpmn(bpmn_path)
                    doc = enrich_flows(doc)
                    doc = enrich_extensions(doc)
                    graph = build_graph(doc)
                    doc.metrics = compute_metrics(doc)
                    doc.structural_warnings = compute_warnings(doc, graph)
                    doc.paths = compute_paths(graph, limit=path_limit)

                    outputs: list[str] = []
                    # Normali
                    if gen_normal:
                        cur_out_normal.mkdir(parents=True, exist_ok=True)
                        if do_json:
                            p = cur_out_normal / "bpmn_analysis.json"
                            export_json(doc, p, anonymize=False)
                            outputs.append(str(p.relative_to(output_dir)))
                        if do_md:
                            p = cur_out_normal / "bpmn_analysis.md"
                            export_markdown(doc, p, anonymize=False)
                            outputs.append(str(p.relative_to(output_dir)))
                        if do_graph:
                            p1 = cur_out_normal / "bpmn_graph.json"
                            export_graph_json(graph, p1, anonymize=False)
                            outputs.append(str(p1.relative_to(output_dir)))
                            p2 = cur_out_normal / "bpmn_graph.graphml"
                            try:
                                export_graphml(graph, p2, anonymize=False)
                                outputs.append(str(p2.relative_to(output_dir)))
                            except Exception:
                                pass
                    # Anonimi
                    if gen_anon:
                        cur_out_anon.mkdir(parents=True, exist_ok=True)
                        if do_json:
                            p = cur_out_anon / "bpmn_analysis.json"
                            export_json(doc, p, anonymize=True)
                            outputs.append(str(p.relative_to(output_dir)))
                        if do_md:
                            p = cur_out_anon / "bpmn_analysis.md"
                            export_markdown(doc, p, anonymize=True)
                            outputs.append(str(p.relative_to(output_dir)))
                        if do_graph:
                            p1 = cur_out_anon / "bpmn_graph.json"
                            export_graph_json(graph, p1, anonymize=True)
                            outputs.append(str(p1.relative_to(output_dir)))
                            p2 = cur_out_anon / "bpmn_graph.graphml"
                            try:
                                export_graphml(graph, p2, anonymize=True)
                                outputs.append(str(p2.relative_to(output_dir)))
                            except Exception:
                                pass

                    # previews (prendi da cartella normal se esiste)
                    preview_md = None
                    preview_json = None
                    for o in outputs:
                        if o.endswith(".md") and "analisi anonimi" not in o:
                            try:
                                if (output_dir / o).exists():
                                    preview_md = (output_dir / o).read_text(encoding="utf-8")
                                    break
                            except Exception:
                                pass
                    # fallback a qualsiasi md
                    if not preview_md:
                        for o in outputs:
                            if o.endswith(".md"):
                                try:
                                    if (output_dir / o).exists():
                                        preview_md = (output_dir / o).read_text(encoding="utf-8")
                                        break
                                except Exception:
                                    pass
                    for o in outputs:
                        if o.endswith(".json") and "bpmn_analysis" in o and "analisi anonimi" not in o:
                            try:
                                if (output_dir / o).exists():
                                    preview_json = (output_dir / o).read_text(encoding="utf-8")
                                    break
                            except Exception:
                                pass
                    if not preview_json:
                        for o in outputs:
                            if o.endswith(".json") and "bpmn_analysis" in o:
                                try:
                                    if (output_dir / o).exists():
                                        preview_json = (output_dir / o).read_text(encoding="utf-8")
                                        break
                                except Exception:
                                    pass

                    results.append({
                        "filename": rel_name,
                        "status": "ok",
                        "metrics": doc.metrics.model_dump(),
                        "warnings": [w.model_dump() for w in doc.structural_warnings],
                        "paths_count": len(doc.paths),
                        "outputs": outputs,
                        "preview_md": preview_md[:8000] if preview_md else None,
                        "preview_json": preview_json[:8000] if preview_json else None,
                    })
                    success += 1
                except Exception as e:
                    import traceback
                    results.append({
                        "filename": rel_name,
                        "status": "error",
                        "error": str(e),
                        "trace": traceback.format_exc() if options.get("verbose") else None
                    })
                    failed += 1

            # create zip
            zip_path = work_dir / f"bpmn_results_{job_id[:8]}.zip"
            try:
                with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
                    for fp in output_dir.rglob("*"):
                        if fp.is_file():
                            z.write(fp, arcname=str(fp.relative_to(output_dir)))
                    # also add batch summary
                    summary = {
                        "tool_version": __version__,
                        "job_id": job_id,
                        "total": len(bpmn_candidates),
                        "success": success,
                        "failed": failed,
                        "results": [{k: v for k, v in r.items() if k not in ("preview_md","preview_json")} for r in results]
                    }
                    z.writestr("summary.json", json.dumps(summary, indent=2, ensure_ascii=False))
            except Exception as e:
                print(f"zip error: {e}")

            JOBS[job_id] = {"zip_path": zip_path, "work_dir": work_dir, "results": results}

            resp = {
                "job_id": job_id,
                "total": len(bpmn_candidates),
                "success": success,
                "failed": failed,
                "results": results,
                "download_url": f"/api/download/{job_id}"
            }
            body_out = json.dumps(resp, ensure_ascii=False).encode("utf-8")
            self._set_headers(200, "application/json", extra={"Content-Length": str(len(body_out))})
            self.wfile.write(body_out)
            return

        # unknown POST path
        self._set_headers(404, "application/json")
        self.wfile.write(json.dumps({"error": "not found"}).encode())


def run_server(host: str = "127.0.0.1", port: int = 8000):
    """Start blocking server (LEGACY)."""
    import warnings as _w
    _w.warn("bpmn web server is LEGACY — use Unified Server (soa-reverse-engineer/web/server.py) + npm run dev", DeprecationWarning, stacklevel=2)
    if port == 8000:
        print("[DEPRECATED] bpmn serve on 8000 conflicts with Unified Platform (8000). Use --port 8001 or npm run bpmn:serve:legacy")
    server_address = (host, port)
    httpd = ThreadingHTTPServer(server_address, Handler)
    httpd.allow_reuse_address = True
    print(f"[LEGACY] Serving BPMN-only at http://{host}:{port}  (prefer npm run dev → Unified)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
