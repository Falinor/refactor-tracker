import { describe, it, expect } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readState, writeState } from '../src/state.js';
import { STORE_VERSION } from '../src/jsonStore.js';

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), 'rt-state-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe('state', () => {
  it('returns an empty object when the file is missing', async () => {
    await withTempDir(async (dir) => {
      const statePath = path.join(dir, 'state.json');
      expect(await readState(statePath)).toEqual({});
    });
  });

  it('parses an existing state file', async () => {
    await withTempDir(async (dir) => {
      const statePath = path.join(dir, 'state.json');
      await writeFile(
        statePath,
        JSON.stringify({
          a: { registeredAt: '2026-03-12T10:00:00.000Z' },
          b: {
            registeredAt: '2026-04-01T09:00:00.000Z',
            completedAt: '2026-05-30T14:32:00.000Z',
          },
        }),
        'utf8',
      );
      const state = await readState(statePath);
      expect(state).toEqual({
        a: { registeredAt: '2026-03-12T10:00:00.000Z' },
        b: {
          registeredAt: '2026-04-01T09:00:00.000Z',
          completedAt: '2026-05-30T14:32:00.000Z',
        },
      });
    });
  });

  it('round-trips through writeState/readState', async () => {
    await withTempDir(async (dir) => {
      const statePath = path.join(dir, 'state.json');
      const input = {
        a: { registeredAt: '2026-03-12T10:00:00.000Z' },
      };
      await writeState(statePath, input);
      expect(await readState(statePath)).toEqual(input);
    });
  });

  it('writes a versioned envelope to disk', async () => {
    await withTempDir(async (dir) => {
      const statePath = path.join(dir, 'state.json');
      const input = { a: { registeredAt: '2026-03-12T10:00:00.000Z' } };
      await writeState(statePath, input);
      const onDisk = JSON.parse(await readFile(statePath, 'utf8'));
      expect(onDisk).toEqual({ version: STORE_VERSION, entries: input });
    });
  });

  it('rethrows non-ENOENT errors from readState', async () => {
    // Passing a directory as the path triggers EISDIR.
    await withTempDir(async (dir) => {
      await expect(readState(dir)).rejects.toThrow();
    });
  });
});
