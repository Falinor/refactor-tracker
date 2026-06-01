import type { TaskResult } from './types.js';

export interface TaskGroup {
  tag: string | null;
  tasks: TaskResult[];
}

export function groupTasksByTag(tasks: TaskResult[]): TaskGroup[] {
  const tagged = new Map<string, TaskResult[]>();
  const untagged: TaskResult[] = [];

  for (const task of tasks) {
    const tags = task.tags ?? [];
    if (tags.length === 0) {
      untagged.push(task);
      continue;
    }
    for (const tag of tags) {
      const bucket = tagged.get(tag);
      if (bucket) bucket.push(task);
      else tagged.set(tag, [task]);
    }
  }

  const groups: TaskGroup[] = [];
  for (const [tag, ts] of tagged) groups.push({ tag, tasks: ts });
  if (groups.length === 0 || untagged.length > 0) {
    groups.push({ tag: null, tasks: untagged });
  }
  return groups;
}
