import { readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';

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

// A persisted store is a `{ version, entries }` envelope; `entries` is the
// refactor-id → entry map. A numeric `version` is the discriminator: a legacy
// refactor whose id happens to be "version" is safe because its value is an
// entry object, not a number, so it fails this check and is read as a bare map.
const storeMapSchema = z.record(z.string(), z.unknown());
const envelopeSchema = z.object({ version: z.number(), entries: storeMapSchema });

// Reads transparently migrate legacy bare-map files (written before versioning)
// by treating the whole document as `entries`, and fall back to an empty store
// for anything that isn't a JSON object (a corrupt/hand-edited file that parses
// to null, an array, or a primitive).
export async function readVersionedStore<T extends object>(path: string): Promise<T> {
  const raw: unknown = await readJsonStore<Record<string, unknown>>(path);
  const envelope = envelopeSchema.safeParse(raw);
  if (envelope.success) return envelope.data.entries as unknown as T;
  const legacy = storeMapSchema.safeParse(raw);
  return (legacy.success ? legacy.data : {}) as unknown as T;
}

export const writeVersionedStore = <T>(path: string, entries: T): Promise<void> =>
  writeJsonStore(path, { version: STORE_VERSION, entries });
