import { describe, expect, it } from 'vitest';
import { extractHeadingSection, findHeadings } from '../src/utils/markdown';

describe('Markdown heading utilities', () => {
  it('ignores headings inside fenced code blocks', () => {
    const source = '# Real\n```md\n## Not a heading\n```\n## Also real';
    expect(findHeadings(source).map((heading) => heading.text)).toEqual(['Real', 'Also real']);
  });

  it('includes nested headings and stops at the next peer heading', () => {
    const source = '# A\ntext\n## A1\nnested\n# B\nother';
    expect(extractHeadingSection(source, 0)).toBe('# A\ntext\n## A1\nnested');
  });
});
