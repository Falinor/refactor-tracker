import { describe, it, expect } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runEngine } from '../src/engine.js';
import { writeCache, readCache } from '../src/cache.js';
import { writeState, readState } from '../src/state.js';
import type { CommandRunner } from '../src/detect.js';
import type { Config } from '../src/config.js';

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), 'rt-engine-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const run: CommandRunner = async (command) => {
  const map: Record<string, string> = { d: '4', t: '11' };
  return { stdout: map[command] ?? '0', exitCode: 0 };
};

const config: Config = {
  refactors: [
    {
      id: 'abc',
      name: 'Lazy routes',
      detect: { done: { command: 'd' }, total: { command: 't' } } as any,
    },
  ],
};

const fixedNow = () => new Date('2026-05-28T12:00:00.000Z');

describe('runEngine', () => {
  it('produces a report with delta null on first run', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
      const statePath = path.join(dir, 'state.json');
      const report = await runEngine(config, { cachePath, statePath, run, now: fixedNow });
      expect(report.tasks).toEqual([
        {
          id: 'abc',
          name: 'Lazy routes',
          done: 4,
          total: 11,
          percentage: 36,
          delta: null,
          registeredAt: '2026-05-28T12:00:00.000Z',
          completedAt: null,
          durationDays: null,
        },
      ]);
      expect(report.hasChanges).toBe(true);
      expect(report.timestamp).toBe('2026-05-28T12:00:00.000Z');
    });
  });

  it('computes delta against the cache and writes the cache', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
      const statePath = path.join(dir, 'state.json');
      await writeCache(cachePath, { abc: { done: 1, total: 11, timestamp: 'old' } });
      const report = await runEngine(config, { cachePath, statePath, run, now: fixedNow });
      expect(report.tasks[0].delta).toBe(3);
      expect(report.hasChanges).toBe(true);
      expect(await readCache(cachePath)).toEqual({
        abc: { done: 4, total: 11, timestamp: '2026-05-28T12:00:00.000Z' },
      });
    });
  });

  it('reports hasChanges false when counts match the cache', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
      const statePath = path.join(dir, 'state.json');
      await writeCache(cachePath, { abc: { done: 4, total: 11, timestamp: 'old' } });
      const report = await runEngine(config, { cachePath, statePath, run, now: fixedNow });
      expect(report.hasChanges).toBe(false);
      expect(report.tasks[0].delta).toBe(0);
    });
  });

  it('propagates a refactor description into the TaskResult when present', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
      const statePath = path.join(dir, 'state.json');
      const withDesc: Config = {
        refactors: [
          {
            id: 'abc',
            name: 'Lazy routes',
            description: 'Frontend route lazy-loading rollout',
            detect: { done: { command: 'd' }, total: { command: 't' } } as any,
          },
        ],
      };
      const report = await runEngine(withDesc, { cachePath, statePath, run, now: fixedNow });
      expect(report.tasks[0].description).toBe('Frontend route lazy-loading rollout');
    });
  });

  it('omits description on the TaskResult when none is configured', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
      const statePath = path.join(dir, 'state.json');
      const report = await runEngine(config, { cachePath, statePath, run, now: fixedNow });
      expect(report.tasks[0]).not.toHaveProperty('description');
    });
  });

  it('does not write the cache in dry-run mode', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
      const statePath = path.join(dir, 'state.json');
      await runEngine(config, { cachePath, statePath, run, now: fixedNow, dryRun: true });
      expect(await readCache(cachePath)).toEqual({});
    });
  });

  it('propagates tags onto the TaskResult when non-empty', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
      const statePath = path.join(dir, 'state.json');
      const tagged: Config = {
        refactors: [
          {
            id: 'abc',
            name: 'Lazy routes',
            tags: ['frontend', 'performance'],
            detect: { done: { command: 'd' }, total: { command: 't' } } as any,
          },
        ],
      };
      const report = await runEngine(tagged, { cachePath, statePath, run, now: fixedNow });
      expect(report.tasks[0].tags).toEqual(['frontend', 'performance']);
    });
  });

  it('omits the tags property when the refactor has no tags', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
      const statePath = path.join(dir, 'state.json');
      const report = await runEngine(config, { cachePath, statePath, run, now: fixedNow });
      expect(report.tasks[0]).not.toHaveProperty('tags');
    });
  });

  it('omits the tags property when the refactor has an empty tags array', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
      const statePath = path.join(dir, 'state.json');
      const empty: Config = {
        refactors: [
          {
            id: 'abc',
            name: 'Lazy routes',
            tags: [],
            detect: { done: { command: 'd' }, total: { command: 't' } } as any,
          },
        ],
      };
      const report = await runEngine(empty, { cachePath, statePath, run, now: fixedNow });
      expect(report.tasks[0]).not.toHaveProperty('tags');
    });
  });

  it('filters refactors by tag (OR semantics) before running detection', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
      const statePath = path.join(dir, 'state.json');
      const ran: string[] = [];
      const trackingRun: CommandRunner = async (command) => {
        ran.push(command);
        const map: Record<string, string> = { d: '4', t: '11' };
        return { stdout: map[command] ?? '0', exitCode: 0 };
      };
      const multi: Config = {
        refactors: [
          {
            id: 'fe',
            name: 'FE',
            tags: ['frontend'],
            detect: { done: { command: 'd' }, total: { command: 't' } } as any,
          },
          {
            id: 'be',
            name: 'BE',
            tags: ['backend'],
            detect: { done: { command: 'd' }, total: { command: 't' } } as any,
          },
          {
            id: 'both',
            name: 'Both',
            tags: ['frontend', 'perf'],
            detect: { done: { command: 'd' }, total: { command: 't' } } as any,
          },
        ],
      };
      const report = await runEngine(multi, {
        cachePath,
        statePath,
        run: trackingRun,
        now: fixedNow,
        tagFilter: ['frontend'],
      });
      expect(report.tasks.map((t) => t.id)).toEqual(['fe', 'both']);
      // Only 2 refactors ran detection → 2 commands per refactor → 4 calls total.
      expect(ran).toHaveLength(4);
    });
  });

  it('throws when tagFilter matches zero refactors', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
      const statePath = path.join(dir, 'state.json');
      await expect(
        runEngine(config, { cachePath, statePath, run, now: fixedNow, tagFilter: ['nope'] }),
      ).rejects.toThrow(/no refactors match/i);
    });
  });

  it('filters refactors by id (OR semantics) before running detection', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
      const statePath = path.join(dir, 'state.json');
      const multi: Config = {
        refactors: [
          {
            id: 'fe',
            name: 'FE',
            detect: { done: { command: 'd' }, total: { command: 't' } } as any,
          },
          {
            id: 'be',
            name: 'BE',
            detect: { done: { command: 'd' }, total: { command: 't' } } as any,
          },
          {
            id: 'ops',
            name: 'Ops',
            detect: { done: { command: 'd' }, total: { command: 't' } } as any,
          },
        ],
      };
      const report = await runEngine(multi, {
        cachePath,
        statePath,
        run,
        now: fixedNow,
        idFilter: ['fe', 'ops'],
      });
      expect(report.tasks.map((t) => t.id)).toEqual(['fe', 'ops']);
    });
  });

  it('combines idFilter and tagFilter with AND semantics', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
      const statePath = path.join(dir, 'state.json');
      const multi: Config = {
        refactors: [
          {
            id: 'fe',
            name: 'FE',
            tags: ['frontend'],
            detect: { done: { command: 'd' }, total: { command: 't' } } as any,
          },
          {
            id: 'be',
            name: 'BE',
            tags: ['backend'],
            detect: { done: { command: 'd' }, total: { command: 't' } } as any,
          },
          {
            id: 'fe-perf',
            name: 'FE perf',
            tags: ['frontend'],
            detect: { done: { command: 'd' }, total: { command: 't' } } as any,
          },
        ],
      };
      const report = await runEngine(multi, {
        cachePath,
        statePath,
        run,
        now: fixedNow,
        tagFilter: ['frontend'],
        idFilter: ['fe'],
      });
      expect(report.tasks.map((t) => t.id)).toEqual(['fe']);
    });
  });

  it('throws when idFilter matches zero refactors', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
      const statePath = path.join(dir, 'state.json');
      await expect(
        runEngine(config, { cachePath, statePath, run, now: fixedNow, idFilter: ['nope'] }),
      ).rejects.toThrow(/no refactors match/i);
    });
  });

  it('with noCache, ignores existing cache (delta null) and does not write it', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
      const statePath = path.join(dir, 'state.json');
      await writeCache(cachePath, { abc: { done: 1, total: 11, timestamp: 'old' } });
      const report = await runEngine(config, {
        cachePath,
        statePath,
        run,
        now: fixedNow,
        noCache: true,
      });
      expect(report.tasks[0].delta).toBeNull();
      expect(await readCache(cachePath)).toEqual({
        abc: { done: 1, total: 11, timestamp: 'old' },
      });
    });
  });

  it('with noCache, still writes the state file', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
      const statePath = path.join(dir, 'state.json');
      await runEngine(config, { cachePath, statePath, run, now: fixedNow, noCache: true });
      expect(await readState(statePath)).toEqual({
        abc: { registeredAt: '2026-05-28T12:00:00.000Z' },
      });
    });
  });

  it('with noCache, does not stamp a fresh registeredAt when cache exists but state is empty', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
      const statePath = path.join(dir, 'state.json');
      // Pre-PR cache from an earlier run (refactor known to the tracker), but no state file.
      await writeCache(cachePath, { abc: { done: 1, total: 11, timestamp: 'old' } });
      const report = await runEngine(config, {
        cachePath,
        statePath,
        run,
        now: fixedNow,
        noCache: true,
      });
      expect(report.tasks[0].registeredAt).toBeNull();
      // And the bogus timestamp must not leak into state on disk.
      expect(await readState(statePath)).toEqual({});
    });
  });

  it('attaches items when the list command returns content and remaining > 0', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
      const statePath = path.join(dir, 'state.json');
      const withList: Config = {
        refactors: [
          {
            id: 'abc',
            name: 'Lazy routes',
            detect: {
              done: { command: 'd' },
              total: { command: 't' },
              list: { command: 'ls' },
            } as any,
          },
        ],
      };
      const listRun: CommandRunner = async (command) => {
        const map: Record<string, string> = {
          d: '4',
          t: '11',
          ls: 'src/foo.ts\nsrc/bar.ts\n',
        };
        return { stdout: map[command] ?? '0', exitCode: 0 };
      };
      const report = await runEngine(withList, {
        cachePath,
        statePath,
        run: listRun,
        now: fixedNow,
      });
      expect(report.tasks[0].items).toEqual(['src/foo.ts', 'src/bar.ts']);
    });
  });

  it('skips the list command when remaining is 0', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
      const statePath = path.join(dir, 'state.json');
      const ran: string[] = [];
      const trackingRun: CommandRunner = async (command) => {
        ran.push(command);
        const map: Record<string, string> = { d: '11', t: '11', ls: 'should-not-appear' };
        return { stdout: map[command] ?? '0', exitCode: 0 };
      };
      const done: Config = {
        refactors: [
          {
            id: 'abc',
            name: 'Lazy routes',
            detect: {
              done: { command: 'd' },
              total: { command: 't' },
              list: { command: 'ls' },
            } as any,
          },
        ],
      };
      const report = await runEngine(done, {
        cachePath,
        statePath,
        run: trackingRun,
        now: fixedNow,
      });
      expect(ran).not.toContain('ls');
      expect(report.tasks[0]).not.toHaveProperty('items');
    });
  });

  it('omits items when no list field is configured', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
      const statePath = path.join(dir, 'state.json');
      const report = await runEngine(config, { cachePath, statePath, run, now: fixedNow });
      expect(report.tasks[0]).not.toHaveProperty('items');
    });
  });

  it('preserves cache entries for refactors excluded by tagFilter', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
      const statePath = path.join(dir, 'state.json');
      await writeCache(cachePath, {
        kept: { done: 9, total: 10, timestamp: 'old' },
      });
      const multi: Config = {
        refactors: [
          {
            id: 'kept',
            name: 'Kept',
            tags: ['backend'],
            detect: { done: { command: 'd' }, total: { command: 't' } } as any,
          },
          {
            id: 'run',
            name: 'Run',
            tags: ['frontend'],
            detect: { done: { command: 'd' }, total: { command: 't' } } as any,
          },
        ],
      };
      await runEngine(multi, { cachePath, statePath, run, now: fixedNow, tagFilter: ['frontend'] });
      const written = await readCache(cachePath);
      expect(written.kept).toEqual({ done: 9, total: 10, timestamp: 'old' });
      expect(written.run).toEqual({ done: 4, total: 11, timestamp: '2026-05-28T12:00:00.000Z' });
    });
  });
});

