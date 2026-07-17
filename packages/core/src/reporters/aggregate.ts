import type { Report } from '../types.js';

export interface ReportAggregate {
  done: number;
  total: number;
  percentage: number;
}

export function aggregateReport(report: Report): ReportAggregate {
  const done = report.tasks.reduce((sum, t) => sum + t.done, 0);
  const total = report.tasks.reduce((sum, t) => sum + t.total, 0);
  const percentage = total === 0 ? 0 : Math.round((done / total) * 100);
  return { done, total, percentage };
}
