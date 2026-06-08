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
