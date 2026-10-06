import React, { useEffect, useRef, useState } from 'react';
import { ParsedBpmn } from '../types';
import { bpmnToMermaid } from '../utils/mermaidConverter';
import { Copy, Check, Loader2, AlertCircle, ChevronRight, ChevronDown, Maximize2, Minimize2 } from 'lucide-react';

interface Props {
  parsed: ParsedBpmn;
  onSvgReady?: (html: string) => void;
}

export function MermaidView({ parsed, onSvgReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgWrapperRef = useRef<HTMLDivElement>(null);
  const [mermaidCode, setMermaidCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
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
          if (el) {
            el.style.maxWidth = '100%';
            el.style.width = '100%';
            el.style.height = 'auto';
            el.style.display = 'block';
            el.style.margin = '0 auto';
          }
          if (onSvgReady) onSvgReady(svgWrapperRef.current.innerHTML);
        }
      } catch (err: any) {
        if (currentKey !== renderKeyRef.current) return;
        setRenderError(err?.message || 'Errore rendering Mermaid');
      }
    });
  }, [mermaidCode]);

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(mermaidCode); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  };

  useEffect(() => {
    if (!svgWrapperRef.current || !mermaidCode) return;
    const svg = svgWrapperRef.current.querySelector('svg');
    if (svg) {
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', 'auto');
      svg.style.maxWidth = '100%';
      svg.style.width = '100%';
      svg.style.height = 'auto';
    }
  }, [isExpanded, mermaidCode]);

  return (
    <div className={isExpanded ? 'fixed inset-0 z-[60] bg-slate-950/90 p-3' : 'flex flex-1 min-h-0 flex-col gap-3 bg-slate-100 p-3 lg:p-5 xl:flex-row'}>
      <div className={isExpanded ? 'flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-slate-700 bg-white shadow-[0_40px_120px_-40px_rgba(15,23,42,0.75)]' : 'flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_80px_-36px_rgba(15,23,42,0.28)]'}>
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 lg:px-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">Mermaid</p>
            <h3 className="mt-1 text-sm font-semibold text-slate-800">Anteprima del diagramma</h3>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setIsExpanded((prev) => !prev)} className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100">
              {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              {isExpanded ? 'Riduci' : 'Espandi'}
            </button>
            <button onClick={() => setShowCode((prev) => !prev)} className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100">
              {showCode ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              {showCode ? 'Nascondi codice' : 'Mostra codice'}
            </button>
            <button onClick={handleCopy} className="flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-700">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiato' : 'Copia'}
            </button>
          </div>
        </div>

        <div ref={containerRef} className="flex-1 overflow-auto bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.08),_transparent_40%),linear-gradient(180deg,_#f8fafc_0%,_#ffffff_100%)] p-4 lg:p-6">
          {!mermaidCode && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Generazione in corso...
            </div>
          )}
          {renderError && (
            <div className="mx-auto flex max-w-xl flex-col items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-600">
              <AlertCircle className="w-8 h-8" />
              <p className="text-sm font-semibold">Errore rendering Mermaid</p>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-white/80 p-4 text-left text-xs text-slate-600">{renderError}</pre>
            </div>
          )}
          <div ref={svgWrapperRef} className="flex min-h-full w-full items-center justify-center overflow-auto p-2" />
        </div>
      </div>

      {showCode && (
        <div className="flex min-h-[220px] w-full shrink-0 flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-slate-900 text-slate-100 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.55)] xl:w-[320px]">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">Sorgente</p>
              <h4 className="mt-1 text-sm font-semibold text-white">Codice Mermaid</h4>
            </div>
          </div>
          <pre className="flex-1 overflow-auto whitespace-pre-wrap break-all p-4 text-[11px] leading-relaxed text-slate-300">{mermaidCode}</pre>
        </div>
      )}
    </div>
  );
}
