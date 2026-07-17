import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Eta } from 'eta';
import type { Report, Reporter } from '../types.js';
import { groupTasksByTag } from '../grouping.js';
import { formatDate } from './format.js';
import { aggregateReport } from './aggregate.js';

const TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Refactor progress</title>
  <style>
    :root { font-family: -apple-system, system-ui, sans-serif; color: #222; }
    main { max-width: 860px; margin: 2rem auto; padding: 0 1rem; }
    h1 { margin: 0 0 0.25rem; }
    h2 { margin: 1.5rem 0 0.5rem; font-size: 1.1em; color: #444; }
    header time { color: #666; font-size: 0.9em; }
    ul.refactors { list-style: none; padding: 0; margin: 1rem 0 0; }
    .refactor { border: 1px solid #ddd; border-radius: 6px; padding: 1rem; margin: 0.5rem 0; }
    .head { display: flex; gap: 1rem; align-items: baseline; }
    .head .name { flex: 1; font-weight: 600; }
    .head .counts, .head .pct { color: #444; font-variant-numeric: tabular-nums; }
    .bar { height: 10px; background: #eee; border-radius: 5px; overflow: hidden; margin-top: 0.5rem; }
    .bar-fill { height: 100%; transition: none; }
    .summary { border: 1px solid #ddd; border-radius: 6px; padding: 1rem; margin: 1rem 0 2rem; background: #fafafa; }
    .summary .name { font-weight: 700; font-size: 1.05em; }
    .summary .bar { height: 16px; border-radius: 8px; }
    .description { margin: 0.25rem 0 0; color: #666; font-size: 0.9em; }
    .delta { padding: 0 0.5rem; border-radius: 999px; font-size: 0.85em; font-variant-numeric: tabular-nums; }
    .delta-up { background: #d4f4dd; color: #0a5028; }
    .delta-down { background: #f8d7da; color: #842029; }
    details.items { margin-top: 0.75rem; }
    details.items > summary { cursor: pointer; color: #444; font-size: 0.9em; }
    details.items > ul { margin: 0.5rem 0 0; padding-left: 1.25rem; color: #444; font-size: 0.9em; }
    dl.milestones { display: flex; flex-wrap: wrap; gap: 0 1.25rem; margin: 0.5rem 0 0; color: #555; font-size: 0.85em; }
    dl.milestones > div { display: flex; gap: 0.35rem; }
    dl.milestones dt { font-weight: 600; color: #444; margin: 0; }
    dl.milestones dd { margin: 0; font-variant-numeric: tabular-nums; }
    <% if (!it.flat) { %>.tag-group { margin-top: 1.5rem; }<% } %>
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Refactor progress</h1>
      <time datetime="<%= it.timestampIso %>"><%= it.timestampLocal %></time>
    </header>

    <section class="summary" style="border-left: 4px solid <%= it.overallBarColor %>;">
      <div class="head">
        <span class="name">Overall</span>
        <span class="counts"><%= it.grandDone %> / <%= it.grandTotal %></span>
        <span class="pct"><%= it.overallPercentage %>%</span>
      </div>
      <div class="bar">
        <div class="bar-fill"
             style="width: <%= it.overallPercentage %>%; background: <%= it.overallBarColor %>"></div>
      </div>
    </section>

    <% if (it.flat) { %>
    <ul class="refactors">
      <% it.groups[0].tasks.forEach(function (task) { %>
      <li class="refactor">
        <div class="head">
          <span class="name"><%= task.name %></span>
          <span class="counts"><%= task.done %> / <%= task.total %></span>
          <span class="pct"><%= task.percentage %>%</span>
          <% if (task.delta) { %>
          <span class="delta delta-<%= task.delta.kind %>"><%= task.delta.text %></span>
          <% } %>
        </div>
        <% if (task.description) { %>
        <p class="description"><%= task.description %></p>
        <% } %>
        <div class="bar">
          <div class="bar-fill"
               style="width: <%= task.percentage %>%; background: <%= task.barColor %>"></div>
        </div>
        <dl class="milestones">
          <div>
            <dt>Registered</dt>
            <% if (task.registered) { %>
            <dd title="<%= task.registered.iso %>"><%= task.registered.display %></dd>
            <% } else { %>
            <dd>—</dd>
            <% } %>
          </div>
          <div>
            <dt>Completed</dt>
            <% if (task.completed) { %>
            <dd title="<%= task.completed.iso %>"><%= task.completed.display %></dd>
            <% } else { %>
            <dd>—</dd>
            <% } %>
          </div>
          <div>
            <dt>Duration</dt>
            <% if (task.duration) { %>
            <dd><%= task.duration %></dd>
            <% } else { %>
            <dd>—</dd>
            <% } %>
          </div>
        </dl>
        <% if (task.items) { %>
        <details class="items">
          <summary><%= task.items.length %> remaining</summary>
          <ul>
            <% task.items.forEach(function (item) { %>
            <li><%= item %></li>
            <% }) %>
          </ul>
        </details>
        <% } %>
      </li>
      <% }) %>
    </ul>
    <% } else { %>
    <% it.groups.forEach(function (group) { %>
    <section class="tag-group">
      <h2><%= group.heading %></h2>
      <ul class="refactors">
        <% group.tasks.forEach(function (task) { %>
        <li class="refactor">
          <div class="head">
            <span class="name"><%= task.name %></span>
            <span class="counts"><%= task.done %> / <%= task.total %></span>
            <span class="pct"><%= task.percentage %>%</span>
            <% if (task.delta) { %>
            <span class="delta delta-<%= task.delta.kind %>"><%= task.delta.text %></span>
            <% } %>
          </div>
          <% if (task.description) { %>
          <p class="description"><%= task.description %></p>
          <% } %>
          <div class="bar">
            <div class="bar-fill"
                 style="width: <%= task.percentage %>%; background: <%= task.barColor %>"></div>
          </div>
          <dl class="milestones">
            <div>
              <dt>Registered</dt>
              <% if (task.registered) { %>
              <dd title="<%= task.registered.iso %>"><%= task.registered.display %></dd>
              <% } else { %>
              <dd>—</dd>
              <% } %>
            </div>
            <div>
              <dt>Completed</dt>
              <% if (task.completed) { %>
              <dd title="<%= task.completed.iso %>"><%= task.completed.display %></dd>
              <% } else { %>
              <dd>—</dd>
              <% } %>
            </div>
            <div>
              <dt>Duration</dt>
              <% if (task.duration) { %>
              <dd><%= task.duration %></dd>
              <% } else { %>
              <dd>—</dd>
              <% } %>
            </div>
          </dl>
          <% if (task.items) { %>
          <details class="items">
            <summary><%= task.items.length %> remaining</summary>
            <ul>
              <% task.items.forEach(function (item) { %>
              <li><%= item %></li>
              <% }) %>
            </ul>
          </details>
          <% } %>
        </li>
        <% }) %>
      </ul>
    </section>
    <% }) %>
    <% } %>
  </main>
</body>
</html>
`;

const eta = new Eta({ autoEscape: true, useWith: false });
const render = eta.compile(TEMPLATE);

interface HtmlDeltaView {
  text: string;
  kind: 'up' | 'down';
}

function barColor(percentage: number): string {
  return `hsl(${Math.round(percentage * 1.2)}, 65%, 45%)`;
}

function buildDelta(delta: number | null): HtmlDeltaView | null {
  if (delta === null || delta === 0) return null;
  if (delta > 0) return { text: `+${delta}`, kind: 'up' };
  return { text: `−${-delta}`, kind: 'down' };
}

interface HtmlMilestoneView {
  iso: string;
  display: string;
}

interface HtmlTaskView {
  name: string;
  description: string | null;
  done: number;
  total: number;
  percentage: number;
  barColor: string;
  delta: HtmlDeltaView | null;
  items: string[] | null;
  registered: HtmlMilestoneView | null;
  completed: HtmlMilestoneView | null;
  duration: string | null;
}

interface HtmlGroupView {
  heading: string;
  tasks: HtmlTaskView[];
}

interface HtmlView {
  timestampIso: string;
  timestampLocal: string;
  grandDone: number;
  grandTotal: number;
  overallPercentage: number;
  overallBarColor: string;
  flat: boolean;
  groups: HtmlGroupView[];
}

const TIMESTAMP_FORMAT = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatTimestamp(iso: string): string {
  return TIMESTAMP_FORMAT.format(new Date(iso));
}

function toTaskView(t: Report['tasks'][number], nowIso: string): HtmlTaskView {
  return {
    name: t.name,
    description: t.description ?? null,
    done: t.done,
    total: t.total,
    percentage: t.percentage,
    barColor: barColor(t.percentage),
    delta: buildDelta(t.delta),
    items: t.items && t.items.length > 0 ? t.items : null,
    registered: t.registeredAt
      ? { iso: t.registeredAt, display: formatDate(t.registeredAt, nowIso) }
      : null,
    completed: t.completedAt
      ? { iso: t.completedAt, display: formatDate(t.completedAt, nowIso) }
      : null,
    duration: t.durationDays !== null ? `${t.durationDays}d` : null,
  };
}

function buildView(report: Report): HtmlView {
  const {
    done: grandDone,
    total: grandTotal,
    percentage: overallPercentage,
  } = aggregateReport(report);
  const taskGroups = groupTasksByTag(report.tasks);
  const flat = taskGroups.length === 1 && taskGroups[0].tag === null;
  const nowIso = report.timestamp;
  const groups: HtmlGroupView[] = taskGroups.map((g) => ({
    heading: g.tag === null ? 'Untagged' : g.tag,
    tasks: g.tasks.map((t) => toTaskView(t, nowIso)),
  }));
  return {
    timestampIso: report.timestamp,
    timestampLocal: formatTimestamp(report.timestamp),
    grandDone,
    grandTotal,
    overallPercentage,
    overallBarColor: barColor(overallPercentage),
    flat,
    groups,
  };
}

export function formatHtml(report: Report): string {
  return render.call(eta, buildView(report));
}

export class HtmlReporter implements Reporter {
  constructor(readonly output: string) {}

  async report(report: Report): Promise<void> {
    await mkdir(path.dirname(this.output), { recursive: true });
    await writeFile(this.output, formatHtml(report), 'utf8');
  }
}
