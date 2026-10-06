import React, { useState, useEffect, useCallback } from "react";
import {
  Save,
  FolderOpen,
  History,
  Check,
  Download,
  FileText,
  RefreshCw,
  FolderArchive,
} from "lucide-react";

interface SavedRun {
  name: string;
  path: string;
  files: string[];
}

interface OutputPanelProps {
  reportMd: string;
  schemaJson: object | null;
  sourceName: string;
}

export const OutputPanel: React.FC<OutputPanelProps> = ({
  reportMd,
  schemaJson,
  sourceName,
}) => {
  const [runs, setRuns] = useState<SavedRun[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [activeRun, setActiveRun] = useState<string | null>(null);

  const loadRuns = useCallback(async () => {
    try {
      const res = await fetch("/api/outputs");
      const data = await res.json();
      setRuns(data.runs || []);
    } catch {
      setRuns([]);
    }
  }, []);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  const handleSave = async () => {
    if (!reportMd && !schemaJson) return;
    setSaving(true);
    setError("");
    setSavedMsg(null);
    try {
      const res = await fetch("/api/output/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: sourceName || "untitled.xml",
          reportMd,
          schemaJson: schemaJson || {},
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore durante il salvataggio.");
      setSavedMsg(`Salvato in output/${data.dir}/`);
      await loadRuns();
      setActiveRun(data.dir);
    } catch (err: any) {
      setError(err.message || "Errore durante il salvataggio.");
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = (runName: string, fileName: string) => {
    const a = document.createElement("a");
    a.href = `/api/output/${runName}/${fileName}`;
    a.download = fileName;
    a.click();
  };

  const hasContent = Boolean(reportMd) || Boolean(schemaJson);

  return (
    <div className="flex flex-col gap-4">
      {/* Save controls */}
      <div className="glass-panel rounded-2xl border border-gray-100 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 shrink-0">
            <Save className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-display font-semibold text-gray-900">
              Persistenza del risultato
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              Salva l'analisi corrente su disco in{" "}
              <code className="text-gray-600 bg-gray-100 px-1 py-0.5 rounded">output/&lt;timestamp&gt;_&lt;nomeFile&gt;/</code>
              con <code className="text-gray-600 bg-gray-100 px-1 py-0.5 rounded">report.md</code> e{" "}
              <code className="text-gray-600 bg-gray-100 px-1 py-0.5 rounded">schema.json</code>.
            </p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={!hasContent || saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white rounded-xl text-xs font-semibold transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {saving ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          {saving ? "Salvataggio..." : "Salva su disco"}
        </button>
      </div>

      {savedMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          {savedMsg}
        </div>
      )}
      {error && (
        <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-800">
          {error}
        </div>
      )}

      {/* History */}
      <div className="glass-panel rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-gray-500" />
            <h4 className="text-xs font-display font-bold text-gray-800 uppercase tracking-wider">
              Cronologia degli output
            </h4>
          </div>
          <button
            onClick={loadRuns}
            className="p-1.5 border border-gray-200 hover:bg-gray-50 text-gray-500 rounded-lg text-xs bg-white shadow-2xs cursor-pointer"
            title="Ricarica la lista"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {runs.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-xs flex flex-col items-center gap-2">
            <FolderArchive className="w-8 h-8 text-gray-300" />
            Nessun output salvato. Esegui un'analisi e premi "Salva su disco".
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {runs.map((run) => {
              const isOpen = activeRun === run.name;
              return (
                <div key={run.name}>
                  <button
                    onClick={() => setActiveRun(isOpen ? null : run.name)}
                    className="w-full px-5 py-3 flex items-center justify-between gap-2 hover:bg-gray-50/70 transition-colors text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FolderOpen className="w-4 h-4 text-blue-500 shrink-0" />
                      <span className="text-xs font-mono text-gray-700 truncate">{run.name}</span>
                    </div>
                    <span className="text-[10px] text-gray-400 shrink-0">{run.files.length} file</span>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 flex flex-wrap gap-2">
                      {run.files.map((file) => (
                        <button
                          key={file}
                          onClick={() => handleDownload(run.name, file)}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-xs font-semibold bg-white shadow-2xs cursor-pointer"
                          title={`Scarica ${file}`}
                        >
                          {file.endsWith(".json") ? (
                            <FolderArchive className="w-3.5 h-3.5 text-amber-500" />
                          ) : (
                            <FileText className="w-3.5 h-3.5 text-blue-500" />
                          )}
                          {file}
                          <Download className="w-3 h-3 text-gray-400" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
