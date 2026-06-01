# Tags on refactors — design

Status: approved
Date: 2026-06-01

## Goal

Let users attach **tags** to refactors so they can:

1. **Group** refactors in reports (stdout / markdown / html) by tag.
2. **Filter** which refactors run from the CLI via `--tag <name>`.

Tags also flow through to the JSON report as plain metadata for custom reporters (Slack, Linear, …) to use however they want.

## Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Cardinality | Multiple tags per refactor: `tags: [string]` |
| Tag presence | Optional; missing or empty array = untagged |
| Multi-tag rendering | Refactor appears in **every** group it's tagged with |
| `--tag` repeated | OR semantics (passes if any requested tag matches) |
| Untagged refactors | Render under a trailing "Untagged" group; group omitted if empty |
| Group trigger | Always on when at least one refactor has a tag |
| JSON reporter | No grouping; just exposes `tags` per task |
| Tag normalization | None (case-sensitive, no whitespace trimming) |

## Schema

`src/config.ts` — add an optional `tags` array to `refactorSchema`:

```ts
const refactorSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  detect: detectSchema,
});
```

Example config:

```yaml
refactors:
  - id: lazy-routes
    name: Lazy-load top-level routes
    tags: [frontend, performance]
    detect: { ... }

  - id: upgrade-somelib
    name: Upgrade somelib to v3
    # no tags → "Untagged" group
    detect: { ... }
```

## Types

`src/types.ts` — add `tags?: string[]` to `TaskResult`:

```ts
export interface TaskResult {
  id: string;
  name: string;
  description?: string;
  tags?: string[];     // present iff non-empty
  done: number;
  total: number;
  percentage: number;
  delta: number | null;
}
```

`Report` is unchanged. `tags` propagates into JSON automatically.

## Engine

`src/engine.ts` — accept an optional `tagFilter`:

```ts
export interface EngineOptions {
  // ...existing...
  tagFilter?: string[];
}
```

- If `tagFilter` is set and non-empty, drop any refactor whose `tags` does **not** intersect the filter set **before** running detection. This avoids wasted shell calls.
- Pass `tags` through into `TaskResult` when non-empty; omit the field otherwise.
- If `tagFilter` matches zero refactors, throw a clear error from the engine (caught in CLI for a non-zero exit). Silent empty reports are surprising.

## CLI

`src/cli.ts` — add a repeatable `--tag <name>` flag:

- cac syntax: `cli.option('--tag <name>', 'Filter refactors by tag (repeatable; OR semantics)')` collected into an array.
- Pass the collected array (or `undefined` when none given) to the engine as `tagFilter`.
- Compatible with `--dry-run` and `--fail-on-regression`.

## Grouping helper

New file `src/grouping.ts`:

```ts
import type { TaskResult } from './types.js';

export interface TaskGroup {
  tag: string | null;          // null === the "Untagged" group
  tasks: TaskResult[];
}

export function groupTasksByTag(tasks: TaskResult[]): TaskGroup[];
```

Behavior:

- Iterate `tasks` once in order. For each tag seen, push the task onto that tag's group (creating the group on first sight). A task with N tags lands in N groups.
- Tasks with no tags accumulate into a trailing `{ tag: null, tasks: [...] }` group.
- Group order = first-seen tag order from the input. "Untagged" group is always last.
- If **no** task has any tag, return a single `{ tag: null, tasks }` group — reporters treat this as the "flat" signal.

Reporters detect "flat" by checking `groups.length === 1 && groups[0].tag === null` (the helper only emits a lone untagged group when no tag was ever seen). When flat, render exactly as today (no group heading).

## Reporter changes

| Reporter | Change |
|---|---|
| `stdout` | One table per group, group title above each. Flat case unchanged. |
| `markdown` | One `##` heading + table per group. Flat case unchanged. |
| `html` | One `<section>` per group with `<h2>` heading; existing card/progress markup reused inside. Layout otherwise unchanged. |
| `json` | No grouping. Adds `tags` per task (already covered by the type change). |

The "Untagged" group renders with the literal heading "Untagged".

## Documentation

README gets a short **Tagging** section with:

- The `tags:` field on a refactor (one YAML example).
- The `--tag` flag and a note about OR semantics for repetition.
- One sentence about grouped output and the "Untagged" group.

## Testing

Following the existing pattern (Vitest, fake `CommandRunner`, `withTempDir` for cache-touching tests):

- `tests/config.test.ts` — schema accepts `tags`, rejects non-string-array values.
- `tests/engine.test.ts` — `tagFilter` OR-matches; non-matching filter throws; `tags` pass through into `TaskResult`.
- `tests/grouping.test.ts` *(new)* — first-seen ordering; multi-tag duplication; untagged-last; all-untagged collapses to flat.
- `tests/reporters/*.test.ts` — grouped output for stdout/markdown/html; JSON includes `tags`.

## Out of scope (YAGNI)

- AND-mode filter, glob filter, `--exclude-tag`.
- Tag colors / chips / icons.
- Per-tag thresholds or success criteria.
- Tag normalization (case-folding, trimming).
- Grouping in JSON reporter.
