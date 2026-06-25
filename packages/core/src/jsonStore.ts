import { readFile, writeFile } from 'node:fs/promises';

export async function readJsonStore<T extends object>(path: string): Promise<T> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {} as T;
    throw err;
  }
}

export async function writeJsonStore<T>(path: string, data: T): Promise<void> {
  await writeFile(path, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// Current on-disk schema version for the cache and state stores. Bump when the
// shape of an entry changes so a future reader can migrate older files.
export const STORE_VERSION = 1;

interface Envelope<T> {
  version: number;
  entries: T;
}

// A persisted store is a `{ version, entries }` envelope. Reads transparently
// migrate legacy bare-map files (written before versioning) by treating the
// whole document as `entries`. The discriminator is a numeric `version` key —
// a legacy refactor entry is always an object, never a number, so this can't
// collide with a refactor whose id happens to be "version".
export async function readVersionedStore<T extends object>(path: string): Promise<T> {
  const raw = await readJsonStore<Record<string, unknown>>(path);
  if (typeof raw.version === 'number' && 'entries' in raw) {
    return (raw as unknown as Envelope<T>).entries;
  }
  return raw as unknown as T;
}

export const writeVersionedStore = <T>(path: string, entries: T): Promise<void> =>
  writeJsonStore<Envelope<T>>(path, { version: STORE_VERSION, entries });
