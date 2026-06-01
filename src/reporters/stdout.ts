import type { Reporter, Report, TaskResult } from '../types.js';
import { groupTasksByTag } from '../grouping.js';

function renderRow(t: TaskResult): string {
  const delta = t.delta === null ? '' : t.delta > 0 ? ` (+${t.delta})` : ` (${t.delta})`;
  return `${t.name}: ${t.done}/${t.total} (${t.percentage}%)${delta}`;
}

export function formatTable(report: Report): string {
  const groups = groupTasksByTag(report.tasks);
  const flat = groups.length === 1 && groups[0].tag === null;

  if (flat) return groups[0].tasks.map(renderRow).join('\n');

  const sections: string[] = [];
  for (const g of groups) {
    const heading = g.tag === null ? 'Untagged' : g.tag;
    sections.push(`## ${heading}`, ...g.tasks.map(renderRow));
  }
  return sections.join('\n');
}

export class StdoutReporter implements Reporter {
  async report(report: Report): Promise<void> {
    console.log(formatTable(report));
  }
}
