# refactor-tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A language-agnostic CLI that runs configurable shell detection commands, counts refactor progress, and reports deltas to pluggable outputs (stdout, json, markdown, and custom modules).

**Architecture:** A config-driven engine reads `.tech-refactors.yml`, runs each refactor's detect command(s) through a shell runner, resolves `{done, total}` from the detection shape, computes deltas against a gitignored JSON cache, and produces a `Report`. Reporters consume the `Report`; the `Report.hasChanges` flag lets expensive reporters short-circuit. Detection is fully delegated to the shell — the tool only reads integers from stdout.

**Tech Stack:** TypeScript (ESM, NodeNext), pnpm, tsdown (rolldown-based bundler), Vitest, zod (config validation), js-yaml, execa (shell), citty (CLI framework — chosen for first-class TypeScript arg inference).

**Scope note:** The Notion reporter from the original spec is **deferred** to a separate future plan — it needs schema/row-mapping design (database id, configurable done-property name, page matching) that the simple reporters don't. Until then, the **custom-reporter loader** is the extension point: anyone can ship a Notion reporter as a JS/TS module. See "Deferred / Out of scope" below.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/types.ts` | Shared interfaces: `TaskResult`, `Report`, `Reporter`. Pure types, no behavior. |
| `src/config.ts` | zod schema, `parseConfig(raw)`, `loadConfig(path)`, `expandEnv` (env var expansion scoped to reporters). |
| `src/runner.ts` | `runCommand(command, cwd?)` — wraps execa, runs a shell string, returns `{stdout, exitCode}`. |
| `src/detect.ts` | `resolveDetection(detect, run, cwd?)` — resolves the four detection shapes into `{done, total}`. |
| `src/cache.ts` | `readCache(path)` / `writeCache(path, cache)` — JSON cache I/O, missing file → `{}`. |
| `src/engine.ts` | `runEngine(config, options)` — orchestrates detection, delta computation, cache write, builds `Report`. |
| `src/reporters/stdout.ts` | `StdoutReporter` + pure `formatTable(report)`. Default reporter. |
| `src/reporters/json.ts` | `JsonReporter` — writes the `Report` as JSON. |
| `src/reporters/markdown.ts` | `MarkdownReporter` + pure `formatMarkdown(report)`. |
| `src/reporters/index.ts` | `createReporters(configs, baseDir)` — factory/registry + custom module loader. |
| `src/cli.ts` | citty command + `execute(options)` core; `--config`, `--dry-run`, `--fail-on-regression`. |
| `src/index.ts` | Package entry — re-exports `Report`, `TaskResult`, `Reporter` for custom-reporter authors. |
| `tests/*.test.ts` | Vitest tests mirroring `src/`. |

Tests live in `tests/` (not bundled — only `cli.ts` and `index.ts` are tsdown entries). Pure functions (`formatTable`, `formatMarkdown`, `resolveDetection`, `parseConfig`) are tested directly; I/O is tested against `os.tmpdir()` temp files; the shell runner and custom-reporter loading use real, deterministic commands/fixtures.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsdown.config.ts`, `.gitignore`, `src/types.ts`

- [ ] **Step 1: Initialize git**

The working directory is not yet a git repo. Run from the repo root:

```bash
cd /Users/inad/dev/refactor-tracker
git init
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "refactor-tracker",
  "version": "0.1.0",
  "description": "Run configurable shell detections to track and report technical-refactor progress.",
  "type": "module",
  "bin": { "refactor-tracker": "./dist/cli.js" },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsdown",
    "test": "vitest run",
    "dev": "vitest"
  }
}
```

- [ ] **Step 3: Install dependencies (pnpm resolves current versions)**

```bash
pnpm add zod js-yaml execa citty
pnpm add -D typescript tsdown vitest @types/node @types/js-yaml
```

Expected: `node_modules/` and `pnpm-lock.yaml` created; deps appear in `package.json`.

- [ ] **Step 4: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "declaration": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "types": ["node"]
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 5: Create `tsdown.config.ts`**

```typescript
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/cli.ts', 'src/index.ts'],
  format: ['esm'],
  platform: 'node',
  dts: true,
  shims: true,
});
```

- [ ] **Step 6: Create `.gitignore`**

```gitignore
node_modules/
dist/
.refactor-tracker-cache.json
*.log
```

- [ ] **Step 7: Create `src/types.ts`**

```typescript
export interface TaskResult {
  id: string;
  name: string;
  done: number;
  total: number;
  percentage: number;      // 0–100, rounded
  delta: number | null;    // change in `done` vs previous run; null on first run
}

export interface Report {
  tasks: TaskResult[];
  timestamp: string;       // ISO-8601
  hasChanges: boolean;
}

