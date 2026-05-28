import { describe, it, expect } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { MarkdownReporter, formatMarkdown } from '../../src/reporters/markdown.js';
import type { Report } from '../../src/types.js';

const report: Report = {
  timestamp: '2026-05-28T12:00:00.000Z',
  hasChanges: true,
  tasks: [{ id: 'a', name: 'Lazy routes', done: 4, total: 11, percentage: 36, delta: 3 }],
};

describe('formatMarkdown', () => {
  it('renders a markdown table row per task', () => {
    const md = formatMarkdown(report);
    expect(md).toContain('| Refactor | Done | Total | % |');
    expect(md).toContain('| Lazy routes | 4 | 11 | 36% |');
  });
});

describe('MarkdownReporter', () => {
  it('writes markdown to the output file, creating parent directories', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'rt-md-'));
    try {
      const out = path.join(dir, 'docs', 'progress.md');
      await new MarkdownReporter(out).report(report);
      expect(await readFile(out, 'utf8')).toContain('| Lazy routes | 4 | 11 | 36% |');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
