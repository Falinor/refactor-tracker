import type { Report } from './types.js';

export interface ViewOptions {
  showCompleted: boolean;
  sortBy?: 'registered' | 'completed' | 'progress';
}

export function applyView(report: Report, opts: ViewOptions): Report {
  let tasks = report.tasks;
  if (!opts.showCompleted) tasks = tasks.filter((t) => t.completedAt === null);
  // sortBy handled in Task 9.
  return { ...report, tasks };
}
