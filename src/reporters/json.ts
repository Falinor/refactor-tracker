import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Reporter, Report } from '../types.js';

export class JsonReporter implements Reporter {
  constructor(private readonly output: string) {}

  async report(report: Report): Promise<void> {
    await mkdir(path.dirname(this.output), { recursive: true });
    await writeFile(this.output, JSON.stringify(report, null, 2) + '\n', 'utf8');
  }
}
