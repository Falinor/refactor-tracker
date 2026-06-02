import type { Reporter, Report, TaskResult } from '../types.js';
import { groupTasksByTag } from '../grouping.js';
import { formatDate, ageDays } from './format.js';

function renderMilestoneLine(t: TaskResult, nowIso: string): string {
  const reg = t.registeredAt ? `registered ${formatDate(t.registeredAt, nowIso)}` : 'registered —';
  if (t.completedAt) {
    const comp = `completed ${formatDate(t.completedAt, nowIso)}`;
    const dur = t.durationDays !== null ? `${t.durationDays}d` : 'duration unknown';
    return `    ${reg} · ${comp} · ${dur}`;
  }
  const age = t.registeredAt ? `${ageDays(t.registeredAt, nowIso)}d open` : 'age unknown';
  return `    ${reg} · ${age}`;
}

function renderRow(t: TaskResult, nowIso: string): string {
  const delta = t.delta === null ? '' : t.delta > 0 ? ` (+${t.delta})` : ` (${t.delta})`;
  const head = `${t.name}: ${t.done}/${t.total} (${t.percentage}%)${delta}`;
  return `${head}\n${renderMilestoneLine(t, nowIso)}`;
}

export function formatTable(report: Report): string {
  const groups = groupTasksByTag(report.tasks);
  const flat = groups.length === 1 && groups[0].tag === null;
  const nowIso = report.timestamp;

  if (flat) return groups[0].tasks.map((t) => renderRow(t, nowIso)).join('\n');

  const sections: string[] = [];
  for (const g of groups) {
    const heading = g.tag === null ? 'Untagged' : g.tag;
    sections.push(`## ${heading}`, ...g.tasks.map((t) => renderRow(t, nowIso)));
  }
  return sections.join('\n');
}

export class StdoutReporter implements Reporter {
  async report(report: Report): Promise<void> {
    console.log(formatTable(report));
  }
}
