import type { CacheEntry } from './cache.js';
import type { RefactorConfig } from './config.js';
import type { StateEntry } from './state.js';

export interface TaskTimestamps {
  registeredAt: string | null;
  completedAt: string | null;
  durationDays: number | null;
}

export function resolveTaskTimestamps(
  refactor: RefactorConfig,
  stateEntry: StateEntry | undefined,
  prevCache: CacheEntry | undefined,
  done: number,
  total: number,
  now: string,
): TaskTimestamps {
  let registeredAt: string | null;
  if (refactor.registeredAt) {
    registeredAt = refactor.registeredAt;
  } else if (stateEntry?.registeredAt) {
    registeredAt = stateEntry.registeredAt;
  } else if (prevCache) {
    registeredAt = null;
  } else {
    registeredAt = now;
  }

  let completedAt: string | null = stateEntry?.completedAt ?? null;
  if (!completedAt && total > 0 && done === total) {
    completedAt = now;
  }

  const durationDays =
    registeredAt && completedAt
      ? Math.floor((Date.parse(completedAt) - Date.parse(registeredAt)) / 86_400_000)
      : null;

  return { registeredAt, completedAt, durationDays };
}
