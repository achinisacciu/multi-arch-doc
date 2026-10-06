import React, { useState } from 'react';
import {
  Layers,
  Server,
  Workflow,
  Database,
  ArrowRight,
  Code2,
  FileText,
  Activity,
  CheckCircle2,
  Radio,
  ExternalLink,
} from 'lucide-react';
import { CompositeConfig } from '../types/jca';

interface CompositeScaViewerProps {
  composites: CompositeConfig[];
}

export const CompositeScaViewer: React.FC<CompositeScaViewerProps> = ({ composites }) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'topology' | 'wires' | 'xml'>('topology');

  if (composites.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-sm">
        <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-700">Nessun Composito SCA Trovato</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
          Carica una cartella contenente i file <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">composite.xml</code> per visualizzare la topologia e le cablature SCA.
        </p>
      </div>
    );
  }

  const selectedComposite = composites[selectedIndex] || composites[0];

  return (
    <div className="space-y-6 animate-fadeIn" id="composite-sca-viewer">
      {/* Selector if multiple composites exist */}
      {composites.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {composites.map((comp, idx) => (
            <button
              key={comp.id}
              onClick={() => setSelectedIndex(idx)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                selectedIndex === idx
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {comp.name} (v{comp.revision || '1.0'})
            </button>
          ))}
        </div>
      )}

      {/* Composite Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold font-mono">
                SCA COMPOSITE
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs text-slate-500">Rev. {selectedComposite.revision || '1.0'}</span>
              <span className="text-xs text-slate-400">•</span>
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] font-medium">
                {selectedComposite.mode || 'active'} / {selectedComposite.state || 'on'}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900">{selectedComposite.name}</h2>
            <p className="text-xs font-mono text-slate-500 break-all">
              {selectedComposite.targetNamespace || 'No targetNamespace'}
            </p>
          </div>

          {/* Sub-view switcher */}
          <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200 text-xs self-start">
            <button
              onClick={() => setActiveTab('topology')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === 'topology' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Topologia SCA
            </button>
            <button
              onClick={() => setActiveTab('wires')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === 'wires' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cablature ({selectedComposite.wires.length})
            </button>
            <button
              onClick={() => setActiveTab('xml')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === 'xml' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              XML Sorgente
            </button>
          </div>
        </div>
      </div>

      {/* Visual SCA 3-Column Architecture Board */}
      {activeTab === 'topology' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1: Inbound Services */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                  IN
                </div>
                <h3 className="font-bold text-slate-800 text-sm">Servizi Inbound (Exposed)</h3>
              </div>
              <span className="text-xs bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-full">
                {selectedComposite.services.length}
              </span>
            </div>

            {selectedComposite.services.length === 0 ? (
              <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
                Nessun servizio di ingresso esposto
              </div>
            ) : (
              selectedComposite.services.map((svc) => (
                <div key={svc.name} className="p-4 bg-white rounded-xl border border-blue-200 shadow-sm space-y-2 hover:border-blue-300 transition-colors">
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-bold text-slate-900 break-all">{svc.name}</span>
                    <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-mono text-[10px] uppercase font-bold">
                      {svc.bindingType || 'SOAP'}
                    </span>
                  </div>
                  {svc.interfacePortType && (
                    <div className="text-[11px] text-slate-600 font-mono bg-slate-50 p-1.5 rounded border border-slate-100 break-all">
                      PortType: <strong>{svc.interfacePortType}</strong>
                    </div>
                  )}
                  {svc.uiWsdlLocation && (
                    <div className="text-[10px] text-slate-400 font-mono truncate">
                      WSDL: {svc.uiWsdlLocation}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Column 2: Internal Components (BPEL, BPMN, Mediator, Task) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">
                  SCA
                </div>
                <h3 className="font-bold text-slate-800 text-sm">Componenti Interni</h3>
              </div>
              <span className="text-xs bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-full">
                {selectedComposite.components.length}
              </span>
            </div>

            {selectedComposite.components.length === 0 ? (
              <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
                Nessun componente interno
              </div>
            ) : (
              selectedComposite.components.map((comp) => {
                const badgeMap: Record<string,string> = {
                  bpel: 'bg-orange-100 text-orange-800',
                  bpmn: 'bg-amber-100 text-amber-800',
                  mediator: 'bg-indigo-100 text-indigo-800',
                  'human-task': 'bg-rose-100 text-rose-800',
                  decision: 'bg-purple-100 text-purple-800',
                  spring: 'bg-slate-100 text-slate-800',
                };
                const badgeClass = badgeMap[comp.type] || 'bg-amber-100 text-amber-800';

                return (
                  <div key={comp.name} className="p-4 bg-white rounded-xl border border-amber-200 shadow-sm space-y-2 hover:border-amber-300 transition-colors">
                    <div className="flex items-start justify-between">
                      <span className="text-xs font-bold text-slate-900 break-all">{comp.name}</span>
                      <span className={`px-1.5 py-0.5 rounded font-mono text-[10px] uppercase font-bold ${badgeClass}`}>
                        {comp.type}
                      </span>
                    </div>
                    {comp.implementationSource && (
                      <div className="text-[11px] text-slate-600 font-mono bg-slate-50 p-1.5 rounded border border-slate-100 break-all">
                        Src: <strong>{comp.implementationSource}</strong>
                      </div>
                    )}
                    {comp.references.length > 0 && (
                      <div className="text-[10px] text-slate-500">
                        Riferimenti: {comp.references.join(', ')}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Column 3: Outbound References & Adapters */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
                  OUT
                </div>
                <h3 className="font-bold text-slate-800 text-sm">Riferimenti Outbound & JCA</h3>
              </div>
              <span className="text-xs bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-full">
                {selectedComposite.references.length}
              </span>
            </div>

            {selectedComposite.references.length === 0 ? (
              <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
                Nessun riferimento outbound
              </div>
            ) : (
              selectedComposite.references.map((ref) => (
                <div key={ref.name} className="p-4 bg-white rounded-xl border border-emerald-200 shadow-sm space-y-2 hover:border-emerald-300 transition-colors">
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-bold text-slate-900 break-all">{ref.name}</span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono text-[10px] uppercase font-bold">
                      {ref.bindingType || 'JCA'}
                    </span>
                  </div>
                  {ref.jcaLocation && (
                    <div className="text-[11px] text-emerald-900 font-mono bg-emerald-50/50 p-1.5 rounded border border-emerald-100 break-all">
                      JCA: <strong>{ref.jcaLocation}</strong>
                    </div>
                  )}
                  {ref.interfacePortType && (
                    <div className="text-[10px] text-slate-500 font-mono truncate">
                      PortType: {ref.interfacePortType}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Wires View */}
      {activeTab === 'wires' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
          <h3 className="font-semibold text-slate-800 text-sm">Collegamenti Cablati Interni (SCA Wires)</h3>
          {selectedComposite.wires.length === 0 ? (
            <p className="text-xs text-slate-500">Nessuna direttiva wire esplicita nel descrittore XML.</p>
          ) : (
            <div className="space-y-2">
              {selectedComposite.wires.map((wire, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono">
                  <span className="text-blue-700 font-semibold">{wire.source}</span>
                  <div className="flex items-center gap-1 text-slate-400 font-sans text-[11px]">
                    <span>collegato a</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-emerald-700 font-semibold">{wire.target}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Raw XML View */}
      {activeTab === 'xml' && (
        <div className="bg-slate-900 rounded-2xl p-4 sm:p-6 overflow-x-auto shadow-sm">
          <pre className="text-slate-100 font-mono text-xs leading-relaxed">
            {selectedComposite.rawXml}
          </pre>
        </div>
      )}
    </div>
  );
};
