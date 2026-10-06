import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { XMLAnalysisStats } from "../types";

interface StatsDashboardProps {
  stats: XMLAnalysisStats;
}

const COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#8b5cf6", // violet
  "#f59e0b", // amber
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
  "#14b8a6", // teal
  "#6366f1", // indigo
  "#84cc16", // lime
];

export const StatsDashboard: React.FC<StatsDashboardProps> = ({ stats }) => {
  // Convert elementCountsByDepth to chart format
  const depthData = Object.entries(stats.elementCountsByDepth)
    .map(([depth, count]) => ({
      name: `Depth ${depth}`,
      count,
    }))
    .sort((a, b) => {
      const depthA = parseInt(a.name.replace("Depth ", ""), 10);
      const depthB = parseInt(b.name.replace("Depth ", ""), 10);
      return depthA - depthB;
    });

  // Top tags for Bar/Pie chart
  const tagData = stats.topTags.map((tag) => ({
    name: tag.tag,
    value: tag.count,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Chart 1: Tag Occurrences */}
      <div className="glass-panel p-5 rounded-2xl flex flex-col shadow-xs">
        <h3 className="text-sm font-display font-semibold text-gray-900 mb-1">
          Distribuzione dei Tag Principali
        </h3>
        <p className="text-xs text-gray-400 mb-4">
          I 10 elementi più frequenti all'interno del documento XML
        </p>
        
        <div className="h-64 w-full">
          {tagData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-gray-400">
              Nessun dato disponibile
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tagData} layout="vertical" margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                <XAxis type="number" stroke="#9ca3af" fontSize={11} />
                <YAxis dataKey="name" type="category" stroke="#9ca3af" fontSize={11} width={80} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    borderRadius: "8px",
                    border: "none",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                  cursor={{ fill: "rgba(229, 231, 235, 0.4)" }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {tagData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Chart 2: Depth Distribution */}
      <div className="glass-panel p-5 rounded-2xl flex flex-col shadow-xs">
        <h3 className="text-sm font-display font-semibold text-gray-900 mb-1">
          Densità per Livello di Profondità
        </h3>
        <p className="text-xs text-gray-400 mb-4">
          Numero di elementi XML disposti per livello di annidamento
        </p>

        <div className="h-64 w-full">
          {depthData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-gray-400">
              Nessun dato disponibile
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={depthData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} />
                <YAxis stroke="#9ca3af" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    borderRadius: "8px",
                    border: "none",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Deepest Nesting and Stats summary */}
      <div className="lg:col-span-2 bg-gradient-to-r from-blue-50 to-violet-50 border border-blue-100 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h4 className="text-xs font-semibold text-blue-800 uppercase tracking-wider">Percorso più Profondo</h4>
          <p className="text-xs font-mono text-gray-600 mt-1 break-all bg-white/70 p-2 rounded-lg border border-blue-200/50">
            {stats.deepestPath || "Nessun percorso rilevato"}
          </p>
        </div>
        <div className="shrink-0 flex gap-6 text-sm">
          <div className="text-left">
            <span className="block text-xs text-gray-400 uppercase tracking-wider">Profondità Massima</span>
            <span className="text-xl font-display font-semibold text-violet-700">{stats.maxDepth}</span>
          </div>
          <div className="text-left border-l border-blue-200/50 pl-6">
            <span className="block text-xs text-gray-400 uppercase tracking-wider">Tag Unici / Totali</span>
            <span className="text-xl font-display font-semibold text-blue-700">
              {stats.uniqueElements} / {stats.totalElements}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
