import { readJsonStore, writeJsonStore } from './jsonStore.js';

export interface StateEntry {
  registeredAt?: string; // ISO-8601; absent for pre-upgrade refactors that reach 100%
  completedAt?: string; // ISO-8601, sticky once set
}

export type State = Record<string, StateEntry>;

export const readState = (path: string): Promise<State> => readJsonStore<State>(path);
export const writeState = (path: string, state: State): Promise<void> =>
  writeJsonStore(path, state);
