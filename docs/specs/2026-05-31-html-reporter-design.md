# HTML Reporter — Design Spec

**Date:** 2026-05-31
**Status:** Approved

---

## Problem

The current reporters cover plain text (`stdout`), structured data (`json`), and rendered documents (`markdown`). None of them produce a viewer-friendly artifact you can open in a browser or commit as a CI asset. A markdown table can show counts and percentages, but it cannot show progress bars or color-code laggards — the things that make refactor progress legible at a glance.

## Goal

Add a fourth built-in reporter, `html`, that writes a single self-contained `.html` file: header, overall summary, and one card per refactor with a horizontal progress bar colored by completion. No external assets, no JavaScript, no server — the file works opened directly from disk or served as a CI artifact.

## Non-Goals

- Dark mode (`prefers-color-scheme`) — easy follow-up if requested
- Any client-side JS (sort, filter, live refresh)
- External CSS, JS, fonts, or icons
- Per-task drill-down, history, or sparklines
- Streaming / partial output

## Config

```yaml
reporters:
  - type: html
    output: docs/progress.html
```

Shape mirrors `markdown` and `json`. No schema change: `reporterSchema` is `z.looseObject({ type })` in `src/config.ts:30` and `output` is read directly by the factory at `src/reporters/index.ts:17`.

## Public Surface

`src/reporters/html.ts` exports two symbols:

```ts
export function formatHtml(report: Report): string;

export class HtmlReporter implements Reporter {
  constructor(private readonly output: string) {}
  async report(report: Report): Promise<void>;
}
```

`HtmlReporter.report` calls `mkdir(path.dirname(output), { recursive: true })` then `writeFile(output, formatHtml(report), 'utf8')` — same shape as `MarkdownReporter` at `src/reporters/markdown.ts:19`.

The factory in `src/reporters/index.ts` gains:

```ts
case 'html':
  reporters.push(new HtmlReporter(config.output as string));
  break;
```

`src/index.ts` is unchanged: it only re-exports types, and `Report` / `TaskResult` / `Reporter` already cover what custom reporters need.

## Template Engine

`eta` (`/eta-dev/eta`, current major) as a new runtime dependency.

Note: eta's `<% %>` and `<%= %>` blocks run at template-compile / render time on the Node side; they don't leak into the output. The emitted `.html` file contains no `<script>` tag — "no client-side JS" still holds.

The template is **inlined as a `const TEMPLATE` string constant inside `html.ts`** — not shipped as a separate `.eta` asset. Rationale: `tsdown` emits ESM + `.d.ts` only; adding an asset-copy step for one template is more brittle integration than the value warrants. Inlining keeps the build pipeline untouched.

Compile once at module load:

```ts
import { Eta } from 'eta';
const eta = new Eta({ autoEscape: true, useWith: false });
const render = eta.compile(TEMPLATE);
```

`formatHtml(report)` calls `render.call(eta, viewModel)`. Default `<%= %>` interpolation auto-escapes via eta's built-in HTML escape, so we never hand-roll escaping. `<%~ %>` (raw) is not used anywhere in the template.

## View Model

`formatHtml` builds a view model first, then renders. The template stays logic-less; the view model is what we unit-test.

```ts
interface HtmlView {
  timestamp: string;
  grandDone: number;
  grandTotal: number;
  overallPercentage: number; // rounded
  overallBarColor: string; // hsl(...)
  tasks: HtmlTaskView[];
}

interface HtmlTaskView {
  name: string;
  done: number;
  total: number;
  percentage: number;
  barColor: string; // hsl(...)
  delta: { text: string; kind: 'up' | 'down' } | null;
}
```

Rules:

- `grandDone = sum(tasks.done)`, `grandTotal = sum(tasks.total)`.
- `overallPercentage = grandTotal === 0 ? 0 : Math.round((grandDone / grandTotal) * 100)`.
- `barColor(p) = \`hsl(${Math.round(p \* 1.2)}, 65%, 45%)\`` — 0% red, ~50% yellow, 100% green. Applied to both the overall bar and per-task bars.
- `delta`:
  - `null` (first run) → `null` (no chip)
  - `0` → `null` (no chip — unchanged rows stay quiet)
  - `> 0` → `{ text: '+N', kind: 'up' }`
  - `< 0` → `{ text: '−N', kind: 'down' }` (uses U+2212 minus, not hyphen)

## HTML / CSS Design

