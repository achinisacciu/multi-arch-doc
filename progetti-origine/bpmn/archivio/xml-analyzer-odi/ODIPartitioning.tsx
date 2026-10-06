import React, { useState } from "react";
import { Check, Clipboard, AlertCircle, Sparkles, Layers, ArrowRight, Share2 } from "lucide-react";

interface ODIPartitioningProps {
  xmlInput: string;
}

interface ODIObjectDefinition {
  name: string;
  tag: string;
  requiredFields: string[];
  description: string;
  sampleXml: string;
}

const ODI_OBJECTS: ODIObjectDefinition[] = [
  {
    name: "SnpMapping",
    tag: "SnpMapping",
    requiredFields: ["IMapping", "I_MAPPING", "Name", "MappingId", "Description", "IOwnerMapping"],
    description: "L'oggetto radice principale di Oracle Data Integrator che contiene la definizione logica e fisica dell'intero flusso ETL.",
    sampleXml: `<SnpMapping IMapping="20501" I_MAPPING="20501" Name="MAP_SALES_DWH_LOAD" MappingId="d1be648d-6ec6-4660-8f92-5d4b58498877" Description="ETL Load Sales into Data Warehouse" IOwnerMapping="3001">
  <!-- Contiene SnpMapComp, SnpMapConn, ecc. -->
</SnpMapping>`
  },
  {
    name: "SnpMapComp",
    tag: "SnpMapComp",
    requiredFields: ["IMapComp", "IOwnerMapComp", "Name", "ComponentType", "Description"],
    description: "Rappresenta un singolo nodo o componente di elaborazione, sorgente o destinazione nel flusso (es. Datastore sorgente/target, Filtro, Joiner, Aggregatore).",
    sampleXml: `<SnpMapComp IMapComp="4001" IOwnerMapComp="20501" Name="SRC_SALES_TRANSACTIONS" ComponentType="DATA_SOURCE" Description="Source sales database table">
  <!-- Contiene SnpMapCp (Connection Points) -->
</SnpMapComp>`
  },
  {
    name: "SnpMapCp",
    tag: "SnpMapCp",
    requiredFields: ["I_MAP_CP", "Name", "Direction", "OwnerComponentId"],
    description: "Connection Point (Porta). Definisce i punti di ingresso (INPUT) o uscita (OUTPUT) del componente che raggruppano i campi.",
    sampleXml: `<SnpMapCp I_MAP_CP="5001" Name="IN_OUT_CP" Direction="IN_OUT" OwnerComponentId="4001">
  <!-- Contiene SnpMapAttr (Attributi) -->
</SnpMapCp>`
  },
  {
    name: "SnpMapAttr",
    tag: "SnpMapAttr",
    requiredFields: ["I_MAP_ATTR", "Name", "DataType", "Precision", "Scale", "Length", "OwnerPortId"],
    description: "Attributo o colonna logica all'interno di una porta. Rappresenta la struttura dei dati che viaggia nel flusso.",
    sampleXml: `<SnpMapAttr I_MAP_ATTR="6001" Name="TX_ID" DataType="NUMERIC" Precision="10" Scale="0" Length="10" OwnerPortId="5001">
  <!-- Contiene SnpMapProp (Proprietà dell'attributo) -->
</SnpMapAttr>`
  },
  {
    name: "SnpMapProp",
    tag: "SnpMapProp",
    requiredFields: ["I_MAP_PROP", "Name", "Value", "OwnerAttributeId"],
    description: "Coppia chiave-valore di metadati per attributi o porte. Memorizza espressioni SQL, formule, nomi fisici delle colonne, o flag.",
    sampleXml: `<SnpMapProp I_MAP_PROP="7001" Name="COLUMN_NAME" Value="TRANSACTION_ID" OwnerAttributeId="6001"/>`
  },
  {
    name: "SnpMapConn",
    tag: "SnpMapConn",
    requiredFields: ["I_MAP_CONN", "Name", "SourceCompId", "TargetCompId", "SourcePortId", "TargetPortId"],
    description: "Connettore logico-fisico (Edge del grafo). Mappa e collega la porta di uscita di un componente con la porta di ingresso del successivo.",
    sampleXml: `<SnpMapConn I_MAP_CONN="8001" Name="CONN_SRC_TO_TRN" SourceCompId="4001" TargetCompId="4002" SourcePortId="5001" TargetPortId="5002"/>`
  }
];

