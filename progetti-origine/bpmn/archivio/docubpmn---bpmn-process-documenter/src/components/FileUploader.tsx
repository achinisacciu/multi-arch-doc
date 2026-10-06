import React, { useState, useRef } from 'react';
import { Upload, FileCode, Play, CheckCircle2, Code, ArrowRight, FolderUp, Layers, Folder } from 'lucide-react';
import { SAMPLE_BPMN_FILES, SampleBpmn } from '../data/sampleBpmnFiles';

interface FileUploaderProps {
  onFileSelect: (xmlString: string, fileName: string, fileSize: number) => void;
  onFolderSelect: (files: Array<{ xml: string; fileName: string; fileSize: number }>, folderName?: string) => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onFileSelect, onFolderSelect }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [pastedXml, setPastedXml] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleMultipleFiles = (filesList: FileList) => {
    if (!filesList || filesList.length === 0) return;

    const bpmnFiles = Array.from(filesList).filter(
      (f) => f.name.endsWith('.bpmn') || f.name.endsWith('.xml')
    );

    if (bpmnFiles.length === 0) {
      alert('Nessun file .bpmn o .xml valido trovato nella selezione.');
      return;
    }

    if (bpmnFiles.length === 1) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        onFileSelect(content, bpmnFiles[0].name, bpmnFiles[0].size);
      };
      reader.readAsText(bpmnFiles[0]);
      return;
    }

    // Process multiple files
    const loadedList: Array<{ xml: string; fileName: string; fileSize: number }> = [];
    let count = 0;

    bpmnFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        loadedList.push({
          xml: content,
          fileName: file.name,
          fileSize: file.size,
        });
        count++;
        if (count === bpmnFiles.length) {
          // Derive folder name if available
          const pathParts = (file as any).webkitRelativePath?.split('/');
          const folderName = pathParts && pathParts.length > 1 ? pathParts[0] : 'Cartella Processi Aziendali';
          onFolderSelect(loadedList, folderName);
        }
      };
      reader.readAsText(file);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleMultipleFiles(e.dataTransfer.files);
    }
  };

  const handleSampleClick = (sample: SampleBpmn) => {
    onFileSelect(sample.xml, `${sample.id}.bpmn`, sample.xml.length);
  };

  const handleSamplePortfolioClick = () => {
    const portfolioFiles = SAMPLE_BPMN_FILES.map((sample) => ({
      xml: sample.xml,
      fileName: `${sample.id}.bpmn`,
      fileSize: sample.xml.length,
    }));
    onFolderSelect(portfolioFiles, 'Portafoglio E-Commerce & Operations Corp');
  };

  const handlePasteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pastedXml.trim()) return;
    onFileSelect(pastedXml, 'custom-process.bpmn', pastedXml.length);
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6">
      
      {/* Hero Welcome */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-bold mb-4">
          <FileCode className="w-4 h-4 text-indigo-600" />
          Documentatore BPMN 2.0 &amp; Analisi Incrociata Multi-Processo
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Genera Documentazione <span className="text-indigo-600">Singola o di una Cartella .bpmn</span>
        </h1>
        <p className="mt-3 text-base text-slate-600 max-w-3xl mx-auto leading-relaxed">
          Carica un singolo file oppure un'<strong>intera cartella di file BPMN 2.0</strong> per generare la documentazione incrociata del portafoglio processi (Sintesi, Fasi, Matrice RACI, Ruoli, Gateway, Rischi, Call Activities e Guida Operativa).
        </p>
      </div>

      {/* Main Upload Box */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
        {!showPaste ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 sm:p-10 text-center transition-all ${
              isDragging
                ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]'
                : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50/50'
            }`}
          >
            {/* Hidden file input for single or multiple files */}
            <input
              type="file"
              ref={fileInputRef}
              accept=".bpmn,.xml"
              multiple
              onChange={(e) => {
                if (e.target.files) {
                  handleMultipleFiles(e.target.files);
                }
              }}
              className="hidden"
            />

            {/* Hidden folder input with webkitdirectory */}
            <input
              type="file"
              ref={folderInputRef}
              {...({ webkitdirectory: '', directory: '', multiple: true } as any)}
              onChange={(e) => {
                if (e.target.files) {
                  handleMultipleFiles(e.target.files);
                }
              }}
              className="hidden"
            />

            <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
              <FolderUp className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              Trascina qui il file o l'<strong>intera cartella</strong> di file <span className="text-indigo-600">.bpmn</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xl mx-auto">
              Puoi caricare un singolo processo oppure selezionare una directory contenente più file BPMN collegati per generare l'analisi incrociata automatica.
            </p>

            <div className="mt-6 flex flex-wrap justify-center items-center gap-3">
              <button
                type="button"
                onClick={() => folderInputRef.current?.click()}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-indigo-500/20 transition-all flex items-center gap-2"
              >
                <Folder className="w-4 h-4" />
                Carica Intera Cartella (.bpmn)
              </button>
              
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold shadow-md transition-all flex items-center gap-2"
              >
                <FileCode className="w-4 h-4" />
                Seleziona Singolo File
              </button>

              <button
                type="button"
                onClick={() => setShowPaste(true)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5"
              >
                <Code className="w-4 h-4 text-slate-500" />
                Incolla XML
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Code className="w-4 h-4 text-indigo-600" />
                Incolla il Codice XML BPMN
              </h3>
              <button
                onClick={() => setShowPaste(false)}
                className="text-xs text-slate-500 hover:text-slate-700 underline"
              >
                Torna al caricamento file
              </button>
            </div>
            <form onSubmit={handlePasteSubmit}>
              <textarea
                value={pastedXml}
                onChange={(e) => setPastedXml(e.target.value)}
                placeholder="<bpmn:definitions xmlns:bpmn=... >"
                rows={10}
                className="w-full font-mono text-xs p-3 bg-slate-900 text-slate-200 rounded-xl border border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPaste(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={!pastedXml.trim()}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 flex items-center gap-1.5"
                >
                  Genera Documentazione
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Multi-File Folder Portfolio Highlight Banner */}
      <div className="mt-8 bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white rounded-2xl p-6 border border-indigo-800/60 flex flex-col md:flex-row items-center justify-between gap-6 shadow-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-900 text-[10px] font-black uppercase tracking-wide">
              Esempio Cartella Multi-Processo
            </span>
            <span className="text-xs text-indigo-200 font-medium">3 File BPMN Collegati</span>
          </div>
          <h2 className="text-lg font-bold text-white">
            Portafoglio Aziendale Completo (Evasione Ordini + Spese + Ticket Supporto)
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl">
            Testa subito l'analisi incrociata automatica caricando l'intero portafoglio aziendale con 1 solo click.
          </p>
        </div>

        <button
          onClick={handleSamplePortfolioClick}
          className="px-5 py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold rounded-xl text-xs shadow-lg transition-all shrink-0 flex items-center gap-2 group cursor-pointer"
        >
          <Layers className="w-4 h-4 text-slate-900" />
          <span>Carica Portafoglio Completo (3 File)</span>
          <ArrowRight className="w-4 h-4 text-slate-900 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* Pre-loaded Single Sample Files Section */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-4">
          <Play className="w-4 h-4 text-indigo-600" />
          <h2 className="text-base font-bold text-slate-900">
            Oppure carica un singolo file di esempio:
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SAMPLE_BPMN_FILES.map((sample) => (
            <div
              key={sample.id}
              onClick={() => handleSampleClick(sample)}
              className="bg-white border border-slate-200 rounded-xl p-4 hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                    File Singolo .bpmn
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                  {sample.name}
                </h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                  {sample.description}
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span className="flex items-center gap-1 text-slate-600">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Singolo file
                </span>
                <span className="text-indigo-600 font-semibold group-hover:underline">
                  Carica &rarr;
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 8 Sections Highlight Cards */}
      <div className="mt-10">
        <h3 className="text-xs font-bold text-slate-500 mb-3 text-center uppercase tracking-wider">
          Sezioni Documentazione Generata (Singola o Incrociata)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs text-slate-700">
          <div className="bg-white p-3 rounded-xl border border-slate-200 font-semibold shadow-2xs">
            1. Sintesi e obiettivi
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200 font-semibold shadow-2xs">
            2. Fasi del processo
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200 font-semibold shadow-2xs">
            3. Matrice RACI
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200 font-semibold shadow-2xs">
            4. Ruoli e partecipanti
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200 font-semibold shadow-2xs">
            5. Gateway e condizioni
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200 font-semibold shadow-2xs">
            6. Rischi e ottimizzazioni
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200 font-semibold shadow-2xs">
            7. Casi di test
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200 font-semibold shadow-2xs">
            8. Guida utente operativa
          </div>
        </div>
      </div>

    </div>
  );
};