describe('registeredAt resolution', () => {
  it('stamps registeredAt for a genuinely new refactor', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
      const statePath = path.join(dir, 'state.json');
      const report = await runEngine(config, { cachePath, statePath, run, now: fixedNow });
      expect(report.tasks[0].registeredAt).toBe('2026-05-28T12:00:00.000Z');
    });
  });

  it('preserves an existing registeredAt across runs', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
      const statePath = path.join(dir, 'state.json');
      await writeState(statePath, { abc: { registeredAt: '2026-01-01T00:00:00.000Z' } });
      const report = await runEngine(config, { cachePath, statePath, run, now: fixedNow });
      expect(report.tasks[0].registeredAt).toBe('2026-01-01T00:00:00.000Z');
    });
  });

  it('honors a YAML registeredAt override above stored state', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
      const statePath = path.join(dir, 'state.json');
      await writeState(statePath, { abc: { registeredAt: '2026-01-01T00:00:00.000Z' } });
      const overridden: Config = {
        refactors: [
          {
            id: 'abc',
            name: 'Lazy routes',
            registeredAt: '2025-12-01T00:00:00.000Z',
            detect: { done: { command: 'd' }, total: { command: 't' } } as any,
          },
        ],
      };
      const report = await runEngine(overridden, { cachePath, statePath, run, now: fixedNow });
      expect(report.tasks[0].registeredAt).toBe('2025-12-01T00:00:00.000Z');
    });
  });

  it('leaves registeredAt null for a refactor present in the cache but not in state (backfill case)', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
      const statePath = path.join(dir, 'state.json');
      await writeCache(cachePath, { abc: { done: 1, total: 11, timestamp: 'old' } });
      const report = await runEngine(config, { cachePath, statePath, run, now: fixedNow });
      expect(report.tasks[0].registeredAt).toBeNull();
    });
  });
});

