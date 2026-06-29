import { describe, it, expect } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readCache, writeCache, type Cache } from '../src/cache.js';
import { STORE_VERSION } from '../src/jsonStore.js';

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), 'rt-cache-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe('cache', () => {
  it('returns an empty object when the cache file does not exist', async () => {
    await withTempDir(async (dir) => {
      const cache = await readCache(path.join(dir, 'missing.json'));
      expect(cache).toEqual({});
    });
  });

  it('round-trips written data', async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, 'cache.json');
      const data: Cache = { abc: { done: 4, total: 11, timestamp: '2026-05-28T10:00:00.000Z' } };
      await writeCache(file, data);
      expect(await readCache(file)).toEqual(data);
    });
  });

  it('writes a versioned envelope to disk', async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, 'cache.json');
      const data: Cache = { abc: { done: 4, total: 11, timestamp: '2026-05-28T10:00:00.000Z' } };
      await writeCache(file, data);
      const onDisk = JSON.parse(await readFile(file, 'utf8'));
      expect(onDisk).toEqual({ version: STORE_VERSION, entries: data });
    });
  });

  it('reads a legacy unversioned (bare-map) cache file', async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, 'cache.json');
      const data: Cache = { abc: { done: 4, total: 11, timestamp: '2026-05-28T10:00:00.000Z' } };
      await writeFile(file, JSON.stringify(data), 'utf8');
      expect(await readCache(file)).toEqual(data);
    });
  });

  it('reads a corrupt (non-object) cache file as an empty store', async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, 'cache.json');
      await writeFile(file, 'null', 'utf8');
      expect(await readCache(file)).toEqual({});
    });
  });
});
