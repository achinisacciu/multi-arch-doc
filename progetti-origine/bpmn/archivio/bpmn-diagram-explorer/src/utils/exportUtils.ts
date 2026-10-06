import jsPDF from 'jspdf';
import { PdfExportOptions } from '../types';

export async function exportToSvg(bpmnViewer: any, fileName: string): Promise<{ svgContent: string; download: () => void }> {
  if (!bpmnViewer) {
    throw new Error('Visualizzatore BPMN non pronto');
  }

  const { svg } = await bpmnViewer.saveSVG({ format: true });
  
  const cleanName = fileName.replace(/\.(bpmn|xml)$/i, '') + '.svg';
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });

  const download = () => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = cleanName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return { svgContent: svg, download };
}

export async function exportToPdf(
  bpmnViewer: any,
  diagramTitle: string,
  options: PdfExportOptions = {
    pageSize: 'a4',
    orientation: 'landscape',
    includeHeader: true,
    includeStats: true,
    highQuality: true,
    backgroundColor: '#ffffff',
  }
): Promise<void> {
  if (!bpmnViewer) {
    throw new Error('Visualizzatore BPMN non pronto');
  }

  // 1. Get SVG string from BPMN viewer
  const { svg } = await bpmnViewer.saveSVG({ format: true });

  // 2. Render SVG onto Canvas for crisp high-DPI PDF image embedding
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Impossibile inizializzare il contesto Canvas');

  // Parse SVG dimensions or calculate bounding box
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svg, 'image/svg+xml');
  const svgEl = svgDoc.documentElement;

  let width = parseFloat(svgEl.getAttribute('width') || '1000');
  let height = parseFloat(svgEl.getAttribute('height') || '600');
  
  const viewBox = svgEl.getAttribute('viewBox');
  if (viewBox) {
    const parts = viewBox.split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      width = parts[2];
      height = parts[3];
    }
  }

  const scale = options.highQuality ? 3 : 2;
  canvas.width = Math.max(800, width) * scale;
  canvas.height = Math.max(500, height) * scale;

  ctx.fillStyle = options.backgroundColor || '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const img = new Image();
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  await new Promise<void>((resolve, reject) => {
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(svgUrl);
      resolve();
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(svgUrl);
      reject(err);
    };
    img.src = svgUrl;
  });

  const imgData = canvas.toDataURL('image/png', 1.0);

  // 3. Create jsPDF document
  const pdfFormat = options.pageSize === 'fit' ? [canvas.width / scale, canvas.height / scale] : options.pageSize;
  const pdf = new jsPDF({
    orientation: options.orientation,
    unit: 'mm',
    format: pdfFormat,
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  let startY = 10;

  // Add clean header if enabled
  if (options.includeHeader) {
    pdf.setFillColor(248, 250, 252);
    pdf.rect(0, 0, pdfWidth, 22, 'F');
    pdf.setDrawColor(226, 232, 240);
    pdf.line(0, 22, pdfWidth, 22);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(15, 23, 42);
    pdf.text(diagramTitle, 12, 12);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    const dateStr = new Date().toLocaleDateString('it-IT', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    pdf.text(`Esportato il ${dateStr} | BPMN 2.0 Diagram Explorer`, 12, 17);

    startY = 26;
  }

  // Calculate scaling to fit diagram on PDF page nicely
  const availableWidth = pdfWidth - 20;
  const availableHeight = pdfHeight - startY - 12;

  const imgAspectRatio = canvas.width / canvas.height;
  let renderWidth = availableWidth;
  let renderHeight = renderWidth / imgAspectRatio;

  if (renderHeight > availableHeight) {
    renderHeight = availableHeight;
    renderWidth = renderHeight * imgAspectRatio;
  }

  const offsetX = 10 + (availableWidth - renderWidth) / 2;
  const offsetY = startY + (availableHeight - renderHeight) / 2;

  // Draw background frame around diagram
  pdf.setDrawColor(241, 245, 249);
  pdf.rect(offsetX - 2, offsetY - 2, renderWidth + 4, renderHeight + 4, 'S');

  pdf.addImage(imgData, 'PNG', offsetX, offsetY, renderWidth, renderHeight);

  // Save the PDF
  const cleanPdfName = diagramTitle.replace(/[\/\s]/g, '_').replace(/\.(bpmn|xml)$/i, '') + '.pdf';
  pdf.save(cleanPdfName);
}

export async function exportToPng(bpmnViewer: any, fileName: string): Promise<void> {
  const { svg } = await bpmnViewer.saveSVG({ format: true });
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svg, 'image/svg+xml');
  const svgEl = svgDoc.documentElement;

  let width = parseFloat(svgEl.getAttribute('width') || '1000');
  let height = parseFloat(svgEl.getAttribute('height') || '600');
  const viewBox = svgEl.getAttribute('viewBox');
  if (viewBox) {
    const parts = viewBox.split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      width = parts[2];
      height = parts[3];
    }
  }

  const scale = 2;
  canvas.width = width * scale;
  canvas.height = height * scale;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const img = new Image();
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  img.onload = () => {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    const pngUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = pngUrl;
    link.download = fileName.replace(/\.(bpmn|xml)$/i, '') + '.png';
    link.click();
  };
  img.src = url;
}
