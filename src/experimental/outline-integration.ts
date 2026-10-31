import { OUTLINE_ITEM_SELECTOR } from '../constants';

/**
 * Experimental Outline adapter. Obsidian does not expose a public API for
 * extending the built-in Outline context menu, so this adds a small action
 * button to each Outline row instead of replacing Obsidian's native menu.
 */
export class ExperimentalOutlineIntegration {
  private observer: MutationObserver | null = null;
  private enabled = false;

  constructor(private readonly onHeadingAction: (headingText: string, line: number | undefined) => void) {}

  enable(): void {
    if (this.enabled) return;
    this.enabled = true;
    this.observer = new MutationObserver(() => this.attachActions());
    this.observer.observe(document.body, { childList: true, subtree: true });
    this.attachActions();
  }

  disable(): void {
    this.enabled = false;
    this.observer?.disconnect();
    this.observer = null;
    document.querySelectorAll<HTMLElement>('.cet-outline-action').forEach((button) => button.remove());
  }

  private attachActions(): void {
    if (!this.enabled) return;
    document.querySelectorAll<HTMLElement>(OUTLINE_ITEM_SELECTOR).forEach((item) => {
      if (item.querySelector('.cet-outline-action')) return;
      const label = item.querySelector<HTMLElement>('.tree-item-inner');
      const headingText = label?.textContent?.trim();
      if (!headingText) return;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cet-outline-action clickable-icon';
      button.setAttribute('aria-label', `Copy or export heading: ${headingText}`);
      button.setAttribute('title', 'Copy and export this heading');
      button.textContent = '⇧';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const rawLine = item.dataset.line ?? item.getAttribute('data-line');
        const line = rawLine && /^\d+$/.test(rawLine) ? Number(rawLine) : undefined;
        this.onHeadingAction(headingText, line);
      });
      item.append(button);
    });
  }
}
