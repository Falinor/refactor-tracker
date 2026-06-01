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
        { id: 'abc', name: 'Lazy routes', done: 4, total: 11, percentage: 36, delta: null },
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
});
