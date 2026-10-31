import { Menu } from 'obsidian';
import { OUTLINE_ITEM_SELECTOR } from '../constants';

/**
 * Experimental integration with Obsidian's built-in Outline view.
 *
 * Obsidian does not currently expose a public API for registering an item in
 * the built-in Outline view's context menu. This adapter therefore delegates
 * right-clicks on Outline tree items and displays an Obsidian Menu containing
 * the plugin action. It does not add controls or modify the Outline DOM.
 *
 * The callback receives the visible heading text and, when available, the
 * zero-based source line reported by the Outline DOM.
 */
export class ExperimentalOutlineIntegration {
  private enabled = false;

  constructor(
    private readonly onHeadingAction: (
      headingText: string,
      line: number | undefined,
    ) => void,
  ) {}

  enable(): void {
    if (this.enabled) return;

    this.enabled = true;
    document.addEventListener('contextmenu', this.handleContextMenu, true);
  }

  disable(): void {
    if (!this.enabled) return;

    this.enabled = false;
    document.removeEventListener('contextmenu', this.handleContextMenu, true);
  }

  /**
   * Use delegated event handling because Outline rows are rebuilt dynamically.
   * No MutationObserver or injected buttons are required.
   */
  private readonly handleContextMenu = (event: MouseEvent): void => {
    if (!this.enabled || !(event.target instanceof Element)) return;

    const item = event.target.closest<HTMLElement>(OUTLINE_ITEM_SELECTOR);
    if (!item) return;

    const headingElement = item.querySelector<HTMLElement>('.tree-item-inner');
    const headingText = headingElement?.textContent?.trim();

    if (!headingText) return;

    // Prevent the browser's native context menu and show an Obsidian Menu.
    event.preventDefault();
    event.stopPropagation();

    const line = headingElement
      ? this.getSourceLine(item, headingElement)
      : undefined;

    new Menu()
      .addItem((menuItem) => {
        menuItem
          .setTitle('Copy and export…')
          .setIcon('copy')
          .onClick(() => this.onHeadingAction(headingText, line));
      })
      .showAtMouseEvent(event);
  };

  /**
   * Obsidian's internal Outline DOM has changed between releases. Check the
   * row and its visible label for the common line-number attributes, without
   * relying on private React/Vue component state or adding DOM elements.
   */
  private getSourceLine(
    item: HTMLElement,
    headingElement: HTMLElement,
  ): number | undefined {
    const selfElement = item.querySelector<HTMLElement>('.tree-item-self');
    const candidates = [item, selfElement, headingElement];

    const lineAttributes = [
      'data-line',
      'data-heading-line',
      'data-line-number',
      'data-start-line',
    ];

    for (const candidate of candidates) {
      if (!candidate) continue;

      for (const attribute of lineAttributes) {
        const rawValue = candidate.getAttribute(attribute);
        if (rawValue && /^\d+$/.test(rawValue)) {
          return Number(rawValue);
        }
      }
    }

    return undefined;
  }
}
