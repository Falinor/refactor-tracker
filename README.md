# refactor-tracker

[![CI](https://github.com/Falinor/refactor-tracker/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Falinor/refactor-tracker/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-blue.svg?style=flat-square)](./LICENSE)

A language-agnostic CLI for tracking technical refactors over time. You declare what "done" looks like for each refactor as a **shell command that prints a count**; the tool runs the commands, diffs against the last run, and dispatches the report to pluggable outputs (stdout / Markdown / HTML / JSON / custom).

Detection is fully delegated to the shell: anything that prints a non-negative integer to stdout — `grep`, `ast-grep`, `ts-morph`, a custom script — is a valid detector. The tool itself never inspects code; it's a **number collector**.

## At a glance

Drop a `.tech-refactors.yml` at your repo root:

```yaml
reporters:
  - type: stdout
  - type: markdown
    output: docs/refactor-progress.md

refactors:
  - id: lazy-routes
    name: Lazy-load top-level routes
    detect:
      done: { command: "grep -rl 'React.lazy' frontend/src/views | wc -l" }
      total: { command: 'ls frontend/src/views | wc -l' }
```

Then run `pnpm dlx refactor-tracker` — locally, in CI on merge, or both. Each run:

1. **Detect** — execute the configured commands for every refactor and read counts from stdout. Each refactor provides any **two** of `done` / `remaining` / `total` (the third is computed), or `binary: true` for all-or-nothing checks.
2. **Diff** — compare the new counts against `.refactor-tracker-cache.json` (gitignored, lives next to the config) to compute a per-task `delta` and a global `hasChanges` flag, so reporters can skip noisy or expensive work when nothing moved.
3. **Report** — dispatch the report object to every configured reporter (built-in or custom).

Milestones (`registeredAt`, sticky `completedAt`) are persisted in `.refactor-tracker-state.json` next to the config. Unlike the cache, **commit this file** so milestones travel with the codebase.

## Data handling

The tool runs only the shell commands you configure, in the directory of your config file. It does not phone home, collect telemetry, or send your code anywhere. The only network calls it makes are the ones explicitly performed by reporters you opt into (e.g. the Notion reporter posting to the Notion API).

## Repository layout

This is a pnpm workspace; each package publishes independently via [release-please](https://github.com/googleapis/release-please) on merge to `main`.

| Package                                                  | Published as                       | Purpose                                                                  |
| -------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------ |
| [`packages/core`](./packages/core)                       | `refactor-tracker`                 | The CLI and library — config loader, engine, runner, built-in reporters. |
| [`packages/notion-reporter`](./packages/notion-reporter) | `refactor-tracker-notion-reporter` | Custom reporter that syncs each snapshot to a Notion database.           |

See each package's README for install, full configuration reference, and API details.

## Examples

Runnable migration scenarios live in [`examples/`](./examples) — each subfolder has a tiny TypeScript source tree, a `.tech-refactors.yml`, and a README explaining what's tracked:

- [TypeScript strict migration](./examples/ts-strict-migration) (`any` cleanup)
- [React class → hooks](./examples/class-to-hooks)
- [Moment → date-fns](./examples/moment-to-date-fns)
- [Redux → Zustand](./examples/redux-to-zustand)
- [CommonJS → ESM](./examples/commonjs-to-esm)
- [Mocha → Vitest](./examples/mocha-to-vitest)

`cd` into any of them and run `pnpm dlx refactor-tracker` to see real output.

## Contributing

Commits **must** follow [Conventional Commits](https://www.conventionalcommits.org/) — enforced locally by a husky `commit-msg` hook (commitlint) and in CI. The commit _type_ drives the next bump (`feat:` → minor, `fix:` → patch, `feat!:` or `BREAKING CHANGE` → major).

Common commands:

```bash
pnpm -r build         # build all packages
pnpm -r test          # run tests once
pnpm dev              # watch tests in the core package
pnpm lint             # oxlint
pnpm format           # oxfmt
```
