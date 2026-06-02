import { describe, it, expect } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runEngine } from '../src/engine.js';
import { writeCache, readCache } from '../src/cache.js';
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
      const report = await runEngine(config, { cachePath, run, now: fixedNow });
      expect(report.tasks).toEqual([
        {
          id: 'abc',
          name: 'Lazy routes',
          done: 4,
          total: 11,
          percentage: 36,
          delta: null,
          registeredAt: null,
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
      await writeCache(cachePath, { abc: { done: 1, total: 11, timestamp: 'old' } });
      const report = await runEngine(config, { cachePath, run, now: fixedNow });
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
      await writeCache(cachePath, { abc: { done: 4, total: 11, timestamp: 'old' } });
      const report = await runEngine(config, { cachePath, run, now: fixedNow });
      expect(report.hasChanges).toBe(false);
      expect(report.tasks[0].delta).toBe(0);
    });
  });

  it('propagates a refactor description into the TaskResult when present', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
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
      const report = await runEngine(withDesc, { cachePath, run, now: fixedNow });
      expect(report.tasks[0].description).toBe('Frontend route lazy-loading rollout');
    });
  });

  it('omits description on the TaskResult when none is configured', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
      const report = await runEngine(config, { cachePath, run, now: fixedNow });
      expect(report.tasks[0]).not.toHaveProperty('description');
    });
  });

  it('does not write the cache in dry-run mode', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
      await runEngine(config, { cachePath, run, now: fixedNow, dryRun: true });
      expect(await readCache(cachePath)).toEqual({});
    });
  });

  it('propagates tags onto the TaskResult when non-empty', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
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
      const report = await runEngine(tagged, { cachePath, run, now: fixedNow });
      expect(report.tasks[0].tags).toEqual(['frontend', 'performance']);
    });
  });

  it('omits the tags property when the refactor has no tags', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
      const report = await runEngine(config, { cachePath, run, now: fixedNow });
      expect(report.tasks[0]).not.toHaveProperty('tags');
    });
  });

  it('omits the tags property when the refactor has an empty tags array', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
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
      const report = await runEngine(empty, { cachePath, run, now: fixedNow });
      expect(report.tasks[0]).not.toHaveProperty('tags');
    });
  });

  it('filters refactors by tag (OR semantics) before running detection', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
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
      await expect(
        runEngine(config, { cachePath, run, now: fixedNow, tagFilter: ['nope'] }),
      ).rejects.toThrow(/no refactors match/i);
    });
  });

  it('attaches items when the list command returns content and remaining > 0', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
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
      const report = await runEngine(withList, { cachePath, run: listRun, now: fixedNow });
      expect(report.tasks[0].items).toEqual(['src/foo.ts', 'src/bar.ts']);
    });
  });

  it('skips the list command when remaining is 0', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
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
      const report = await runEngine(done, { cachePath, run: trackingRun, now: fixedNow });
      expect(ran).not.toContain('ls');
      expect(report.tasks[0]).not.toHaveProperty('items');
    });
  });

  it('omits items when no list field is configured', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
      const report = await runEngine(config, { cachePath, run, now: fixedNow });
      expect(report.tasks[0]).not.toHaveProperty('items');
    });
  });

  it('preserves cache entries for refactors excluded by tagFilter', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
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
      await runEngine(multi, { cachePath, run, now: fixedNow, tagFilter: ['frontend'] });
      const written = await readCache(cachePath);
      expect(written.kept).toEqual({ done: 9, total: 10, timestamp: 'old' });
      expect(written.run).toEqual({ done: 4, total: 11, timestamp: '2026-05-28T12:00:00.000Z' });
    });
  });
});
