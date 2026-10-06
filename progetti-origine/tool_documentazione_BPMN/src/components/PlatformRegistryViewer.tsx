import { Database, FileCode, Search } from "lucide-react";
import { useState } from "react";

export function PlatformRegistryViewer({ registry }: { registry: any }) {
  const [filter, setFilter] = useState("");
  const artifacts: any[] = registry?.artifacts || [];
  const byType: Record<string, number> = registry?.by_type || {};
  const filtered = artifacts.filter(a =>
    !filter || a.type.toLowerCase().includes(filter.toLowerCase()) || a.relativePath.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="bg-white border border-[#D9D9D9] rounded-2xl p-5">
        <h3 className="text-sm font-bold text-[#0E2841] flex items-center gap-2">
          <Database className="w-4 h-4 text-[#fc0000]" /> Artifact Registry
          <span className="ml-auto text-xs font-mono bg-[#0E2841] text-[#D9D9D9] px-2 py-1 rounded-full">{registry?.total || 0} file</span>
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(byType).map(([t, c]) => (
            <span key={t} className="px-2.5 py-1 rounded-full bg-[#0E2841] text-[#D9D9D9] text-xs font-mono border border-[#D9D9D9]/20">
              {t}: {String(c)}
            </span>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#0E2841]/50" />
            <input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Filtra per tipo o path..." className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#D9D9D9] bg-[#D9D9D9]/20 text-[#0E2841] text-sm focus:outline-none focus:border-[#fc0000]" />
          </div>
          <span className="text-xs text-[#0E2841]/60">{filtered.length} / {artifacts.length}</span>
        </div>
      </div>

      <div className="bg-white border border-[#D9D9D9] rounded-2xl overflow-hidden">
        <div className="max-h-[480px] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[#0E2841] text-[#D9D9D9]">
              <tr><th className="text-left p-2">ID</th><th className="text-left p-2">Type</th><th className="text-left p-2">Path</th><th className="text-left p-2">Detected</th></tr>
            </thead>
            <tbody>
              {filtered.slice(0,200).map(a => (
                <tr key={a.id} className="border-t border-[#D9D9D9]/50 hover:bg-[#D9D9D9]/30">
                  <td className="p-2 font-mono text-[10px] text-[#0E2841]">{a.id}</td>
                  <td className="p-2"><span className="px-2 py-0.5 rounded-full bg-[#fc0000] text-white text-[10px]">{a.type}</span></td>
                  <td className="p-2 font-mono text-[#0E2841]">{a.relativePath}</td>
                  <td className="p-2 text-[#0E2841]/70">{a.detected_by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 200 && <div className="p-2 text-center text-xs text-[#0E2841]/60">Mostrati 200 / {filtered.length} — usa filtro</div>}
      </div>
    </div>
  );
}
