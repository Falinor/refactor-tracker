import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCommand } from 'citty';
import { execute, main } from '../src/cli.js';
import { writeCache } from '../src/cache.js';

const here = path.dirname(fileURLToPath(import.meta.url));
let dir: string;
let configPath: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'rt-cli-'));
  configPath = path.join(dir, 'config.yml');
  await copyFile(path.join(here, 'fixtures', 'regression-config.yml'), configPath);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
  vi.restoreAllMocks();
  process.exitCode = 0; // run() sets this on regression; reset between tests
  await rm(dir, { recursive: true, force: true });
});

describe('execute', () => {
  it('returns 0 on a normal run (stdout default reporter)', async () => {
    const code = await execute({ config: configPath, dryRun: false, failOnRegression: false });
    expect(code).toBe(0);
  });

  it('returns 1 under failOnRegression when done decreased vs cache', async () => {
    await writeCache(path.join(dir, '.refactor-tracker-cache.json'), {
      regressed: { done: 4, total: 5, timestamp: 'old' },
    });
    const code = await execute({ config: configPath, dryRun: true, failOnRegression: true });
    expect(code).toBe(1);
  });
});

describe('citty wiring', () => {
  it('parses --dry-run and --fail-on-regression and returns the exit code', async () => {
    await writeCache(path.join(dir, '.refactor-tracker-cache.json'), {
      regressed: { done: 4, total: 5, timestamp: 'old' },
    });
    const { result } = await runCommand(main, {
      rawArgs: ['--config', configPath, '--fail-on-regression', '--dry-run'],
    });
    expect(result).toBe(1);
  });
});
