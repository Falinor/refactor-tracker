# Contributing

Thanks for taking the time to contribute. This repo is a small pnpm workspace; everything below assumes you have **pnpm** and **Node 24** (the version CI runs).

## Setup

```bash
pnpm install
pnpm -r build
pnpm -r test
```

A husky `commit-msg` hook installs on `pnpm install` and enforces [Conventional Commits](https://www.conventionalcommits.org/) locally.

## Commit messages

Commits **must** follow Conventional Commits — checked by commitlint locally and in CI. The type drives the next release:

- `feat:` → minor bump
- `fix:` → patch bump
- `feat!:` or `BREAKING CHANGE:` footer → major bump
- `chore:` / `docs:` / `refactor:` / `test:` / `ci:` → no release

Examples:

```
feat(core): expose hasChanges on Report
fix(notion-reporter): retry transient 5xx from Notion API
docs: clarify cache file location
```

## Code style

Format and lint run through the [oxc](https://oxc.rs) toolchain:

```bash
pnpm format      # autoformat with oxfmt
pnpm lint        # oxlint (correctness rules as errors)
pnpm lint:fix    # autofix what's autofixable
```

A `lint-staged` config runs `oxfmt` then `oxlint --fix` on staged files. Don't fight it.

## Tests

Tests live in each package under `tests/`. Use `pnpm -r test` to run everything, or scope to a single file:

```bash
pnpm --filter refactor-tracker exec vitest run tests/engine.test.ts
pnpm --filter refactor-tracker exec vitest run -t "computes delta"
```

The core tests inject a fake `CommandRunner` and `now` — they never spawn real shells. New tests should follow that pattern; see `tests/engine.test.ts` and the `withTempDir` helper for cache-touching cases.

## Pull requests

- One concern per PR. Mixing a fix with a refactor makes review hard.
- Keep the diff focused — no drive-by formatting of unrelated files.
- Reference an issue if one exists; if not, a paragraph of "why" in the PR description is fine.
- CI must be green before merge.

## Releases

Pushes to `main` open or update a release-please PR per package. Merging that PR cuts the tag, the GitHub Release, and triggers `pnpm publish` to npm. You don't need to bump versions manually — commit types do it.
