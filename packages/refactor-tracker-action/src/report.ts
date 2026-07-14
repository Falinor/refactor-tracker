import type { Report } from 'refactor-tracker';

export function totalDelta(report: Report): number {
  return report.tasks.reduce((sum, t) => sum + (t.delta ?? 0), 0);
}
