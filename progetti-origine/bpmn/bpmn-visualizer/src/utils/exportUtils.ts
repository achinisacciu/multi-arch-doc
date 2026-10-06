import jsPDF from 'jspdf';
import { PdfExportOptions } from '../types';

async function svgToCanvas(svgContent: string): Promise<HTMLCanvasElement> {
  const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  const result = await new Promise<HTMLCanvasElement>((resolve, reject) => {
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas 2D context non disponibile')); return; }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Errore nel caricamento dell\'immagine SVG')); };
    img.src = url;
  });
  return result;
}

export async function exportToSvg(bpmnViewer: any, fileName: string): Promise<{ svgContent: string; download: () => void }> {
  const result = await bpmnViewer.saveSVG();
  const svgContent = result.svg;
  const download = () => {
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName.replace(/\.(bpmn|xml)$/i, '')}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return { svgContent, download };
}

export async function exportToPdf(bpmnViewer: any, diagramTitle: string, options: PdfExportOptions): Promise<void> {
  const { svgContent } = await exportToSvg(bpmnViewer, diagramTitle);
  const canvas = await svgToCanvas(svgContent);
  const imgData = canvas.toDataURL('image/png');
  const size = options.pageSize === 'fit' ? 'a4' : options.pageSize;
  const pdf = new jsPDF({ orientation: options.orientation, format: size, unit: 'mm' });
  if (options.includeHeader) {
    pdf.setFontSize(16);
    pdf.text(diagramTitle.replace(/\.(bpmn|xml)$/i, ''), 20, 20);
    pdf.setFontSize(10);
    pdf.text(`Esportato il: ${new Date().toLocaleDateString('it-IT')}`, 20, 28);
    if (options.includeStats) {
      pdf.text(`Opzioni: ${options.pageSize}, ${options.orientation}`, 20, 34);
    }
  }
  const pageWidth = pdf.internal.pageSize.getWidth() - 30;
  const maxHeight = pdf.internal.pageSize.getHeight() - (options.includeHeader ? 50 : 20);
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height / canvas.width) * imgWidth;
  if (imgHeight > maxHeight) {
    const scale = maxHeight / imgHeight;
    pdf.addImage(imgData, 'PNG', 15, options.includeHeader ? 45 : 15, imgWidth * scale, imgHeight * scale);
  } else {
    pdf.addImage(imgData, 'PNG', 15, options.includeHeader ? 45 : 15, imgWidth, imgHeight);
  }
  pdf.save(`${diagramTitle.replace(/\.(bpmn|xml)$/i, '')}.pdf`);
}

