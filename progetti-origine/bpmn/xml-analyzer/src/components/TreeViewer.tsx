import React, { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, Search, ZoomIn, ZoomOut, Eye, Info } from "lucide-react";
import { XMLTreeVisualNode } from "../types";

interface TreeViewerProps {
  rootNode: XMLTreeVisualNode | null;
}

export const TreeViewer: React.FC<TreeViewerProps> = ({ rootNode }) => {
  const [search, setSearch] = useState("");
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [showValues, setShowValues] = useState(true);

  // Helper to expand all nodes matching search
  useEffect(() => {
    if (!rootNode) return;
    if (search.trim() === "") return;

    const newExpanded: Record<string, boolean> = {};
    const query = search.toLowerCase();

    function scan(node: XMLTreeVisualNode): boolean {
      let containsMatch = node.name.toLowerCase().includes(query) || node.path.toLowerCase().includes(query);
      
      let childMatch = false;
      node.children.forEach((child) => {
        if (scan(child)) {
          childMatch = true;
        }
      });

      if (containsMatch || childMatch) {
        newExpanded[node.id] = true;
        return true;
      }
      return false;
    }

    scan(rootNode);
    setExpandedNodes((prev) => ({ ...prev, ...newExpanded }));
  }, [search, rootNode]);

  // Expand all / Collapse all functions
  const expandAll = () => {
    if (!rootNode) return;
    const newExpanded: Record<string, boolean> = {};

    function recurse(node: XMLTreeVisualNode) {
      newExpanded[node.id] = true;
      node.children.forEach(recurse);
    }

    recurse(rootNode);
    setExpandedNodes(newExpanded);
  };

  const collapseAll = () => {
    setExpandedNodes({});
  };

  // Toggle single node collapse
  const toggleNode = (id: string) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  if (!rootNode) {
    return (
      <div className="p-8 text-center text-gray-400 text-xs italic">
        Nessun albero gerarchico generato
      </div>
    );
  }

  // Recursive render component
  const TreeNodeComponent: React.FC<{ node: XMLTreeVisualNode }> = ({ node }) => {
    const isExpanded = !!expandedNodes[node.id];
    const hasChildren = node.children.length > 0;
    const isMatched = search !== "" && (
      node.name.toLowerCase().includes(search.toLowerCase()) || 
      node.path.toLowerCase().includes(search.toLowerCase())
    );

    return (
      <div className="flex flex-col ml-4 border-l border-gray-100/75 pl-3">
        {/* Row Container */}
        <div className="flex items-center gap-2 group py-1 rounded-md hover:bg-gray-50/70 transition-colors -ml-3 pl-3 pr-2">
          {/* Collapse icon */}
          {hasChildren ? (
            <button
              onClick={() => toggleNode(node.id)}
              className="p-0.5 rounded-sm hover:bg-gray-200 transition-colors shrink-0"
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
              )}
            </button>
          ) : (
            <div className="w-4.5 h-4.5 flex items-center justify-center shrink-0">
              <span className="w-1 h-1 bg-gray-300 rounded-full" />
            </div>
          )}

          {/* Node name and details */}
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <span
              onClick={() => hasChildren && toggleNode(node.id)}
              className={`font-mono text-sm cursor-pointer select-none ${
                hasChildren ? "font-semibold text-gray-800" : "text-gray-700"
              } ${isMatched ? "bg-amber-100 text-amber-950 px-1 rounded-sm border border-amber-200 font-bold" : ""}`}
            >
              &lt;{node.name}&gt;
            </span>

            {/* Attributes decorator */}
            {node.attributes.length > 0 && (
              <span className="flex gap-1">
                {node.attributes.map((attr) => (
                  <span
                    key={attr.name}
                    className="text-[10px] font-mono text-blue-500 bg-blue-50 border border-blue-100 px-1 py-0.2 rounded-sm"
                    title={`${attr.name}="${attr.value}"`}
                  >
                    @{attr.name}
                  </span>
                ))}
              </span>
            )}

            {/* Values summary */}
            {showValues && node.value && (
              <span className="text-xs text-emerald-600 font-mono truncate max-w-xs pl-1 border-l border-gray-200 ml-1">
                "{node.value.length > 50 ? `${node.value.substring(0, 50)}...` : node.value}"
              </span>
            )}

            {/* Datatype indicator */}
            {!hasChildren && (
              <span className="text-[9px] font-mono font-medium uppercase tracking-wider text-gray-400 border border-gray-200 bg-white px-1.5 py-0.2 rounded-sm select-none">
                {node.dataType}
              </span>
            )}
          </div>
        </div>

        {/* Render nested children if expanded */}
        {hasChildren && isExpanded && (
          <div className="flex flex-col">
            {node.children.map((child) => (
              <TreeNodeComponent key={child.id} node={child} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Search & Tool Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Cerca nodi dell'albero..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-4 py-1.5 border border-gray-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
          />
        </div>

        <div className="flex gap-2 w-full sm:w-auto shrink-0 justify-end">
          <button
            onClick={expandAll}
            className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-xs font-semibold transition-colors bg-white shadow-2xs"
          >
            <ZoomIn className="w-3.5 h-3.5" /> Espandi Tutto
          </button>
          <button
            onClick={collapseAll}
            className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-xs font-semibold transition-colors bg-white shadow-2xs"
          >
            <ZoomOut className="w-3.5 h-3.5" /> Comprimi Tutto
          </button>
          <button
            onClick={() => setShowValues(!showValues)}
            className={`flex items-center gap-1 px-3 py-1.5 border rounded-xl text-xs font-semibold transition-all shadow-2xs ${
              showValues
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            <Eye className="w-3.5 h-3.5" /> {showValues ? "Valori Visibili" : "Nascondi Valori"}
          </button>
        </div>
      </div>

      {/* Tree Frame */}
      <div className="border border-gray-100 bg-white rounded-2xl p-5 shadow-xs overflow-x-auto max-h-[500px] overflow-y-auto">
        <div className="flex items-center gap-1.5 bg-blue-50/50 border border-blue-100/50 rounded-lg p-2.5 mb-4 text-[11px] text-blue-800">
          <Info className="w-4 h-4 shrink-0 text-blue-600" />
          <span>Fai clic sulle frecce per espandere i tag annidati e visualizzare gli attributi ed i tipi di dato.</span>
        </div>
        <div className="-ml-4 font-mono">
          <TreeNodeComponent node={rootNode} />
        </div>
      </div>
    </div>
  );
};
