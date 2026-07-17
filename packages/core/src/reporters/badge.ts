import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { makeBadge } from 'badge-maker';
import type { Reporter, Report } from '../types.js';
import { aggregateReport } from './aggregate.js';

const LABEL = 'refactor-tracker';

export function colorFor(percentage: number): string {
  if (percentage >= 100) return 'brightgreen';
  if (percentage >= 80) return 'green';
  if (percentage >= 50) return 'yellow';
  return 'red';
}

export class BadgeReporter implements Reporter {
  readonly wantsRaw = true;
  constructor(readonly output: string) {}

  async report(report: Report): Promise<void> {
    let svg: string;
    if (report.tasks.length === 0) {
      svg = makeBadge({ label: LABEL, message: 'no refactors tracked', color: 'lightgrey' });
    } else {
      const { percentage } = aggregateReport(report);
      svg = makeBadge({ label: LABEL, message: `${percentage}%`, color: colorFor(percentage) });
    }

    await mkdir(path.dirname(this.output), { recursive: true });
    await writeFile(this.output, svg, 'utf8');
  }
}
