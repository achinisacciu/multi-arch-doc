import { BpmnFileItem, BpmnFolderNode } from '../types';

export function parseBpmnStats(xmlContent: string) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'text/xml');
    
    // Check for XML parse errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      return { isValid: false, error: 'Sintassi XML non valida', tasksCount: 0, gatewaysCount: 0, eventsCount: 0, subprocessesCount: 0 };
    }

    const tasks = doc.querySelectorAll('task, userTask, serviceTask, sendTask, receiveTask, manualTask, scriptTask, businessRuleTask');
    const gateways = doc.querySelectorAll('gateway, exclusiveGateway, parallelGateway, inclusiveGateway, eventBasedGateway, complexGateway');
    const events = doc.querySelectorAll('startEvent, endEvent, intermediateCatchEvent, intermediateThrowEvent, boundaryEvent');
    const subprocesses = doc.querySelectorAll('subProcess, transaction, adHocSubProcess');

    return {
      isValid: true,
      tasksCount: tasks.length,
      gatewaysCount: gateways.length,
      eventsCount: events.length,
      subprocessesCount: subprocesses.length,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Errore nel parsing XML';
    return { isValid: false, error: message, tasksCount: 0, gatewaysCount: 0, eventsCount: 0, subprocessesCount: 0 };
  }
}

export function buildFolderTree(files: BpmnFileItem[]): BpmnFolderNode {
  const root: BpmnFolderNode = {
    name: 'Cartella Radice',
    path: '',
    files: [],
    subfolders: {},
  };

  for (const file of files) {
    const pathParts = file.relativePath.split('/').filter(Boolean);
    
    // If it's a file at root level
    if (pathParts.length <= 1) {
      root.files.push(file);
      continue;
    }

    // Traverse or create subfolders
    let currentFolder = root;
    let currentPath = '';

    for (let i = 0; i < pathParts.length - 1; i++) {
      const folderName = pathParts[i];
      currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;

      if (!currentFolder.subfolders[folderName]) {
        currentFolder.subfolders[folderName] = {
          name: folderName,
          path: currentPath,
          files: [],
          subfolders: {},
        };
      }
      currentFolder = currentFolder.subfolders[folderName];
    }

    currentFolder.files.push(file);
  }

  return root;
}

export async function processFileInputs(filesList: FileList): Promise<BpmnFileItem[]> {
  const bpmnFiles: BpmnFileItem[] = [];

  for (let i = 0; i < filesList.length; i++) {
    const file = filesList[i];
    const isBpmn = file.name.endsWith('.bpmn') || file.name.endsWith('.xml') || file.name.endsWith('.bpmn20.xml');
    
    if (!isBpmn) continue;

    const relPath = file.webkitRelativePath || file.name;
    const pathSegments = relPath.split('/');
    const folderPath = pathSegments.length > 1 ? pathSegments.slice(0, -1).join('/') : 'Radice';

    try {
      const content = await file.text();
      const stats = parseBpmnStats(content);

      bpmnFiles.push({
        id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: file.name,
        relativePath: relPath,
        folderPath,
        content,
        size: file.size,
        lastModified: file.lastModified,
        isSample: false,
        isValid: stats.isValid,
        error: stats.error,
        stats: stats.isValid
          ? {
              tasksCount: stats.tasksCount,
              gatewaysCount: stats.gatewaysCount,
              eventsCount: stats.eventsCount,
              subprocessesCount: stats.subprocessesCount,
            }
          : undefined,
      });
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : 'Impossibile leggere il file';
      bpmnFiles.push({
        id: `file-err-${Date.now()}`,
        name: file.name,
        relativePath: relPath,
        folderPath,
        content: '',
        size: file.size,
        isValid: false,
        error: errorMsg,
      });
    }
  }

  return bpmnFiles;
}

// Traverse dropped directory entries recursively
export async function processDroppedItems(items: DataTransferItemList): Promise<BpmnFileItem[]> {
  const resultFiles: BpmnFileItem[] = [];

  const readEntry = async (entry: FileSystemEntry, pathPrefix = ''): Promise<void> => {
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      return new Promise((resolve) => {
        fileEntry.file(async (file) => {
          const isBpmn = file.name.endsWith('.bpmn') || file.name.endsWith('.xml') || file.name.endsWith('.bpmn20.xml');
          if (isBpmn) {
            const relPath = pathPrefix ? `${pathPrefix}/${file.name}` : file.name;
            const folderPath = pathPrefix || 'Radice';
            const content = await file.text();
            const stats = parseBpmnStats(content);

            resultFiles.push({
              id: `drop-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              name: file.name,
              relativePath: relPath,
              folderPath,
              content,
              size: file.size,
              lastModified: file.lastModified,
              isSample: false,
              isValid: stats.isValid,
              error: stats.error,
              stats: stats.isValid ? {
                tasksCount: stats.tasksCount,
                gatewaysCount: stats.gatewaysCount,
                eventsCount: stats.eventsCount,
                subprocessesCount: stats.subprocessesCount,
              } : undefined,
            });
          }
          resolve();
        });
      });
    } else if (entry.isDirectory) {
      const dirEntry = entry as FileSystemDirectoryEntry;
      const dirReader = dirEntry.createReader();
      const readEntries = (): Promise<FileSystemEntry[]> => {
        return new Promise((resolve) => {
          dirReader.readEntries((entries) => resolve(entries));
        });
      };

      let entries = await readEntries();
      while (entries.length > 0) {
        for (const subEntry of entries) {
          const newPath = pathPrefix ? `${pathPrefix}/${dirEntry.name}` : dirEntry.name;
          await readEntry(subEntry, newPath);
        }
        entries = await readEntries(); // read next batch if any
      }
    }
  };

  const entriesToProcess: FileSystemEntry[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
    if (entry) {
      entriesToProcess.push(entry);
    }
  }

  for (const entry of entriesToProcess) {
    await readEntry(entry);
  }

  return resultFiles;
}
