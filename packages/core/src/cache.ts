import { readVersionedStore, writeVersionedStore } from './jsonStore.js';

export interface CacheEntry {
  done: number;
  total: number;
  timestamp: string;
}

export type Cache = Record<string, CacheEntry>;

export const readCache = (path: string): Promise<Cache> => readVersionedStore<Cache>(path);
export const writeCache = (path: string, cache: Cache): Promise<void> =>
  writeVersionedStore(path, cache);
