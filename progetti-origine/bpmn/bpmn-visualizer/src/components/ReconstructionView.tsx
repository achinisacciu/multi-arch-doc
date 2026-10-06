import React, { useMemo, useState } from 'react';
import { BpmnFileItem } from '../types';
import {
  buildReconstruction,
  Reconstruction,
  reconstructionToMarkdown,
  ReconstructedComposite,
  ReconstructedProcess,
  countProcesses,
} from '../utils/reconstruction';
import { buildLabelMap, buildDescriptionMap } from '../utils/documentationXmlParser';
import { bpmnToDrawioNodes, compositeToDrawioNodes, downloadDrawio, bpmnXmlToDrawio } from '../utils/drawioGenerator';
import { exportReconstructionZip, triggerBlobDownload } from '../utils/exportBatch';
import { DiagramSvgPreview } from './DiagramSvgPreview';
import {
  Boxes,
  Workflow,
  Download,
  ChevronDown,
  ChevronRight,
  FileWarning,
  Link2,
  ArrowLeft,
  Info,
  Network,
  FileQuestion,
  Layers,
  Braces,
} from 'lucide-react';

interface Props {
  files: BpmnFileItem[];
}

interface Selection {
  compositeId: string;
  processIndex: number | null;
}

export function ReconstructionView({ files }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selection, setSelection] = useState<Selection | null>(null);
  const [showStubs, setShowStubs] = useState(false);

  const rec = useMemo(() => buildReconstruction(files), [files]);

  const selectedComposite = selection
    ? rec.composites.find((c) => c.file.id === selection.compositeId) || null
    : null;
  const selectedProcess =
    selectedComposite && selection?.processIndex !== null && selection?.processIndex !== undefined
      ? selectedComposite.processes[selection.processIndex] || null
      : null;

  const toggle = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const selectProcess = (compositeId: string, index: number) =>
    setSelection({ compositeId, processIndex: index });

  const handleExport = () => {
    const md = reconstructionToMarkdown(rec);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ricostruzione-portafoglio-soa.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const [exporting, setExporting] = useState(false);
  const handleExportZip = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const blob = await exportReconstructionZip(rec);
      triggerBlobDownload(blob, 'portafoglio-soa.zip');
    } finally {
      setExporting(false);
    }
  };

  const processCount = countProcesses(rec);

  return (
    <div className="flex h-full min-h-0 gap-4 p-3 lg:p-5">
      {/* LEFT */}
      <div className="flex w-80 shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Ricostruzione</p>
          <h3 className="mt-1 text-sm font-semibold text-slate-800">Portafoglio SOA</h3>
          <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px]">
            <div className="rounded-lg bg-indigo-50 px-2 py-1.5 text-indigo-700">
              <span className="font-bold">{rec.composites.length}</span> compositi
            </div>
            <div className="rounded-lg bg-blue-50 px-2 py-1.5 text-blue-700">
              <span className="font-bold">{processCount}</span> processi
            </div>
            <div className="rounded-lg bg-slate-50 px-2 py-1.5 text-slate-600">
              <span className="font-bold">{rec.documentationFiles.length}</span> doc.xml
            </div>
            <div className="rounded-lg bg-amber-50 px-2 py-1.5 text-amber-700">
              <span className="font-bold">{rec.stubFiles.length}</span> stub
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {rec.composites.length === 0 && (
            <div className="p-6 text-center text-xs text-slate-400">
              Nessun composite.xml trovato nella cartella.
            </div>
          )}

          <SectionLabel icon={<Boxes className="h-3 w-3" />} text="Compositi" count={rec.composites.length} />
          {rec.composites.map((c) => {
            const isOpen = !!expanded[`c:${c.file.id}`];
            const isSel = selection?.compositeId === c.file.id && selection?.processIndex === null;
            return (
              <div key={c.file.id} className="border-b border-slate-50">
                <div className="flex items-center gap-1 px-2">
                  <button onClick={() => toggle(`c:${c.file.id}`)} className="p-1 text-slate-400 hover:text-slate-600">
                    {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={() => {
                      setSelection({ compositeId: c.file.id, processIndex: null });
                      toggle(`c:${c.file.id}`);
                    }}
                    className={`flex flex-1 items-center gap-2 rounded-lg px-1.5 py-2 text-left text-xs transition-colors ${
                      isSel ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Boxes className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                    <span className="truncate font-medium">{c.parsed.compositeName}</span>
                    <span className="ml-auto text-[9px] font-semibold text-slate-400">{c.processes.length}</span>
                  </button>
                </div>
                {isOpen && (
                  <div className="pb-2 pl-9 pr-3">
                    <p className="truncate font-mono text-[10px] text-slate-400">{c.file.relativePath}</p>
                    {c.processes.map((p, i) => {
                      const isProc = selection?.compositeId === c.file.id && selection?.processIndex === i;
                      return (
                        <button
                          key={`${c.file.id}:${p.componentName}`}
                          onClick={() => selectProcess(c.file.id, i)}
                          className={`mt-1 flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[11px] transition-colors ${
                            isProc ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          {p.bpmnFile ? <Workflow className="h-3 w-3 shrink-0 text-blue-500" /> : <FileQuestion className="h-3 w-3 shrink-0 text-slate-400" />}
                          <span className="truncate">{p.componentName}</span>
                          {p.documentation && <Link2 className="ml-auto h-2.5 w-2.5 shrink-0 text-emerald-500" />}
                        </button>
                      );
                    })}
                    {c.otherComponents.length > 0 && (
                      <p className="mt-1.5 text-[10px] text-slate-400">
                        + {c.otherComponents.length} altri componenti
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {rec.orphanProcesses.length > 0 && (
            <>
              <SectionLabel icon={<FileQuestion className="h-3 w-3" />} text="Processi non associati" count={rec.orphanProcesses.length} />
              {rec.orphanProcesses.map((f) => (
                <div key={f.id} className="flex items-center gap-2 px-4 py-1.5 text-[11px] text-slate-500">
                  <Workflow className="h-3 w-3 shrink-0 text-slate-400" />
                  <span className="truncate font-mono">{f.name}</span>
                </div>
              ))}
            </>
          )}

          {rec.orphanDocumentation.length > 0 && (
            <>
              <SectionLabel icon={<FileWarning className="h-3 w-3" />} text="Documentazione orfana" count={rec.orphanDocumentation.length} />
              {rec.orphanDocumentation.map((f) => (
                <div key={f.id} className="flex items-center gap-2 px-4 py-1.5 text-[11px] text-slate-500">
                  <FileWarning className="h-3 w-3 shrink-0 text-amber-400" />
                  <span className="truncate font-mono">{f.name}</span>
                </div>
              ))}
            </>
          )}

          {rec.stubFiles.length > 0 && (
            <>
              <button
                onClick={() => setShowStubs(!showStubs)}
                className="flex w-full items-center gap-2 px-3 py-2 text-[11px] font-medium text-slate-400 hover:bg-slate-50"
              >
                {showStubs ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                <FileWarning className="h-3 w-3 text-amber-400" /> Stub ignorati ({rec.stubFiles.length})
              </button>
              {showStubs && (
                <div className="pb-2">
                  {rec.stubFiles.map((f) => (
                    <div key={f.id} className="flex items-center gap-2 px-5 py-1 text-[10px] text-slate-400">
                      <span className="truncate font-mono">{f.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="border-t border-slate-100 p-3">
          <button
            onClick={handleExportZip}
            disabled={exporting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-60"
          >
            <Download className="h-3.5 w-3.5" /> {exporting ? 'Generazione ZIP…' : 'Esporta ZIP (tutto il portafoglio)'}
          </button>
          <button
            onClick={handleExport}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" /> Esporta documentazione (.md)
          </button>
        </div>
      </div>

      {/* RIGHT */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {!selectedComposite ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-slate-400">
            <Layers className="h-10 w-10 text-slate-300" />
            <p className="max-w-sm text-sm">
              Seleziona un composite per ricostruirne la documentazione: componenti, processi BPMN, servizi,
              reference e relazioni verso gli altri compositi del portafoglio.
            </p>
          </div>
        ) : selectedProcess ? (
          <ProcessDetail
            composite={selectedComposite}
            process={selectedProcess}
            onBack={() => setSelection({ compositeId: selectedComposite.file.id, processIndex: null })}
          />
        ) : (
          <CompositeDetail composite={selectedComposite} onSelectProcess={selectProcess} />
        )}
      </div>
    </div>
  );
}

function SectionLabel({ icon, text, count }: { icon: React.ReactNode; text: string; count: number }) {
  return (
    <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
      {icon}
      <span className="truncate">{text}</span>
      <span className="ml-auto">{count}</span>
    </div>
  );
}

// ---------- Composite detail ----------

function CompositeDetail({
  composite,
  onSelectProcess,
}: {
  composite: ReconstructedComposite;
  onSelectProcess: (compositeId: string, index: number) => void;
}) {
  const diagram = useMemo(() => compositeToDrawioNodes(composite.parsed), [composite.parsed]);
  return (
    <>
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <Boxes className="h-4 w-4 text-indigo-500" />
          <div>
            <h3 className="text-sm font-semibold text-slate-800">{composite.parsed.compositeName}</h3>
            <p className="text-[10px] text-slate-400">
              {composite.parsed.applicationName ? `app: ${composite.parsed.applicationName} · ` : ''}
              rev: {composite.parsed.revision || '—'} · {composite.file.relativePath}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="mb-4 rounded-xl border border-slate-100">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
              <Network className="h-3 w-3" /> Diagramma composite
            </p>
            <p className="text-[9px] text-slate-400">
              {diagram.nodes.length} nodi · {diagram.edges.length} wire
            </p>
          </div>
          <div className="overflow-auto p-3">
            <div className="h-[460px]">
              <DiagramSvgPreview nodes={diagram.nodes} edges={diagram.edges} />
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-100 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-600">
              <Network className="h-3 w-3" /> Servizi esposti ({composite.services.length})
            </p>
            {composite.services.length === 0 && <p className="text-[11px] text-slate-400">Nessun servizio.</p>}
            {composite.services.map((s) => (
              <div key={s.name} className="mb-1 rounded-lg bg-emerald-50/60 px-2 py-1.5 text-[11px]">
                <p className="font-medium text-emerald-800">{s.name}</p>
                {s.wsdlLocation && <p className="truncate font-mono text-[9px] text-emerald-600">{s.wsdlLocation}</p>}
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-slate-100 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-amber-600">
              <Link2 className="h-3 w-3" /> Reference verso l'esterno ({composite.references.length})
            </p>
            {composite.references.length === 0 && <p className="text-[11px] text-slate-400">Nessuna reference.</p>}
            {composite.references.map((r) => (
              <div key={r.name} className="mb-1 rounded-lg bg-amber-50/60 px-2 py-1.5 text-[11px]">
                <p className="font-medium text-amber-800">{r.name}</p>
                {r.wsdlLocation && <p className="truncate font-mono text-[9px] text-amber-600">{r.wsdlLocation}</p>}
              </div>
            ))}
          </div>
        </div>

        {composite.externalRefs.length > 0 && (
          <div className="mt-4 rounded-xl border border-slate-100 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-indigo-600">
              <Link2 className="h-3 w-3" /> Dipendenze da altri compositi ({composite.externalRefs.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {composite.externalRefs.map((r) => (
                <span key={r.name} className="rounded-full border border-indigo-100 bg-indigo-50/60 px-2.5 py-1 text-[10px] font-medium text-indigo-700" title={r.wsdlLocation}>
                  {r.name} → {r.target}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
            <Workflow className="h-3 w-3" /> Processi ({composite.processes.length})
          </p>
          {composite.processes.map((p, i) => (
            <button
              key={p.componentName}
              onClick={() => onSelectProcess(composite.file.id, i)}
              className="mb-2 flex w-full items-center gap-3 rounded-xl border border-slate-100 p-3 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/40"
            >
              {p.bpmnFile ? <Workflow className="h-4 w-4 shrink-0 text-blue-500" /> : <FileQuestion className="h-4 w-4 shrink-0 text-slate-400" />}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-700">{p.componentName}</p>
                <p className="truncate text-[10px] text-slate-400">
                  {p.bpmnFile ? p.bpmnFile.relativePath : 'processo BPMN non trovato nel portafoglio'}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5 text-[9px]">
                {p.documentation && (
                  <span className="flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-600">
                    <Braces className="h-2.5 w-2.5" /> {p.documentation.topics.length}
                  </span>
                )}
                {p.parsed && (
                  <span className="rounded bg-blue-50 px-1.5 py-0.5 font-medium text-blue-600">
                    {p.parsed.stats.totalElements} elem.
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        {composite.otherComponents.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
              Altri componenti ({composite.otherComponents.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {composite.otherComponents.map((oc) => (
                <span key={oc.id} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-600">
                  {oc.name} <span className="text-slate-400">({oc.implementation || oc.binding || 'componente'})</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ---------- Process detail ----------

function ProcessDetail({
  composite,
  process,
  onBack,
}: {
  composite: ReconstructedComposite;
  process: ReconstructedProcess;
  onBack: () => void;
}) {
  const labelMap = useMemo(
    () => (process.documentation ? buildLabelMap(process.documentation, ['it', 'en']) : new Map<string, string>()),
    [process.documentation]
  );
  const descMap = useMemo(
    () => (process.documentation ? buildDescriptionMap(process.documentation, ['it', 'en']) : new Map<string, string>()),
    [process.documentation]
  );

  const diagram = useMemo(
    () => (process.bpmnFile ? bpmnToDrawioNodes(process.bpmnFile.content) : { nodes: [], edges: [] }),
    [process.bpmnFile]
  );

  const allElements = process.parsed?.elements || [];
  const elements = useMemo(() => allElements.filter((e) => e.rawType !== 'sequenceFlow'), [allElements]);
  const flows = useMemo(() => {
    const out: Array<{ id: string; from: string; to: string; condition?: string }> = [];
    for (const el of allElements) {
      if (el.rawType !== 'sequenceFlow') continue;
      const src = allElements.find((e) => e.id === el.incoming[0]);
      const tgt = allElements.find((e) => e.id === el.outgoing[0]);
      out.push({
        id: el.id,
        from: src ? src.name || src.id : el.incoming[0],
        to: tgt ? tgt.name || tgt.id : el.outgoing[0],
        condition: el.conditionExpression,
      });
    }
    return out;
  }, [allElements]);

  const label = (id: string, fallback: string) => labelMap.get(id) || fallback;

  return (
    <>
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <Workflow className="h-4 w-4 text-blue-500" />
          <div>
            <h3 className="text-sm font-semibold text-slate-800">{process.componentName}</h3>
            <p className="text-[10px] text-slate-400">
              di <span className="font-medium text-indigo-500">{composite.parsed.compositeName}</span>
              {process.parsed?.processName ? ` · processo "${process.parsed.processName}"` : ''}
              {process.bpmnFile ? ` · ${process.bpmnFile.relativePath}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Composite
          </button>
          {process.bpmnFile && (
            <button
              onClick={() => downloadDrawio(bpmnXmlToDrawio(process.bpmnFile!.content, process.bpmnFile!.name), process.bpmnFile!.name)}
              className="flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500"
            >
              <Download className="h-3.5 w-3.5" /> .drawio
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {!process.bpmnFile && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
            ⚠ Processo BPMN non trovato nel portafoglio: impossibile ricostruirne il diagramma e gli elementi.
          </div>
        )}

        {process.bpmnFile && (
          <div className="mb-4 rounded-xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                <Info className="h-3 w-3" /> Diagramma processo
              </p>
              <p className="text-[9px] text-slate-400">
                {diagram.nodes.length} nodi · {diagram.edges.length} flussi
              </p>
            </div>
            <div className="overflow-auto p-3">
              <div className="h-[540px]">
                <DiagramSvgPreview
                  nodes={diagram.nodes}
                  edges={diagram.edges}
                  xmlContent={process.bpmnFile.content}
                />
              </div>
            </div>
          </div>
        )}

        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Elementi" value={process.parsed?.stats.totalElements ?? '—'} />
          <Stat label="Attività" value={process.parsed?.stats.tasksCount ?? '—'} />
          <Stat label="Gateway" value={process.parsed?.stats.gatewaysCount ?? '—'} />
          <Stat label="Topic doc" value={process.documentation?.topics.length ?? '—'} />
        </div>

        {elements.length > 0 && (
          <div className="mb-4 rounded-xl border border-slate-100">
            <div className="border-b border-slate-100 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
              Elementi del processo ({elements.length})
            </div>
            <div className="max-h-80 overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-left text-[10px] uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2 font-medium">ID</th>
                    <th className="px-3 py-2 font-medium">Nome</th>
                    <th className="px-3 py-2 font-medium">Tipo</th>
                    <th className="px-3 py-2 font-medium">Descrizione</th>
                  </tr>
                </thead>
                <tbody>
                  {elements.map((el) => (
                    <tr key={el.id} className="border-t border-slate-50 align-top hover:bg-slate-50">
                      <td className="px-3 py-1.5 font-mono text-[10px] text-slate-400">{el.id}</td>
                      <td className="px-3 py-1.5 font-medium text-slate-700">{label(el.id, el.name || el.id)}</td>
                      <td className="px-3 py-1.5 text-[10px] text-slate-500">{el.type}</td>
                      <td className="px-3 py-1.5 text-[10px] text-slate-500">{descMap.get(el.id) || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {flows.length > 0 && (
          <div className="rounded-xl border border-slate-100">
            <div className="border-b border-slate-100 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
              Flussi ({flows.length})
            </div>
            <div className="max-h-60 overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-left text-[10px] uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2 font-medium">Da</th>
                    <th className="px-3 py-2 font-medium">A</th>
                    <th className="px-3 py-2 font-medium">Condizione</th>
                  </tr>
                </thead>
                <tbody>
                  {flows.map((f, i) => (
                    <tr key={i} className="border-t border-slate-50 hover:bg-slate-50">
                      <td className="px-3 py-1.5 font-medium text-slate-700">{f.from}</td>
                      <td className="px-3 py-1.5 text-slate-600">{f.to}</td>
                      <td className="px-3 py-1.5 font-mono text-[10px] text-amber-600">{f.condition || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-100 px-3 py-2 text-center">
      <p className="text-lg font-bold text-slate-800">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  );
}