export const ODIPartitioning: React.FC<ODIPartitioningProps> = ({ xmlInput }) => {
  const [copiedObj, setCopiedObj] = useState<string | null>(null);

  // Detect presence of each tag in the uploaded XML
  const checkTagPresence = (tag: string) => {
    const regex = new RegExp(`<${tag}\\b`, "i");
    return regex.test(xmlInput);
  };

  const copyToClipboard = (text: string, name: string) => {
    navigator.clipboard.writeText(text);
    setCopiedObj(name);
    setTimeout(() => setCopiedObj(null), 2000);
  };

  // Determine overall match rate for ODI
  const detectedCount = ODI_OBJECTS.filter((obj) => checkTagPresence(obj.tag)).length;
  const isODISchema = detectedCount >= 2;

  return (
    <div className="flex flex-col gap-6">
      {/* Overview Banner */}
      <div className={`p-5 rounded-2xl border transition-all duration-300 ${
        isODISchema 
          ? "bg-emerald-50/45 border-emerald-100 text-emerald-900" 
          : "bg-amber-50/45 border-amber-100 text-amber-900"
      }`}>
        <div className="flex items-start gap-3.5">
          <div className={`p-2.5 rounded-xl shrink-0 ${
            isODISchema ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
          }`}>
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display font-bold text-sm">
                Rilevatore di Strutture ODI SmartExport
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                isODISchema 
                  ? "bg-emerald-100 text-emerald-800" 
                  : "bg-amber-100 text-amber-800"
              }`}>
                {isODISchema ? "Rilevato ODI" : "Sorgente Generica"}
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
              {isODISchema 
                ? `Il file XML caricato corrisponde ai tag standard di un export di Oracle Data Integrator (ODI). Sono stati individuati ${detectedCount} su ${ODI_OBJECTS.length} blocchi del grafo dei Mapping fisici.`
                : "Questo tool scansiona il file XML per identificare la presenza di nodi descrittivi di Oracle Data Integrator (ODI), utili per il partizionamento preciso dei mapping ETL."
              }
            </p>
          </div>
        </div>
      </div>

      {/* Grid of ODI Elements */}
      <div className="grid grid-cols-1 gap-6">
        {ODI_OBJECTS.map((obj) => {
          const isPresent = checkTagPresence(obj.tag);
          return (
            <div 
              key={obj.name}
              className={`glass-panel rounded-2xl border transition-all overflow-hidden ${
                isPresent 
                  ? "border-emerald-100/80 shadow-xs" 
                  : "border-gray-100 hover:border-gray-200"
              }`}
            >
              {/* Header block */}
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-mono font-bold">
                    &lt;{obj.tag}&gt;
                  </span>
                  <h4 className="font-display font-bold text-sm text-gray-800">{obj.name}</h4>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    isPresent 
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                      : "bg-gray-50 text-gray-400 border border-gray-100"
                  }`}>
                    {isPresent ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> Rilevato nel file
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3.5 h-3.5" /> Non rilevato
                      </>
                    )}
                  </span>

                  <button
                    onClick={() => copyToClipboard(obj.sampleXml, obj.name)}
                    className="p-1.5 border border-gray-200 hover:bg-gray-50 text-gray-500 rounded-lg text-xs font-semibold bg-white shadow-2xs transition-all flex items-center gap-1"
                    title={`Copia blocco XML di esempio per ${obj.name}`}
                  >
                    {copiedObj === obj.name ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-[10px] text-emerald-600">Copiato</span>
                      </>
                    ) : (
                      <>
                        <Clipboard className="w-3.5 h-3.5" />
                        <span className="text-[10px]">Copia</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Body block */}
              <div className="p-5 flex flex-col gap-4">
                <p className="text-xs text-gray-500 leading-relaxed">
                  {obj.description}
                </p>

                {/* Key attributes highlights */}
                <div>
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                    Attributi Chiave ODI da Mappare:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {obj.requiredFields.map((field) => {
                      const isFieldInXml = isPresent && xmlInput.includes(`${field}=`);
                      return (
                        <span 
                          key={field} 
                          className={`px-2 py-1 rounded-md text-xs font-mono border transition-all ${
                            isFieldInXml 
                              ? "bg-emerald-50/75 text-emerald-700 border-emerald-100 font-bold" 
                              : "bg-gray-50 text-gray-600 border-gray-100"
                          }`}
                        >
                          {field}
                          {isFieldInXml && " (✓)"}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Simulated XML Block */}
                <div className="relative">
                  <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] text-gray-400 font-mono bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
                    Estratto Fittizio
                  </div>
                  <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre leading-relaxed shadow-inner border border-slate-800">
                    {obj.sampleXml}
                  </pre>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
