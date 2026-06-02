import { readFile, writeFile } from 'node:fs/promises';

export interface StateEntry {
  registeredAt?: string; // ISO-8601; absent for pre-upgrade refactors that reach 100%
  completedAt?: string; // ISO-8601, sticky once set
}

export type State = Record<string, StateEntry>;

export async function readState(path: string): Promise<State> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as State;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw err;
  }
}

export async function writeState(path: string, state: State): Promise<void> {
  await writeFile(path, JSON.stringify(state, null, 2) + '\n', 'utf8');
}
