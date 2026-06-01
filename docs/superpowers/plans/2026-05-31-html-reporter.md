# HTML Reporter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fourth built-in reporter, `html`, that writes a self-contained `.html` file with one progress bar per refactor, an overall summary, and color-by-completion.

**Architecture:** A new `src/reporters/html.ts` exports `formatHtml(report)` (pure) and `class HtmlReporter` (writes a file). Rendering uses the `eta` template engine with an inline template constant compiled once at module load. The factory in `src/reporters/index.ts` gains a `case 'html':` arm. View-model logic is internal to `html.ts`; the template stays logic-only-for-iteration.

**Tech Stack:** TypeScript (NodeNext ESM, `.js` import extensions), `eta` template engine, `vitest`, `tsdown` build (unchanged), `oxlint` / `oxfmt`.

**Spec:** `docs/specs/2026-05-31-html-reporter-design.md`.

---

## Files Map

| File                            | Role                                                           | Action |
| ------------------------------- | -------------------------------------------------------------- | ------ |
| `package.json`                  | Add `eta` to `dependencies`                                    | Modify |
| `src/reporters/html.ts`         | `formatHtml`, `HtmlReporter`, inline template, compiled render | Create |
| `src/reporters/index.ts`        | Add `case 'html':` arm                                         | Modify |
| `tests/reporters/html.test.ts`  | Unit + integration tests                                       | Create |
| `tests/reporters/index.test.ts` | Assert `html` config builds `HtmlReporter`                     | Modify |
| `README.md`                     | Add `html` row to reporters table                              | Modify |

---

### Task 1: Add `eta` dependency

**Files:**

- Modify: `package.json` (dependencies), `pnpm-lock.yaml`

- [ ] **Step 1: Install eta**

Run:

```bash
pnpm add eta
```

Expected: `package.json` gains `"eta": "^3.x"` (or current major) under `dependencies`; `pnpm-lock.yaml` updates.

- [ ] **Step 2: Verify type-check passes**

Run:

```bash
pnpm exec tsc --noEmit
```

Expected: exit 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "feat(html-reporter): add eta template engine dependency"
```

---

### Task 2: Scaffold `formatHtml` and `HtmlReporter` shell

Lay down `html.ts` with the inline template, compiled render function, view-model interfaces, and a stubbed `HtmlReporter.report` (real I/O comes in Task 8). The initial template renders only the DOCTYPE, title, and timestamp — per-task content and the summary come in later tasks.

**Files:**

- Create: `src/reporters/html.ts`
- Create: `tests/reporters/html.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/reporters/html.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatHtml } from '../../src/reporters/html.js';
import type { Report } from '../../src/types.js';

const report: Report = {
  timestamp: '2026-05-28T12:00:00.000Z',
  hasChanges: true,
  tasks: [
    { id: 'a', name: 'Lazy routes', done: 4, total: 11, percentage: 36, delta: 3 },
    { id: 'b', name: 'Drop legacy <Modal>', done: 0, total: 5, percentage: 0, delta: null },
  ],
};

