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
