import type { Reporter, Report } from '../types.js';

export function formatTable(report: Report): string {
  return report.tasks
    .map((t) => {
      const delta = t.delta === null ? '' : t.delta > 0 ? ` (+${t.delta})` : ` (${t.delta})`;
      return `${t.name}: ${t.done}/${t.total} (${t.percentage}%)${delta}`;
    })
    .join('\n');
}

export class StdoutReporter implements Reporter {
  async report(report: Report): Promise<void> {
    console.log(formatTable(report));
  }
}
