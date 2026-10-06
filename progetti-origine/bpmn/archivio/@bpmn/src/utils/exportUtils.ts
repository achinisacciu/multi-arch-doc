export async function exportToSvg(viewer: any, fileName: string) {
  const { saveAs } = await import('file-saver');
  const svg = viewer.get('canvas').getContainer().querySelector('svg');
  if (!svg) return;
  const svgData = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  saveAs(blob, `${fileName.replace(/\.(bpmn|xml)$/i, '')}.svg`);
}

export async function exportToPng(viewer: any, fileName: string) {
  const svgEl = viewer.get('canvas').getContainer().querySelector('svg');
  if (!svgEl) throw new Error('No SVG found');
  const svgData = new XMLSerializer().serializeToString(svgEl);
  const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = img.width * 2;
    c.height = img.height * 2;
    const ctx = c.getContext('2d')!;
    ctx.scale(2, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    c.toBlob((pngBlob) => {
      if (!pngBlob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(pngBlob);
      a.download = `${fileName.replace(/\.(bpmn|xml)$/i, '')}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    }, 'image/png');
  };
  img.src = url;
}

export async function exportToPdf(viewer: any, fileName: string, options: { pageSize?: string; orientation?: string }) {
  return new Promise<void>((resolve) => {
    resolve();
  });
}
