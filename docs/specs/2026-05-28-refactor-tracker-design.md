# refactor-tracker — Design Spec

**Date:** 2026-05-28  
**Status:** Approved

---

## Problem

Technical refactors are tracked manually in a Notion table (`Progression des tâches techniques`). The `Réalisé` (done) count is updated by hand — tedious, error-prone, and frequently out of sync with the actual codebase state.

---

## Goal

A CLI tool that:
1. Runs configurable detection commands against the codebase
2. Counts progress for each tracked refactor
3. Reports results to one or more configurable outputs (Notion, markdown, stdout, JSON, …)

Designed to run in CI (GitHub Action on merge) and locally on demand.

---

## Core Design Principle

> The tool is a **number collector and reporter**. Detection is fully delegated — a shell command must print a non-negative integer to stdout. What produces that number is none of the tool's business.

This keeps the tool language-agnostic. TypeScript, Python, Go, Ruby — all supported via the shell. Complex detection (AST analysis, type checking) is delegated to specialized tools (`ast-grep`, `ts-morph`, `semgrep`, etc.) called from the shell command.

---

## Architecture

```
.tech-refactors.yml
       │
       ▼
   [ Engine ]      reads config → runs detect commands → produces Report
       │
       ▼
 [ Reporters ]     stdout · json · markdown · notion · custom
```

The engine compares the current `Report` against a local cache to compute deltas. Reporters that would be noisy or expensive (e.g. Notion) only fire when something changed.

---

## Config Schema

A single `.tech-refactors.yml` at the repo root (path overridable via `--config` flag).

```yaml
reporters:
  - type: stdout
  - type: notion
    token: $NOTION_TOKEN
    database_id: 2099ec2a-056c-80a7-91c2-000bce44006a
  - type: markdown
    output: docs/refactor-progress.md

refactors:
  - id: 2559ec2a-056c-800c-a767-f23682a3603e
    name: Importer dynamiquement les routes
    detect:
      done:
        command: "grep -rl 'React.lazy' frontend/src/views | wc -l | tr -d ' '"
      total:
        command: "ls frontend/src/views | wc -l | tr -d ' '"

  - id: xxxx-yyyy
    name: Replace custom useForm with react-hook-form
    detect:
      done:
        command: "grep -rl 'react-hook-form' frontend/src | grep -v 'hooks/useForm' | wc -l"
      remaining:
        command: "grep -rl 'from.*hooks/useForm' frontend/src | wc -l"
      # total = done + remaining (computed automatically)

  - id: zzzz-wwww
    name: Upgrade somelib to v3
    detect:
      command: "node -e \"process.exit(require('./package.json').dependencies.somelib.startsWith('3') ? 1 : 0)\""
      binary: true
      # total = 1, done = 0 or 1
```

### Detection shapes

Any two of `done`, `remaining`, `total` determine the third:

| Fields provided | Computed |
|---|---|
| `done` + `total` | `remaining = total - done` |
| `done` + `remaining` | `total = done + remaining` |
| `remaining` + `total` | `done = total - remaining` |
| `binary: true` | `total = 1`, `done = 0 or 1` (command exits 0 = done) |

Each field is a shell command that **must print a non-negative integer to stdout**. The tool does not interpret the command — it only reads the output.

Env var references in reporter config (e.g. `$NOTION_TOKEN`) are expanded at runtime and never stored.

### Why raw shell commands

No custom DSL, no lock-in to a specific search tool. Users choose the right tool for their codebase:
- Simple pattern counts → `grep`, `ripgrep`
- AST-aware detection → `ast-grep`, `semgrep`
- TypeScript type analysis → `ts-morph` script
- Anything else → any script that prints a number

Structured presets (e.g. `type: grep`, `type: ast-grep`) are a future enhancement once common patterns emerge from real usage.

---

## Data Model

```typescript
interface TaskResult {
  id: string;
  name: string;
  done: number;
  total: number;
  percentage: number;      // 0–100, rounded
  delta: number | null;    // change in `done` vs previous run; null on first run
}

interface Report {
  tasks: TaskResult[];
  timestamp: string;       // ISO-8601
  hasChanges: boolean;
}

interface Reporter {
  report(report: Report): Promise<void>;
}
```

---

## Reporters

### Built-in

| Reporter | Output | Notes |
|---|---|---|
| `stdout` | Progress table to terminal | Default; always active if no reporters configured |
| `json` | `Report` object to a file | `output: path` required |
| `markdown` | Progress table to a `.md` file | `output: path` required |
| `notion` | Updates `Réalisé` on each Notion page | Only fires when `hasChanges = true`; never touches `Objectif` |

The Notion reporter uses `id` as the Notion page ID and only updates `Réalisé`. `Objectif` remains under human control in Notion.

### Custom reporters

A JS/TS module exporting a default `Reporter` implementation:

```yaml
- type: custom
  path: ./reporters/slack.js
```

This is the extension point for integrations not shipped with the package (Slack, Linear, GitHub PR comment, etc.).

---

## Cache

`.refactor-tracker-cache.json` (gitignored) — stores the last known counts per task ID:

```json
{
  "2559ec2a-...": { "done": 4, "total": 11, "timestamp": "2026-05-28T10:00:00Z" },
  "xxxx-yyyy":    { "done": 7, "total": 9,  "timestamp": "2026-05-28T10:00:00Z" }
}
```

Used to compute `delta` and to skip expensive reporters when nothing changed.

---

## CLI

```bash
refactor-tracker [options]

Options:
  --config <path>       Path to config file (default: .tech-refactors.yml)
  --dry-run             Run detections and print what would be reported; do not call reporters
  --fail-on-regression  Exit 1 if any task's done count decreased vs cache
```

### GitHub Action usage

```yaml
- name: Sync refactor progress
  run: npx refactor-tracker
  env:
    NOTION_TOKEN: ${{ secrets.NOTION_TOKEN }}
```

```yaml
# Regression guard on PRs
- name: Check for regressions
  run: npx refactor-tracker --fail-on-regression --dry-run
```

---

## Package Structure

```
packages/refactor-tracker/      # or root of extracted repo
├── src/
│   ├── cli.ts                  # entry point, arg parsing
│   ├── engine.ts               # runs detect commands, produces Report
│   ├── config.ts               # parses + validates config (zod)
│   ├── cache.ts                # reads/writes cache file
│   └── reporters/
│       ├── index.ts            # Reporter interface + registry
│       ├── stdout.ts
│       ├── json.ts
│       ├── markdown.ts
│       └── notion.ts
├── package.json
├── tsconfig.json
└── README.md
```

**Extractability constraints:**
- Zero imports from other workspace packages
- No assumptions about repo layout — all paths come from config
- All dependencies are general-purpose: `zod`, `js-yaml`, `@notionhq/client`, `execa`
- `package.json` name is the only thing to change on extraction

---

## Out of scope

- Claude Code hook integration (future)
- Structured detection presets (future, once patterns emerge)
- `Objectif` sync — `total` is computed locally; Notion's `Objectif` is human-managed
- Multi-repo support
