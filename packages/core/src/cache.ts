import { readFile, writeFile } from 'node:fs/promises';

export interface CacheEntry {
  done: number;
  total: number;
  timestamp: string;
}

export type Cache = Record<string, CacheEntry>;

export async function readCache(path: string): Promise<Cache> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as Cache;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw err;
  }
}

export async function writeCache(path: string, cache: Cache): Promise<void> {
  await writeFile(path, JSON.stringify(cache, null, 2) + '\n', 'utf8');
}
