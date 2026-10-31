export interface Heading {
  readonly level: number;
  readonly text: string;
  readonly line: number;
}

/** Parse ATX headings from Markdown source. Fenced code blocks are ignored. */
export function findHeadings(markdown: string): Heading[] {
  const lines = markdown.split(/\r?\n/);
  const headings: Heading[] = [];
  let fence: string | null = null;

  lines.forEach((line, index) => {
    const fenceMatch = line.match(/^\s{0,3}(```+|~~~+)/);
    if (fenceMatch) {
      const marker = fenceMatch[1]?.[0] ?? '';
      if (fence === null) fence = marker;
      else if (fence === marker) fence = null;
      return;
    }
    if (fence !== null) return;

    const match = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (match) {
      headings.push({
        level: match[1]?.length ?? 1,
        text: (match[2] ?? '').trim(),
        line: index,
      });
    }
  });
  return headings;
}

/**
 * Extract a heading and its descendants, stopping at the next heading of equal
 * or smaller depth. The returned source retains the original Markdown.
 */
export function extractHeadingSection(markdown: string, headingLine: number): string {
  const lines = markdown.split(/\r?\n/);
  const headings = findHeadings(markdown);
  const target = headings.find((heading) => heading.line === headingLine);
  if (!target) return '';

  const next = headings.find(
    (heading) => heading.line > headingLine && heading.level <= target.level,
  );
  return lines.slice(target.line, next?.line ?? lines.length).join('\n').trim();
}