export async function exportToPng(bpmnViewer: any, fileName: string): Promise<void> {
  const result = await bpmnViewer.saveSVG();
  const canvas = await svgToCanvas(result.svg);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${fileName.replace(/\.(bpmn|xml)$/i, '')}.png`;
    a.click();
  }
}

export function generateMarkdownDoc(data: any, parsed: any, integratedDoc?: any): string {
  const isFolder = !!integratedDoc;
  if (isFolder && integratedDoc) {
    return generateFolderMarkdown(integratedDoc);
  }
  return generateSingleMarkdown(data, parsed);
}

function generateSingleMarkdown(doc: any, parsed: any): string {
  const lines: string[] = [
    `# ${doc.processName || 'Processo BPMN'}`,
    '',
    `**ID Processo**: ${doc.processId || 'N/D'}`,
    `**Versione Documentazione**: ${doc.version || '1.0'}`,
    `**Generato il**: ${new Date(doc.generatedAt || Date.now()).toLocaleString('it-IT')}`,
    `**Lingua**: ${doc.language || 'it'}`,
    '',
    '---',
    '',
    '## 1. Sintesi Esecutiva',
    '',
    doc.executiveSummary || '',
    '',
    '## 2. Obiettivi di Business',
    '',
    ...(doc.businessObjectives || []).map((o: string) => `- ${o}`),
    '',
    '## 3. Attori e Ruoli',
    '',
    '| Ruolo | Tipo | Attività Assegnate |',
    '|-------|------|-------------------|',
    ...(doc.rolesAndParticipants || []).map((r: any) => `| ${r.name} | ${r.type} | ${r.assignedTasksCount || 0} |`),
  ];

  if (doc.processSteps && doc.processSteps.length > 0) {
    lines.push('', '## 4. Fasi del Processo', '');
    for (const step of doc.processSteps) {
      lines.push(`### ${step.stepNumber}. ${step.name}`);
      lines.push(`- **Tipo**: ${step.type}`);
      lines.push(`- **Attore**: ${step.actorRole}`);
      lines.push(`- **Descrizione**: ${step.description}`);
      if (step.inputs && step.inputs.length > 0) lines.push(`- **Input**: ${step.inputs.join(', ')}`);
      if (step.outputs && step.outputs.length > 0) lines.push(`- **Output**: ${step.outputs.join(', ')}`);
      if (step.decisionRules) lines.push(`- **Regole**: ${step.decisionRules}`);
      lines.push('');
    }
  }

  lines.push('## 5. Matrice RACI', '', '| Attività | Responsabile | Accountable | Consultato | Informato |', '|----------|-------------|-------------|------------|-----------|');
  for (const r of doc.raciMatrix || []) {
    lines.push(`| ${r.taskName} | ${r.responsible} | ${r.accountable} | ${r.consulted} | ${r.informed} |`);
  }

  if (doc.gateways && doc.gateways.length > 0) {
    lines.push('', '## 6. Gateway di Decisione', '');
    for (const gw of doc.gateways) {
      lines.push(`### ${gw.name || gw.id} (${gw.type})`, '');
      for (const b of gw.branches || []) {
        lines.push(`- Se: ${b.condition || 'N/D'} → ${b.target || 'N/D'}`);
      }
      lines.push('');
    }
  }

  lines.push('', '## 7. Rischi e Mitigazioni', '');
  for (const r of doc.risksAndExceptions || []) {
    lines.push(`- **${r.risk}** (${r.location}): ${r.mitigation}`);
  }

  if (doc.testScenarios && doc.testScenarios.length > 0) {
    lines.push('', '## 8. Casi di Test', '');
    for (const tc of doc.testScenarios) {
      lines.push(`### ${tc.id}: ${tc.title}`);
      lines.push(`- **Precondizioni**: ${tc.preconditions}`);
      lines.push(`- **Percorso**: ${(tc.pathSteps || []).join(' → ')}`);
      lines.push(`- **Risultato atteso**: ${tc.expectedResult}`);
      lines.push('');
    }
  }

  lines.push('', '## 9. Guida Operativa', '', doc.userManualGuide || '');

  return lines.join('\n');
}

function generateFolderMarkdown(doc: any): string {
  const lines: string[] = [
    `# Documentazione Portafoglio Processi: ${doc.folderName || 'Portafoglio'}`,
    '',
    `**Totale Processi**: ${doc.totalFiles || 0}`,
    `**Complessità Media**: ${doc.averageComplexity || 0}`,
    `**Generato il**: ${new Date(doc.generatedAt || Date.now()).toLocaleString('it-IT')}`,
    '',
    '---',
    '',
    '## 1. Sintesi Esecutiva',
    '',
    doc.executiveSummary || '',
    '',
    '## 2. Ranking di Complessità',
    '',
    '| Processo | Punteggio | Valutazione |',
    '|----------|-----------|-------------|',
    ...(doc.processComplexityRanking || []).map((p: any) => `| ${p.processName} | ${p.score} | ${p.ratingLabel} |`),
    '',
    '## 3. Dipendenze Incrociate',
    '',
    ...(doc.crossLinks || []).map((l: any) => `- **${l.sourceProcessName}** → **${l.targetProcessName || l.sourceElementName}** (${l.linkType}): ${l.description}`),
    '',
    ...(doc.crossLinks && doc.crossLinks.length === 0 ? ['Nessuna dipendenza incrociata rilevata.', ''] : []),
    '',
    '## 4. Ruoli Condivisi',
    '',
    ...(doc.sharedRoles || []).map((r: any) => `- **${r.roleName}**: presente in ${r.participatingProcesses.join(', ')}`),
    '',
    ...(doc.sharedRoles && doc.sharedRoles.length === 0 ? ['Nessun ruolo condiviso.', ''] : []),
    '',
    '## 5. Rischi di Integrazione',
    '',
    ...(doc.crossProcessRisks || []).map((r: any) => `- **${r.risk}**: ${r.impact}. Mitigazione: ${r.mitigation}`),
    '',
    '---',
    '',
    '## 6. Guida Operativa Integrata',
    '',
    doc.integratedOperationalGuide || '',
  ];
  return lines.join('\n');
}
