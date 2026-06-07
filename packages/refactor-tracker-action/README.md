# refactor-tracker-action

[![CI](https://github.com/Falinor/refactor-tracker/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Falinor/refactor-tracker/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-blue.svg?style=flat-square)](../../LICENSE)

GitHub Action wrapper for [`refactor-tracker`](https://www.npmjs.com/package/refactor-tracker). Runs detections in CI, persists the cache between runs, and posts a sticky PR comment with the delta.

## Quick start

```yaml
name: refactor-tracker

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read
  pull-requests: write # required only if comment-on-pr is true (default)

jobs:
  refactor-tracker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: Falinor/refactor-tracker/packages/refactor-tracker-action@v1
```

That's the whole batteries-included setup:

- Detections run on every push and PR.
- The cache file (`.refactor-tracker-cache.json`) is restored from the default branch's last successful run, so PR deltas are measured against `main` — not against the previous PR push.
- On `push` to the default branch, the cache is saved for future runs.
- On `pull_request`, a sticky comment is posted (or updated on subsequent pushes) with the per-task delta.

## Inputs

| Input                | Default               | Description                                                                                   |
| -------------------- | --------------------- | --------------------------------------------------------------------------------------------- |
| `config-path`        | `.tech-refactors.yml` | Path to the refactor-tracker config, relative to `working-directory`.                         |
| `working-directory`  | `.`                   | Directory to run from. Useful for monorepos where the config lives in a subdirectory.         |
| `fail-on-regression` | `false`               | Fail the step if any tracked metric decreased vs the baseline.                                |
| `comment-on-pr`      | `true`                | Post (and update) a sticky comment on the PR with the delta. Requires `pull-requests: write`. |
| `cache-strategy`     | `actions-cache`       | How to persist the cache between runs. One of: `actions-cache` \| `none`.                     |
| `github-token`       | `${{ github.token }}` | Token used to post comments. The default workflow token is enough for most cases.             |

## Outputs

| Output        | Description                                                                |
| ------------- | -------------------------------------------------------------------------- |
| `delta`       | Sum of per-task deltas across all tracked refactors (positive = progress). |
| `total`       | Total number of tracked refactors.                                         |
| `has-changes` | `"true"` if any task moved since the baseline, `"false"` otherwise.        |
| `report-json` | The full `Report` serialized as a JSON string.                             |

Example consuming the outputs:

```yaml
- id: rt
  uses: Falinor/refactor-tracker/packages/refactor-tracker-action@v1

- name: Slack on regression
  if: steps.rt.outputs.delta < 0
  run: ./scripts/notify-slack.sh "${{ steps.rt.outputs.delta }}"
```

## Cache strategy

The action's default (`actions-cache`) uses [`@actions/cache`](https://github.com/actions/toolkit/tree/main/packages/cache) under the hood with a key pinned to the default branch:

- **PR runs** restore the cache that the most recent `main` build produced, so deltas are measured against `main`.
- **`push` to default branch** saves the cache for future runs.
- Other events restore but never save — the baseline remains stable.

If the cache is evicted (no run on `main` in the last 7 days, or repository cache eviction), the next run starts from a null baseline and reports `delta: null` for every task. This is benign — the run still completes and the next `main` push re-seeds the cache.

Set `cache-strategy: none` to opt out entirely (e.g. if you wire `actions/cache@v4` yourself or pull the cache file from another source).

## Versioning

This action lives under `packages/refactor-tracker-action/` inside the `refactor-tracker` monorepo. Reference it via the repository path:

```yaml
uses: Falinor/refactor-tracker/packages/refactor-tracker-action@v1
```

A `v1` tag tracks the latest 1.x release; pin to a specific tag (`@v1.0.0`) for reproducible builds.

## What runs under the hood

The action shells out to `npx --yes refactor-tracker --config <path> --report-output <tmpfile>`. That means the CLI version it uses is whatever `npx` resolves at runtime — usually the latest published. To pin a specific version, install it as a step beforehand:

```yaml
- run: npm install -g refactor-tracker@0.4.0
- uses: Falinor/refactor-tracker/packages/refactor-tracker-action@v1
```

`refactor-tracker@0.4.0` (or later) is required — it's the first version to expose the `--report-output` flag the action relies on.

## Permissions

For the default configuration (`comment-on-pr: true`), the job needs:

```yaml
permissions:
  contents: read
  pull-requests: write
```

Drop `pull-requests: write` if you set `comment-on-pr: false`.
