import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  DEFAULT_CONFIG_PATH,
  gatherOptions,
  runInit,
  type InitPrompter,
} from '../src/commands/init.js';
import { runCli } from './cli-helper.js';

afterEach(() => {
  process.exitCode = 0; // the init action sets exitCode on error paths; reset between tests
});

const SCHEMA = 'https://cdn.jsdelivr.net/npm/refactor-tracker@9.9.9/schema.json';

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), 'rt-init-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// Fake that throws if any prompt is called — proves the non-interactive path never prompts.
const noPrompts: InitPrompter = {
  configPath: () => Promise.reject(new Error('prompted configPath')),
  examples: () => Promise.reject(new Error('prompted examples')),
  reporter: () => Promise.reject(new Error('prompted reporter')),
  confirmOverwrite: () => Promise.reject(new Error('prompted confirmOverwrite')),
};

function fakePrompter(answers: {
  configPath?: string;
  examples?: Array<'counts' | 'remaining' | 'binary'>;
  reporter?: 'stdout' | 'json' | 'markdown' | 'html' | 'none';
  confirmOverwrite?: boolean;
}): InitPrompter {
  return {
    configPath: () => Promise.resolve(answers.configPath ?? DEFAULT_CONFIG_PATH),
    examples: () => Promise.resolve(answers.examples ?? ['counts']),
    reporter: () => Promise.resolve(answers.reporter ?? 'stdout'),
    confirmOverwrite: () => Promise.resolve(answers.confirmOverwrite ?? false),
  };
}

describe('gatherOptions', () => {
  it('uses defaults without prompting when not a TTY', async () => {
    const opts = await gatherOptions({}, { prompter: noPrompts, isTTY: false });
    expect(opts).toEqual({
      configPath: DEFAULT_CONFIG_PATH,
      examples: ['counts', 'remaining', 'binary'],
      reporter: 'stdout',
      force: false,
    });
  });

  it('honors flags in non-interactive mode', async () => {
    const opts = await gatherOptions(
      { config: 'cfg.yml', reporter: 'markdown', force: true },
      { prompter: noPrompts, isTTY: false },
    );
    expect(opts).toEqual({
      configPath: 'cfg.yml',
      examples: ['counts', 'remaining', 'binary'],
      reporter: 'markdown',
      force: true,
    });
  });

  it('treats --yes as non-interactive even on a TTY', async () => {
    const opts = await gatherOptions({ yes: true }, { prompter: noPrompts, isTTY: true });
    expect(opts.reporter).toBe('stdout');
  });

  it('throws on an invalid --reporter value', async () => {
    await expect(
      gatherOptions({ reporter: 'slack' }, { prompter: noPrompts, isTTY: false }),
    ).rejects.toThrow(/Invalid --reporter value/);
  });

  it('prompts for unspecified values in interactive mode', async () => {
    const opts = await gatherOptions(
      {},
      {
        prompter: fakePrompter({ configPath: 'x.yml', examples: ['binary'], reporter: 'json' }),
        isTTY: true,
      },
    );
    expect(opts).toEqual({
      configPath: 'x.yml',
      examples: ['binary'],
      reporter: 'json',
      force: false,
    });
  });
});

describe('runInit', () => {
  it('writes the rendered config and reports the path', async () => {
    await withTempDir(async (dir) => {
      const res = await runInit(
        {
          configPath: '.refactor-tracker.yml',
          examples: ['counts'],
          reporter: 'stdout',
          force: false,
        },
        { cwd: dir, schemaUrl: SCHEMA, interactive: false, prompter: noPrompts },
      );
      expect(res.wrote).toBe(true);
      const written = await readFile(res.targetPath, 'utf8');
      expect(written).toContain(`$schema=${SCHEMA}`);
      expect(written).toContain('id: example-counts');
    });
  });

  it('errors when the file exists and --force is not set (non-interactive)', async () => {
    await withTempDir(async (dir) => {
      const p = path.join(dir, '.refactor-tracker.yml');
      await writeFile(p, 'old', 'utf8');
      await expect(
        runInit(
          {
            configPath: '.refactor-tracker.yml',
            examples: ['counts'],
            reporter: 'stdout',
            force: false,
          },
          { cwd: dir, schemaUrl: SCHEMA, interactive: false, prompter: noPrompts },
        ),
      ).rejects.toThrow(/already exists/);
      expect(await readFile(p, 'utf8')).toBe('old');
    });
  });

  it('overwrites when --force is set', async () => {
    await withTempDir(async (dir) => {
      const p = path.join(dir, '.refactor-tracker.yml');
      await writeFile(p, 'old', 'utf8');
      const res = await runInit(
        {
          configPath: '.refactor-tracker.yml',
          examples: ['counts'],
          reporter: 'stdout',
          force: true,
        },
        { cwd: dir, schemaUrl: SCHEMA, interactive: false, prompter: noPrompts },
      );
      expect(res.wrote).toBe(true);
      expect(await readFile(p, 'utf8')).toContain('id: example-counts');
    });
  });

  it('aborts without writing when the user declines overwrite (interactive)', async () => {
    await withTempDir(async (dir) => {
      const p = path.join(dir, '.refactor-tracker.yml');
      await writeFile(p, 'old', 'utf8');
      const res = await runInit(
        {
          configPath: '.refactor-tracker.yml',
          examples: ['counts'],
          reporter: 'stdout',
          force: false,
        },
        {
          cwd: dir,
          schemaUrl: SCHEMA,
          interactive: true,
          prompter: fakePrompter({ confirmOverwrite: false }),
        },
      );
      expect(res.wrote).toBe(false);
      expect(await readFile(p, 'utf8')).toBe('old');
    });
  });
});

describe('init command', () => {
  it('writes a config via --yes and exits 0', async () => {
    await withTempDir(async (dir) => {
      const target = path.join(dir, '.refactor-tracker.yml');
      expect(await runCli(['init', '--config', target, '--yes'])).toBe(0);
      const written = await readFile(target, 'utf8');
      expect(written).toContain('# yaml-language-server: $schema=');
      expect(written).toContain('refactor-tracker@9.9.9/schema.json');
      expect(written).toContain('id: example-counts');
    });
  });

  it('exits 1 when the target exists and --force is absent', async () => {
    await withTempDir(async (dir) => {
      const target = path.join(dir, '.refactor-tracker.yml');
      await writeFile(target, 'old', 'utf8');
      expect(await runCli(['init', '--config', target, '--yes'])).toBe(1);
      expect(await readFile(target, 'utf8')).toBe('old');
    });
  });
});

describe('bare command still runs detection', () => {
  it('routes flag-only args to detection, not init', async () => {
    await withTempDir(async (dir) => {
      const cfg = path.join(dir, 'config.yml');
      await writeFile(
        cfg,
        'refactors:\n  - id: a\n    name: A\n    detect:\n      done: { command: "echo 1" }\n      total: { command: "echo 2" }\n',
        'utf8',
      );
      expect(await runCli(['--config', cfg, '--dry-run'])).toBe(0);
    });
  });
});
