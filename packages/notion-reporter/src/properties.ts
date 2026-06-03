import type { TaskResult } from 'refactor-tracker';

type PropertyBag = Record<string, unknown>;

const text = (content: string) => [{ text: { content } }];
const date = (iso: string | null) => (iso ? { date: { start: iso } } : { date: null });
const numberOrNull = (n: number | null | undefined) => ({
  number: n === undefined ? null : n,
});

export function taskToProperties(task: TaskResult, syncedAtIso: string): PropertyBag {
  const props: PropertyBag = {
    Task: { title: text(task.name) },
    ID: { rich_text: text(task.id) },
    Done: { number: task.done },
    Total: { number: task.total },
    Percentage: { number: task.percentage },
    'Δ Last run': numberOrNull(task.delta),
    Completed: { checkbox: task.completedAt != null },
    Registered: date(task.registeredAt),
    'Completed at': date(task.completedAt),
    'Duration (days)': numberOrNull(task.durationDays),
    'Last synced': date(syncedAtIso),
  };
  if (task.description) {
    props.Description = { rich_text: text(task.description) };
  }
  if (task.tags && task.tags.length > 0) {
    props.Tags = { multi_select: task.tags.map((name) => ({ name })) };
  }
  return props;
}
