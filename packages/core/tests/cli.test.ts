import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { access, mkdtemp, readFile, rm, copyFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { runCommand } from 'citty';
import { execute, main, parseReporterFlag } from '../src/main.js';
import { readCache, writeCache } from '../src/cache.js';
import type { Config } from '../src/config.js';
import type { Report } from '../src/types.js';

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

  it('writes a state file next to the config after a run', async () => {
    await execute({ config: configPath, dryRun: false, failOnRegression: false });
    await expect(access(path.join(dir, '.refactor-tracker-state.json'))).resolves.toBeUndefined();
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

  it('exposes the package version on meta so citty can render --version', async () => {
    const pkg = JSON.parse(await readFile(path.join(here, '..', 'package.json'), 'utf8')) as {
      version: string;
    };
    const meta = typeof main.meta === 'function' ? await main.meta() : await main.meta;
    expect(meta?.version).toBe(pkg.version);
  });
});

async function writeTaggedConfig(p: string): Promise<void> {
  const c: Config = {
    refactors: [
      {
        id: 'fe',
        name: 'FE',
        tags: ['frontend'],
        detect: { done: { command: 'echo 1' }, total: { command: 'echo 2' } } as any,
      },
      {
        id: 'be',
        name: 'BE',
        tags: ['backend'],
        detect: { done: { command: 'echo 1' }, total: { command: 'echo 2' } } as any,
      },
    ],
  };
  await writeFile(p, yaml.dump(c), 'utf8');
}

describe('--tag flag', () => {
  it('passes repeated --tag values into execute as an array (OR filter)', async () => {
    const taggedPath = path.join(dir, 'tagged.yml');
    await writeTaggedConfig(taggedPath);
    const { result } = await runCommand(main, {
      rawArgs: ['--config', taggedPath, '--tag', 'frontend', '--tag', 'backend', '--dry-run'],
    });
    expect(result).toBe(0);
  });

  it('accepts --tag=value form', async () => {
    const taggedPath = path.join(dir, 'tagged.yml');
    await writeTaggedConfig(taggedPath);
    const { result } = await runCommand(main, {
      rawArgs: ['--config', taggedPath, '--tag=frontend', '--dry-run'],
    });
    expect(result).toBe(0);
  });

  it('exits 1 with an error when no refactor matches --tag', async () => {
    const taggedPath = path.join(dir, 'tagged.yml');
    await writeTaggedConfig(taggedPath);
    const { result } = await runCommand(main, {
      rawArgs: ['--config', taggedPath, '--tag', 'nope', '--dry-run'],
    });
    expect(result).toBe(1);
  });
});

describe('--show-completed', () => {
  it('forwards the flag through citty into execute', async () => {
    const { result } = await runCommand(main, {
      rawArgs: ['--config', configPath, '--show-completed', '--dry-run'],
    });
    expect(result).toBe(0);
  });
});

describe('--sort-by', () => {
  it('accepts a valid sort key', async () => {
    const { result } = await runCommand(main, {
      rawArgs: ['--config', configPath, '--sort-by', 'registered', '--dry-run'],
    });
    expect(result).toBe(0);
  });

  it('rejects an invalid sort key with exit 1', async () => {
    const { result } = await runCommand(main, {
      rawArgs: ['--config', configPath, '--sort-by', 'bogus', '--dry-run'],
    });
    expect(result).toBe(1);
  });
});

describe('--id flag', () => {
  it('passes repeated --id values into execute as an array (OR filter)', async () => {
    const taggedPath = path.join(dir, 'tagged.yml');
    await writeTaggedConfig(taggedPath);
    const { result } = await runCommand(main, {
      rawArgs: ['--config', taggedPath, '--id', 'fe', '--id', 'be', '--dry-run'],
    });
    expect(result).toBe(0);
  });

  it('exits 1 with an error when no refactor matches --id', async () => {
    const taggedPath = path.join(dir, 'tagged.yml');
    await writeTaggedConfig(taggedPath);
    const { result } = await runCommand(main, {
      rawArgs: ['--config', taggedPath, '--id', 'nope', '--dry-run'],
    });
    expect(result).toBe(1);
  });
});

describe('parseReporterFlag', () => {
  it('parses bare stdout', () => {
    expect(parseReporterFlag('stdout')).toEqual({ type: 'stdout' });
  });

  it('parses type:path for file reporters', () => {
    expect(parseReporterFlag('json:out.json')).toEqual({ type: 'json', output: 'out.json' });
    expect(parseReporterFlag('markdown:r.md')).toEqual({ type: 'markdown', output: 'r.md' });
    expect(parseReporterFlag('html:r.html')).toEqual({ type: 'html', output: 'r.html' });
  });

  it('preserves colons in the output path', () => {
    expect(parseReporterFlag('json:a:b.json')).toEqual({ type: 'json', output: 'a:b.json' });
  });

  it('throws when a file reporter is missing its path', () => {
    expect(() => parseReporterFlag('json')).toThrow(/requires an output path/);
  });

  it('throws when stdout is given an output path', () => {
    expect(() => parseReporterFlag('stdout:foo')).toThrow(/takes no output path/);
  });

  it('throws on unknown reporter type', () => {
    expect(() => parseReporterFlag('slack:foo')).toThrow(/Unknown --reporter type/);
  });
});

describe('--reporter flag', () => {
  it('overrides config reporters with a CLI-specified set', async () => {
    const out = path.join(dir, 'cli-md.md');
    const { result } = await runCommand(main, {
      rawArgs: ['--config', configPath, '--reporter', `markdown:${out}`],
    });
    expect(result).toBe(0);
    await expect(access(out)).resolves.toBeUndefined();
  });

  it('exits 1 on an invalid --reporter value', async () => {
    const { result } = await runCommand(main, {
      rawArgs: ['--config', configPath, '--reporter', 'nope', '--dry-run'],
    });
    expect(result).toBe(1);
  });
});

describe('--no-cache and --cache-path', () => {
  it('--no-cache leaves an existing cache untouched', async () => {
    const cachePath = path.join(dir, '.refactor-tracker-cache.json');
    await writeCache(cachePath, { regressed: { done: 4, total: 5, timestamp: 'old' } });
    const code = await execute({
      config: configPath,
      dryRun: false,
      failOnRegression: false,
      noCache: true,
    });
    expect(code).toBe(0);
    expect(await readCache(cachePath)).toEqual({
      regressed: { done: 4, total: 5, timestamp: 'old' },
    });
  });

  it('--no-cache disables regression detection (delta null on every task)', async () => {
    await writeCache(path.join(dir, '.refactor-tracker-cache.json'), {
      regressed: { done: 4, total: 5, timestamp: 'old' },
    });
    const code = await execute({
      config: configPath,
      dryRun: true,
      failOnRegression: true,
      noCache: true,
    });
    expect(code).toBe(0);
  });

  it('--cache-path writes the cache to the given location', async () => {
    const customCache = path.join(dir, 'custom-cache.json');
    const code = await execute({
      config: configPath,
      dryRun: false,
      failOnRegression: false,
      cachePath: customCache,
    });
    expect(code).toBe(0);
    await expect(access(customCache)).resolves.toBeUndefined();
  });

  it('wires --no-cache and --cache-path through citty', async () => {
    const customCache = path.join(dir, 'cli-cache.json');
    const { result } = await runCommand(main, {
      rawArgs: ['--config', configPath, '--cache-path', customCache, '--dry-run'],
    });
    expect(result).toBe(0);
    const { result: result2 } = await runCommand(main, {
      rawArgs: ['--config', configPath, '--no-cache', '--dry-run'],
    });
    expect(result2).toBe(0);
  });
});

describe('--report-output', () => {
  it('writes the full Report as JSON to the given path on a normal run', async () => {
    const out = path.join(dir, 'report.json');
    const code = await execute({
      config: configPath,
      dryRun: false,
      failOnRegression: false,
      reportOutput: out,
    });
    expect(code).toBe(0);
    const parsed: Report = JSON.parse(await readFile(out, 'utf8'));
    expect(parsed).toHaveProperty('tasks');
    expect(parsed).toHaveProperty('timestamp');
    expect(parsed).toHaveProperty('hasChanges');
    expect(Array.isArray(parsed.tasks)).toBe(true);
  });

  it('writes the report file even under --dry-run', async () => {
    const out = path.join(dir, 'dry-report.json');
    const code = await execute({
      config: configPath,
      dryRun: true,
      failOnRegression: false,
      reportOutput: out,
    });
    expect(code).toBe(0);
    await expect(access(out)).resolves.toBeUndefined();
  });

  it('is wired through citty as --report-output', async () => {
    const out = path.join(dir, 'cli-report.json');
    const { result } = await runCommand(main, {
      rawArgs: ['--config', configPath, '--report-output', out, '--dry-run'],
    });
    expect(result).toBe(0);
    await expect(access(out)).resolves.toBeUndefined();
  });
});