export interface Reporter {
  report(report: Report): Promise<void>;
}
```

- [ ] **Step 8: Verify the toolchain runs**

Run: `pnpm vitest run`
Expected: Vitest starts and reports "No test files found" (exit 0 or the "no tests" notice). Confirms vitest is installed before any tests exist.

- [ ] **Step 9: Commit**

```bash
git add package.json pnpm-lock.yaml tsconfig.json tsdown.config.ts .gitignore src/types.ts
git commit -m "chore: scaffold refactor-tracker package"
```

---

### Task 2: Config parsing and validation

**Files:**
- Create: `src/config.ts`
- Test: `tests/config.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/config.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { parseConfig, expandEnv } from '../src/config.js';

describe('parseConfig', () => {
  it('parses refactors with a done+total detection shape', () => {
    const config = parseConfig(`
refactors:
  - id: abc
    name: Lazy routes
    detect:
      done:
        command: "grep -rl x | wc -l"
      total:
        command: "ls views | wc -l"
`);
    expect(config.refactors).toHaveLength(1);
    expect(config.refactors[0].id).toBe('abc');
    expect(config.refactors[0].detect).toMatchObject({
      done: { command: 'grep -rl x | wc -l' },
      total: { command: 'ls views | wc -l' },
    });
  });

  it('accepts a binary detection shape', () => {
    const config = parseConfig(`
refactors:
  - id: bin
    name: Upgrade lib
    detect:
      command: "node -e 'process.exit(0)'"
      binary: true
`);
    expect(config.refactors[0].detect).toMatchObject({ binary: true });
  });

  it('rejects a detect with fewer than two of done/remaining/total', () => {
    expect(() =>
      parseConfig(`
refactors:
  - id: bad
    name: Bad
    detect:
      done:
        command: "echo 1"
`),
    ).toThrow();
  });
});

