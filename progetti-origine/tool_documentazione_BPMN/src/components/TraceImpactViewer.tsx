import { useState } from "react";
import { Search, GitBranch, AlertTriangle, Workflow } from "lucide-react";

export function TraceImpactViewer({ baseUrl, jobId, fallbackGraph }: { baseUrl: string; jobId: string | null; fallbackGraph?: any }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [artifact, setArtifact] = useState("");
  const [traceRes, setTraceRes] = useState<any>(null);
  const [impactRes, setImpactRes] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const api = (p: string) => baseUrl ? `${baseUrl}${p}` : p;
  function localTrace(fromN: string, toN?: string){
    if(!fallbackGraph?.nodes) return { total: 0, paths: [], source:"locale", hint: "backend non connesso — trace locale limitato" };
    const nodes = new Set(fallbackGraph.nodes.map((n:any)=>n.id||n.label));
    const edges: any[] = fallbackGraph.edges || [];
    // BFS semplice
    const adj: Record<string,string[]> = {};
    edges.forEach((e:any)=>{ if(!adj[e.source]) adj[e.source]=[]; adj[e.source].push(e.target); });
    if(!nodes.has(fromN) && !adj[fromN]) return { total: 0, paths: [], error: `from "${fromN}" non trovato. Nodi: ${Array.from(nodes).slice(0,8).join(", ")}` };
    const q: string[][] = [[fromN]]; const seen = new Set([fromN]); const out: string[][] = [];
    while(q.length && out.length<10){ const p=q.shift()!; const last=p[p.length-1]; if(toN && last===toN){ out.push(p); continue; } if(!toN && p.length>1) out.push(p); const neigh=adj[last]||[]; for(const nb of neigh){ if(!p.includes(nb)){ q.push([...p, nb]); }} if(p.length>6) continue; }
    return { from: fromN, to: toN||null, total: out.length, paths: out, source:"locale-ecosystem" };
  }
  function localImpact(art: string){
    if(!fallbackGraph?.nodes) return { total: 0, impacted: [], error: "graph vuoto" };
    const edges = fallbackGraph.edges || [];
    // successori transitivi
    const adj: Record<string,string[]> = {};
    edges.forEach((e:any)=>{ if(!adj[e.source]) adj[e.source]=[]; adj[e.source].push(e.target); });
    const impacted = new Set<string>(); const stack=[art]; const vis=new Set([art]);
    while(stack.length){ const cur=stack.pop()!; const neigh=adj[cur]||[]; for(const nb of neigh){ if(!vis.has(nb)){ vis.add(nb); impacted.add(nb); stack.push(nb); }} }
    return { artifact: art, total: impacted.size, impacted: Array.from(impacted).slice(0,50), source:"locale-ecosystem" };
  }
  async function doTrace(){
    if(!from) return;
    setLoading(true);
    try{
      if(!jobId && fallbackGraph?.nodes){
        setTraceRes(localTrace(from, to||undefined));
        return;
      }
      const qs = new URLSearchParams({ from, job: jobId || "" });
      if(to) qs.set("to", to);
      const r = await fetch(api(`/api/trace?${qs.toString()}`));
      const j = await r.json();
      setTraceRes(j);
    }catch(e:any){ 
      // fallback locale
      if(fallbackGraph?.nodes) setTraceRes(localTrace(from, to||undefined));
      else setTraceRes({error: String(e)}); 
    }
    finally{ setLoading(false); }
  }
  async function doImpact(){
    if(!artifact) return;
    setLoading(true);
    try{
      if(!jobId && fallbackGraph?.nodes){
        setImpactRes(localImpact(artifact));
        return;
      }
      const r = await fetch(api(`/api/impact?artifact=${encodeURIComponent(artifact)}&job=${jobId||""}`));
      const j = await r.json();
      setImpactRes(j);
    }catch(e:any){ 
      if(fallbackGraph?.nodes) setImpactRes(localImpact(artifact));
      else setImpactRes({error: String(e)}); 
    }
    finally{ setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-[#D9D9D9] rounded-2xl p-5">
        <h3 className="text-sm font-bold text-[#0E2841] flex items-center gap-2"><Workflow className="w-4 h-4 text-[#fc0000]"/> Trace</h3>
        <p className="text-xs text-[#0E2841]/60 mt-1">reverse-engineer trace --from ActivityA [--to Database] — usa il Global Graph</p>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
          <input value={from} onChange={e=>setFrom(e.target.value)} placeholder="from (es. LoanService_ep)" className="px-3 py-2 rounded-xl border border-[#D9D9D9] bg-[#D9D9D9]/20 text-sm text-[#0E2841] focus:border-[#fc0000] outline-none" />
          <input value={to} onChange={e=>setTo(e.target.value)} placeholder="to (opzionale)" className="px-3 py-2 rounded-xl border border-[#D9D9D9] bg-[#D9D9D9]/20 text-sm text-[#0E2841] focus:border-[#fc0000] outline-none" />
          <button onClick={doTrace} disabled={loading || !from} className="px-4 py-2 rounded-xl bg-[#fc0000] text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"><Search className="w-4 h-4"/> Trace</button>
        </div>
        {traceRes && (
          <div className="mt-3 bg-[#0E2841] rounded-xl p-3 max-h-[200px] overflow-auto">
            <pre className="text-xs font-mono text-[#D9D9D9] whitespace-pre-wrap">{JSON.stringify(traceRes, null, 2)}</pre>
          </div>
        )}
      </div>

      <div className="bg-white border border-[#D9D9D9] rounded-2xl p-5">
        <h3 className="text-sm font-bold text-[#0E2841] flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-[#fc0000]"/> Impact</h3>
        <p className="text-xs text-[#0E2841]/60 mt-1">reverse-engineer impact --artifact customer.xsd — cosa si rompe?</p>
        <div className="mt-3 flex gap-2">
          <input value={artifact} onChange={e=>setArtifact(e.target.value)} placeholder="artifact (es. LoanSchema.xsd)" className="flex-1 px-3 py-2 rounded-xl border border-[#D9D9D9] bg-[#D9D9D9]/20 text-sm text-[#0E2841] focus:border-[#fc0000] outline-none" />
          <button onClick={doImpact} disabled={loading || !artifact} className="px-4 py-2 rounded-xl bg-[#0E2841] text-white text-sm font-bold disabled:opacity-50 flex items-center gap-2"><GitBranch className="w-4 h-4"/> Impact</button>
        </div>
        {impactRes && (
          <div className="mt-3 bg-[#D9D9D9]/30 border border-[#D9D9D9] rounded-xl p-3 max-h-[200px] overflow-auto">
            <pre className="text-xs font-mono text-[#0E2841] whitespace-pre-wrap">{JSON.stringify(impactRes, null, 2)}</pre>
          </div>
        )}
      </div>

      {!jobId && fallbackGraph?.nodes && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">Modalità <b>locale</b>: trace/impact eseguiti su graph derivato da ecosystem (senza backend). Avvia backend con <code>npm run dev</code> per canonical completo.</p>}
      {!jobId && !fallbackGraph?.nodes && <p className="text-xs text-[#0E2841]/60 bg-[#D9D9D9]/40 border border-[#D9D9D9] rounded-xl p-3">Suggerimento: <code>npm run dev</code> avvia Vite :3000 + API :8000. Oppure <code>npm run serve</code> per prod single-port :8000. Carica file via drag&drop.</p>}
    </div>
  );
}
