import type { TableFormat } from '../types/settings';

function escapeMarkdownCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function escapeDelimited(value: string, delimiter: string): string {
  const escaped = value.replace(/"/g, '""');
  return escaped.includes(delimiter) || /["\r\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

export function tableToMarkdown(rows: readonly (readonly string[])[]): string {
  if (rows.length === 0) return '';
  const width = Math.max(...rows.map((row) => row.length));
  const normalized = rows.map((row) =>
    Array.from({ length: width }, (_, index) => escapeMarkdownCell(row[index] ?? '')),
  );
  const header = normalized[0] ?? [];
  const separator = Array.from({ length: width }, () => '---');
  const body = normalized.slice(1);
  return [header, separator, ...body].map((row) => `| ${row.join(' | ')} |`).join('\n');
}

export function tableToDelimited(
  rows: readonly (readonly string[])[],
  delimiter: ',' | '\t',
): string {
  return rows.map((row) => row.map((cell) => escapeDelimited(cell, delimiter)).join(delimiter)).join('\n');
}

export function tableToHtml(rows: readonly (readonly string[])[]): string {
  const table = createEl('table');
  rows.forEach((row, rowIndex) => {
    const tr = createEl('tr');
    row.forEach((cell) => {
      const cellElement = createEl(rowIndex === 0 ? 'th' : 'td');
      cellElement.textContent = cell;
      tr.append(cellElement);
    });
    table.append(tr);
  });
  return table.outerHTML;
}

export function convertTable(rows: readonly (readonly string[])[], format: TableFormat): string {
  switch (format) {
    case 'markdown': return tableToMarkdown(rows);
    case 'html': return tableToHtml(rows);
    case 'csv': return tableToDelimited(rows, ',');
    case 'tsv': return tableToDelimited(rows, '\t');
  }
}