describe('formatHtml', () => {
  it('renders a complete HTML5 document with the title and timestamp', () => {
    const html = formatHtml(report);
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('<title>Refactor progress</title>');
    expect(html).toContain('<h1>Refactor progress</h1>');
    expect(html).toContain('2026-05-28T12:00:00.000Z');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm exec vitest run tests/reporters/html.test.ts
```

Expected: FAIL with module-not-found for `../../src/reporters/html.js`.

- [ ] **Step 3: Create `src/reporters/html.ts`**

Create with this content:

```ts
import { Eta } from 'eta';
import type { Report, Reporter } from '../types.js';

const TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Refactor progress</title>
  <style>
    :root { font-family: -apple-system, system-ui, sans-serif; color: #222; }
    main { max-width: 860px; margin: 2rem auto; padding: 0 1rem; }
    h1 { margin: 0 0 0.25rem; }
    header time { color: #666; font-size: 0.9em; }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Refactor progress</h1>
      <time><%= it.timestamp %></time>
    </header>
  </main>
</body>
</html>
`;

const eta = new Eta({ autoEscape: true, useWith: false });
const render = eta.compile(TEMPLATE);

interface HtmlView {
  timestamp: string;
}

function buildView(report: Report): HtmlView {
  return { timestamp: report.timestamp };
}

export function formatHtml(report: Report): string {
  return render.call(eta, buildView(report));
}

export class HtmlReporter implements Reporter {
  constructor(private readonly output: string) {}
  async report(_report: Report): Promise<void> {
    throw new Error('HtmlReporter.report not implemented yet');
  }
}
```

The `_report` underscore prefix marks the stub parameter as intentionally unused.

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
pnpm exec vitest run tests/reporters/html.test.ts
```

Expected: PASS — 1 test.

- [ ] **Step 5: Type-check and lint**

Run:

```bash
pnpm exec tsc --noEmit && pnpm lint
```

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/reporters/html.ts tests/reporters/html.test.ts
git commit -m "feat(html-reporter): scaffold formatHtml and HtmlReporter shell"
```

---

### Task 3: Render one card per refactor

Add `<ul class="refactors">` with one `<li class="refactor">` per task. Each card shows name, `done / total`, percentage, and a progress bar whose fill width matches the percentage. Bars stay neutral here; color comes in Task 5, delta chip in Task 4.

**Files:**

- Modify: `src/reporters/html.ts`
- Modify: `tests/reporters/html.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to the `describe('formatHtml', ...)` block in `tests/reporters/html.test.ts`:

```ts
it('renders one .refactor card per task with name, counts, and percentage', () => {
  const html = formatHtml(report);
  const cards = html.match(/<li class="refactor">/g) ?? [];
  expect(cards).toHaveLength(2);
  expect(html).toContain('Lazy routes');
  expect(html).toContain('4 / 11');
  expect(html).toContain('36%');
  expect(html).toContain('0 / 5');
  expect(html).toContain('0%');
});

it('renders a progress bar whose fill width matches the percentage', () => {
  const html = formatHtml(report);
  expect(html).toContain('width: 36%');
  expect(html).toContain('width: 0%');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
pnpm exec vitest run tests/reporters/html.test.ts
```

Expected: 2 NEW failures; existing test still passes.

- [ ] **Step 3: Extend view model and template**

In `src/reporters/html.ts`, replace the `HtmlView` interface and `buildView` function with:

```ts
interface HtmlTaskView {
  name: string;
  done: number;
  total: number;
  percentage: number;
}

interface HtmlView {
  timestamp: string;
  tasks: HtmlTaskView[];
}

function buildView(report: Report): HtmlView {
  return {
    timestamp: report.timestamp,
    tasks: report.tasks.map((t) => ({
      name: t.name,
      done: t.done,
      total: t.total,
      percentage: t.percentage,
    })),
  };
}
```

Replace `TEMPLATE` with:

```ts
const TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Refactor progress</title>
  <style>
    :root { font-family: -apple-system, system-ui, sans-serif; color: #222; }
    main { max-width: 860px; margin: 2rem auto; padding: 0 1rem; }
    h1 { margin: 0 0 0.25rem; }
    header time { color: #666; font-size: 0.9em; }
    ul.refactors { list-style: none; padding: 0; margin: 1rem 0 0; }
    .refactor { border: 1px solid #ddd; border-radius: 6px; padding: 1rem; margin: 0.5rem 0; }
    .head { display: flex; gap: 1rem; align-items: baseline; }
    .head .name { flex: 1; font-weight: 600; }
    .head .counts, .head .pct { color: #444; font-variant-numeric: tabular-nums; }
    .bar { height: 10px; background: #eee; border-radius: 5px; overflow: hidden; margin-top: 0.5rem; }
    .bar-fill { height: 100%; background: #333; }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Refactor progress</h1>
      <time><%= it.timestamp %></time>
    </header>

    <ul class="refactors">
      <% it.tasks.forEach(function (task) { %>
      <li class="refactor">
        <div class="head">
          <span class="name"><%= task.name %></span>
          <span class="counts"><%= task.done %> / <%= task.total %></span>
          <span class="pct"><%= task.percentage %>%</span>
        </div>
        <div class="bar">
          <div class="bar-fill" style="width: <%= task.percentage %>%"></div>
        </div>
      </li>
      <% }) %>
    </ul>
  </main>
</body>
</html>
`;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
pnpm exec vitest run tests/reporters/html.test.ts
```

Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/reporters/html.ts tests/reporters/html.test.ts
git commit -m "feat(html-reporter): render per-refactor cards with progress bars"
```

---

### Task 4: Delta chip with four states

The chip shows `+N` (green, class `delta-up`) for positive delta, `−N` (red, class `delta-down`, U+2212 minus) for negative, and is omitted for `null` (first run) and `0` (unchanged — keeps the page quiet).

**Files:**

- Modify: `src/reporters/html.ts`
- Modify: `tests/reporters/html.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to the `describe('formatHtml', ...)` block:

```ts
it('renders a green delta chip for positive delta', () => {
  const html = formatHtml(report);
  expect(html).toContain('<span class="delta delta-up">+3</span>');
});

it('omits the delta chip when delta is null (first run)', () => {
  const html = formatHtml(report);
  // Second card belongs to "Drop legacy <Modal>" with delta: null.
  const modalCard = html.match(/<li class="refactor">[\s\S]*?Drop legacy[\s\S]*?<\/li>/)?.[0] ?? '';
  expect(modalCard).not.toContain('class="delta');
});

it('omits the delta chip when delta is 0', () => {
  const zeroReport: Report = {
    timestamp: '2026-05-28T12:00:00.000Z',
    hasChanges: false,
    tasks: [{ id: 'a', name: 'Stable', done: 4, total: 10, percentage: 40, delta: 0 }],
  };
  const html = formatHtml(zeroReport);
  expect(html).not.toContain('class="delta');
});

it('renders a red delta chip with U+2212 minus for negative delta', () => {
  const regressionReport: Report = {
    timestamp: '2026-05-28T12:00:00.000Z',
    hasChanges: true,
    tasks: [{ id: 'a', name: 'Backslid', done: 3, total: 10, percentage: 30, delta: -2 }],
  };
  const html = formatHtml(regressionReport);
  expect(html).toContain('<span class="delta delta-down">−2</span>');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
pnpm exec vitest run tests/reporters/html.test.ts
```

Expected: 4 NEW failures.

- [ ] **Step 3: Add delta to the view model**

In `src/reporters/html.ts`, add this interface and helper above `buildView`:

```ts
interface HtmlDeltaView {
  text: string;
  kind: 'up' | 'down';
}

function buildDelta(delta: number | null): HtmlDeltaView | null {
  if (delta === null || delta === 0) return null;
  if (delta > 0) return { text: `+${delta}`, kind: 'up' };
  return { text: `−${-delta}`, kind: 'down' };
}
```

Extend `HtmlTaskView`:

```ts
interface HtmlTaskView {
  name: string;
  done: number;
  total: number;
  percentage: number;
  delta: HtmlDeltaView | null;
}
```

Update the task mapping inside `buildView`:

```ts
    tasks: report.tasks.map((t) => ({
      name: t.name,
      done: t.done,
      total: t.total,
      percentage: t.percentage,
      delta: buildDelta(t.delta),
    })),
```

- [ ] **Step 4: Render the chip in the template**

In `TEMPLATE`, replace the `<div class="head">…</div>` block inside `<li class="refactor">` with:

```html
<div class="head">
  <span class="name"><%= task.name %></span>
  <span class="counts"><%= task.done %> / <%= task.total %></span>
  <span class="pct"><%= task.percentage %>%</span>
  <% if (task.delta) { %>
  <span class="delta delta-<%= task.delta.kind %>"><%= task.delta.text %></span>
  <% } %>
</div>
```

Add chip CSS inside the `<style>` block (after the existing `.bar-fill` rule):

```css
.delta {
  padding: 0 0.5rem;
  border-radius: 999px;
  font-size: 0.85em;
  font-variant-numeric: tabular-nums;
}
.delta-up {
  background: #d4f4dd;
  color: #0a5028;
}
.delta-down {
  background: #f8d7da;
  color: #842029;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run:

```bash
pnpm exec vitest run tests/reporters/html.test.ts
```

Expected: PASS — 7 tests.

- [ ] **Step 6: Commit**

```bash
git add src/reporters/html.ts tests/reporters/html.test.ts
git commit -m "feat(html-reporter): add delta chip with up/down/none states"
```

---

### Task 5: Color bars by completion (red → green)

Bar `background` uses `hsl(${Math.round(percentage * 1.2)}, 65%, 45%)`. 0% → hue 0 (red), 50% → hue 60 (yellow), 100% → hue 120 (green).

**Files:**

- Modify: `src/reporters/html.ts`
- Modify: `tests/reporters/html.test.ts`

- [ ] **Step 1: Write the failing test**

Append to the `describe('formatHtml', ...)` block:

```ts
it('colors each progress bar by completion using hsl', () => {
  const html = formatHtml(report);
  // 36% → hue round(36 * 1.2) = 43
  expect(html).toContain('background: hsl(43, 65%, 45%)');
  // 0% → hue 0 (red)
  expect(html).toContain('background: hsl(0, 65%, 45%)');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm exec vitest run tests/reporters/html.test.ts
```

Expected: 1 NEW failure (no `background: hsl(...)` in output).

- [ ] **Step 3: Add the helper and extend the view model**

In `src/reporters/html.ts`, add this helper alongside `buildDelta`:

```ts
function barColor(percentage: number): string {
  return `hsl(${Math.round(percentage * 1.2)}, 65%, 45%)`;
}
```

Extend `HtmlTaskView`:

```ts
interface HtmlTaskView {
  name: string;
  done: number;
  total: number;
  percentage: number;
  barColor: string;
  delta: HtmlDeltaView | null;
}
```

Update the task mapping inside `buildView`:

```ts
    tasks: report.tasks.map((t) => ({
      name: t.name,
      done: t.done,
      total: t.total,
      percentage: t.percentage,
      barColor: barColor(t.percentage),
      delta: buildDelta(t.delta),
    })),
```

- [ ] **Step 4: Update the template**

In `TEMPLATE`, replace the `<div class="bar">…</div>` block inside `<li class="refactor">` with:

```html
<div class="bar">
  <div
    class="bar-fill"
    style="width: <%= task.percentage %>%; background: <%= task.barColor %>"
  ></div>
</div>
```

In the `<style>` block, remove `background: #333;` from the `.bar-fill` rule (the inline style now provides the color):

```css
.bar-fill {
  height: 100%;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run:

```bash
pnpm exec vitest run tests/reporters/html.test.ts
```

Expected: PASS — 8 tests.

- [ ] **Step 6: Commit**

```bash
git add src/reporters/html.ts tests/reporters/html.test.ts
git commit -m "feat(html-reporter): color bars by completion percentage"
```

---

### Task 6: Overall summary section

A headline card above the refactor list with combined `done / total`, overall percentage, and an aggregate bar (also colored by overall percentage).

**Files:**

- Modify: `src/reporters/html.ts`
- Modify: `tests/reporters/html.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to the `describe('formatHtml', ...)` block:

```ts
it('renders an overall summary with grand totals and aggregate percentage', () => {
  const html = formatHtml(report);
  // grandDone = 4 + 0 = 4; grandTotal = 11 + 5 = 16; round(4/16*100) = 25
  expect(html).toContain('<section class="summary">');
  expect(html).toContain('4 / 16');
  expect(html).toContain('25%');
  // 25% → hue round(25 * 1.2) = 30
  expect(html).toContain('background: hsl(30, 65%, 45%)');
});

it('treats overall percentage as 0 when grandTotal is 0', () => {
  const emptyReport: Report = {
    timestamp: '2026-05-28T12:00:00.000Z',
    hasChanges: false,
    tasks: [{ id: 'a', name: 'Empty', done: 0, total: 0, percentage: 0, delta: null }],
  };
  const html = formatHtml(emptyReport);
  expect(html).toContain('0 / 0');
  expect(html).toMatch(/<section class="summary">[\s\S]*?0%/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
pnpm exec vitest run tests/reporters/html.test.ts
```

Expected: 2 NEW failures.

- [ ] **Step 3: Extend the view model**

In `src/reporters/html.ts`, replace `HtmlView` with:

```ts
interface HtmlView {
  timestamp: string;
  grandDone: number;
  grandTotal: number;
  overallPercentage: number;
  overallBarColor: string;
  tasks: HtmlTaskView[];
}
```

Replace `buildView` with:

```ts
function buildView(report: Report): HtmlView {
  const grandDone = report.tasks.reduce((sum, t) => sum + t.done, 0);
  const grandTotal = report.tasks.reduce((sum, t) => sum + t.total, 0);
  const overallPercentage = grandTotal === 0 ? 0 : Math.round((grandDone / grandTotal) * 100);
  return {
    timestamp: report.timestamp,
    grandDone,
    grandTotal,
    overallPercentage,
    overallBarColor: barColor(overallPercentage),
    tasks: report.tasks.map((t) => ({
      name: t.name,
      done: t.done,
      total: t.total,
      percentage: t.percentage,
      barColor: barColor(t.percentage),
      delta: buildDelta(t.delta),
    })),
  };
}
```

- [ ] **Step 4: Update the template**

In `TEMPLATE`, insert the summary block between the closing `</header>` and the opening `<ul class="refactors">`:

```html
<section class="summary">
  <div class="head">
    <span class="name">Overall</span>
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
```

Add CSS for the summary in the `<style>` block (placed alongside `.refactor`):

```css
.summary {
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 1rem;
  margin: 1rem 0;
  background: #fafafa;
}
.summary .name {
  font-weight: 700;
  font-size: 1.05em;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run:

```bash
pnpm exec vitest run tests/reporters/html.test.ts
```

Expected: PASS — 10 tests.

- [ ] **Step 6: Commit**

```bash
git add src/reporters/html.ts tests/reporters/html.test.ts
git commit -m "feat(html-reporter): add overall summary section with aggregate bar"
```

---

### Task 7: Verify task names are HTML-escaped

Eta auto-escapes `<%= %>` interpolations by default. The sample report's `Drop legacy <Modal>` task makes that escaping visible. This task is a guard test — it should pass without code changes; if it fails, the eta config has regressed.

**Files:**

- Modify: `tests/reporters/html.test.ts`

- [ ] **Step 1: Write the test**

Append to the `describe('formatHtml', ...)` block:

```ts
it('html-escapes task names containing < and >', () => {
  const html = formatHtml(report);
  // "Drop legacy <Modal>" must be escaped — never appear raw
  expect(html).toContain('Drop legacy &lt;Modal&gt;');
  expect(html).not.toContain('Drop legacy <Modal>');
});
```

- [ ] **Step 2: Run the test**

Run:

```bash
pnpm exec vitest run tests/reporters/html.test.ts
```

Expected: PASS — 11 tests. If this FAILS, the eta config is wrong: verify `new Eta({ autoEscape: true, useWith: false })` in `src/reporters/html.ts` and re-run.

- [ ] **Step 3: Commit**

```bash
git add tests/reporters/html.test.ts
git commit -m "test(html-reporter): assert task names are html-escaped"
```

---

### Task 8: Implement `HtmlReporter.report` file I/O

Mirrors `MarkdownReporter` exactly (see `src/reporters/markdown.ts:19`): `mkdir -p` parents, then `writeFile`.

**Files:**

- Modify: `src/reporters/html.ts`
- Modify: `tests/reporters/html.test.ts`

- [ ] **Step 1: Write the failing integration test**

Append to `tests/reporters/html.test.ts` (these imports go at the top of the file, alongside the existing ones):

```ts
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { HtmlReporter } from '../../src/reporters/html.js';
```

Add this new describe block at the end of the file:

```ts
describe('HtmlReporter', () => {
  it('writes html to the output file, creating parent directories', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'rt-html-'));
    try {
      const out = path.join(dir, 'docs', 'progress.html');
      await new HtmlReporter(out).report(report);
      const contents = await readFile(out, 'utf8');
      expect(contents).toMatch(/^<!DOCTYPE html>/);
      expect(contents).toContain('Lazy routes');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm exec vitest run tests/reporters/html.test.ts
```

Expected: FAIL with `HtmlReporter.report not implemented yet`.

- [ ] **Step 3: Implement the real `report`**

At the top of `src/reporters/html.ts`, add:

```ts
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
```

Replace the stubbed `HtmlReporter` class with:

```ts
export class HtmlReporter implements Reporter {
  constructor(private readonly output: string) {}
  async report(report: Report): Promise<void> {
    await mkdir(path.dirname(this.output), { recursive: true });
    await writeFile(this.output, formatHtml(report), 'utf8');
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
pnpm exec vitest run tests/reporters/html.test.ts
```

Expected: PASS — 12 tests.

- [ ] **Step 5: Type-check and lint**

Run:

```bash
pnpm exec tsc --noEmit && pnpm lint
```

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/reporters/html.ts tests/reporters/html.test.ts
git commit -m "feat(html-reporter): write rendered html to output path"
```

---

### Task 9: Wire `html` into the reporter factory

**Files:**

- Modify: `src/reporters/index.ts` (factory switch around line 17)
- Modify: `tests/reporters/index.test.ts`

- [ ] **Step 1: Write the failing test update**

In `tests/reporters/index.test.ts`, add the import alongside the existing reporter imports:

```ts
import { HtmlReporter } from '../../src/reporters/html.js';
```

Replace the `'builds the configured built-in reporters'` test with:

```ts
it('builds the configured built-in reporters', async () => {
  const reporters = await createReporters(
    [
      { type: 'stdout' },
      { type: 'json', output: 'out.json' },
      { type: 'markdown', output: 'out.md' },
      { type: 'html', output: 'out.html' },
    ],
    process.cwd(),
  );
  expect(reporters[0]).toBeInstanceOf(StdoutReporter);
  expect(reporters[1]).toBeInstanceOf(JsonReporter);
  expect(reporters[2]).toBeInstanceOf(MarkdownReporter);
  expect(reporters[3]).toBeInstanceOf(HtmlReporter);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm exec vitest run tests/reporters/index.test.ts
```

Expected: FAIL with `Unknown reporter type: html`.

- [ ] **Step 3: Wire the factory**

In `src/reporters/index.ts`, add the import alongside the existing reporter imports:

```ts
import { HtmlReporter } from './html.js';
```

In the switch (around line 17), insert this case immediately after the `'markdown'` case:

```ts
      case 'html':
        reporters.push(new HtmlReporter(config.output as string));
        break;
```

- [ ] **Step 4: Run the full reporter test suite**

Run:

```bash
pnpm exec vitest run tests/reporters
```

Expected: PASS — all reporter tests.

- [ ] **Step 5: Commit**

```bash
git add src/reporters/index.ts tests/reporters/index.test.ts
git commit -m "feat(html-reporter): register html in the reporter factory"
```

---

### Task 10: Document the new reporter in the README

**Files:**

- Modify: `README.md` (reporters table around line 89)

- [ ] **Step 1: Add the html row to the reporters table**

Replace the existing reporters table with:

```markdown
| Reporter   | Output                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------- |
| `stdout`   | Progress table to the terminal (default when no reporters are configured)                   |
| `json`     | The full report object to a file (`output: <path>` required)                                |
| `markdown` | A progress table to a `.md` file (`output: <path>` required)                                |
| `html`     | A self-contained HTML page with progress bars to a `.html` file (`output: <path>` required) |
| `custom`   | Your own module (`path: <path>`) — the extension point for Slack, Linear, Notion, etc.      |
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs(html-reporter): list html in the reporters table"
```

---

### Task 11: Final verification (full suite + browser smoke)

- [ ] **Step 1: Run the full test suite**

Run:

```bash
pnpm test
```

Expected: PASS — every test in the repo.

- [ ] **Step 2: Type-check, lint, format-check**

Run:

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm fmt:check
```

Expected: exit 0 for all three.

- [ ] **Step 3: Build**

Run:

```bash
pnpm build
```

Expected: exit 0; `dist/cli.js` and `dist/index.js` rebuilt.

- [ ] **Step 4: End-to-end smoke via the CLI in a browser**

This step is the writing-plans skill's "use the feature in a browser before reporting complete" check.

Create a sample config:

```bash
mkdir -p /tmp/rt-html-smoke
cat > /tmp/rt-html-smoke/.tech-refactors.yml <<'YAML'
reporters:
  - type: html
    output: progress.html
refactors:
  - id: lazy-routes
    name: Lazy routes
    detect:
      done: { command: "echo 4" }
      total: { command: "echo 11" }
  - id: legacy-modal
    name: "Drop legacy <Modal>"
    detect:
      done: { command: "echo 0" }
      total: { command: "echo 5" }
  - id: lodash
    name: Replace lodash
    detect:
      done: { command: "echo 18" }
      total: { command: "echo 24" }
YAML
```

Run the CLI against it (absolute paths so cwd doesn't matter):

```bash
node "$PWD/dist/cli.js" --config /tmp/rt-html-smoke/.tech-refactors.yml
open /tmp/rt-html-smoke/progress.html
```

Expected (visual check in the browser):

- Title "Refactor progress" with an ISO timestamp.
- Overall summary card on top with combined counts (22 / 40) and an orange-ish aggregate bar (~55%).
- Three refactor cards beneath: "Lazy routes" with a yellow bar at 36%, "Drop legacy &lt;Modal&gt;" (note the escaped `<`/`>`) with a red bar at 0% and no delta chip, "Replace lodash" with a green bar at 75%.
- No `<script>` tag, no broken layout, no console errors.

Clean up:

```bash
rm -rf /tmp/rt-html-smoke
```

---

## Notes

- **No `tsdown` config change is needed** — the template is inlined as a string constant in `html.ts`, so the build still emits only `.js` and `.d.ts` files. If a future change moves the template to a separate asset file, that's when packaging needs revisiting.
- **`src/index.ts` is unchanged.** It only re-exports types, and `Report` / `TaskResult` / `Reporter` are already covered for custom-reporter consumers.
- **Conventional Commit prefixes** (enforced by commitlint): `feat` for behavior, `test` for test-only additions, `docs` for README. Each commit message in this plan follows that.
