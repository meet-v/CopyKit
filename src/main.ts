import { Editor, MarkdownView, Menu, Notice, Plugin } from 'obsidian';
import { DEFAULT_SETTINGS } from './types/settings';
import type { CopyExportSettings, TableFormat } from './types/settings';
import { CopyExportSettingTab } from './ui/settings';
import { ExportModal } from './ui/export-modal';
import { copyText, copyHtml } from './services/clipboard';
import { copyImageFromUrl, saveImageToVault } from './services/image';
import { convertTable } from './utils/table';
import { findHeadings } from './utils/markdown';
import { ExperimentalOutlineIntegration } from './experimental/outline-integration';
import { TABLE_ACTION_CLASS } from './constants';

export default class CopyExportPlugin extends Plugin {
  settings: CopyExportSettings = DEFAULT_SETTINGS;
  private outlineIntegration: ExperimentalOutlineIntegration | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.registerCommands();
    this.registerEditorMenu();
    this.registerRenderedContentActions();
    this.addSettingTab(new CopyExportSettingTab(this.app, this));
    this.configureExperimentalOutline();
  }

  onunload(): void {
    this.outlineIntegration?.disable();
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  refreshExperimentalOutline(): void {
    this.configureExperimentalOutline();
  }

  private configureExperimentalOutline(): void {
    if (this.settings.enableExperimentalOutline) {
      if (!this.outlineIntegration) {
        this.outlineIntegration = new ExperimentalOutlineIntegration((headingText, line) => {
          const active = this.getActiveMarkdown();
          if (!active) return;
          const headings = findHeadings(active.editor.getValue());
          const heading = (line !== undefined
            ? headings.find((candidate) => candidate.line === line)
            : undefined) ?? headings.find((candidate) => candidate.text === headingText);
          if (!heading) {
            new Notice('Could not resolve this Outline entry to a note heading.');
            return;
          }
          new ExportModal(this.app, this.settings, () => this.getActiveMarkdown(), heading.line).open();
        });
      }
      this.outlineIntegration.enable();
    } else {
      this.outlineIntegration?.disable();
    }
  }

  private registerCommands(): void {
    this.addCommand({
      id: 'copykit',
      name: 'CopyKit',
      callback: () => new ExportModal(this.app, this.settings, () => this.getActiveMarkdown()).open(),
    });
  }

  private registerEditorMenu(): void {
    this.registerEvent(this.app.workspace.on('editor-menu', (menu: Menu) => {
      menu.addItem((item) => item
        .setTitle('CopyKit…')
        .setIcon('copy')
        .onClick(() => new ExportModal(this.app, this.settings, () => this.getActiveMarkdown()).open()));
    }));
  }

  private registerRenderedContentActions(): void {
    // Do not intercept the native contextmenu event. Obsidian does not expose
    // a public preview-table menu extension point; the action button below
    // opens our table actions without suppressing Obsidian's own menu.
    this.registerMarkdownPostProcessor((element) => {
      element.querySelectorAll('table').forEach((table) => {
        if (table.dataset.cetActionAdded === 'true') return;
        table.dataset.cetActionAdded = 'true';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `clickable-icon ${TABLE_ACTION_CLASS}`;
        button.setAttribute('aria-label', 'Copy or export table');
        button.textContent = 'Copy / Export';
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          const menu = new Menu();
          this.addTableMenuItems(menu, table);
          menu.showAtPosition({ x: button.getBoundingClientRect().left, y: button.getBoundingClientRect().bottom });
        });
        table.parentElement?.insertBefore(button, table);
      });
      element.querySelectorAll('img').forEach((image) => {
        if (image.dataset.cetActionAdded === 'true') return;
        image.dataset.cetActionAdded = 'true';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `clickable-icon ${TABLE_ACTION_CLASS}`;
        button.setAttribute('aria-label', 'Copy or save image');
        button.textContent = 'Image actions';
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          const menu = new Menu();
          this.addImageMenuItems(menu, image);
          menu.showAtPosition({ x: button.getBoundingClientRect().left, y: button.getBoundingClientRect().bottom });
        });
        image.parentElement?.insertBefore(button, image);
      });
    });
  }

  private addTableMenuItems(menu: Menu, table: HTMLTableElement): void {
    const rows = this.readTable(table);
    const formats: { format: TableFormat; label: string }[] = [
      { format: 'markdown', label: 'Markdown' },
      { format: 'html', label: 'HTML' },
      { format: 'csv', label: 'CSV' },
      { format: 'tsv', label: 'TSV' },
    ];
    formats.forEach(({ format, label }) => {
      menu.addItem((item) => item
        .setTitle(`Copy table as ${label}`)
        .setIcon('copy')
        .onClick(async () => {
          const value = convertTable(rows, format);
          try {
            if (format === 'html') await copyHtml(value, table.innerText);
            else await copyText(value);
            new Notice(`Table copied as ${label}.`);
          } catch (error) {
            new Notice(error instanceof Error ? error.message : 'Unable to copy table.');
          }
        }));
    });
  }

  private addImageMenuItems(menu: Menu, image: HTMLImageElement): void {
    const source = image.currentSrc || image.src;
    menu.addItem((item) => item
      .setTitle('Copy image')
      .setIcon('image')
      .onClick(async () => {
        try {
          await copyImageFromUrl(source, this.app);
          new Notice('Image copied.');
        } catch (error) {
          new Notice(error instanceof Error ? error.message : 'Unable to copy image.');
        }
      }));
    menu.addItem((item) => item
      .setTitle('Save image to vault')
      .setIcon('download')
      .onClick(async () => {
        try {
          const path = await saveImageToVault(source, this.settings.imageFolder, this.app);
          new Notice(`Image saved to ${path}.`);
        } catch (error) {
          new Notice(error instanceof Error ? error.message : 'Unable to save image.');
        }
      }));
  }

  private readTable(table: HTMLTableElement): string[][] {
    return Array.from(table.rows).map((row) =>
      Array.from(row.cells).map((cell) => cell.innerText.trim()),
    );
  }

  private getActiveMarkdown(): { view: MarkdownView; editor: Editor } | null {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    return view ? { view, editor: view.editor } : null;
  }

}