The rendered document:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Refactor progress</title>
    <style>
      /* inline CSS, see below */
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>Refactor progress</h1>
        <time><%= it.timestamp %></time>
      </header>

      <section class="summary">
        <div class="summary-head">
          <span class="label">Overall</span>
          <span class="counts"><%= it.grandDone %> / <%= it.grandTotal %></span>
          <span class="pct"><%= it.overallPercentage %>%</span>
        </div>
        <div class="bar">
          <div
            class="bar-fill"
            style="width: <%= it.overallPercentage %>%; background: <%= it.overallBarColor %>"
          ></div>
        </div>
      </section>

      <ul class="refactors">
        <% it.tasks.forEach(function (task) { %>
        <li class="refactor">
          <div class="head">
            <span class="name"><%= task.name %></span>
            <span class="counts"><%= task.done %> / <%= task.total %></span>
            <span class="pct"><%= task.percentage %>%</span>
            <% if (task.delta) { %>
            <span class="delta delta-<%= task.delta.kind %>"><%= task.delta.text %></span>
            <% } %>
          </div>
          <div class="bar">
            <div
              class="bar-fill"
              style="width: <%= task.percentage %>%; background: <%= task.barColor %>"
            ></div>
          </div>
        </li>
        <% }) %>
      </ul>
    </main>
  </body>
</html>
```

Inline CSS (sketch — exact values may be tuned during implementation):

- System font stack (`-apple-system, system-ui, ...`)
- `main` max-width ~860px, centered, generous padding
- `.summary` card visually distinct (slightly thicker border or background tint) so it reads as the headline
- `.refactors` is a `<ul>` with `list-style: none`; each `.refactor` is a card with border, rounded corners, padding
- `.head` is `display: flex; gap: ...` aligning name / counts / pct / delta on one row
- `.bar` is `height: 10px; background: #eee; border-radius: 5px; overflow: hidden`
- `.bar-fill` is `height: 100%; transition: none` (no animation)
- `.delta-up` green pill, `.delta-down` red pill

## Escaping & Safety

- All user-supplied strings reach the template through default `<%= %>` interpolation, which eta auto-escapes (`autoEscape: true`).
- The only user-supplied string is `task.name` (from YAML config).
- `barColor` is a string we construct ourselves from a numeric percentage — safe to inject into the `style=` attribute. Same for the numeric `width` value.
- No `<%~ %>` raw interpolation anywhere in the template.

## Tests

`tests/reporters/html.test.ts`, mirroring `tests/reporters/markdown.test.ts`:

1. **`formatHtml` unit tests** (no temp dir needed):
   - Renders the title and timestamp.
   - Renders one `.refactor` card per task, with name, counts, and percentage.
   - Omits the delta chip when `delta` is `null` or `0`.
   - Renders `delta-up` chip with `+N` when `delta > 0`.
   - Renders `delta-down` chip with `−N` (U+2212) when `delta < 0`.
   - Computes overall percentage from summed counts.
   - Escapes a task name containing `<` and `&`.
2. **`HtmlReporter` integration test**:
   - Writes to a temp dir, creating parent directories (uses the `mkdtemp` / `rm` pattern from `markdown.test.ts`).
   - Output file contains the rendered HTML.

`tests/reporters/index.test.ts` gains an assertion that `{ type: 'html', output }` produces an `HtmlReporter`.

## Docs / Packaging

- `README.md` reporters table (around line 89) gets a fourth row: `` `html` | A self-contained HTML page with progress bars to a `.html` file (`output: <path>` required) ``.
- `package.json` `dependencies`: add `eta` (latest 3.x).
- No `tsdown` config changes — template is inlined.
- No change to `src/index.ts`; the existing `Reporter` / `Report` / `TaskResult` re-exports still cover custom-reporter consumers.

## Files Touched

| File                            | Change                                                                  |
| ------------------------------- | ----------------------------------------------------------------------- |
| `src/reporters/html.ts`         | New: `formatHtml`, `HtmlReporter`, inline `TEMPLATE`, compiled `render` |
| `src/reporters/index.ts`        | New `case 'html':` arm in the factory switch                            |
| `tests/reporters/html.test.ts`  | New: unit + integration tests                                           |
| `tests/reporters/index.test.ts` | Assert `html` config produces `HtmlReporter`                            |
| `README.md`                     | Add `html` row to the reporters table                                   |
| `package.json`                  | Add `eta` to `dependencies`                                             |