describe('completedAt and durationDays', () => {
  const doneRun: CommandRunner = async (command) => {
    const map: Record<string, string> = { d: '11', t: '11' };
    return { stdout: map[command] ?? '0', exitCode: 0 };
  };

  it('stamps completedAt the first time a refactor reaches 100%', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
      const statePath = path.join(dir, 'state.json');
      const report = await runEngine(config, {
        cachePath,
        statePath,
        run: doneRun,
        now: fixedNow,
      });
      expect(report.tasks[0].percentage).toBe(100);
      expect(report.tasks[0].completedAt).toBe('2026-05-28T12:00:00.000Z');
    });
  });

  it('keeps completedAt sticky across a regression below 100%', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
      const statePath = path.join(dir, 'state.json');
      await writeState(statePath, {
        abc: {
          registeredAt: '2026-01-01T00:00:00.000Z',
          completedAt: '2026-04-01T00:00:00.000Z',
        },
      });
      // Default fake `run` returns done=4, total=11 (regression from 100%).
      const report = await runEngine(config, { cachePath, statePath, run, now: fixedNow });
      expect(report.tasks[0].percentage).toBe(36);
      expect(report.tasks[0].completedAt).toBe('2026-04-01T00:00:00.000Z');
    });
  });

  it('computes durationDays when both timestamps are present', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
      const statePath = path.join(dir, 'state.json');
      await writeState(statePath, {
        abc: { registeredAt: '2026-04-01T00:00:00.000Z' },
      });
      // fixedNow is 2026-05-28T12:00:00.000Z → 57 days later. Done=total triggers completedAt.
      const report = await runEngine(config, {
        cachePath,
        statePath,
        run: doneRun,
        now: fixedNow,
      });
      expect(report.tasks[0].completedAt).toBe('2026-05-28T12:00:00.000Z');
      expect(report.tasks[0].durationDays).toBe(57);
    });
  });

  it('stamps completedAt but leaves durationDays null for a backfill case reaching 100%', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
      const statePath = path.join(dir, 'state.json');
      await writeCache(cachePath, { abc: { done: 10, total: 11, timestamp: 'old' } });
      const report = await runEngine(config, {
        cachePath,
        statePath,
        run: doneRun,
        now: fixedNow,
      });
      expect(report.tasks[0].registeredAt).toBeNull();
      expect(report.tasks[0].completedAt).toBe('2026-05-28T12:00:00.000Z');
      expect(report.tasks[0].durationDays).toBeNull();
    });
  });

  it('leaves durationDays null while the refactor is still open', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
      const statePath = path.join(dir, 'state.json');
      const report = await runEngine(config, { cachePath, statePath, run, now: fixedNow });
      expect(report.tasks[0].completedAt).toBeNull();
      expect(report.tasks[0].durationDays).toBeNull();
    });
  });
});

