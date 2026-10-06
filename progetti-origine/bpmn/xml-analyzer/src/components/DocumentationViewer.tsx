import React, { useState } from "react";
import { FileText, Copy, Check, Download, AlertTriangle, Sparkles, Languages, Edit3, Eye } from "lucide-react";

interface DocumentationViewerProps {
  documentation: string;
  docLanguage: "it" | "en";
  onLanguageChange: (lang: "it" | "en") => void;
  onGenerate: (lang: "it" | "en") => void;
  onUpdateDocumentation: (newDoc: string) => void;
}

export const DocumentationViewer: React.FC<DocumentationViewerProps> = ({
  documentation,
  docLanguage,
  onLanguageChange,
  onGenerate,
  onUpdateDocumentation,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"preview" | "raw">("preview");

  const copyToClipboard = () => {
    navigator.clipboard.writeText(documentation);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadMarkdownFile = () => {
    const blob = new Blob([documentation], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `xml-documentation-${docLanguage}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Safe simplified Markdown renderer for rich preview
  const renderMarkdownPreview = (text: string) => {
    if (!text) return null;

    const lines = text.split("\n");

    return (
      <div className="space-y-4 text-gray-800 text-sm leading-relaxed">
        {lines.map((line, idx) => {
          const trimmed = line.trim();

          if (trimmed.startsWith("```")) {
            return null;
          }

          if (trimmed.startsWith("├──") || trimmed.startsWith("└──") || trimmed.startsWith("│")) {
            return (
              <pre key={idx} className="font-mono text-xs bg-gray-50 p-2.5 rounded-lg border border-gray-100 overflow-x-auto text-violet-700 whitespace-pre">
                {line}
              </pre>
            );
          }

          if (trimmed.startsWith("# ")) {
            return (
              <h1 key={idx} className="text-2xl font-display font-bold text-gray-950 pt-4 border-b border-gray-100 pb-2">
                {trimmed.replace("# ", "")}
              </h1>
            );
          }
          if (trimmed.startsWith("## ")) {
            return (
              <h2 key={idx} className="text-xl font-display font-semibold text-gray-900 pt-3 border-b border-gray-50 pb-1.5">
                {trimmed.replace("## ", "")}
              </h2>
            );
          }
          if (trimmed.startsWith("### ")) {
            return (
              <h3 key={idx} className="text-base font-display font-semibold text-gray-800 pt-2">
                {trimmed.replace("### ", "")}
              </h3>
            );
          }

          if (trimmed.startsWith(">")) {
            return (
              <blockquote key={idx} className="border-l-4 border-blue-500 bg-blue-50/50 p-3 rounded-r-lg text-xs text-blue-900">
                {trimmed.substring(1).trim()}
              </blockquote>
            );
          }

          if (/^\d+\. /.test(trimmed)) {
            return (
              <ol key={idx} className="list-decimal pl-5 space-y-1">
                <li>{trimmed.replace(/^\d+\. /, "")}</li>
              </ol>
            );
          }

          if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
            const listContent = trimmed.substring(2);
            const boldParts = listContent.split("**");
            return (
              <ul key={idx} className="list-disc pl-5 space-y-1">
                <li>
                  {boldParts.map((part, pIdx) =>
                    pIdx % 2 === 1 ? <strong key={pIdx} className="font-semibold text-gray-950">{part}</strong> : part
                  )}
                </li>
              </ul>
            );
          }

          if (trimmed.startsWith("|")) {
            const cells = trimmed.split("|").map((c) => c.trim()).filter((c) => c !== "");

            if (trimmed.includes("---")) {
              return null;
            }

            return (
              <div key={idx} className="overflow-x-auto my-3">
                <table className="w-full border-collapse border border-gray-200 rounded-lg text-xs bg-white">
                  <tbody>
                    <tr className="hover:bg-gray-50/30">
                      {cells.map((cell, cIdx) => {
                        const cellBoldParts = cell.split("**");
                        const parsedCell = cellBoldParts.map((part, pIdx) =>
                          pIdx % 2 === 1 ? <strong key={pIdx} className="font-semibold text-gray-950">{part}</strong> : part
                        );
                        return (
                          <td key={cIdx} className="border border-gray-200 p-2.5 min-w-28 text-gray-700">
                            {parsedCell}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          }

          if (trimmed !== "") {
            const boldParts = line.split("**");
            return (
              <p key={idx}>
                {boldParts.map((part, pIdx) =>
                  pIdx % 2 === 1 ? <strong key={pIdx} className="font-semibold text-gray-900">{part}</strong> : part
                )}
              </p>
            );
          }

          return <div key={idx} className="h-2" />;
        })}
      </div>
    );
  };

  return (
    <div className="glass-panel rounded-2xl border border-gray-100 overflow-hidden shadow-sm flex flex-col">
      {/* Top Banner & Control Panel */}
      <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-display font-semibold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-500" />
            Documentazione Tecnica (.MD)
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            Genera una documentazione professionale a partire dalla struttura XML (motore locale, nessuna AI)
          </p>
        </div>

        {!documentation ? (
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-1.5 border border-gray-200 bg-white px-2.5 py-1.5 rounded-xl text-xs text-gray-600">
              <Languages className="w-3.5 h-3.5" />
              <select
                value={docLanguage}
                onChange={(e) => onLanguageChange(e.target.value as "it" | "en")}
                className="bg-transparent border-none font-medium focus:outline-hidden"
              >
                <option value="it">Italiano (IT)</option>
                <option value="en">English (EN)</option>
              </select>
            </div>
            <button
              onClick={() => onGenerate(docLanguage)}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white rounded-xl text-xs font-semibold transition-all shadow-md active:scale-98 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" /> Genera Documentazione
            </button>
          </div>
        ) : (
          <div className="flex gap-2 shrink-0">
            <div className="flex border border-gray-200 rounded-xl p-0.5 bg-white mr-2">
              <button
                onClick={() => setActiveTab("preview")}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === "preview"
                    ? "bg-gray-100 text-gray-800"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                <Eye className="w-3.5 h-3.5" /> Anteprima
              </button>
              <button
                onClick={() => setActiveTab("raw")}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === "raw"
                    ? "bg-gray-100 text-gray-800"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" /> Modifica MD
              </button>
            </div>

            <button
              onClick={copyToClipboard}
              className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-xs font-semibold transition-colors bg-white shadow-2xs cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" /> Copiato
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Copia MD
                </>
              )}
            </button>
            <button
              onClick={downloadMarkdownFile}
              className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-xs font-semibold transition-colors bg-white shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Scarica .MD
            </button>
          </div>
        )}
      </div>

      {/* Main Container Area */}
      <div className="p-6 min-h-[300px] flex-1">
        {!documentation ? (
          <div className="h-64 flex flex-col items-center justify-center text-center gap-3">
            <FileText className="w-10 h-10 text-gray-300" />
            <div className="max-w-md">
              <p className="text-sm font-semibold text-gray-600">Nessuna documentazione generata</p>
              <p className="text-xs text-gray-400 mt-1">
                Fai clic sul pulsante sopra per avviare il motore documentale locale. Genererà una specifica
                tecnica .MD completa, con struttura gerarchica, statistiche e la tabella di tutti i campi.
              </p>
            </div>
          </div>
        ) : activeTab === "preview" ? (
          <div className="prose prose-blue max-w-none bg-white p-6 rounded-2xl border border-gray-100 max-h-[600px] overflow-y-auto shadow-2xs">
            {renderMarkdownPreview(documentation)}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 text-[11px] text-amber-800 p-2.5 rounded-lg">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>Questo editor ti consente di modificare direttamente il file Markdown (.md) prima di esportarlo o salvarlo.</span>
            </div>
            <textarea
              value={documentation}
              onChange={(e) => onUpdateDocumentation(e.target.value)}
              className="w-full h-[500px] font-mono text-xs p-4 bg-gray-900 text-gray-100 border border-gray-800 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-violet-500/30"
              spellCheck="false"
            />
          </div>
        )}
      </div>
    </div>
  );
};
