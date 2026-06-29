import { readVersionedStore, writeVersionedStore } from './jsonStore.js';

export interface StateEntry {
  registeredAt?: string; // ISO-8601; absent for pre-upgrade refactors that reach 100%
  completedAt?: string; // ISO-8601, sticky once set
}

export type State = Record<string, StateEntry>;

export const readState = (path: string): Promise<State> => readVersionedStore<State>(path);
export const writeState = (path: string, state: State): Promise<void> =>
  writeVersionedStore(path, state);
