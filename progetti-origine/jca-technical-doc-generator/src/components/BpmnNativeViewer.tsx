import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { BpmnProcessInfo, OracleEcosystem } from '../types/jca';
import { buildBpmnGraph } from '../services/bpmnFlowGraph';
import { BpmnFlowDiagramViewer } from './BpmnFlowDiagramViewer';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';

interface Props {
  proc: BpmnProcessInfo;
  ecosystem?: OracleEcosystem;
}

/**
 * Render BPMN nativo (bpmn-js, standard Camunda): simboli BPMN 2.0 reali,
 * zoom/pan navigabili, badge sui nodi collegati ad artefatti, click → tooltip.
 * Se il file non ha DI (BPMNDiagram) o l'import fallisce → fallback al
 * diagramma SVG semplificato (stessi dati, niente perdita).
 */
export const BpmnNativeViewer: React.FC<Props> = ({ proc, ecosystem }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<{ destroy: () => void } | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [forceSimple, setForceSimple] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const graph = useMemo(() => buildBpmnGraph(proc, ecosystem), [proc, ecosystem]);
  const linkedIds = useMemo(() => new Set(graph.nodes.filter((n) => n.links.length > 0).map((n) => n.id)), [graph]);

  useEffect(() => {
    if (forceSimple) return;
    let cancelled = false;
    setStatus('loading');
    setError(null);
    (async () => {
      try {
        const { default: NavigatedViewer } = await import('bpmn-js/lib/NavigatedViewer');
        if (cancelled || !containerRef.current) return;
        const viewer = new NavigatedViewer({ container: containerRef.current });
        viewerRef.current = viewer;
        await viewer.importXML(proc.rawXml);
        if (cancelled) {
          viewer.destroy();
          return;
        }
        // Vista d'insieme
        const bus = viewer.get.bind(viewer) as (name: string) => {
          zoom?: (mode: string) => void;
          add?: (id: string, cfg: unknown) => void;
          get?: (id: string) => unknown;
          on?: (ev: string, cb: (e: { element?: { id?: string } }) => void) => void;
        };
        try {
          bus('canvas').zoom?.('fit-viewport');
        } catch {
          /* noop */
        }
        // Badge sui nodi con collegamenti ad artefatti reali
        try {
          const overlays = bus('overlays');
          const registry = bus('elementRegistry');
          linkedIds.forEach((id) => {
            try {
              if (!registry.get?.(id)) return;
              const badge = document.createElement('div');
              badge.textContent = '∞';
              badge.title = 'Collegato ad artefatti (vedi tooltip)';
              badge.style.cssText =
                'width:16px;height:16px;border-radius:9999px;background:#4f46e5;color:#fff;' +
                'font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;cursor:pointer;';
              overlays.add?.(id, { position: { top: -10, right: -10 }, html: badge });
            } catch {
              /* singolo overlay fallito: ignora */
            }
          });
        } catch {
          /* noop */
        }
        // Click su elemento → tooltip
        try {
          bus('eventBus').on?.('element.click', (e: { element?: { id?: string } }) => {
            if (e.element?.id) setSelectedId(e.element.id);
          });
        } catch {
          /* noop */
        }
        setStatus('ready');
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200));
          setStatus('fallback');
        }
      }
    })();
    return () => {
      cancelled = true;
      try {
        viewerRef.current?.destroy();
      } catch {
        /* noop */
      }
      viewerRef.current = null;
    };
  }, [proc, forceSimple, linkedIds]);

  const selected = graph.nodes.find((n) => n.id === selectedId) || null;

  if (forceSimple || status === 'fallback') {
    return (
      <div>
        {status === 'fallback' && !forceSimple && error && (
          <div className="mb-2 flex items-start gap-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <div>
              Render nativo non possibile (manca il layout DI nel file o XML non standard): mostro il diagramma semplificato.
              <span className="block font-mono text-[10px] text-amber-700 mt-0.5 break-all">{error}</span>
            </div>
          </div>
        )}
        <BpmnFlowDiagramViewer proc={proc} ecosystem={ecosystem} />
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-bold text-slate-800">
          Flusso BPMN nativo: {proc.name}
          {graph.syntheticOrder && (
            <span className="ml-1 px-2 py-0.5 rounded bg-amber-100 border border-amber-300 text-amber-800 text-[10px] font-semibold">
              metadati da parser (il disegno usa il DI del file)
            </span>
          )}
        </h4>
        <button
          onClick={() => setForceSimple(true)}
          className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-[11px] font-semibold hover:bg-slate-50"
          title="Passa al diagramma semplificato (sempre disponibile)"
        >
          Vista semplificata
        </button>
      </div>
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {status === 'loading' && (
          <div className="p-8 text-center text-xs text-slate-400 animate-pulse">Caricamento renderer BPMN…</div>
        )}
        <div ref={containerRef} style={{ height: 420, display: status === 'loading' ? 'none' : 'block' }} />
      </div>
      {selected ? (
        <div className="bg-white rounded-lg border border-indigo-200 p-3 text-xs space-y-1.5" role="dialog" aria-label={`Dettagli ${selected.label}`}>
          <div className="flex items-center justify-between">
            <strong className="text-slate-900">{selected.label}</strong>
            <button onClick={() => setSelectedId(null)} className="text-slate-400 hover:text-slate-700 text-xs px-1">✕ chiudi</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
            <div><span className="text-slate-500">Tipo:</span> <code className="font-mono">{selected.kind}</code></div>
            <div><span className="text-slate-500">ID XML:</span> <code className="font-mono break-all">{selected.id}</code></div>
            {selected.lane && <div><span className="text-slate-500">Lane:</span> {selected.lane}</div>}
            <div><span className="text-slate-500">File:</span> <code className="font-mono break-all">{selected.source}</code></div>
          </div>
          {selected.detail && <div className="text-[11px] text-slate-600">{selected.detail}</div>}
          {selected.links.length > 0 ? (
            <div className="pt-1">
              <div className="text-[11px] font-semibold text-slate-700">Collegamenti ad artefatti reali:</div>
              <ul className="text-[11px] space-y-0.5">
                {selected.links.map((l, i) => (
                  <li key={i} className="font-mono text-indigo-700 break-all">
                    [{l.kind}] {l.label} → {l.path}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-[11px] text-slate-400">Nessun collegamento ad artefatti (unresolved).</div>
          )}
        </div>
      ) : (
        status === 'ready' && (
          <div className="text-[11px] text-slate-400">Clicca un elemento del diagramma per i dettagli. Rotella + trascinamento per zoom/pan.</div>
        )
      )}
    </div>
  );
};
