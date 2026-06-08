import { readJsonStore, writeJsonStore } from './jsonStore.js';

export interface CacheEntry {
  done: number;
  total: number;
  timestamp: string;
}

export type Cache = Record<string, CacheEntry>;

export const readCache = (path: string): Promise<Cache> => readJsonStore<Cache>(path);
export const writeCache = (path: string, cache: Cache): Promise<void> =>
  writeJsonStore(path, cache);
