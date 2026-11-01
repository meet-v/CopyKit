import html2canvas from 'html2canvas';
import { PDFDocument } from 'pdf-lib';
import { markdownToHtml, markdownToPlainText } from './formatting';

export type DownloadFormat = 'markdown' | 'text' | 'html' | 'pdf';

const PDF_PAGE_WIDTH = 595.28;
const PDF_PAGE_HEIGHT = 841.89;
const PDF_MARGIN = 28;
const PDF_RENDER_WIDTH = 760;
const PDF_RENDER_SCALE = 1.5;

export async function createExportBlob(
  markdown: string,
  format: DownloadFormat,
): Promise<{ blob: Blob; extension: string; mimeType: string }> {
  if (format === 'markdown') {
    return {
      blob: new Blob([markdown], { type: 'text/markdown;charset=utf-8' }),
      extension: 'md',
      mimeType: 'text/markdown',
    };
  }

  if (format === 'text') {
    return {
      blob: new Blob([markdownToPlainText(markdown)], { type: 'text/plain;charset=utf-8' }),
      extension: 'txt',
      mimeType: 'text/plain',
    };
  }

  const html = markdownToHtml(markdown);
  if (format === 'html') {
    return {
      blob: new Blob([html], { type: 'text/html;charset=utf-8' }),
      extension: 'html',
      mimeType: 'text/html',
    };
  }

  const blob = await createPdfBlob(html);
  return { blob, extension: 'pdf', mimeType: 'application/pdf' };
}

/**
 * Render sanitized HTML to a canvas, then write page-sized PNG slices into a
 * PDF. This intentionally avoids jsPDF's html() plugin, which can dynamically
 * inject script elements when trying to load its HTML-rendering dependency.
 * Both rendering and PDF generation use statically bundled libraries.
 */
async function createPdfBlob(html: string): Promise<Blob> {
  const container = createEl('div');
  container.className = 'cet-pdf-render-root';
  container.style.cssText = [
    'position:fixed',
    'left:-100000px',
    'top:0',
    `width:${PDF_RENDER_WIDTH}px`,
    'box-sizing:border-box',
    'padding:32px',
    'background:#fff',
    'color:#222',
    'font-family:Arial,sans-serif',
    'font-size:14px',
    'line-height:1.5',
    'overflow:visible',
  ].join(';');

  const parsed = new DOMParser().parseFromString(html, 'text/html');
  container.append(...Array.from(parsed.body.childNodes).map((node) => node.cloneNode(true)));
  document.body.append(container);

  try {
    const renderedCanvas = await html2canvas(container, {
      scale: PDF_RENDER_SCALE,
      backgroundColor: '#ffffff',
      useCORS: false,
      allowTaint: false,
      logging: false,
      width: PDF_RENDER_WIDTH,
      windowWidth: PDF_RENDER_WIDTH,
    });

    if (renderedCanvas.width === 0 || renderedCanvas.height === 0) {
      throw new Error('The selected content could not be rendered for PDF export.');
    }

    const pdf = await PDFDocument.create();
    const contentWidth = PDF_PAGE_WIDTH - PDF_MARGIN * 2;
    const contentHeight = PDF_PAGE_HEIGHT - PDF_MARGIN * 2;
    const pointsPerPixel = contentWidth / renderedCanvas.width;
    const maxSliceHeight = Math.max(1, Math.floor(contentHeight / pointsPerPixel));

    for (let sourceY = 0; sourceY < renderedCanvas.height; sourceY += maxSliceHeight) {
      const sliceHeight = Math.min(maxSliceHeight, renderedCanvas.height - sourceY);
      const pageCanvas = createEl('canvas');
      pageCanvas.width = renderedCanvas.width;
      pageCanvas.height = sliceHeight;

      const context = pageCanvas.getContext('2d');
      if (!context) {
        throw new Error('Unable to prepare a PDF page image.');
      }

      context.drawImage(
        renderedCanvas,
        0,
        sourceY,
        renderedCanvas.width,
        sliceHeight,
        0,
        0,
        renderedCanvas.width,
        sliceHeight,
      );

      const dataUrl = pageCanvas.toDataURL('image/png');
      const base64 = dataUrl.split(',')[1];
      if (!base64) {
        throw new Error('Unable to encode a PDF page image.');
      }

      const imageBytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
      const pageImage = await pdf.embedPng(imageBytes);
      const page = pdf.addPage([PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT]);
      const drawWidth = contentWidth;
      const drawHeight = sliceHeight * pointsPerPixel;

      page.drawImage(pageImage, {
        x: PDF_MARGIN,
        y: PDF_PAGE_HEIGHT - PDF_MARGIN - drawHeight,
        width: drawWidth,
        height: drawHeight,
      });

      pageCanvas.width = 0;
      pageCanvas.height = 0;
    }

    const pdfBytes = await pdf.save();
    const pdfBuffer = new ArrayBuffer(pdfBytes.byteLength);
    new Uint8Array(pdfBuffer).set(pdfBytes);
    return new Blob([pdfBuffer], { type: 'application/pdf' });
  } finally {
    container.remove();
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = createEl('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
