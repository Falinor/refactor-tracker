# refactor-tracker

A language-agnostic CLI that runs configurable **shell detection commands**, counts progress for each tracked refactor, and reports deltas to pluggable outputs. Designed to run in CI (on merge) and locally on demand.

The tool is a **number collector and reporter**. Detection is fully delegated to the shell: a command must print a non-negative integer to stdout — what produces that number (grep, ast-grep, ts-morph, a custom script, …) is up to you.

## Install

```bash
pnpm add -D refactor-tracker
# or run ad hoc
pnpm dlx refactor-tracker
```

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

## Reporters

| Reporter   | Output                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------- |
| `stdout`   | Progress table to the terminal (default when no reporters are configured)                   |
| `json`     | The full report object to a file (`output: <path>` required)                                |
| `markdown` | A progress table to a `.md` file (`output: <path>` required)                                |
| `html`     | A self-contained HTML page with progress bars to a `.html` file (`output: <path>` required) |
| `custom`   | Your own module (`path: <path>`) — the extension point for Slack, Linear, Notion, etc.      |

### Custom reporters

Default-export an object implementing `Reporter`:

```ts
// reporters/slack.ts
import type { Reporter } from 'refactor-tracker';

const reporter: Reporter = {
  async report(report) {
    // report.tasks: { id, name, done, total, percentage, delta }[]
    // report.hasChanges: skip expensive work when nothing changed
  },
};

export default reporter;
```

```yaml
reporters:
  - type: custom
    path: ./reporters/slack.ts
```

## How it works

Each run compares current counts against `.refactor-tracker-cache.json` (gitignored) to compute per-task `delta` and a global `hasChanges` flag, so reporters can skip noisy or expensive work when nothing moved. The cache is not updated in `--dry-run` mode.

## Roadmap

- **List remaining cases per refactor** — surface the actual items left to migrate (file paths, symbols, …), not just the count, so you can see what's left without re-running ad-hoc greps. Likely shape: an optional `list` command alongside `done`/`remaining`/`total` that prints one case per line; reporters render it as a collapsible section.
