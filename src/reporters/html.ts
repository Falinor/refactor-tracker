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

const eta = new Eta({ autoEscape: true, useWith: false });
const render = eta.compile(TEMPLATE);

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

export function formatHtml(report: Report): string {
  return render.call(eta, buildView(report));
}

export class HtmlReporter implements Reporter {
  constructor(private readonly output: string) {}
  async report(_report: Report): Promise<void> {
    throw new Error('HtmlReporter.report not implemented yet');
  }
}
