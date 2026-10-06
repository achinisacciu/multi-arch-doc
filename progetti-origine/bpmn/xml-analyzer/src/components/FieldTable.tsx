import React, { useState } from "react";
import { Search, ChevronDown, ChevronRight, Copy, Check, Filter, Download } from "lucide-react";
import { XMLNodeSummary } from "../types";

interface FieldTableProps {
  nodes: XMLNodeSummary[];
}

export const FieldTable: React.FC<FieldTableProps> = ({ nodes }) => {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"path" | "depth" | "occurrence">("path");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPath(text);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const toggleExpand = (id: string) => {
    if (expandedNodeId === id) {
      setExpandedNodeId(null);
    } else {
      setExpandedNodeId(id);
    }
  };

  const handleSort = (field: "path" | "depth" | "occurrence") => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  // Convert fields table to markdown format and trigger download
  const exportToMarkdown = () => {
    let md = "# Report Campi XML - Schema Analizzato\n\n";
    md += `Generato il: ${new Date().toLocaleString()}\n\n`;
    md += "| Tag / XPath | Tipo Dato | Profondità (Depth) | Ricorrenze | Opzionale | Attributi / Metadati |\n";
    md += "| :--- | :--- | :---: | :---: | :---: | :--- |\n";
    
    filteredNodes.forEach((node) => {
      const attrsStr = node.attributes.map(a => `@${a.name} ("${a.valueSample}")`).join(", ") || "Nessuno";
      const cleanedPath = node.path.replace(/\|/g, "\\|"); // escape pipe for markdown tables
      md += `| **${node.name}** <br> \`${cleanedPath}\` | \`${node.dataType}\` | ${node.depth} | ${node.occurrenceCount}x | ${node.isOptional ? "Sì" : "No"} | ${attrsStr} |\n`;
    });

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `campi_xml_export.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter & Search
  const filteredNodes = nodes
    .filter((node) => {
      const matchesSearch =
        node.name.toLowerCase().includes(search.toLowerCase()) ||
        node.path.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === "all" || node.dataType === typeFilter;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === "path") {
        comparison = a.path.localeCompare(b.path);
      } else if (sortBy === "depth") {
        comparison = a.depth - b.depth;
      } else if (sortBy === "occurrence") {
        comparison = a.occurrenceCount - b.occurrenceCount;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

  // Get list of unique types for dropdown
  const availableTypes = Array.from(new Set(nodes.map((n) => n.dataType))) as string[];

  return (
    <div className="flex flex-col gap-4">
      {/* Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cerca per tag o XPath..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 px-3 py-2 rounded-xl bg-white">
            <Filter className="w-3.5 h-3.5" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-transparent border-none text-gray-700 font-medium focus:outline-hidden"
            >
              <option value="all">Tutti i tipi</option>
              {availableTypes.map((type) => (
                <option key={type} value={type}>
                  {type === "complex" ? "Nested/Complex" : type.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={exportToMarkdown}
            disabled={filteredNodes.length === 0}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl bg-white shadow-2xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="Esporta la tabella in formato Markdown (.md)"
          >
            <Download className="w-3.5 h-3.5 text-blue-500" />
            Esporta .MD
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50/70 border-b border-gray-100 font-medium text-gray-500 select-none">
                <th className="py-3 px-4 w-10"></th>
                <th
                  onClick={() => handleSort("path")}
                  className="py-3 px-4 cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    Tag / XPath
                    {sortBy === "path" && (sortOrder === "asc" ? "▲" : "▼")}
                  </div>
                </th>
                <th className="py-3 px-4">Tipo Dato</th>
                <th
                  onClick={() => handleSort("depth")}
                  className="py-3 px-4 cursor-pointer hover:bg-gray-100 transition-colors text-center w-28"
                >
                  <div className="flex items-center justify-center gap-1">
                    Nido (Depth)
                    {sortBy === "depth" && (sortOrder === "asc" ? "▲" : "▼")}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("occurrence")}
                  className="py-3 px-4 cursor-pointer hover:bg-gray-100 transition-colors text-right w-28"
                >
                  <div className="flex items-center justify-end gap-1">
                    Ricorrenze
                    {sortBy === "occurrence" && (sortOrder === "asc" ? "▲" : "▼")}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredNodes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400 text-xs">
                    Nessun campo corrisponde ai criteri di ricerca
                  </td>
                </tr>
              ) : (
                filteredNodes.map((node) => {
                  const isExpanded = expandedNodeId === node.id;
                  return (
                    <React.Fragment key={node.id}>
                      <tr
                        className={`hover:bg-gray-50/50 transition-colors cursor-pointer ${
                          isExpanded ? "bg-blue-50/15" : ""
                        }`}
                        onClick={() => toggleExpand(node.id)}
                      >
                        <td className="py-3 px-4 text-center">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-800">{node.name}</span>
                            {node.isOptional && (
                              <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-sm text-[10px] font-medium uppercase tracking-wider">
                                Opzionale
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-mono text-gray-400 mt-1 max-w-lg truncate flex items-center gap-1.5 group">
                            <span>{node.path}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(node.path);
                              }}
                              className="opacity-0 group-hover:opacity-100 text-blue-500 hover:text-blue-700 transition-all p-0.5"
                              title="Copia XPath"
                            >
                              {copiedPath === node.path ? (
                                <Check className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-1 rounded-md text-xs font-mono border ${
                              node.dataType === "complex"
                                ? "bg-violet-50 text-violet-700 border-violet-100"
                                : node.dataType === "number"
                                ? "bg-sky-50 text-sky-700 border-sky-100"
                                : node.dataType === "date"
                                ? "bg-amber-50 text-amber-700 border-amber-100"
                                : "bg-gray-50 text-gray-600 border-gray-150"
                            }`}
                          >
                            {node.dataType === "complex" ? "nested" : node.dataType}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-gray-600">
                          {node.depth}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-gray-600 font-medium">
                          {node.occurrenceCount}x
                        </td>
                      </tr>

                      {/* Expanded Section */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={5} className="py-4 px-6 bg-gray-50/40 border-l-4 border-blue-500">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                              {/* Left column: Samples & Sub-paths */}
                              <div className="flex flex-col gap-3">
                                <div>
                                  <span className="font-semibold text-gray-500 block mb-1">
                                    Valori di Esempio
                                  </span>
                                  {node.sampleValues.length > 0 ? (
                                    <div className="flex flex-col gap-1.5">
                                      {node.sampleValues.map((val, idx) => (
                                        <div
                                          key={idx}
                                          className="p-2 bg-white rounded-lg border border-gray-100 font-mono text-gray-700 max-h-20 overflow-y-auto break-all"
                                        >
                                          "{val}"
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-gray-400 italic font-mono block p-1 bg-white border border-gray-100 rounded-lg">
                                      Nessun valore (Elemento contenitore)
                                    </span>
                                  )}
                                </div>

                                {node.childrenPaths.length > 0 && (
                                  <div>
                                    <span className="font-semibold text-gray-500 block mb-1">
                                      Elementi Figli ({node.childrenPaths.length})
                                    </span>
                                    <div className="flex flex-col gap-1 bg-white border border-gray-100 rounded-lg p-2 max-h-32 overflow-y-auto font-mono text-gray-500">
                                      {node.childrenPaths.map((cp) => (
                                        <div key={cp} className="truncate">
                                          └─ {cp.substring(cp.lastIndexOf("/") + 1)}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Right column: Attributes */}
                              <div>
                                <span className="font-semibold text-gray-500 block mb-1">
                                  Attributi ({node.attributes.length})
                                </span>
                                {node.attributes.length > 0 ? (
                                  <div className="border border-gray-100 bg-white rounded-lg overflow-hidden divide-y divide-gray-50">
                                    {node.attributes.map((attr) => (
                                      <div key={attr.name} className="p-2 flex justify-between items-center font-mono">
                                        <div>
                                          <span className="text-blue-600 font-semibold">@{attr.name}</span>
                                          <span className="text-[10px] text-gray-400 border border-gray-200 rounded-sm px-1 py-0.2 ml-1.5 uppercase bg-gray-50">
                                            {attr.type}
                                          </span>
                                        </div>
                                        <span className="text-gray-500 text-right truncate max-w-xs pl-4">
                                          "{attr.valueSample}"
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-gray-400 italic block p-2 bg-white border border-gray-100 rounded-lg">
                                    Nessun attributo definito
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
