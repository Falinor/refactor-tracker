# refactor-tracker

A language-agnostic CLI that runs configurable **shell detection commands**, counts progress for each tracked refactor, and reports deltas to pluggable outputs. Designed to run in CI (on merge) and locally on demand.

The tool is a **number collector and reporter**. Detection is fully delegated to the shell: a command must print a non-negative integer to stdout — what produces that number (grep, ast-grep, ts-morph, a custom script, …) is up to you.

## Install

```bash
pnpm add -D refactor-tracker
# or run ad hoc
pnpm dlx refactor-tracker
```

Published from a pnpm workspace at `packages/core/`; downstream consumers `npm install refactor-tracker` as before.

## Configuration

Create `.tech-refactors.yml` at your repo root (override with `--config <path>`):

```yaml
reporters:
  - type: stdout
  - type: markdown
    output: docs/refactor-progress.md
  - type: json
    output: .refactor-report.json

refactors:
  - id: lazy-routes
    name: Importer dynamiquement les routes
    description: Lazy-load top-level route views to cut the initial JS bundle
    detect:
      done:
        command: "grep -rl 'React.lazy' frontend/src/views | wc -l | tr -d ' '"
      total:
        command: "ls frontend/src/views | wc -l | tr -d ' '"

  - id: react-hook-form
    name: Replace custom useForm with react-hook-form
    detect:
      done:
        command: "grep -rl 'react-hook-form' frontend/src | wc -l | tr -d ' '"
      remaining:
        command: "grep -rl 'hooks/useForm' frontend/src | wc -l | tr -d ' '"

  - id: upgrade-somelib
    name: Upgrade somelib to v3
    detect:
      command: 'node -e "process.exit(require(''./package.json'').dependencies.somelib.startsWith(''3'') ? 0 : 1)"'
      binary: true
```

### Detection shapes

Provide any **two** of `done` / `remaining` / `total` and the third is computed:

| Fields provided       | Computed                                                     |
| --------------------- | ------------------------------------------------------------ |
| `done` + `total`      | `remaining = total − done`                                   |
| `done` + `remaining`  | `total = done + remaining`                                   |
| `remaining` + `total` | `done = total − remaining`                                   |
| `binary: true`        | `total = 1`, `done = 1` if the command **exits 0**, else `0` |

Each `command` must print a non-negative integer to stdout (binary commands signal via exit code instead).

An optional `description` field gives a one-line context blurb. It flows through to the JSON output, renders as a subtitle in the HTML reporter, and adds a `Description` column to the markdown reporter (the column is omitted entirely when no refactor has one). The stdout reporter ignores it.

#### Listing remaining items

Optionally attach a `list` command alongside the counts to surface the actual items left to migrate (file paths, symbols, …) — one per line on stdout:

```yaml
refactors:
  - id: lazy-routes
    name: Lazy-load top-level routes
    detect:
      done: { command: "grep -rl 'React.lazy' frontend/src/views | wc -l" }
      total: { command: 'ls frontend/src/views | wc -l' }
      list:
        {
          command: "comm -23 <(ls frontend/src/views | sort) <(grep -rl 'React.lazy' frontend/src/views | xargs -n1 basename | sort)",
        }
```

The list command only runs when `remaining > 0`. Markdown and HTML reporters render the items in a collapsible `<details>` block per refactor; the JSON reporter serializes them as `items: string[]`; the stdout reporter ignores them. The list is not allowed with `binary: true`.

Reporter `output` paths are resolved against the config file's directory, so relative paths Just Work regardless of where the CLI is invoked from. Absolute paths are used as-is.

Reporter config values that are exactly `$VAR` (e.g. `token: $MY_TOKEN`) are expanded from the environment at runtime and never stored. A missing variable is a hard error.

## CLI

```
refactor-tracker [options]

  -c, --config <path>     Path to config file (default: .tech-refactors.yml)
  --dry-run               Run detections and print the report as JSON; do not invoke reporters
  --fail-on-regression    Exit 1 if any task's done count decreased vs the cache
```

### GitHub Action

```yaml
- name: Sync refactor progress
  run: pnpm dlx refactor-tracker

# Regression guard on PRs
- name: Check for regressions
  run: pnpm dlx refactor-tracker --fail-on-regression --dry-run
```

## Tagging

Attach **tags** to any refactor to group reports and filter from the CLI:

```yaml
refactors:
  - id: lazy-routes
    name: Lazy-load top-level routes
    tags: [frontend, performance]
    detect: { ... }
```

