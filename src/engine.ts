import type { Config } from './config.js';
import type { Report, TaskResult } from './types.js';
import { resolveDetection, type CommandRunner } from './detect.js';
import { runCommand } from './runner.js';
import { readCache, writeCache, type Cache } from './cache.js';

export interface EngineOptions {
  cachePath: string;
  cwd?: string;
  dryRun?: boolean;
  run?: CommandRunner;
  now?: () => Date;
  tagFilter?: string[];
}

export async function runEngine(config: Config, options: EngineOptions): Promise<Report> {
  const run = options.run ?? runCommand;
  const now = options.now ?? (() => new Date());
  const timestamp = now().toISOString();
  const cache = await readCache(options.cachePath);

  const filter = options.tagFilter;
  const filterActive = filter !== undefined && filter.length > 0;
  const filtered = filterActive
    ? config.refactors.filter((r) => (r.tags ?? []).some((t) => filter.includes(t)))
    : config.refactors;
  if (filterActive && filtered.length === 0) {
    throw new Error(`No refactors match the requested tags: ${filter.join(', ')}`);
  }

  const tasks: TaskResult[] = [];
  // When a tag filter is active, seed nextCache from the prior cache so
  // skipped refactors keep their entries (otherwise --fail-on-regression
  // on the next full run would see them as first-time, delta null).
  const nextCache: Cache = filterActive ? { ...cache } : {};
  let hasChanges = false;

  for (const refactor of filtered) {
    const { done, total } = await resolveDetection(refactor.detect, run, options.cwd);
    const percentage = total === 0 ? 0 : Math.round((done / total) * 100);
    const prev = cache[refactor.id];
    const delta = prev ? done - prev.done : null;
    if (!prev || prev.done !== done || prev.total !== total) hasChanges = true;

    tasks.push({
      id: refactor.id,
      name: refactor.name,
      ...(refactor.description ? { description: refactor.description } : {}),
      ...(refactor.tags && refactor.tags.length > 0 ? { tags: refactor.tags } : {}),
      done,
      total,
      percentage,
      delta,
    });
    nextCache[refactor.id] = { done, total, timestamp };
  }

  if (!options.dryRun) await writeCache(options.cachePath, nextCache);
  return { tasks, timestamp, hasChanges };
}