describe('state file write', () => {
  it('writes only meaningful entries (skips refactors with no milestones)', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
      const statePath = path.join(dir, 'state.json');
      // Refactor exists in cache but not in state, no override, not at 100% → no milestones.
      await writeCache(cachePath, { abc: { done: 1, total: 11, timestamp: 'old' } });
      await runEngine(config, { cachePath, statePath, run, now: fixedNow });
      expect(await readState(statePath)).toEqual({});
    });
  });

  it('writes state for new refactors with registeredAt', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
      const statePath = path.join(dir, 'state.json');
      await runEngine(config, { cachePath, statePath, run, now: fixedNow });
      expect(await readState(statePath)).toEqual({
        abc: { registeredAt: '2026-05-28T12:00:00.000Z' },
      });
    });
  });

  it('writes both registeredAt and completedAt when a refactor reaches 100%', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
      const statePath = path.join(dir, 'state.json');
      const doneRun: CommandRunner = async (command) => {
        const map: Record<string, string> = { d: '11', t: '11' };
        return { stdout: map[command] ?? '0', exitCode: 0 };
      };
      await runEngine(config, { cachePath, statePath, run: doneRun, now: fixedNow });
      expect(await readState(statePath)).toEqual({
        abc: {
          registeredAt: '2026-05-28T12:00:00.000Z',
          completedAt: '2026-05-28T12:00:00.000Z',
        },
      });
    });
  });

  it('preserves state for refactors excluded by tagFilter', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
      const statePath = path.join(dir, 'state.json');
      await writeState(statePath, {
        kept: { registeredAt: '2026-01-01T00:00:00.000Z' },
      });
      const multi: Config = {
        refactors: [
          {
            id: 'kept',
            name: 'Kept',
            tags: ['backend'],
            detect: { done: { command: 'd' }, total: { command: 't' } } as any,
          },
          {
            id: 'run',
            name: 'Run',
            tags: ['frontend'],
            detect: { done: { command: 'd' }, total: { command: 't' } } as any,
          },
        ],
      };
      await runEngine(multi, {
        cachePath,
        statePath,
        run,
        now: fixedNow,
        tagFilter: ['frontend'],
      });
      const written = await readState(statePath);
      expect(written.kept).toEqual({ registeredAt: '2026-01-01T00:00:00.000Z' });
      expect(written.run).toEqual({ registeredAt: '2026-05-28T12:00:00.000Z' });
    });
  });

  it('does not write the state file in dry-run mode', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
      const statePath = path.join(dir, 'state.json');
      await runEngine(config, { cachePath, statePath, run, now: fixedNow, dryRun: true });
      expect(await readState(statePath)).toEqual({});
    });
  });
});