Tags are optional and a refactor may carry any number of them. When any refactor has a tag, `stdout`, `markdown`, and `html` reporters render one section per tag (a refactor with N tags appears in N sections). Untagged refactors fall into a trailing `Untagged` group; the group is omitted when every refactor has at least one tag.

Filter with `--tag` (repeatable, OR semantics):

```bash
refactor-tracker --tag frontend
refactor-tracker --tag frontend --tag performance   # any refactor with frontend OR performance
refactor-tracker --tag=frontend                     # = form also accepted
```

Skipped refactors keep their cache entries from previous runs, so partial runs don't break `--fail-on-regression` on the next full run.

## Milestones

Each refactor carries two timestamps:

- `registeredAt` — when the tracker first saw the refactor.
- `completedAt` — the first run that observed 100% progress. **Sticky**: it is never cleared, even if the count regresses afterwards.

Milestones live in `.refactor-tracker-state.json` next to your config. Unlike the cache, **this file should be committed** so milestones travel with the codebase and are available in CI.

### Backfilling `registeredAt`

For refactors that predate adopting the tracker, set `registeredAt` in the YAML and it will win over whatever is in the state file:

```yaml
refactors:
  - id: migrate-to-typescript
    name: Migrate to TypeScript
    registeredAt: 2026-03-12 # ISO date or full timestamp
    detect: ...
```

### Flags

- `--show-completed` — include refactors that have already reached 100% (hidden by default).
- `--sort-by registered|completed|progress` — sort tasks by milestone or progress. Default is config order. `registered` is ascending (oldest first), `completed` is descending (most recent first), `progress` is ascending (least done first). Refactors with no value for the chosen key sort last.

These are presentation concerns: they apply to `stdout`, `markdown`, `html`, and `custom` reporters. The `json` reporter always emits the full unfiltered, unsorted dataset.

## Reporters

| Reporter   | Output                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------- |
| `stdout`   | Progress table to the terminal (default when no reporters are configured)                   |
| `json`     | The full report object to a file (`output: <path>` required)                                |
| `markdown` | A progress table to a `.md` file (`output: <path>` required)                                |
| `html`     | A self-contained HTML page with progress bars to a `.html` file (`output: <path>` required) |
| `custom`   | Your own module — file path or npm package; extension point for Slack, Linear, Notion, etc. |

### Custom reporters

A `custom` reporter loads an external module and uses it as a `Reporter` implementation. Reference it by either a relative file path or an npm module specifier:

```yaml
reporters:
  # Local file
  - type: custom
    path: ./reporters/slack.mjs

  # npm package
  - type: custom
    module: refactor-tracker-notion-reporter
    token: $NOTION_TOKEN
    databaseId: 1a2b3c4d-...
    dataSourceId: 0a1b2c3d-...
```

Exactly one of `path` or `module` is required. If the module's default export is a **function**, it's called as a factory with the reporter config (minus `type`, `module`, and `path`) and must return a `Reporter`. Otherwise the default export is used directly as the `Reporter`:

```ts
import type { Reporter } from 'refactor-tracker';

// Shape A — default-export an instance:
const reporter: Reporter = {
  async report(report) {
    // report.tasks: { id, name, done, total, percentage, delta, ... }[]
    // report.hasChanges: skip expensive work when nothing changed
  },
};
export default reporter;

// Shape B — default-export a factory that receives the config block:
export default function createReporter(config: { token: string }): Reporter {
  return {
    async report(report) {
      /* … */
    },
  };
}
```

`$VAR` references in any reporter field are expanded against `process.env` (missing variables are a hard error).

### Notion

To sync each snapshot to a Notion database (donut, per-task progress bars, table on a private team page), install [`refactor-tracker-notion-reporter`](./packages/notion-reporter/README.md) and wire it as a custom reporter:

```yaml
reporters:
  - type: custom
    module: refactor-tracker-notion-reporter
    token: $NOTION_TOKEN
    databaseId: 1a2b3c4d-...
    dataSourceId: 0a1b2c3d-...
```

See the package README for the one-time Notion setup (integration, database schema, page layout, where to find both IDs).

## How it works

Each run compares current counts against `.refactor-tracker-cache.json` (gitignored) to compute per-task `delta` and a global `hasChanges` flag, so reporters can skip noisy or expensive work when nothing moved. The cache is not updated in `--dry-run` mode.

## Roadmap

_No items currently on the roadmap._
