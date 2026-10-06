import React, { useState } from 'react';
import {
  FileCode,
  Layers,
  Code,
  FileSpreadsheet,
  Shuffle,
  Tag,
  ArrowRight,
} from 'lucide-react';
import { WsdlContractInfo, XsdSchemaInfo, XsltInfo } from '../types/jca';

interface ContractsTransformsViewerProps {
  wsdlContracts: WsdlContractInfo[];
  xsdSchemas: XsdSchemaInfo[];
  xsltTransforms: XsltInfo[];
}

export const ContractsTransformsViewer: React.FC<ContractsTransformsViewerProps> = ({
  wsdlContracts,
  xsdSchemas,
  xsltTransforms,
}) => {
  const [activeTab, setActiveTab] = useState<'wsdl' | 'xsd' | 'xslt'>('wsdl');
  const [visibleCount, setVisibleCount] = useState(50);
  React.useEffect(() => setVisibleCount(50), [activeTab]);

  return (
    <div className="space-y-6 animate-fadeIn" id="contracts-transforms-viewer">
      {/* Sub-tab Switcher */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200/80 shadow-sm">
        <button
          onClick={() => setActiveTab('wsdl')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'wsdl' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <FileCode className="w-3.5 h-3.5" />
          Contratti WSDL ({wsdlContracts.length})
        </button>

        <button
          onClick={() => setActiveTab('xsd')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'xsd' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          Schemi Dati XSD ({xsdSchemas.length})
        </button>

        <button
          onClick={() => setActiveTab('xslt')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'xslt' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Shuffle className="w-3.5 h-3.5" />
          Trasformazioni XSLT ({xsltTransforms.length})
        </button>
      </div>

      {/* WSDL Tab */}
      {activeTab === 'wsdl' && (
        <div className="space-y-4">
          {wsdlContracts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center text-xs text-slate-400">
              Nessun file WSDL rilevato.
            </div>
          ) : (
            <>
            {wsdlContracts.slice(0, visibleCount).map((wsdl) => (
              <div key={wsdl.id} className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <span className="px-2 py-0.5 rounded bg-cyan-50 text-cyan-700 font-mono text-[11px] font-bold">
                    WSDL CONTRACT (SOAP)
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-1">{wsdl.name}</h3>
                  <p className="text-xs font-mono text-slate-400">{wsdl.relativePath || wsdl.fileName}</p>
                  {wsdl.targetNamespace && (
                    <div className="text-[11px] font-mono text-cyan-800 bg-cyan-50/50 p-1.5 rounded mt-2 break-all">
                      TargetNamespace: {wsdl.targetNamespace}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {wsdl.portTypes.map((pt) => (
                    <div key={pt.name} className="p-4 bg-slate-50 rounded-xl border border-slate-200/70 space-y-2">
                      <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                        <span>PortType:</span>
                        <code className="text-cyan-700 font-mono">{pt.name}</code>
                      </h4>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-white border-y border-slate-200 text-slate-600 font-semibold">
                              <th className="py-2 px-3">Operazione</th>
                              <th className="py-2 px-3">Messaggio Input</th>
                              <th className="py-2 px-3">Messaggio Output</th>
                              <th className="py-2 px-3">Faults</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {pt.operations.map((op) => (
                              <tr key={op.name}>
                                <td className="py-2 px-3 font-semibold text-slate-900 font-mono">{op.name}</td>
                                <td className="py-2 px-3 font-mono text-slate-600">{op.inputMessage || '-'}</td>
                                <td className="py-2 px-3 font-mono text-slate-600">{op.outputMessage || '-'}</td>
                                <td className="py-2 px-3 font-mono text-rose-600">
                                  {op.faultMessages.join(', ') || '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {wsdlContracts.length > visibleCount && (
              <button onClick={() => setVisibleCount((c) => c + 50)} className="w-full py-2 rounded-xl bg-slate-100 text-xs font-semibold text-slate-600 hover:bg-slate-200">Carica altri 50 ({wsdlContracts.length - visibleCount} rimanenti)</button>
            )}
            </>
          )}
        </div>
      )}

      {/* XSD Tab */}
      {activeTab === 'xsd' && (
        <div className="space-y-4">
          {xsdSchemas.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center text-xs text-slate-400">
              Nessun file XSD rilevato.
            </div>
          ) : (
            <>
            {xsdSchemas.slice(0, visibleCount).map((xsd) => (
              <div key={xsd.id} className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <span className="px-2 py-0.5 rounded bg-teal-50 text-teal-700 font-mono text-[11px] font-bold">
                    XSD XML SCHEMA
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-1">{xsd.name}</h3>
                  <p className="text-xs font-mono text-slate-400">{xsd.relativePath || xsd.fileName}</p>
                  {xsd.targetNamespace && (
                    <div className="text-[11px] font-mono text-teal-800 bg-teal-50/50 p-1.5 rounded mt-2 break-all">
                      TargetNamespace: {xsd.targetNamespace}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Root Elements */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-2">
                    <h4 className="text-xs font-bold text-slate-800">Elementi Root ({xsd.elements.length})</h4>
                    {xsd.elements.length === 0 ? (
                      <p className="text-[11px] text-slate-400">Nessun elemento root dichiarato.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {xsd.elements.map((el) => (
                          <span key={el.name} className="px-2 py-1 rounded bg-white border border-slate-200 text-xs font-mono text-slate-800">
                            &lt;{el.name}&gt;
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Complex Types */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-2">
                    <h4 className="text-xs font-bold text-slate-800">Tipi Complessi ({xsd.complexTypes.length})</h4>
                    {xsd.complexTypes.length === 0 ? (
                      <p className="text-[11px] text-slate-400">Nessun complexType dichiarato.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {xsd.complexTypes.map((ct) => (
                          <span key={ct.name} className="px-2 py-1 rounded bg-white border border-slate-200 text-xs font-mono text-slate-800">
                            {ct.name} ({ct.elementCount} campi)
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {xsdSchemas.length > visibleCount && (
              <button onClick={() => setVisibleCount((c) => c + 50)} className="w-full py-2 rounded-xl bg-slate-100 text-xs font-semibold text-slate-600 hover:bg-slate-200">Carica altri 50 ({xsdSchemas.length - visibleCount} rimanenti)</button>
            )}
            </>
          )}
        </div>
      )}

      {/* XSLT Tab */}
      {activeTab === 'xslt' && (
        <div className="space-y-4">
          {xsltTransforms.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center text-xs text-slate-400">
              Nessun foglio di stile XSLT (.xsl) rilevato.
            </div>
          ) : (
            <>
            {xsltTransforms.slice(0, visibleCount).map((xsl) => (
              <div key={xsl.id} className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-mono text-[11px] font-bold">
                    XSLT DATA TRANSFORMATION
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-1">{xsl.name}</h3>
                  <p className="text-xs font-mono text-slate-400">{xsl.relativePath || xsl.fileName}</p>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-700">Template Matches:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {xsl.templateMatches.map((tm, idx) => (
                      <span key={idx} className="px-2.5 py-1 rounded-lg bg-purple-50 border border-purple-200 text-xs font-mono text-purple-900">
                        match="{tm}"
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {xsltTransforms.length > visibleCount && (
              <button onClick={() => setVisibleCount((c) => c + 50)} className="w-full py-2 rounded-xl bg-slate-100 text-xs font-semibold text-slate-600 hover:bg-slate-200">Carica altri 50 ({xsltTransforms.length - visibleCount} rimanenti)</button>
            )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
