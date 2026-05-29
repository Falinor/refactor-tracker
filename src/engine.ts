import type { Config } from './config.js';
import type { Report, TaskResult } from './types.js';
import { resolveDetection, type CommandRunner } from './detect.js';
import { runCommand } from './runner.js';
import { readCache, writeCache, type Cache } from './cache.js';

export interface EngineOptions {
  cachePath: string;
  cwd?: string;
  dryRun?: boolean;
  run?: CommandRunner; // injectable for tests; defaults to the real shell runner
  now?: () => Date; // injectable for tests; defaults to wall clock
}

export async function runEngine(config: Config, options: EngineOptions): Promise<Report> {
  const run = options.run ?? runCommand;
  const now = options.now ?? (() => new Date());
  const timestamp = now().toISOString();
  const cache = await readCache(options.cachePath);

  const tasks: TaskResult[] = [];
  const nextCache: Cache = {};
  let hasChanges = false;

  for (const refactor of config.refactors) {
    const { done, total } = await resolveDetection(refactor.detect, run, options.cwd);
    const percentage = total === 0 ? 0 : Math.round((done / total) * 100);
    const prev = cache[refactor.id];
    const delta = prev ? done - prev.done : null;
    if (!prev || prev.done !== done || prev.total !== total) hasChanges = true;

    tasks.push({ id: refactor.id, name: refactor.name, done, total, percentage, delta });
    nextCache[refactor.id] = { done, total, timestamp };
  }

  if (!options.dryRun) await writeCache(options.cachePath, nextCache);
  return { tasks, timestamp, hasChanges };
}
