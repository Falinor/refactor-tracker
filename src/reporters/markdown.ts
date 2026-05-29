import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Reporter, Report } from '../types.js';

export function formatMarkdown(report: Report): string {
  const header = '| Refactor | Done | Total | % |\n| --- | --- | --- | --- |';
  const rows = report.tasks.map((t) => `| ${t.name} | ${t.done} | ${t.total} | ${t.percentage}% |`);
  return [
    '# Refactor progress',
    '',
    `_Updated: ${report.timestamp}_`,
    '',
    header,
    ...rows,
    '',
  ].join('\n');
}

export class MarkdownReporter implements Reporter {
  constructor(private readonly output: string) {}

  async report(report: Report): Promise<void> {
    await mkdir(path.dirname(this.output), { recursive: true });
    await writeFile(this.output, formatMarkdown(report), 'utf8');
  }
}
