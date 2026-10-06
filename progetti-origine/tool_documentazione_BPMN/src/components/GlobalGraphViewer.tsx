import { useState } from "react";
import { Workflow, GitBranch } from "lucide-react";

export function GlobalGraphViewer({ graph, lineage }: { graph: any; lineage: any }) {
  const [view, setView] = useState<"mermaid"|"json">("mermaid");

  const nodes: any[] = graph?.nodes || [];
  const edges: any[] = graph?.edges || [];
  const lineageEdges: any[] = lineage?.edges || [];

  // Mermaid fallback (react-force-graph opzionale)
  const mermaidGraph = `graph TD
${edges.slice(0,30).map((e,i)=>`  ${sanitize(e.source)} -->|${e.type||'edge'}| ${sanitize(e.target)}`).join("\n")}
${lineageEdges.slice(0,10).map(e=>`  ${sanitize(e.source)} -.->|transform| ${sanitize(e.target)}`).join("\n")}
`;

  function sanitize(s: string){ return (s||"node").replace(/[^a-zA-Z0-9_]/g,"_").slice(0,30) || "n"; }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-[#D9D9D9] rounded-2xl p-5">
        <h3 className="text-sm font-bold text-[#0E2841] flex items-center gap-2">
          <Workflow className="w-4 h-4 text-[#fc0000]" /> Dependency Graph Globale
          <span className="ml-auto text-xs font-mono bg-[#0E2841] text-white px-2 py-1 rounded-full">{nodes.length} nodi • {edges.length} archi</span>
        </h3>
        <div className="mt-3 flex gap-2">
          <button onClick={()=>setView("mermaid")} className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${view==="mermaid" ? "bg-[#fc0000] text-white border-[#fc0000]" : "bg-white text-[#0E2841] border-[#D9D9D9]"}`}>Mermaid</button>
          <button onClick={()=>setView("json")} className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${view==="json" ? "bg-[#0E2841] text-white border-[#0E2841]" : "bg-white text-[#0E2841] border-[#D9D9D9]"}`}>JSON</button>
          <span className="ml-auto flex items-center gap-1 text-xs text-[#0E2841]/60"><GitBranch className="w-3 h-3"/> lineage {lineageEdges.length}</span>
        </div>
      </div>

      {view==="mermaid" ? (
        <div className="bg-[#0E2841] border border-[#D9D9D9] rounded-2xl p-4 overflow-auto">
          <pre className="text-xs font-mono text-[#D9D9D9] whitespace-pre">{mermaidGraph || "graph TD\n  A-->B"}</pre>
          <p className="mt-3 text-[11px] text-[#D9D9D9]/70">Render Mermaid locale. Per interattivo installa <code>react-force-graph-2d</code> e verrà usato automaticamente.</p>
        </div>
      ) : (
        <div className="bg-white border border-[#D9D9D9] rounded-2xl p-4 max-h-[400px] overflow-auto">
          <pre className="text-xs font-mono text-[#0E2841] whitespace-pre-wrap">{JSON.stringify({nodes: nodes.slice(0,5), edges: edges.slice(0,10)}, null, 2)}...</pre>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-[#D9D9D9] rounded-2xl p-4">
          <h4 className="text-xs font-bold text-[#0E2841]">Nodi per tipo</h4>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.entries(nodes.reduce((acc:any,n:any)=>(acc[n.type]=(acc[n.type]||0)+1,acc),{} as any)).map(([t,c])=>(
              <span key={t} className="px-2 py-1 rounded-full bg-[#D9D9D9] text-[#0E2841] text-xs border border-[#0E2841]/10">{t}: {String(c)}</span>
            ))}
          </div>
        </div>
        <div className="bg-white border border-[#D9D9D9] rounded-2xl p-4">
          <h4 className="text-xs font-bold text-[#0E2841]">Archi per tipo</h4>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.entries(edges.reduce((acc:any,e:any)=>(acc[e.type]=(acc[e.type]||0)+1,acc),{} as any)).map(([t,c])=>(
              <span key={t} className="px-2 py-1 rounded-full bg-[#fc0000] text-white text-xs">{t}: {String(c)}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
