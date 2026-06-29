# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

This repo uses **pnpm**. ESM-only, Node 24 in CI.

| Task                | Command                                                               |
| ------------------- | --------------------------------------------------------------------- |
| Build all packages  | `pnpm -r build`                                                       |
| Run tests once      | `pnpm -r test`                                                        |
| Watch tests (core)  | `pnpm dev`                                                            |
| Single test file    | `pnpm --filter refactor-tracker exec vitest run tests/engine.test.ts` |
| Single test by name | `pnpm --filter refactor-tracker exec vitest run -t "computes delta"`  |
| Type-check only     | `pnpm --filter refactor-tracker exec tsc --noEmit`                    |
| Lint                | `pnpm lint` (oxlint) · `pnpm lint:fix` to autofix                     |
| Format              | `pnpm format` (oxfmt) · `pnpm format:check` to verify                 |

Lint/format are handled by the **oxc** toolchain: `oxlint` (config in `.oxlintrc.json` — `correctness` category as errors, with the `typescript`/`unicorn`/`oxc` plugins) and `oxfmt`. A `lint-staged` config runs `oxfmt` then `oxlint --fix` on staged JS/TS files.

The published `refactor-tracker` package ships only `packages/core/dist/`; the build emits ESM + `.d.ts` for both the CLI (`src/cli.ts`) and the library entry (`src/index.ts`).

## Architecture

The repo is a pnpm workspace. `packages/core/` is the published `refactor-tracker` CLI/library — the pipeline described below. Additional reporter packages can live as sibling workspace packages (e.g. a future `packages/notion-reporter/`) and are loaded via the `custom` reporter mechanism.

A language-agnostic CLI that runs shell **detection commands**, counts refactor progress, diffs against a cache, and dispatches to reporters. The tool is a _number collector_ — it never inspects code itself; any command that prints a non-negative integer (or, for `binary`, signals via exit code) is a valid detector.

Pipeline (one direction, each stage in its own file):

`cli.ts` → `config.ts` (`loadConfig`) → `engine.ts` (`runEngine`) → `detect.ts` (`resolveDetection`) → `runner.ts` (`runCommand`) → `cache.ts` diff → `types.ts` `Report` → `reporters/`

- **`config.ts`** — parses YAML (`js-yaml`) and validates with a Zod schema. `detect` is a union of `binary` vs. a counts shape requiring **at least two** of `done`/`remaining`/`total`. Reporter config is `looseObject` (only `type` is known here). `expandEnv` resolves values that are _exactly_ `$VAR` against `process.env` (missing var = hard error); applied only to reporter configs.
- **`engine.ts`** — orchestrates per-refactor detection, computes `percentage`, `delta` (vs cached `done`, `null` on first run), and a global `hasChanges`. Takes injectable `run` and `now` for tests; skips the cache write in `dryRun`.
- **`detect.ts`** — resolves the count shapes (the README table) and enforces the non-negative-integer contract on stdout.
- **`runner.ts`** — the only real side-effecting shell call: `execa(command, { shell: true, reject: false })`. `cwd` is the config file's directory.
- **`reporters/index.ts`** — factory mapping `type` → reporter. Built-ins: `stdout` (default when none configured), `json`, `markdown`, `html`. `custom` dynamically imports a module whose default export implements `Reporter`.
- **`index.ts`** — the public API surface, and it only re-exports types (`Report`, `TaskResult`, `Reporter`). Custom reporters import `Reporter` from here.
- **`commands/init.ts`** — the `init` command: scaffolds a `.refactor-tracker.yml` via `@clack/prompts` (non-TTY or `--yes` falls back to writing defaults). `renderConfig` (in `commands/init-template.ts`) is a pure template; `createInitCommand(version)` is a citty command. Because citty 0.2.2 runs a parent's `run` _even after_ a subcommand matches, `cli.ts` dispatches `init` as a **top-level command** (`argv[0] === 'init'`) rather than registering it under `main.subCommands`.

### Conventions that bite

- **Imports use `.js` extensions** on relative paths (NodeNext ESM), even though sources are `.ts`. Match this in new files.
- Tests inject a fake `CommandRunner` and `now`; they don't spawn real shells. Follow that pattern — see `tests/engine.test.ts` and its `withTempDir` helper for cache-touching tests.
- The cache file `.refactor-tracker-cache.json` lives next to the config and is gitignored.

## Commits & releases

Commits **must** follow Conventional Commits — enforced locally by a husky `commit-msg` hook (commitlint) and in CI. On push to `main`, the **release-please** GitHub Action opens or updates a "Release PR" containing per-package version bumps and CHANGELOG entries (independent versions, one tag and GitHub Release per package, tag format `<package>-v<version>`). Merging the Release PR triggers a CI step that runs `pnpm publish` for each released package. The commit _type_ drives the next bump (`feat:` → minor, `fix:` → patch, `feat!:` or `BREAKING CHANGE` → major; under `0.x.y`, `feat:` stays in the minor lane per `bump-minor-pre-major`).
