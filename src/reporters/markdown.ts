import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Reporter, Report } from '../types.js';

function escapeCell(s: string): string {
  return s.replaceAll('|', '\\|').replaceAll('\n', ' ');
}

export function formatMarkdown(report: Report): string {
  const showDescription = report.tasks.some((t) => t.description);
  const headers = showDescription
    ? ['Refactor', 'Description', 'Done', 'Total', '%']
    : ['Refactor', 'Done', 'Total', '%'];
  const headerLine = `| ${headers.join(' | ')} |`;
  const separator = `| ${headers.map(() => '---').join(' | ')} |`;
  const rows = report.tasks.map((t) => {
    const cells = showDescription
      ? [t.name, escapeCell(t.description ?? ''), t.done, t.total, `${t.percentage}%`]
      : [t.name, t.done, t.total, `${t.percentage}%`];
    return `| ${cells.join(' | ')} |`;
  });
  return [
    '# Refactor progress',
    '',
    `_Updated: ${report.timestamp}_`,
    '',
    headerLine,
    separator,
    ...rows,
    '',
  ].join('\n');
}

export class MarkdownReporter implements Reporter {
  constructor(readonly output: string) {}

  async report(report: Report): Promise<void> {
    await mkdir(path.dirname(this.output), { recursive: true });
    await writeFile(this.output, formatMarkdown(report), 'utf8');
  }
}
