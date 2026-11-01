import { Editor, MarkdownView, Menu, Notice, Plugin, setIcon } from 'obsidian';
import { DEFAULT_SETTINGS } from './types/settings';
import type { CopyExportSettings, TableFormat , ExportFormat, CopyFormat} from './types/settings';
import { CopyExportSettingTab } from './ui/settings';
import { ExportModal } from './ui/export-modal';
import { copyText, copyHtml } from './services/clipboard';
import { copyImageFromUrl } from './services/image';
import { convertTable } from './utils/table';
import { findHeadings } from './utils/markdown';
import { ExperimentalOutlineIntegration } from './experimental/outline-integration';
import { TABLE_ACTION_CLASS } from './constants';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCopyFormat(value: unknown): value is CopyFormat {
  return value === 'markdown' || value === 'text' || value === 'html';
}

function isExportFormat(value: unknown): value is ExportFormat {
  return (
    value === 'markdown' ||
    value === 'text' ||
    value === 'html' ||
    value === 'pdf'
  );
}

export default class CopyExportPlugin extends Plugin {
  settings: CopyExportSettings = DEFAULT_SETTINGS;
  private outlineIntegration: ExperimentalOutlineIntegration | null = null;
  /** Last Markdown view that had focus; Outline clicks can make it inactive. */
  private lastMarkdownView: MarkdownView | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.trackActiveMarkdownView();
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
    const data: unknown = await this.loadData();

    if (!isRecord(data)) {
      this.settings = { ...DEFAULT_SETTINGS };
      return;
    }

    this.settings = {
      defaultCopyFormat: isCopyFormat(data.defaultCopyFormat)
        ? data.defaultCopyFormat
        : DEFAULT_SETTINGS.defaultCopyFormat,

      defaultExportFormat: isExportFormat(data.defaultExportFormat)
        ? data.defaultExportFormat
        : DEFAULT_SETTINGS.defaultExportFormat,

      enableExperimentalOutline:
        typeof data.enableExperimentalOutline === 'boolean'
          ? data.enableExperimentalOutline
          : DEFAULT_SETTINGS.enableExperimentalOutline,
    };
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
          if (!active) {
            new Notice('Could not find the Markdown note associated with this Outline entry.');
            return;
          }

          const headings = findHeadings(active.editor.getValue());

          // Outline DOM attributes may be zero-based or one-based depending on
          // the Obsidian version. Prefer a line-and-text match, then fall back
          // to the line alone and finally to the heading text.
          const heading = (line !== undefined
            ? headings.find((candidate) =>
                candidate.text === headingText &&
                (candidate.line === line || candidate.line === line - 1))
            : undefined)
            ?? (line !== undefined
              ? headings.find((candidate) =>
                  candidate.line === line || candidate.line === line - 1)
              : undefined)
            ?? headings.find((candidate) => candidate.text === headingText);

          if (!heading) {
            new Notice('Could not resolve this Outline entry to a note heading.');
            return;
          }

