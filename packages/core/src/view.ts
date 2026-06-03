import type { Report, TaskResult } from './types.js';

export interface ViewOptions {
  showCompleted: boolean;
  sortBy?: 'registered' | 'completed' | 'progress';
}

function compareNullable<T>(a: T | null, b: T | null, cmp: (x: T, y: T) => number): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return cmp(a, b);
}

function sortTasks(
  tasks: TaskResult[],
  key: 'registered' | 'completed' | 'progress',
): TaskResult[] {
  const sorted = [...tasks];
  if (key === 'registered') {
    sorted.sort((a, b) =>
      compareNullable(a.registeredAt, b.registeredAt, (x, y) => Date.parse(x) - Date.parse(y)),
    );
  } else if (key === 'completed') {
    sorted.sort((a, b) =>
      compareNullable(a.completedAt, b.completedAt, (x, y) => Date.parse(y) - Date.parse(x)),
    );
  } else {
    sorted.sort((a, b) => a.percentage - b.percentage);
  }
  return sorted;
}

export function applyView(report: Report, opts: ViewOptions): Report {
  let tasks = report.tasks;
  if (!opts.showCompleted) tasks = tasks.filter((t) => t.completedAt === null);
  if (opts.sortBy) tasks = sortTasks(tasks, opts.sortBy);
  return { ...report, tasks };
}
