import type { Config } from './config.js';
import type { Report, TaskResult } from './types.js';
import { resolveDetection, resolveList, type CommandRunner } from './detect.js';
import { runCommand } from './runner.js';
import { readCache, writeCache, type Cache } from './cache.js';
import { readState, writeState, type State, type StateEntry } from './state.js';

export interface EngineOptions {
  cachePath: string;
  statePath: string;
  cwd?: string;
  dryRun?: boolean;
  run?: CommandRunner;
  now?: () => Date;
  tagFilter?: string[];
  idFilter?: string[];
  noCache?: boolean;
}

export async function runEngine(config: Config, options: EngineOptions): Promise<Report> {
  const run = options.run ?? runCommand;
  const now = options.now ?? (() => new Date());
  const timestamp = now().toISOString();
  const cache = options.noCache ? {} : await readCache(options.cachePath);
  const state = await readState(options.statePath);

  const tagFilter = options.tagFilter;
  const tagFilterActive = tagFilter !== undefined && tagFilter.length > 0;
  const idFilter = options.idFilter;
  const idFilterActive = idFilter !== undefined && idFilter.length > 0;
  const filterActive = tagFilterActive || idFilterActive;
  const filtered = config.refactors.filter((r) => {
    if (tagFilterActive && !(r.tags ?? []).some((t) => tagFilter.includes(t))) return false;
    if (idFilterActive && !idFilter.includes(r.id)) return false;
    return true;
  });
  if (filterActive && filtered.length === 0) {
    const parts: string[] = [];
    if (tagFilterActive) parts.push(`tags: ${tagFilter.join(', ')}`);
    if (idFilterActive) parts.push(`ids: ${idFilter.join(', ')}`);
    throw new Error(`No refactors match the requested filters (${parts.join('; ')})`);
  }

  const tasks: TaskResult[] = [];
  // When a tag filter is active, seed nextCache from the prior cache so
  // skipped refactors keep their entries (otherwise --fail-on-regression
  // on the next full run would see them as first-time, delta null).
  const nextCache: Cache = filterActive ? { ...cache } : {};
  const nextState: State = filterActive ? { ...state } : {};
  let hasChanges = false;

  for (const refactor of filtered) {
    const { done, total } = await resolveDetection(refactor.detect, run, options.cwd);
    const percentage = total === 0 ? 0 : Math.round((done / total) * 100);
    const prev = cache[refactor.id];
    const delta = prev ? done - prev.done : null;
    if (!prev || prev.done !== done || prev.total !== total) hasChanges = true;

    const items =
      total - done > 0 ? await resolveList(refactor.detect, run, options.cwd) : undefined;

    const stateEntry = state[refactor.id];
    let registeredAt: string | null;
    if (refactor.registeredAt) {
      registeredAt = refactor.registeredAt;
    } else if (stateEntry?.registeredAt) {
      registeredAt = stateEntry.registeredAt;
    } else if (cache[refactor.id]) {
      registeredAt = null;
    } else {
      registeredAt = timestamp;
    }

    let completedAt: string | null = stateEntry?.completedAt ?? null;
    if (!completedAt && total > 0 && done === total) {
      completedAt = timestamp;
    }

    const durationDays =
      registeredAt && completedAt
        ? Math.floor((Date.parse(completedAt) - Date.parse(registeredAt)) / 86_400_000)
        : null;

    tasks.push({
      id: refactor.id,
      name: refactor.name,
      ...(refactor.description ? { description: refactor.description } : {}),
      ...(refactor.tags && refactor.tags.length > 0 ? { tags: refactor.tags } : {}),
      done,
      total,
      percentage,
      delta,
      ...(items ? { items } : {}),
      registeredAt,
      completedAt,
      durationDays,
    });
    nextCache[refactor.id] = { done, total, timestamp };

    if (registeredAt !== null || completedAt !== null) {
      nextState[refactor.id] = {
        ...(registeredAt !== null ? { registeredAt } : {}),
        ...(completedAt !== null ? { completedAt } : {}),
      } as StateEntry;
    }
  }

  if (!options.dryRun && !options.noCache) await writeCache(options.cachePath, nextCache);
  if (!options.dryRun) await writeState(options.statePath, nextState);
  return { tasks, timestamp, hasChanges };
}