          new ExportModal(
            this.app,
            this.settings,
            () => this.getActiveMarkdown(),
            heading.line,
          ).open();
        });
      }
      this.outlineIntegration.enable();
    } else {
      this.outlineIntegration?.disable();
    }
  }

  private registerCommands(): void {
    this.addCommand({
      id: 'copy-and-export',
      name: 'Copy / Export Content',
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

    this.registerMarkdownPostProcessor((element) => {
      
      // Table Export Button
      element.querySelectorAll('table').forEach((table) => {
        if (table.dataset.cetActionAdded === 'true') return;
        table.dataset.cetActionAdded = 'true';
        const button = createEl('button', {
          cls: `clickable-icon ${TABLE_ACTION_CLASS}`,
          attr: {
            type: 'button',
            'aria-label': 'Copy or export table',
          },
          text: 'Copy / Export',
        });
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          const menu = new Menu();
          this.addTableMenuItems(menu, table);
          menu.showAtPosition({ x: button.getBoundingClientRect().left, y: button.getBoundingClientRect().bottom });
        });
        table.parentElement?.insertBefore(button, table);
      });
    });

    // Detect embedded images that Obsidian inserts after Markdown processing.
    const addImageAction = (image: HTMLImageElement): void => {
      const imageHost = image.closest('.image-embed, .image-wrapper');

      if (!(imageHost instanceof HTMLElement)) return;

      // Explicitly exclude Live Preview and other source-editor views.
      const isReadingView =
        image.closest('.markdown-preview-view') !== null &&
        image.closest('.markdown-source-view') === null;

      if (!isReadingView) {
        const previousElement = imageHost.previousElementSibling;

        if (
          previousElement instanceof HTMLButtonElement &&
          previousElement.dataset.cetImageAction === 'true'
        ) {
          previousElement.remove();
        }

        delete image.dataset.cetActionAdded;
        return;
      }

      if (image.dataset.cetActionAdded === 'true') return;

      const button = createEl('button', {
        cls: 'clickable-icon',
        attr: {
          type: 'button',
          'aria-label': 'Copy image',
        },
      });

      setIcon(button, 'image');
      button.dataset.cetImageAction = 'true';

      button.addEventListener('click', async (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();

        try {
          await copyImageFromUrl(image.currentSrc || image.src, this.app);
          new Notice('Image copied to clipboard.');
        } catch (error) {
          new Notice(
            error instanceof Error
              ? error.message
              : 'Unable to copy image to clipboard.',
          );
        }
      });;

      imageHost.insertAdjacentElement('beforebegin', button);
      image.dataset.cetActionAdded = 'true';
    };

    const processNode = (node: Node): void => {
      if (!(node instanceof HTMLElement)) return;

      if (node instanceof HTMLImageElement) {
        addImageAction(node);
      }

      node.querySelectorAll<HTMLImageElement>(
        '.image-embed img, .image-wrapper img, img.image-embed',
      ).forEach(addImageAction);
    };

    // Process images already present.
    document.querySelectorAll<HTMLImageElement>(
      '.image-embed img, .image-wrapper img, img.image-embed',
    ).forEach(addImageAction);

    // Process images inserted later by Obsidian.
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach(processNode);
      });
    });

    // Hide image action buttons inside Live Preview.
    const imageButtonStyle = createEl('style');

    imageButtonStyle.textContent = `
      .markdown-source-view button[aria-label="Copy image"] {
        display: none !important;
      }
    `;

    document.head.appendChild(imageButtonStyle);

    this.register(() => imageButtonStyle.remove());

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Disconnect the observer when the plugin unloads.
    this.register(() => observer.disconnect());
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

  private readTable(table: HTMLTableElement): string[][] {
    return Array.from(table.rows).map((row) =>
      Array.from(row.cells).map((cell) => cell.innerText.trim()),
    );
  }

  /**
   * Remember the most recently focused Markdown view. When a user right-clicks
   * an Outline item, the Outline leaf may become active, so
   * getActiveViewOfType(MarkdownView) can return null.
   */
  private trackActiveMarkdownView(): void {
    const initiallyActive = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (initiallyActive) this.lastMarkdownView = initiallyActive;

    this.registerEvent(
      this.app.workspace.on('active-leaf-change', (leaf) => {
        if (leaf?.view instanceof MarkdownView) {
          this.lastMarkdownView = leaf.view;
        }
      }),
    );
  }

  private getActiveMarkdown(): { view: MarkdownView; editor: Editor } | null {
    const workspace = this.app.workspace;

    // Prefer the active Markdown view whenever one is focused.
    const activeView = workspace.getActiveViewOfType(MarkdownView);
    if (activeView) {
      this.lastMarkdownView = activeView;
      return { view: activeView, editor: activeView.editor };
    }

    // If Outline has focus, resolve its note through the workspace's active
    // file and the Markdown leaves currently displaying that file.
    const activeFile = workspace.getActiveFile();
    if (activeFile) {
      const matchingLeaf = workspace.getLeavesOfType('markdown').find((leaf) => {
        const view = leaf.view;
        return view instanceof MarkdownView && view.file?.path === activeFile.path;
      });

      if (matchingLeaf?.view instanceof MarkdownView) {
        this.lastMarkdownView = matchingLeaf.view;
        return { view: matchingLeaf.view, editor: matchingLeaf.view.editor };
      }
    }

    // Final fallback: the Markdown view that was active before Outline took
    // focus. This is what allows the Outline context-menu action to open.
    if (this.lastMarkdownView?.file) {
      return { view: this.lastMarkdownView, editor: this.lastMarkdownView.editor };
    }

    return null;
  }

}
