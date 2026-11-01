import { App, Editor, MarkdownView, Modal, Notice, Setting } from 'obsidian';
import type { CopyExportSettings, CopyFormat, ExportFormat } from '../types/settings';
import { findHeadings, extractHeadingSection } from '../utils/markdown';
import { copyHtml, copyText } from '../services/clipboard';
import { markdownToHtml, markdownToPlainText } from '../services/formatting';
import { createExportBlob, downloadBlob } from '../services/export';

type ContentSource = 'selection' | 'heading';
type Operation = 'copy' | 'export';

export class ExportModal extends Modal {
  private operation: Operation;
  private copyFormat: CopyFormat;
  private exportFormat: ExportFormat;
  private source: ContentSource;
  private headingLevel = 1;
  private selectedLine = -1;
  private preview = '';

  constructor(
    app: App,
    settings: CopyExportSettings,
    private readonly getActiveMarkdown: () => { view: MarkdownView; editor: Editor } | null,
    initialHeadingLine?: number,
  ) {
    super(app);
    this.operation = 'copy';
    this.copyFormat = settings.defaultCopyFormat;
    this.exportFormat = settings.defaultExportFormat;
    this.source = initialHeadingLine === undefined ? 'selection' : 'heading';
    this.selectedLine = initialHeadingLine ?? -1;
    const active = getActiveMarkdown();
    this.preview = active?.editor.getSelection() ?? '';
    if (initialHeadingLine !== undefined && active) {
      const heading = findHeadings(active.editor.getValue()).find((item) => item.line === initialHeadingLine);
      this.headingLevel = heading?.level ?? 1;
      this.preview = extractHeadingSection(active.editor.getValue(), initialHeadingLine);
    } else if (!this.preview) {
      this.source = 'heading';
    }
  }

  onOpen(): void {
    this.modalEl.addClass('cet-export-modal');
    this.render();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: 'CopyKit' });
    const active = this.getActiveMarkdown();
    if (!active) {
      contentEl.createEl('p', { text: 'Open a Markdown note to use this tool.' });
      return;
    }

    new Setting(contentEl)
      .setName('Action')
      .addDropdown((dropdown) => dropdown
        .addOption('copy', 'Copy to clipboard')
        .addOption('export', 'Export as file')
        .setValue(this.operation)
        .onChange((value) => { this.operation = value as Operation; this.render(); }));

    const currentSelection = active.editor.getSelection();
    new Setting(contentEl)
      .setName('Content source')
      .addDropdown((dropdown) => dropdown
        .addOption('selection', 'Selected text')
        .addOption('heading', 'Choose a heading')
        .setValue(this.source)
        .onChange((value) => {
          this.source = value as ContentSource;
          this.selectedLine = -1;
          this.preview = this.source === 'selection' ? currentSelection : '';
          this.render();
        }));

    if (this.source === 'selection') {
      this.preview = currentSelection || this.preview;
      if (!this.preview) contentEl.createEl('p', { text: 'Select text in the editor, then reopen this modal.' });
    } else {
      const headings = findHeadings(active.editor.getValue());
      const levels = [...new Set(headings.map((heading) => heading.level))].sort();
      new Setting(contentEl)
        .setName('Heading level')
        .addDropdown((dropdown) => {
        for (const level of levels) {
          dropdown.addOption(String(level), `H${level}`);
        }
          dropdown.setValue(String(levels.includes(this.headingLevel) ? this.headingLevel : levels[0] ?? 1));
          dropdown.onChange((value) => { this.headingLevel = Number(value); this.selectedLine = -1; this.preview = ''; this.render(); });
        });
      const matches = headings.filter((heading) => heading.level === this.headingLevel);
      new Setting(contentEl)
        .setName('Heading')
        .addDropdown((dropdown) => {
          dropdown.addOption('', 'Choose a heading');
          for (const heading of matches) {
            dropdown.addOption(
              String(heading.line),
              `${heading.text} (line ${heading.line + 1})`,
            );
          }
          dropdown.setValue(this.selectedLine >= 0 ? String(this.selectedLine) : '');
          dropdown.onChange((value) => {
            this.selectedLine = value ? Number(value) : -1;
            this.preview = this.selectedLine >= 0 ? extractHeadingSection(active.editor.getValue(), this.selectedLine) : '';
            this.render();
          });
        });
    }

    if (this.operation === 'copy') {
      new Setting(contentEl)
        .setName('Copy format')
        .addDropdown((dropdown) => dropdown
          .addOption('markdown', 'Markdown')
          .addOption('text', 'Plain text')
          .addOption('html', 'Formatted text (HTML / rich text)')
          .setValue(this.copyFormat)
          .onChange((value) => { this.copyFormat = value as CopyFormat; this.render(); }));
    } else {
      new Setting(contentEl)
        .setName('Export format')
        .addDropdown((dropdown) => dropdown
          .addOption('pdf', 'PDF')
          .addOption('markdown', 'Markdown (.md)')
          .addOption('text', 'Plain text (.txt)')
          .addOption('html', 'Formatted text (.html)')
          .setValue(this.exportFormat)
          .onChange((value) => { this.exportFormat = value as ExportFormat; this.render(); }));
    }

    if (this.preview) {
      const previewEl = contentEl.createEl('pre', { cls: 'cet-preview' });
      previewEl.setText(this.preview.length > 3000 ? `${this.preview.slice(0, 3000)}\n…` : this.preview);
      new Setting(contentEl).addButton((button) => button
        .setButtonText(this.operation === 'copy' ? 'Copy' : 'Export')
        .setCta()
        .onClick(() => { void this.performAction(active.view.file?.path ?? ''); }));
    }
  }

  private async performAction(sourcePath: string): Promise<void> {
    if (!this.preview) return;
    try {
      if (this.operation === 'copy') {
        if (this.copyFormat === 'markdown') await copyText(this.preview);
        else if (this.copyFormat === 'text') await copyText(markdownToPlainText(this.preview));
        else {
          const formatted = await copyHtml(markdownToHtml(this.preview), markdownToPlainText(this.preview));
          if (!formatted) {
            new Notice('HTML clipboard is unavailable; copied as plain text instead.');
            return;
          }
        }
        new Notice(`Copied as ${this.copyFormat === 'html' ? 'formatted text' : this.copyFormat}.`);
        return;
      }
      const result = await createExportBlob(this.preview, this.exportFormat);
      const baseName = sourcePath.split('/').pop()?.replace(/\.[^.]+$/, '') || 'obsidian-export';
      downloadBlob(result.blob, `${baseName}-export.${result.extension}`);
      new Notice(`Exported ${result.extension.toUpperCase()} file.`);
    } catch (error) {
      new Notice(error instanceof Error ? error.message : 'Unable to complete the operation.');
    }
  }
}
