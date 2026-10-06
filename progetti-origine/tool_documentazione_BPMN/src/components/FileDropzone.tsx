import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileCode,
  FolderTree,
  Code2,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  FilePlus,
  Loader2,
  Sparkles,
} from 'lucide-react';

interface FileDropzoneProps {
  onFilesLoaded: (files: Array<{ content: string; name: string; relativePath: string }>) => void;
  totalLoaded: number;
  onLoadSample: () => void;
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({
  onFilesLoaded,
  totalLoaded,
  onLoadSample,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [showPasteArea, setShowPasteArea] = useState(false);
  const [pastedXml, setPastedXml] = useState('');
  const [pasteFileName, setPasteFileName] = useState('composite.xml');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Allineata a ecosystemParser.ts (C-01): include tutti i tipi gestiti dal parser
  const supportedExtensions = [
    '.xml',
    '.wsdl',
    '.xsd',
    '.jca',
    '.bpmn',
    '.bpel',
    '.componentType',
    '.mplan',
    '.task',
    '.xsl',
    '.xslt',
    '.jpr',
    '.jws',
    '.dcx',
    '.cpx',
    '.sql',
    '.sh',
    '.py',
    '.properties',
    '.dvm',
    '.tcl',
    '.ctl',
    '.java',
    '.jspx',
    '.txt',
    '.config',
    '.bpel',
  ];

  const isSupportedFile = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.endsWith('.sample')) return true;
    // Gestione _copy (es. OrderSchema.xsd_copy)
    const normalized = lower.replace(/_copy$/, '');
    return supportedExtensions.some((ext) => normalized.endsWith(ext));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const traverseFileTree = async (
    item: FileSystemEntry,
    path = ''
  ): Promise<Array<{ file: File; relativePath: string }>> => {
    return new Promise((resolve) => {
      if (item.isFile) {
        (item as FileSystemFileEntry).file(
          (file: File) => {
            if (isSupportedFile(file.name)) {
              resolve([{ file, relativePath: path ? `${path}/${file.name}` : file.name }]);
            } else {
              resolve([]);
            }
          },
          () => resolve([])
        );
      } else if (item.isDirectory) {
        const dirReader = (item as FileSystemDirectoryEntry).createReader();
        const entries: FileSystemEntry[] = [];
        const readEntries = () => {
          dirReader.readEntries(async (result: FileSystemEntry[]) => {
            if (result.length > 0) {
              entries.push(...result);
              readEntries();
            } else {
              const promises: Promise<Array<{ file: File; relativePath: string }>>[] = [];
              for (const entry of entries) {
                promises.push(traverseFileTree(entry, path ? `${path}/${item.name}` : item.name));
              }
              const nestedFiles = await Promise.all(promises);
              resolve(nestedFiles.flat());
            }
          });
        };
        readEntries();
      } else {
        resolve([]);
      }
    });
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setIsScanning(true);

    const items = e.dataTransfer.items;
    const filePromises: Promise<Array<{ file: File; relativePath: string }>>[] = [];

    if (items && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const entry = (items[i] as unknown as { getAsEntry?: () => FileSystemEntry | null; webkitGetAsEntry?: () => FileSystemEntry | null }).getAsEntry?.() ??
                     (items[i] as unknown as { webkitGetAsEntry?: () => FileSystemEntry | null }).webkitGetAsEntry?.() ?? null;
        if (entry) {
          filePromises.push(traverseFileTree(entry));
        } else {
          const file = items[i].getAsFile();
          if (file && isSupportedFile(file.name)) {
            filePromises.push(Promise.resolve([{ file, relativePath: file.name }]));
          }
        }
      }
    } else if (e.dataTransfer.files) {
      const files = Array.from(e.dataTransfer.files);
      const validFiles = files
        .filter((f) => isSupportedFile(f.name))
        .map((file) => ({ file, relativePath: file.name }));
      filePromises.push(Promise.resolve(validFiles));
    }

    const flatFiles = (await Promise.all(filePromises)).flat();
    await processLoadedFiles(flatFiles);
    setIsScanning(false);
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsScanning(true);
      const fileList = Array.from(e.target.files);
      const filesToProcess = fileList
        .filter((f) => isSupportedFile(f.name))
        .map((file) => {
          const relPath = file.webkitRelativePath || file.name;
          return { file, relativePath: relPath };
        });
      await processLoadedFiles(filesToProcess);
      setIsScanning(false);
    }
  };

  const processLoadedFiles = async (files: Array<{ file: File; relativePath: string }>) => {
    const loadedData: Array<{ content: string; name: string; relativePath: string }> = [];
    let skipped = 0;

    for (const item of files) {
      try {
        const content = await item.file.text();
        if (content.trim()) {
          loadedData.push({
            content,
            name: item.file.name,
            relativePath: item.relativePath,
          });
        } else {
          skipped++;
        }
      } catch (err) {
        console.error(`Error reading ${item.relativePath}`, err);
        skipped++;
      }
    }

    if (loadedData.length > 0) {
      onFilesLoaded(loadedData);
    }
    if (skipped > 0) {
      console.warn(`${skipped} file scartati (vuoti o illeggibili)`);
    }
  };

  const handleApplyPasted = () => {
    if (pastedXml.trim()) {
      onFilesLoaded([
        {
          content: pastedXml,
          name: pasteFileName,
          relativePath: pasteFileName,
        },
      ]);
      setShowPasteArea(false);
      setPastedXml('');
    }
  };

  return (
    <div id="ecosystem-upload-section" className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
      <div className="flex flex-col lg:flex-row gap-6 items-stretch">
        {/* Dropzone Area */}
        <div
          id="dropzone-box"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex-1 border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all ${
            isDragging
              ? 'border-indigo-500 bg-indigo-950/40 scale-[0.99]'
              : 'border-slate-700 hover:border-indigo-500/60 bg-slate-950/40 hover:bg-slate-950/70'
          }`}
        >
          <input
            ref={fileInputRef}
            id="ecosystem-file-input"
            type="file"
            accept=".xml,.wsdl,.xsd,.jca,.bpmn,.bpel,.componentType,.mplan,.task,.xsl,.xslt,.jpr,.jws,.dcx,.cpx,.sql,.sh,.py,.properties,.dvm,.tcl,.ctl,.java,.jspx,.txt"
            multiple
            onChange={handleFileInput}
            className="hidden"
          />
          <input
            ref={folderInputRef}
            id="ecosystem-folder-input"
            type="file"
            // @ts-ignore
            webkitdirectory="true"
            // @ts-ignore
            directory="true"
            multiple
            onChange={handleFileInput}
            className="hidden"
          />

          <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-3 shadow-inner">
            {isScanning ? (
              <Loader2 className="w-7 h-7 animate-spin text-indigo-400" />
            ) : (
              <UploadCloud className="w-7 h-7" />
            )}
          </div>

          <h3 className="text-base font-bold text-slate-100 mb-1">
            Trascina qui la cartella o i file dell'applicazione Oracle SOA / ADF
          </h3>
          <p className="text-xs text-slate-400 max-w-xl mb-4 leading-relaxed">
            Supporto per repository completi: <code className="text-indigo-300 font-mono">composite.xml</code>, <code className="text-cyan-300 font-mono">.wsdl</code>, <code className="text-teal-300 font-mono">.xsd</code>, <code className="text-emerald-300 font-mono">.jca</code>, <code className="text-amber-300 font-mono">.bpmn</code>, <code className="text-orange-300 font-mono">.bpel</code>, <code className="text-indigo-300 font-mono">.mplan</code>, <code className="text-rose-300 font-mono">.task</code>, <code className="text-purple-300 font-mono">.xsl</code>, <code className="text-fuchsia-300 font-mono">.py</code>, <code className="text-slate-300 font-mono">.sh</code>.
          </p>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              id="upload-folder-btn"
              onClick={() => folderInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500 transition shadow-lg shadow-indigo-600/30 cursor-pointer active:scale-95"
            >
              <FolderOpen className="w-4 h-4" />
              <span>Carica Cartella di Progetto Ricorsiva</span>
            </button>

            <button
              type="button"
              id="upload-files-btn"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 transition cursor-pointer"
            >
              <FilePlus className="w-4 h-4 text-indigo-400" />
              <span>Seleziona File Multipli</span>
            </button>

            <button
              type="button"
              id="load-sample-btn"
              onClick={onLoadSample}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-amber-600/80 to-amber-700/80 hover:from-amber-600 hover:to-amber-700 text-white border border-amber-500/40 transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Carica Esempio Completo (SOA Suite)</span>
            </button>
          </div>
        </div>

        {/* Info & Manual Paste */}
        <div id="quick-input-panel" className="lg:w-80 flex flex-col justify-between border border-slate-800 bg-slate-950/60 rounded-2xl p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <FolderTree className="w-3.5 h-3.5 text-indigo-400" />
                Scansione Modulare
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-800 text-emerald-300">
                Deterministico
              </span>
            </div>

            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl text-xs space-y-1.5 text-slate-300">
              <p className="font-semibold text-slate-200">Visione di Alto Livello & SCA</p>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Il parser collega automaticamente i componenti del <code className="font-mono text-indigo-300">composite.xml</code> (Services, BPEL, BPMN, Mediator, Task) con i connettori JCA e i contratti WSDL.
              </p>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between">
            <button
              id="toggle-paste-btn"
              onClick={() => setShowPasteArea(!showPasteArea)}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 font-semibold cursor-pointer"
            >
              <Code2 className="w-3.5 h-3.5" />
              {showPasteArea ? 'Chiudi Incolla' : 'Incolla XML Manuale'}
              {showPasteArea ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            <span className="text-[11px] text-slate-500 font-mono">
              File: {totalLoaded}
            </span>
          </div>
        </div>
      </div>

      {/* Collapsible Direct XML Paste Area */}
      {showPasteArea && (
        <div id="paste-xml-section" className="mt-4 pt-4 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-2">
            <input
              type="text"
              value={pasteFileName}
              onChange={(e) => setPasteFileName(e.target.value)}
              placeholder="composite.xml"
              className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
            />
            <span className="text-xs text-slate-400">Incolla qui il codice sorgente (XML, WSDL, BPMN, JCA, ecc.):</span>
          </div>
          <textarea
            id="ecosystem-paste-textarea"
            rows={7}
            value={pastedXml}
            onChange={(e) => setPastedXml(e.target.value)}
            placeholder="<composite name='MyService' ...>"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500 resize-y"
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => setShowPasteArea(false)}
              className="px-3 py-1 rounded text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              Annulla
            </button>
            <button
              id="apply-pasted-btn"
              onClick={handleApplyPasted}
              disabled={!pastedXml.trim()}
              className="px-4 py-1.5 rounded text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition cursor-pointer"
            >
              Elabora File
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