describe('expandEnv', () => {
  beforeEach(() => {
    process.env.TEST_TOKEN = 'secret-123';
  });

  it('expands a string that is exactly $VAR', () => {
    expect(expandEnv({ token: '$TEST_TOKEN' })).toEqual({ token: 'secret-123' });
  });

  it('leaves strings that merely contain $ untouched', () => {
    expect(expandEnv({ command: "grep '$foo' src" })).toEqual({ command: "grep '$foo' src" });
  });

  it('throws when the referenced env var is unset', () => {
    expect(() => expandEnv({ token: '$DEFINITELY_UNSET_VAR' })).toThrow(/DEFINITELY_UNSET_VAR/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/config.test.ts`
Expected: FAIL — cannot resolve `../src/config.js` (module does not exist).

- [ ] **Step 3: Write `src/config.ts`**

```typescript
import { readFile } from 'node:fs/promises';
import yaml from 'js-yaml';
import { z } from 'zod';

const commandField = z.object({ command: z.string() });

const detectBinary = z.object({
  command: z.string(),
  binary: z.literal(true),
});

const detectCounts = z
  .object({
    done: commandField.optional(),
    remaining: commandField.optional(),
    total: commandField.optional(),
  })
  .refine((d) => [d.done, d.remaining, d.total].filter(Boolean).length >= 2, {
    message: 'detect must provide at least two of done/remaining/total',
  });

const detectSchema = z.union([detectBinary, detectCounts]);

const refactorSchema = z.object({
  id: z.string(),
  name: z.string(),
  detect: detectSchema,
});

const reporterSchema = z.looseObject({ type: z.string() }); // zod v4: looseObject replaces .passthrough()

export const configSchema = z.object({
  reporters: z.array(reporterSchema).optional(),
  refactors: z.array(refactorSchema),
});

export type Config = z.infer<typeof configSchema>;
export type DetectConfig = z.infer<typeof detectSchema>;
export type RefactorConfig = z.infer<typeof refactorSchema>;
export type ReporterConfig = z.infer<typeof reporterSchema>;

const ENV_REF = /^\$([A-Za-z_][A-Za-z0-9_]*)$/;

export function expandEnv<T>(value: T): T {
  if (typeof value === 'string') {
    const match = value.match(ENV_REF);
    if (!match) return value;
    const resolved = process.env[match[1]];
    if (resolved === undefined) throw new Error(`Environment variable not set: ${match[1]}`);
    return resolved as unknown as T;
  }
  if (Array.isArray(value)) return value.map((v) => expandEnv(v)) as unknown as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, expandEnv(v)]),
    ) as T;
  }
  return value;
}

export function parseConfig(raw: string): Config {
  const config = configSchema.parse(yaml.load(raw));
  if (config.reporters) config.reporters = config.reporters.map((r) => expandEnv(r));
  return config;
}

export async function loadConfig(path: string): Promise<Config> {
  return parseConfig(await readFile(path, 'utf8'));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/config.test.ts`
Expected: PASS — all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/config.ts tests/config.test.ts
git commit -m "feat: add config schema, parsing, and env expansion"
```

---

### Task 3: Shell command runner

**Files:**
- Create: `src/runner.ts`
- Test: `tests/runner.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/runner.test.ts
import { describe, it, expect } from 'vitest';
import { runCommand } from '../src/runner.js';

describe('runCommand', () => {
  it('returns trimmed stdout of a shell command', async () => {
    const result = await runCommand('echo 42');
    expect(result.stdout).toBe('42');
    expect(result.exitCode).toBe(0);
  });

  it('runs commands with pipes', async () => {
    const result = await runCommand('printf "a\\nb\\nc\\n" | wc -l | tr -d " "');
    expect(result.stdout).toBe('3');
  });

  it('captures a non-zero exit code without throwing', async () => {
    const result = await runCommand('exit 3');
    expect(result.exitCode).toBe(3);
  });

  it('respects the cwd option', async () => {
    const result = await runCommand('pwd', '/tmp');
    expect(result.stdout).toContain('/tmp');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/runner.test.ts`
Expected: FAIL — cannot resolve `../src/runner.js`.

- [ ] **Step 3: Write `src/runner.ts`**

```typescript
import { execa } from 'execa';

export interface CommandResult {
  stdout: string;
  exitCode: number;
}

export async function runCommand(command: string, cwd?: string): Promise<CommandResult> {
  const result = await execa(command, { shell: true, reject: false, cwd });
  return {
    stdout: String(result.stdout ?? '').trim(),
    exitCode: result.exitCode ?? 0,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/runner.test.ts`
Expected: PASS — all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/runner.ts tests/runner.test.ts
git commit -m "feat: add shell command runner"
```

---

### Task 4: Detection shape resolver

> **Spec note for the reviewer:** The spec's table states binary detection is `command exits 0 = done`. This task implements exactly that (exit code 0 → `done = 1`). The spec's *inline example* (`process.exit(startsWith('3') ? 1 : 0)`) appears to invert this — it exits 1 when the lib is upgraded. Implement per the table (exit 0 = done) and flag the example to the user when reporting completion so they can correct the example or confirm the rule.

**Files:**
- Create: `src/detect.ts`
- Test: `tests/detect.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/detect.test.ts
import { describe, it, expect } from 'vitest';
import { resolveDetection, type CommandRunner } from '../src/detect.js';

// Fake runner: maps a command string to a canned result.
function fakeRunner(map: Record<string, { stdout?: string; exitCode?: number }>): CommandRunner {
  return async (command: string) => ({
    stdout: map[command]?.stdout ?? '',
    exitCode: map[command]?.exitCode ?? 0,
  });
}

describe('resolveDetection', () => {
  it('computes remaining from done + total', async () => {
    const run = fakeRunner({ d: { stdout: '4' }, t: { stdout: '11' } });
    const counts = await resolveDetection(
      { done: { command: 'd' }, total: { command: 't' } } as any,
      run,
    );
    expect(counts).toEqual({ done: 4, total: 11 });
  });

  it('computes total from done + remaining', async () => {
    const run = fakeRunner({ d: { stdout: '7' }, r: { stdout: '2' } });
    const counts = await resolveDetection(
      { done: { command: 'd' }, remaining: { command: 'r' } } as any,
      run,
    );
    expect(counts).toEqual({ done: 7, total: 9 });
  });

  it('computes done from remaining + total', async () => {
    const run = fakeRunner({ r: { stdout: '3' }, t: { stdout: '10' } });
    const counts = await resolveDetection(
      { remaining: { command: 'r' }, total: { command: 't' } } as any,
      run,
    );
    expect(counts).toEqual({ done: 7, total: 10 });
  });

  it('treats exit code 0 as done for binary detection', async () => {
    const run = fakeRunner({ check: { exitCode: 0 } });
    const counts = await resolveDetection({ command: 'check', binary: true } as any, run);
    expect(counts).toEqual({ done: 1, total: 1 });
  });

  it('treats non-zero exit code as not done for binary detection', async () => {
    const run = fakeRunner({ check: { exitCode: 1 } });
    const counts = await resolveDetection({ command: 'check', binary: true } as any, run);
    expect(counts).toEqual({ done: 0, total: 1 });
  });

  it('throws when a command does not print a non-negative integer', async () => {
    const run = fakeRunner({ d: { stdout: 'not-a-number' }, t: { stdout: '5' } });
    await expect(
      resolveDetection({ done: { command: 'd' }, total: { command: 't' } } as any, run),
    ).rejects.toThrow(/non-negative integer/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/detect.test.ts`
Expected: FAIL — cannot resolve `../src/detect.js`.

- [ ] **Step 3: Write `src/detect.ts`**

```typescript
import type { DetectConfig } from './config.js';
import type { CommandResult } from './runner.js';

export type CommandRunner = (command: string, cwd?: string) => Promise<CommandResult>;

export interface Counts {
  done: number;
  total: number;
}

function parseCount(stdout: string, command: string): number {
  const n = Number(stdout);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(
      `Command did not print a non-negative integer: "${command}" produced "${stdout}"`,
    );
  }
  return n;
}

export async function resolveDetection(
  detect: DetectConfig,
  run: CommandRunner,
  cwd?: string,
): Promise<Counts> {
  if ('binary' in detect && detect.binary) {
    const { exitCode } = await run(detect.command, cwd);
    return { done: exitCode === 0 ? 1 : 0, total: 1 };
  }

  const counts: Partial<Record<'done' | 'remaining' | 'total', number>> = {};
  for (const key of ['done', 'remaining', 'total'] as const) {
    const field = (detect as Record<string, { command: string } | undefined>)[key];
    if (field) {
      const { stdout } = await run(field.command, cwd);
      counts[key] = parseCount(stdout, field.command);
    }
  }

  const { done, remaining, total } = counts;
  if (done !== undefined && total !== undefined) {
    return { done, total };
  }
  if (done !== undefined && remaining !== undefined) {
    return { done, total: done + remaining };
  }
  if (remaining !== undefined && total !== undefined) {
    return { done: total - remaining, total };
  }
  throw new Error('detect must provide binary, or any two of done/remaining/total');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/detect.test.ts`
Expected: PASS — all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/detect.ts tests/detect.test.ts
git commit -m "feat: add detection shape resolver"
```

---

### Task 5: Cache I/O

**Files:**
- Create: `src/cache.ts`
- Test: `tests/cache.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/cache.test.ts
import { describe, it, expect } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readCache, writeCache, type Cache } from '../src/cache.js';

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), 'rt-cache-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe('cache', () => {
  it('returns an empty object when the cache file does not exist', async () => {
    await withTempDir(async (dir) => {
      const cache = await readCache(path.join(dir, 'missing.json'));
      expect(cache).toEqual({});
    });
  });

  it('round-trips written data', async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, 'cache.json');
      const data: Cache = { abc: { done: 4, total: 11, timestamp: '2026-05-28T10:00:00.000Z' } };
      await writeCache(file, data);
      expect(await readCache(file)).toEqual(data);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/cache.test.ts`
Expected: FAIL — cannot resolve `../src/cache.js`.

- [ ] **Step 3: Write `src/cache.ts`**

```typescript
import { readFile, writeFile } from 'node:fs/promises';

export interface CacheEntry {
  done: number;
  total: number;
  timestamp: string;
}

export type Cache = Record<string, CacheEntry>;

export async function readCache(path: string): Promise<Cache> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as Cache;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw err;
  }
}

export async function writeCache(path: string, cache: Cache): Promise<void> {
  await writeFile(path, JSON.stringify(cache, null, 2) + '\n', 'utf8');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/cache.test.ts`
Expected: PASS — both tests green.

- [ ] **Step 5: Commit**

```bash
git add src/cache.ts tests/cache.test.ts
git commit -m "feat: add cache read/write"
```

---

### Task 6: Engine

**Files:**
- Create: `src/engine.ts`
- Test: `tests/engine.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/engine.test.ts
import { describe, it, expect } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runEngine } from '../src/engine.js';
import { writeCache, readCache } from '../src/cache.js';
import type { CommandRunner } from '../src/detect.js';
import type { Config } from '../src/config.js';

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), 'rt-engine-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const run: CommandRunner = async (command) => {
  const map: Record<string, string> = { d: '4', t: '11' };
  return { stdout: map[command] ?? '0', exitCode: 0 };
};

const config: Config = {
  refactors: [
    {
      id: 'abc',
      name: 'Lazy routes',
      detect: { done: { command: 'd' }, total: { command: 't' } } as any,
    },
  ],
};

const fixedNow = () => new Date('2026-05-28T12:00:00.000Z');

describe('runEngine', () => {
  it('produces a report with delta null on first run', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
      const report = await runEngine(config, { cachePath, run, now: fixedNow });
      expect(report.tasks).toEqual([
        { id: 'abc', name: 'Lazy routes', done: 4, total: 11, percentage: 36, delta: null },
      ]);
      expect(report.hasChanges).toBe(true);
      expect(report.timestamp).toBe('2026-05-28T12:00:00.000Z');
    });
  });

  it('computes delta against the cache and writes the cache', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
      await writeCache(cachePath, { abc: { done: 1, total: 11, timestamp: 'old' } });
      const report = await runEngine(config, { cachePath, run, now: fixedNow });
      expect(report.tasks[0].delta).toBe(3);
      expect(report.hasChanges).toBe(true);
      expect(await readCache(cachePath)).toEqual({
        abc: { done: 4, total: 11, timestamp: '2026-05-28T12:00:00.000Z' },
      });
    });
  });

  it('reports hasChanges false when counts match the cache', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
      await writeCache(cachePath, { abc: { done: 4, total: 11, timestamp: 'old' } });
      const report = await runEngine(config, { cachePath, run, now: fixedNow });
      expect(report.hasChanges).toBe(false);
      expect(report.tasks[0].delta).toBe(0);
    });
  });

  it('does not write the cache in dry-run mode', async () => {
    await withTempDir(async (dir) => {
      const cachePath = path.join(dir, 'cache.json');
      await runEngine(config, { cachePath, run, now: fixedNow, dryRun: true });
      expect(await readCache(cachePath)).toEqual({});
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/engine.test.ts`
Expected: FAIL — cannot resolve `../src/engine.js`.

- [ ] **Step 3: Write `src/engine.ts`**

```typescript
import type { Config } from './config.js';
import type { Report, TaskResult } from './types.js';
import { resolveDetection, type CommandRunner } from './detect.js';
import { runCommand } from './runner.js';
import { readCache, writeCache, type Cache } from './cache.js';

export interface EngineOptions {
  cachePath: string;
  cwd?: string;
  dryRun?: boolean;
  run?: CommandRunner;     // injectable for tests; defaults to the real shell runner
  now?: () => Date;        // injectable for tests; defaults to wall clock
}

export async function runEngine(config: Config, options: EngineOptions): Promise<Report> {
  const run = options.run ?? runCommand;
  const now = options.now ?? (() => new Date());
  const timestamp = now().toISOString();
  const cache = await readCache(options.cachePath);

  const tasks: TaskResult[] = [];
  const nextCache: Cache = {};
  let hasChanges = false;

  for (const refactor of config.refactors) {
    const { done, total } = await resolveDetection(refactor.detect, run, options.cwd);
    const percentage = total === 0 ? 0 : Math.round((done / total) * 100);
    const prev = cache[refactor.id];
    const delta = prev ? done - prev.done : null;
    if (!prev || prev.done !== done || prev.total !== total) hasChanges = true;

    tasks.push({ id: refactor.id, name: refactor.name, done, total, percentage, delta });
    nextCache[refactor.id] = { done, total, timestamp };
  }

  if (!options.dryRun) await writeCache(options.cachePath, nextCache);
  return { tasks, timestamp, hasChanges };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/engine.test.ts`
Expected: PASS — all 4 tests green. (`4/11 = 36.36% → 36` confirms rounding.)

- [ ] **Step 5: Commit**

```bash
git add src/engine.ts tests/engine.test.ts
git commit -m "feat: add engine orchestrating detection, delta, and cache"
```

---

### Task 7: stdout reporter

**Files:**
- Create: `src/reporters/stdout.ts`
- Test: `tests/reporters/stdout.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/reporters/stdout.test.ts
import { describe, it, expect } from 'vitest';
import { formatTable } from '../../src/reporters/stdout.js';
import type { Report } from '../../src/types.js';

const report: Report = {
  timestamp: '2026-05-28T12:00:00.000Z',
  hasChanges: true,
  tasks: [
    { id: 'a', name: 'Lazy routes', done: 4, total: 11, percentage: 36, delta: 3 },
    { id: 'b', name: 'react-hook-form', done: 7, total: 9, percentage: 78, delta: null },
    { id: 'c', name: 'Regressed', done: 2, total: 5, percentage: 40, delta: -1 },
  ],
};

describe('formatTable', () => {
  it('renders each task with counts, percentage, and signed delta', () => {
    const out = formatTable(report);
    expect(out).toContain('Lazy routes: 4/11 (36%) (+3)');
    expect(out).toContain('react-hook-form: 7/9 (78%)');
    expect(out).not.toContain('react-hook-form: 7/9 (78%) (');
    expect(out).toContain('Regressed: 2/5 (40%) (-1)');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/reporters/stdout.test.ts`
Expected: FAIL — cannot resolve `../../src/reporters/stdout.js`.

- [ ] **Step 3: Write `src/reporters/stdout.ts`**

```typescript
import type { Reporter, Report } from '../types.js';

export function formatTable(report: Report): string {
  return report.tasks
    .map((t) => {
      const delta =
        t.delta === null ? '' : t.delta > 0 ? ` (+${t.delta})` : ` (${t.delta})`;
      return `${t.name}: ${t.done}/${t.total} (${t.percentage}%)${delta}`;
    })
    .join('\n');
}

export class StdoutReporter implements Reporter {
  async report(report: Report): Promise<void> {
    console.log(formatTable(report));
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/reporters/stdout.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/reporters/stdout.ts tests/reporters/stdout.test.ts
git commit -m "feat: add stdout reporter"
```

---

### Task 8: json reporter

**Files:**
- Create: `src/reporters/json.ts`
- Test: `tests/reporters/json.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/reporters/json.test.ts
import { describe, it, expect } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { JsonReporter } from '../../src/reporters/json.js';
import type { Report } from '../../src/types.js';

const report: Report = {
  timestamp: '2026-05-28T12:00:00.000Z',
  hasChanges: true,
  tasks: [{ id: 'a', name: 'Lazy routes', done: 4, total: 11, percentage: 36, delta: 3 }],
};

describe('JsonReporter', () => {
  it('writes the report as JSON, creating parent directories', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'rt-json-'));
    try {
      const out = path.join(dir, 'nested', 'report.json');
      await new JsonReporter(out).report(report);
      const written = JSON.parse(await readFile(out, 'utf8'));
      expect(written).toEqual(report);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/reporters/json.test.ts`
Expected: FAIL — cannot resolve `../../src/reporters/json.js`.

- [ ] **Step 3: Write `src/reporters/json.ts`**

```typescript
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Reporter, Report } from '../types.js';

export class JsonReporter implements Reporter {
  constructor(private readonly output: string) {}

  async report(report: Report): Promise<void> {
    await mkdir(path.dirname(this.output), { recursive: true });
    await writeFile(this.output, JSON.stringify(report, null, 2) + '\n', 'utf8');
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/reporters/json.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/reporters/json.ts tests/reporters/json.test.ts
git commit -m "feat: add json reporter"
```

---

### Task 9: markdown reporter

**Files:**
- Create: `src/reporters/markdown.ts`
- Test: `tests/reporters/markdown.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/reporters/markdown.test.ts
import { describe, it, expect } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { MarkdownReporter, formatMarkdown } from '../../src/reporters/markdown.js';
import type { Report } from '../../src/types.js';

const report: Report = {
  timestamp: '2026-05-28T12:00:00.000Z',
  hasChanges: true,
  tasks: [{ id: 'a', name: 'Lazy routes', done: 4, total: 11, percentage: 36, delta: 3 }],
};

describe('formatMarkdown', () => {
  it('renders a markdown table row per task', () => {
    const md = formatMarkdown(report);
    expect(md).toContain('| Refactor | Done | Total | % |');
    expect(md).toContain('| Lazy routes | 4 | 11 | 36% |');
  });
});

describe('MarkdownReporter', () => {
  it('writes markdown to the output file, creating parent directories', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'rt-md-'));
    try {
      const out = path.join(dir, 'docs', 'progress.md');
      await new MarkdownReporter(out).report(report);
      expect(await readFile(out, 'utf8')).toContain('| Lazy routes | 4 | 11 | 36% |');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/reporters/markdown.test.ts`
Expected: FAIL — cannot resolve `../../src/reporters/markdown.js`.

- [ ] **Step 3: Write `src/reporters/markdown.ts`**

```typescript
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Reporter, Report } from '../types.js';

export function formatMarkdown(report: Report): string {
  const header = '| Refactor | Done | Total | % |\n| --- | --- | --- | --- |';
  const rows = report.tasks.map(
    (t) => `| ${t.name} | ${t.done} | ${t.total} | ${t.percentage}% |`,
  );
  return ['# Refactor progress', '', `_Updated: ${report.timestamp}_`, '', header, ...rows, ''].join(
    '\n',
  );
}

export class MarkdownReporter implements Reporter {
  constructor(private readonly output: string) {}

  async report(report: Report): Promise<void> {
    await mkdir(path.dirname(this.output), { recursive: true });
    await writeFile(this.output, formatMarkdown(report), 'utf8');
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/reporters/markdown.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/reporters/markdown.ts tests/reporters/markdown.test.ts
git commit -m "feat: add markdown reporter"
```

---

### Task 10: Reporter registry

**Files:**
- Create: `src/reporters/index.ts`
- Test: `tests/reporters/index.test.ts`, `tests/fixtures/custom-reporter.ts`

- [ ] **Step 1: Create the custom-reporter fixture**

```typescript
// tests/fixtures/custom-reporter.ts
import type { Reporter } from '../../src/types.js';

const reporter: Reporter = {
  async report() {
    // no-op fixture used to verify custom loading
  },
};

export default reporter;
```

- [ ] **Step 2: Write the failing test**

```typescript
// tests/reporters/index.test.ts
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReporters } from '../../src/reporters/index.js';
import { StdoutReporter } from '../../src/reporters/stdout.js';
import { JsonReporter } from '../../src/reporters/json.js';
import { MarkdownReporter } from '../../src/reporters/markdown.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(here, '..', 'fixtures');

describe('createReporters', () => {
  it('defaults to a single stdout reporter when none are configured', async () => {
    const reporters = await createReporters(undefined, process.cwd());
    expect(reporters).toHaveLength(1);
    expect(reporters[0]).toBeInstanceOf(StdoutReporter);
  });

  it('builds the configured built-in reporters', async () => {
    const reporters = await createReporters(
      [
        { type: 'stdout' },
        { type: 'json', output: 'out.json' },
        { type: 'markdown', output: 'out.md' },
      ],
      process.cwd(),
    );
    expect(reporters[0]).toBeInstanceOf(StdoutReporter);
    expect(reporters[1]).toBeInstanceOf(JsonReporter);
    expect(reporters[2]).toBeInstanceOf(MarkdownReporter);
  });

  it('loads a custom reporter from a module path relative to baseDir', async () => {
    const reporters = await createReporters(
      [{ type: 'custom', path: './custom-reporter.ts' }],
      fixturesDir,
    );
    expect(reporters).toHaveLength(1);
    expect(typeof reporters[0].report).toBe('function');
  });

  it('throws on an unknown reporter type', async () => {
    await expect(createReporters([{ type: 'banana' }], process.cwd())).rejects.toThrow(
      /Unknown reporter type: banana/,
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run tests/reporters/index.test.ts`
Expected: FAIL — cannot resolve `../../src/reporters/index.js`.

- [ ] **Step 4: Write `src/reporters/index.ts`**

```typescript
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Reporter } from '../types.js';
import type { ReporterConfig } from '../config.js';
import { StdoutReporter } from './stdout.js';
import { JsonReporter } from './json.js';
import { MarkdownReporter } from './markdown.js';

export async function createReporters(
  configs: ReporterConfig[] | undefined,
  baseDir: string,
): Promise<Reporter[]> {
  if (!configs || configs.length === 0) return [new StdoutReporter()];

  const reporters: Reporter[] = [];
  for (const config of configs) {
    switch (config.type) {
      case 'stdout':
        reporters.push(new StdoutReporter());
        break;
      case 'json':
        reporters.push(new JsonReporter(config.output as string));
        break;
      case 'markdown':
        reporters.push(new MarkdownReporter(config.output as string));
        break;
      case 'custom': {
        const resolved = path.resolve(baseDir, config.path as string);
        const mod = await import(pathToFileURL(resolved).href);
        reporters.push(mod.default as Reporter);
        break;
      }
      default:
        throw new Error(`Unknown reporter type: ${config.type}`);
    }
  }
  return reporters;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run tests/reporters/index.test.ts`
Expected: PASS — all 4 tests green.

- [ ] **Step 6: Commit**

```bash
git add src/reporters/index.ts tests/reporters/index.test.ts tests/fixtures/custom-reporter.ts
git commit -m "feat: add reporter registry and custom loader"
```

---

### Task 11: CLI (citty)

**Files:**
- Create: `src/cli.ts`
- Test: `tests/cli.test.ts`, `tests/fixtures/regression-config.yml`

citty gives **case-agnostic** arg access — the kebab flag `--fail-on-regression` is readable as `args['fail-on-regression']` (used here) and is fully typed from the `args` definition. The core logic lives in an exported `execute(options)` that returns an exit code, so it is tested directly; `runMain(main)` is guarded so importing the module in tests does not start the CLI. A second test uses citty's `runCommand` to confirm flags are wired into `execute`.

- [ ] **Step 1: Create the CLI test fixture**

`done` (2) is lower than the cache (4) seeded in the test, so `--fail-on-regression` must return 1.

```yaml
# tests/fixtures/regression-config.yml
refactors:
  - id: regressed
    name: Regressed task
    detect:
      done:
        command: "echo 2"
      total:
        command: "echo 5"
```

- [ ] **Step 2: Write the failing test**

```typescript
// tests/cli.test.ts
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run tests/cli.test.ts`
Expected: FAIL — cannot resolve `../src/cli.js`.

- [ ] **Step 4: Write `src/cli.ts`**

```typescript
#!/usr/bin/env node
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { defineCommand, runMain } from 'citty';
import { loadConfig } from './config.js';
import { runEngine } from './engine.js';
import { createReporters } from './reporters/index.js';

export interface ExecuteOptions {
  config: string;
  dryRun: boolean;
  failOnRegression: boolean;
}

export async function execute(options: ExecuteOptions): Promise<number> {
  const configPath = path.resolve(options.config);
  const baseDir = path.dirname(configPath);
  const config = await loadConfig(configPath);

  const report = await runEngine(config, {
    cachePath: path.join(baseDir, '.refactor-tracker-cache.json'),
    cwd: baseDir,
    dryRun: options.dryRun,
  });

  if (options.dryRun) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const reporters = await createReporters(config.reporters, baseDir);
    for (const reporter of reporters) await reporter.report(report);
  }

  if (options.failOnRegression && report.tasks.some((t) => t.delta !== null && t.delta < 0)) {
    console.error("Regression detected: a tracked task's done count decreased.");
    return 1;
  }
  return 0;
}

export const main = defineCommand({
  meta: {
    name: 'refactor-tracker',
    description: 'Run configurable shell detections to track and report technical-refactor progress.',
  },
  args: {
    config: {
      type: 'string',
      description: 'Path to the config file',
      default: '.tech-refactors.yml',
      alias: ['c'],
    },
    'dry-run': {
      type: 'boolean',
      description: 'Run detections and print the report; do not invoke reporters',
      default: false,
    },
    'fail-on-regression': {
      type: 'boolean',
      description: "Exit 1 if any task's done count decreased vs the cache",
      default: false,
    },
  },
  async run({ args }) {
    const code = await execute({
      config: args.config,
      dryRun: args['dry-run'],
      failOnRegression: args['fail-on-regression'],
    });
    if (code !== 0) process.exitCode = code;
    return code;
  },
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runMain(main);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run tests/cli.test.ts`
Expected: PASS — all 3 tests green.

- [ ] **Step 6: Commit**

```bash
git add src/cli.ts tests/cli.test.ts tests/fixtures/regression-config.yml
git commit -m "feat: add citty CLI with dry-run and fail-on-regression"
```

---

### Task 12: Package entry, build, and end-to-end smoke test

**Files:**
- Create: `src/index.ts`, `README.md`
- Verify: `dist/cli.js` runs against a fixture config

- [ ] **Step 1: Create `src/index.ts`**

```typescript
export type { Report, TaskResult, Reporter } from './types.js';
```

- [ ] **Step 2: Run the full test suite**

Run: `pnpm test`
Expected: PASS — every test from Tasks 2–11 green.

- [ ] **Step 3: Build the package**

Run: `pnpm build`
Expected: tsdown writes `dist/cli.js`, `dist/index.js`, and `.d.ts` files; build exits 0. `dist/cli.js` begins with a `#!/usr/bin/env node` shebang (preserved by tsdown from `cli.ts`).

- [ ] **Step 4: Smoke-test the built CLI**

```bash
mkdir -p /tmp/rt-smoke && cd /tmp/rt-smoke
cat > .tech-refactors.yml <<'YML'
refactors:
  - id: demo
    name: Demo refactor
    detect:
      done:
        command: "echo 3"
      total:
        command: "echo 4"
YML
node /Users/inad/dev/refactor-tracker/dist/cli.js --config .tech-refactors.yml
```

Expected stdout: `Demo refactor: 3/4 (75%)` (no delta suffix on first run). A `.refactor-tracker-cache.json` appears in `/tmp/rt-smoke`. Then verify `--help` works (citty auto-generates it):

```bash
node /Users/inad/dev/refactor-tracker/dist/cli.js --help
```

Expected: usage text listing `--config`, `--dry-run`, `--fail-on-regression`. Clean up: `cd - && rm -rf /tmp/rt-smoke`.

- [ ] **Step 5: Write `README.md`**

Document: install, the `.tech-refactors.yml` schema (detection-shapes table from the spec), CLI options (`--config`, `--dry-run`, `--fail-on-regression`), the three built-in reporters (stdout/json/markdown), the custom-reporter contract (default-export a `Reporter`; note this is also how to add Notion or Slack today), and the GitHub Action snippets from the spec. Keep it concise — mirror the spec's wording.

- [ ] **Step 6: Commit**

```bash
git add src/index.ts README.md
git commit -m "feat: add package entry, build config, and docs"
```

---

## Spec Coverage Check

| Spec requirement | Task(s) |
|---|---|
| Config schema `.tech-refactors.yml`, `--config` override | 2, 11 |
| Detection shapes: done+total, done+remaining, remaining+total, binary | 4 |
| "Command must print a non-negative integer" enforcement | 4 |
| Env var expansion for reporter config (`$VAR`), never stored | 2 |
| Raw shell commands, language-agnostic | 3 |
| Data model (`TaskResult`, `Report`, `Reporter`) | 1, 7–10 |
| `stdout` / `json` / `markdown` reporters | 7, 8, 9 |
| Custom reporters via JS/TS module | 10 |
| Cache `.refactor-tracker-cache.json` (gitignored), delta computation | 1, 5, 6 |
| `hasChanges` flag for reporter short-circuiting | 6 |
| CLI `--dry-run`, `--fail-on-regression` | 11 |
| GitHub Action usage | 12 (README) |
| Package structure + extractability (zero workspace imports, config-driven paths) | 1–12 (all deps general-purpose; all paths come from config) |

## Deferred / Out of scope

- **Notion reporter** — deferred to a future plan. Needs its own design: `database_id`, a configurable done-property name (the spec hardcodes `Réalisé`), and a row-matching strategy (the spec conflates the tracking `id` with the Notion page id). Until built-in, the **custom-reporter loader (Task 10)** is the supported path — ship a Notion reporter as a JS/TS module via `type: custom`.
- Claude Code hook integration (future).
- Structured detection presets, e.g. `type: grep` (future, once patterns emerge).
- `Objectif` sync — `total` is computed locally; Notion's `Objectif` stays human-managed.
- Multi-repo support.

## Open Question for the User

The spec's binary-detection **example** appears to invert the stated **rule** (table says "exits 0 = done", but the example exits 1 when the lib is upgraded). Task 4 implements the rule (exit 0 = done). Confirm this is the intended convention, or correct the spec example.
