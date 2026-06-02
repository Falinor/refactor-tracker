import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createReporters } from '../../src/reporters/index.js';

const noopReport = { tasks: [], timestamp: '2026-06-02T00:00:00.000Z', hasChanges: false };

async function withTempDir(fn: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(path.join(tmpdir(), 'rt-custom-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe('custom reporter loader', () => {
  it('loads a file path whose default export is a Reporter instance (back-compat)', async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, 'rep.mjs');
      await writeFile(
        file,
        `
        export default { report: async () => { globalThis.__rt_called = true; } };
      `,
      );
      const reporters = await createReporters([{ type: 'custom', path: './rep.mjs' }], dir);
      await reporters[0].report(noopReport);
      expect((globalThis as any).__rt_called).toBe(true);
      delete (globalThis as any).__rt_called;
    });
  });

  it('loads a file path whose default export is a factory and passes the rest of the config', async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, 'rep-factory.mjs');
      await writeFile(
        file,
        `
        export default function factory(cfg) {
          globalThis.__rt_cfg = cfg;
          return { report: async () => {} };
        };
      `,
      );
      await createReporters(
        [{ type: 'custom', path: './rep-factory.mjs', token: 'xyz', databaseId: '1234' }],
        dir,
      );
      expect((globalThis as any).__rt_cfg).toEqual({ token: 'xyz', databaseId: '1234' });
      delete (globalThis as any).__rt_cfg;
    });
  });

  // The `module:` branch is exercised end-to-end in Phase 3 once
  // `refactor-tracker-notion-reporter` is installed as a workspace dep
  // (see "Final verification"). It's deliberately not unit-tested here
  // because Node's bare-specifier resolution is relative to the importer's
  // location, not to the test's temp dir — making a meaningful unit test
  // require either a child process or a built-in module hack, both of
  // which obscure more than they verify. The branch itself is one ternary.

  it('throws a clear error when both module and path are set', async () => {
    await withTempDir(async (dir) => {
      await expect(
        createReporters([{ type: 'custom', module: 'x', path: './y.mjs' }], dir),
      ).rejects.toThrow(/exactly one of `module` or `path`/);
    });
  });

  it('throws a clear error when neither module nor path is set', async () => {
    await withTempDir(async (dir) => {
      await expect(createReporters([{ type: 'custom' }], dir)).rejects.toThrow(
        /exactly one of `module` or `path`/,
      );
    });
  });
});
