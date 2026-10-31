import { describe, expect, it } from 'vitest';
import { tableToDelimited, tableToMarkdown } from '../src/utils/table';

describe('table converters', () => {
  it('escapes pipes in Markdown cells', () => {
    expect(tableToMarkdown([['A', 'B'], ['x|y', 'z']])).toContain('x\\|y');
  });

  it('quotes CSV fields containing delimiters', () => {
    expect(tableToDelimited([['a,b', 'c']], ',')).toBe('"a,b",c');
  });
});
