import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Reporter, Report, TaskResult } from '../types.js';
import { groupTasksByTag } from '../grouping.js';
import { formatDate } from './format.js';

function escapeCell(s: string): string {
  return s.replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function renderTable(tasks: TaskResult[], nowIso: string): string[] {
  const showDescription = tasks.some((t) => t.description);
  const headers = showDescription
    ? ['Refactor', 'Description', 'Done', 'Total', '%', 'Registered', 'Completed', 'Duration']
    : ['Refactor', 'Done', 'Total', '%', 'Registered', 'Completed', 'Duration'];
  const headerLine = `| ${headers.join(' | ')} |`;
  const separator = `| ${headers.map(() => '---').join(' | ')} |`;
  const rows = tasks.map((t) => {
    const reg = t.registeredAt ? formatDate(t.registeredAt, nowIso) : '—';
    const comp = t.completedAt ? formatDate(t.completedAt, nowIso) : '—';
    const dur = t.durationDays !== null ? `${t.durationDays}d` : '—';
    const cells = showDescription
      ? [
          t.name,
          escapeCell(t.description ?? ''),
          t.done,
          t.total,
          `${t.percentage}%`,
          reg,
          comp,
          dur,
        ]
      : [t.name, t.done, t.total, `${t.percentage}%`, reg, comp, dur];
    return `| ${cells.join(' | ')} |`;
  });
  return [headerLine, separator, ...rows];
}

function renderItems(tasks: TaskResult[]): string[] {
  const lines: string[] = [];
  for (const t of tasks) {
    if (!t.items || t.items.length === 0) continue;
    lines.push(
      '<details>',
      `<summary>${t.name} — ${t.items.length} remaining</summary>`,
      '',
      ...t.items.map((item) => `- ${item}`),
      '',
      '</details>',
      '',
    );
  }
  return lines;
}

export function formatMarkdown(report: Report): string {
  const groups = groupTasksByTag(report.tasks);
  const flat = groups.length === 1 && groups[0].tag === null;
  const nowIso = report.timestamp;

  const body: string[] = [];
  if (flat) {
    body.push(...renderTable(groups[0].tasks, nowIso), '', ...renderItems(groups[0].tasks));
  } else {
    for (const g of groups) {
      const heading = g.tag === null ? 'Untagged' : g.tag;
      body.push(`## ${heading}`, '', ...renderTable(g.tasks, nowIso), '', ...renderItems(g.tasks));
    }
  }

  return ['# Refactor progress', '', `_Updated: ${report.timestamp}_`, '', ...body].join('\n');
}

export class MarkdownReporter implements Reporter {
  constructor(readonly output: string) {}

  async report(report: Report): Promise<void> {
    await mkdir(path.dirname(this.output), { recursive: true });
    await writeFile(this.output, formatMarkdown(report), 'utf8');
  }
}
