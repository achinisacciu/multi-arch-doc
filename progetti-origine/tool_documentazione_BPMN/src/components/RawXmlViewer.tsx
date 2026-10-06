import React, { useState } from 'react';
import { Copy, Check, FileCode, Search } from 'lucide-react';

interface RawXmlViewerProps {
  xmlContent: string;
  fileName: string;
}

export const RawXmlViewer: React.FC<RawXmlViewerProps> = ({ xmlContent, fileName }) => {
  const [copied, setCopied] = useState(false);
  const [filterText, setFilterText] = useState('');

  const lines = React.useMemo(() => xmlContent.split('\n'), [xmlContent]);
  const byteSize = React.useMemo(() => new Blob([xmlContent]).size, [xmlContent]);

  const handleCopy = () => {
    navigator.clipboard.writeText(xmlContent).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = xmlContent;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredLines = lines
    .map((line, idx) => ({ line, num: idx + 1 }))
    .filter(({ line }) => !filterText || line.toLowerCase().includes(filterText.toLowerCase()));

  return (
    <div id="raw-xml-viewer-container" className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
      {/* Header bar */}
      <div className="bg-slate-950/80 px-6 py-4 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <FileCode className="w-5 h-5 text-indigo-400" />
          <div>
            <h3 className="text-sm font-bold text-slate-100 font-mono">{fileName}</h3>
            <p className="text-xs text-slate-400">{lines.length} righe • {byteSize} byte</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filtra righe XML..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-md pl-8 pr-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <button
            id="copy-raw-xml-btn"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copiato!' : 'Copia XML'}</span>
          </button>
        </div>
      </div>

      {/* Code with line numbers */}
      <div className="p-4 bg-slate-950 overflow-x-auto max-h-[600px] overflow-y-auto">
        <pre className="font-mono text-xs text-slate-300 leading-relaxed">
          {filteredLines.map(({ line, num }) => (
            <div key={num} className="flex hover:bg-slate-900/80 px-2 py-0.5 rounded transition">
              <span className="w-10 select-none text-slate-600 text-right pr-4 font-mono text-[11px] shrink-0">
                {num}
              </span>
              <span className="text-emerald-300 whitespace-pre">
                {line || ' '}
              </span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
};
