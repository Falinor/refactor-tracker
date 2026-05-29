# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

This repo uses **pnpm**. ESM-only, Node 24 in CI.

| Task | Command |
|---|---|
| Build (to `dist/`) | `pnpm build` (tsdown) |
| Run tests once | `pnpm test` (vitest run) |
| Watch tests | `pnpm dev` |
| Single test file | `pnpm exec vitest run tests/engine.test.ts` |
| Single test by name | `pnpm exec vitest run -t "computes delta"` |
| Type-check only | `pnpm exec tsc --noEmit` |

There is no linter configured. The package ships only `dist/`; the build emits ESM + `.d.ts` for both the CLI (`src/cli.ts`) and the library entry (`src/index.ts`).

## Architecture

A language-agnostic CLI that runs shell **detection commands**, counts refactor progress, diffs against a cache, and dispatches to reporters. The tool is a *number collector* — it never inspects code itself; any command that prints a non-negative integer (or, for `binary`, signals via exit code) is a valid detector.

Pipeline (one direction, each stage in its own file):

`cli.ts` → `config.ts` (`loadConfig`) → `engine.ts` (`runEngine`) → `detect.ts` (`resolveDetection`) → `runner.ts` (`runCommand`) → `cache.ts` diff → `types.ts` `Report` → `reporters/`

- **`config.ts`** — parses YAML (`js-yaml`) and validates with a Zod schema. `detect` is a union of `binary` vs. a counts shape requiring **at least two** of `done`/`remaining`/`total`. Reporter config is `looseObject` (only `type` is known here). `expandEnv` resolves values that are *exactly* `$VAR` against `process.env` (missing var = hard error); applied only to reporter configs.
- **`engine.ts`** — orchestrates per-refactor detection, computes `percentage`, `delta` (vs cached `done`, `null` on first run), and a global `hasChanges`. Takes injectable `run` and `now` for tests; skips the cache write in `dryRun`.
- **`detect.ts`** — resolves the count shapes (the README table) and enforces the non-negative-integer contract on stdout.
- **`runner.ts`** — the only real side-effecting shell call: `execa(command, { shell: true, reject: false })`. `cwd` is the config file's directory.
- **`reporters/index.ts`** — factory mapping `type` → reporter. Built-ins: `stdout` (default when none configured), `json`, `markdown`. `custom` dynamically imports a module whose default export implements `Reporter`.
- **`index.ts`** — the public API surface, and it only re-exports types (`Report`, `TaskResult`, `Reporter`). Custom reporters import `Reporter` from here.

### Conventions that bite

- **Imports use `.js` extensions** on relative paths (NodeNext ESM), even though sources are `.ts`. Match this in new files.
- Tests inject a fake `CommandRunner` and `now`; they don't spawn real shells. Follow that pattern — see `tests/engine.test.ts` and its `withTempDir` helper for cache-touching tests.
- The cache file `.refactor-tracker-cache.json` lives next to the config and is gitignored.

## Commits & releases

Commits **must** follow Conventional Commits — enforced locally by a husky `commit-msg` hook (commitlint) and in CI. `main` runs `semantic-release` on push (version bump, CHANGELOG, npm + GitHub release), so the commit type drives the next published version.
