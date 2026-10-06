import React, { useEffect, useRef, useState } from 'react';
import type { ParsedBpmn } from '../types';
import { bpmnToMermaid } from '../utils/mermaidConverter';
import { Copy, Check, Loader2, AlertCircle } from 'lucide-react';

interface Props {
  parsed: ParsedBpmn;
  onSvgReady?: (html: string) => void;
}

export function MermaidView({ parsed, onSvgReady }: Props) {
  const svgWrapperRef = useRef<HTMLDivElement>(null);
  const [mermaidCode, setMermaidCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const renderKeyRef = useRef(0);

  useEffect(() => {
    const code = bpmnToMermaid(parsed);
    setMermaidCode(code);
  }, [parsed]);

  useEffect(() => {
    if (!svgWrapperRef.current || !mermaidCode) return;
    const currentKey = ++renderKeyRef.current;
    setRenderError(null);

    import('mermaid').then(async (mermaid) => {
      mermaid.default.initialize({
        startOnLoad: false,
        theme: 'default',
        flowchart: { useMaxWidth: false, htmlLabels: true, curve: 'basis', padding: 20 },
        securityLevel: 'loose',
      });
      try {
        const id = `mermaid-${currentKey}`;
        const { svg } = await mermaid.default.render(id, mermaidCode);
        if (currentKey !== renderKeyRef.current) return;
        if (svgWrapperRef.current) {
          svgWrapperRef.current.innerHTML = svg;
          const el = svgWrapperRef.current.querySelector('svg');
          if (el) { el.style.maxWidth = 'none'; el.style.width = 'auto'; el.style.height = 'auto'; }
          if (onSvgReady) onSvgReady(svgWrapperRef.current.innerHTML);
        }
      } catch (err: any) {
        if (currentKey !== renderKeyRef.current) return;
        setRenderError(err?.message || 'Errore rendering Mermaid');
      }
    });
  }, [mermaidCode, onSvgReady]);

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(mermaidCode); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  };

  return (
    <div className="flex flex-1 min-h-0">
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-slate-50 shrink-0">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Diagramma Mermaid</h3>
          <button onClick={handleCopy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-xs font-medium text-slate-700 transition-colors">
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copiato' : 'Copia sorgente'}
          </button>
        </div>
        <div className="flex-1 overflow-auto p-6 bg-white">
          {!mermaidCode && (
            <div className="flex items-center gap-2 text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" />Generazione...</div>
          )}
          {renderError && (
            <div className="flex flex-col items-center gap-3 text-rose-500 p-8">
              <AlertCircle className="w-8 h-8" />
              <p className="text-sm font-medium">Errore rendering Mermaid</p>
              <pre className="text-xs text-slate-500 bg-slate-50 p-4 rounded-lg max-w-xl overflow-auto whitespace-pre-wrap">{renderError}</pre>
            </div>
          )}
          <div ref={svgWrapperRef} />
        </div>
      </div>
      <div className="w-80 border-l border-slate-200 bg-slate-50 flex flex-col shrink-0">
        <div className="px-4 py-2 border-b border-slate-200">
          <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Codice Sorgente</h4>
        </div>
        <pre className="flex-1 overflow-auto text-[11px] text-slate-700 font-mono whitespace-pre-wrap break-all p-4 leading-relaxed">{mermaidCode}</pre>
      </div>
    </div>
  );
}
