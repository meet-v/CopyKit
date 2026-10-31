import { jsPDF } from 'jspdf';
import { markdownToHtml, markdownToPlainText } from './formatting';

export type DownloadFormat = 'markdown' | 'text' | 'html' | 'pdf';

export async function createExportBlob(markdown: string, format: DownloadFormat): Promise<{ blob: Blob; extension: string; mimeType: string }> {
  if (format === 'markdown') {
    return { blob: new Blob([markdown], { type: 'text/markdown;charset=utf-8' }), extension: 'md', mimeType: 'text/markdown' };
  }
  if (format === 'text') {
    return { blob: new Blob([markdownToPlainText(markdown)], { type: 'text/plain;charset=utf-8' }), extension: 'txt', mimeType: 'text/plain' };
  }
  const html = markdownToHtml(markdown);
  if (format === 'html') {
    return { blob: new Blob([html], { type: 'text/html;charset=utf-8' }), extension: 'html', mimeType: 'text/html' };
  }

  const container = document.createElement('div');
  container.className = 'cet-pdf-render-root';
  container.style.cssText = 'position:fixed;left:-10000px;top:0;width:760px;background:#fff;color:#222;padding:32px;font-family:Arial,sans-serif;line-height:1.5;';
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const content = parsed.body;
  container.append(...Array.from(content.childNodes).map((node) => node.cloneNode(true)));
  document.body.append(container);

  try {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const blob = await new Promise<Blob>((resolve, reject) => {
      try {
        pdf.html(container, {
          html2canvas: { scale: 0.9, useCORS: false, logging: false },
          x: 28,
          y: 28,
          width: 539,
          windowWidth: 760,
          autoPaging: 'text',
          callback: (document) => resolve(document.output('blob')),
        });
      } catch (error) {
        reject(error);
      }
    });
    return { blob, extension: 'pdf', mimeType: 'application/pdf' };
  } finally {
    container.remove();
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
