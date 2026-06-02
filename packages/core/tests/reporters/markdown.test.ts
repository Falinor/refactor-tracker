import { describe, it, expect } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { MarkdownReporter, formatMarkdown } from '../../src/reporters/markdown.js';
import type { Report } from '../../src/types.js';

const report: Report = {
  timestamp: '2026-05-28T12:00:00.000Z',
  hasChanges: true,
  tasks: [
    {
      id: 'a',
      name: 'Lazy routes',
      done: 4,
      total: 11,
      percentage: 36,
      delta: 3,
      registeredAt: null,
      completedAt: null,
      durationDays: null,
    },
  ],
};

describe('formatMarkdown', () => {
  it('renders a markdown table row per task', () => {
    const md = formatMarkdown(report);
    expect(md).toContain('| Refactor | Done | Total | % |');
    expect(md).toContain('| Lazy routes | 4 | 11 | 36% |');
  });
});

describe('formatMarkdown with descriptions', () => {
  it('adds a Description column when at least one task has a description', () => {
    const withDesc: Report = {
      timestamp: '2026-05-28T12:00:00.000Z',
      hasChanges: true,
      tasks: [
        {
          id: 'a',
          name: 'Lazy routes',
          description: 'Frontend route lazy-loading rollout',
          done: 4,
          total: 11,
          percentage: 36,
          delta: 3,
          registeredAt: null,
          completedAt: null,
          durationDays: null,
        },
        {
          id: 'b',
          name: 'No desc',
          done: 0,
          total: 5,
          percentage: 0,
          delta: null,
          registeredAt: null,
          completedAt: null,
          durationDays: null,
        },
      ],
    };
    const md = formatMarkdown(withDesc);
    expect(md).toContain('| Refactor | Description | Done | Total | % |');
    expect(md).toContain('| Lazy routes | Frontend route lazy-loading rollout | 4 | 11 | 36% |');
    // Row without a description gets an empty cell, not "undefined".
    expect(md).toContain('| No desc |  | 0 | 5 | 0% |');
  });

  it('omits the Description column when no task has a description', () => {
    const md = formatMarkdown(report);
    expect(md).toContain('| Refactor | Done | Total | % |');
    expect(md).not.toContain('Description');
  });

  it('escapes pipes inside a description so the table stays valid', () => {
    const withPipe: Report = {
      timestamp: '2026-05-28T12:00:00.000Z',
      hasChanges: true,
      tasks: [
        {
          id: 'a',
          name: 'Foo',
          description: 'left | right',
          done: 1,
          total: 2,
          percentage: 50,
          delta: null,
          registeredAt: null,
          completedAt: null,
          durationDays: null,
        },
      ],
    };
    const md = formatMarkdown(withPipe);
    expect(md).toContain('| left \\| right |');
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

describe('formatMarkdown with items', () => {
  it('renders a <details> block per task that has items', () => {
    const r: Report = {
      timestamp: '2026-05-28T12:00:00.000Z',
      hasChanges: true,
      tasks: [
        {
          id: 'a',
          name: 'Lazy routes',
          done: 1,
          total: 3,
          percentage: 33,
          delta: null,
          items: ['src/foo.ts', 'src/bar.ts'],
          registeredAt: null,
          completedAt: null,
          durationDays: null,
        },
      ],
    };
    const md = formatMarkdown(r);
    expect(md).toContain('<details>');
    expect(md).toContain('<summary>Lazy routes — 2 remaining</summary>');
    expect(md).toContain('- src/foo.ts');
    expect(md).toContain('- src/bar.ts');
    expect(md).toContain('</details>');
  });

  it('does not render any <details> when no task has items', () => {
    const md = formatMarkdown(report);
    expect(md).not.toContain('<details>');
  });

  it('attaches <details> to the same tag group as the table', () => {
    const r: Report = {
      timestamp: '2026-05-28T12:00:00.000Z',
      hasChanges: true,
      tasks: [
        {
          id: 'a',
          name: 'FE',
          tags: ['frontend'],
          done: 0,
          total: 2,
          percentage: 0,
          delta: null,
          items: ['src/a.ts'],
          registeredAt: null,
          completedAt: null,
          durationDays: null,
        },
        {
          id: 'b',
          name: 'BE',
          tags: ['backend'],
          done: 0,
          total: 2,
          percentage: 0,
          delta: null,
          registeredAt: null,
          completedAt: null,
          durationDays: null,
        },
      ],
    };
    const md = formatMarkdown(r);
    const fe = md.indexOf('## frontend');
    const be = md.indexOf('## backend');
    const details = md.indexOf('<details>');
    expect(fe).toBeGreaterThanOrEqual(0);
    expect(be).toBeGreaterThan(fe);
    // <details> for the FE task appears between the frontend heading and the backend heading.
    expect(details).toBeGreaterThan(fe);
    expect(details).toBeLessThan(be);
  });
});

describe('formatMarkdown grouped by tag', () => {
  it('emits a heading and table per tag when any task has tags', () => {
    const r: Report = {
      timestamp: '2026-05-28T12:00:00.000Z',
      hasChanges: true,
      tasks: [
        {
          id: 'a',
          name: 'FE',
          tags: ['frontend'],
          done: 1,
          total: 2,
          percentage: 50,
          delta: null,
          registeredAt: null,
          completedAt: null,
          durationDays: null,
        },
        {
          id: 'b',
          name: 'BE',
          tags: ['backend'],
          done: 0,
          total: 3,
          percentage: 0,
          delta: null,
          registeredAt: null,
          completedAt: null,
          durationDays: null,
        },
      ],
    };
    const md = formatMarkdown(r);
    expect(md).toContain('## frontend');
    expect(md).toContain('## backend');
    expect(md.indexOf('## frontend')).toBeLessThan(md.indexOf('## backend'));
    expect(md).toContain('| FE | 1 | 2 | 50% |');
    expect(md).toContain('| BE | 0 | 3 | 0% |');
  });

  it('duplicates a multi-tag task under every matching group', () => {
    const r: Report = {
      timestamp: '2026-05-28T12:00:00.000Z',
      hasChanges: true,
      tasks: [
        {
          id: 'a',
          name: 'Both',
          tags: ['x', 'y'],
          done: 1,
          total: 2,
          percentage: 50,
          delta: null,
          registeredAt: null,
          completedAt: null,
          durationDays: null,
        },
      ],
    };
    const md = formatMarkdown(r);
    const occurrences = md.split('| Both | 1 | 2 | 50% |').length - 1;
    expect(occurrences).toBe(2);
  });

  it('renders an "Untagged" group last when both tagged and untagged tasks exist', () => {
    const r: Report = {
      timestamp: '2026-05-28T12:00:00.000Z',
      hasChanges: true,
      tasks: [
        {
          id: 'a',
          name: 'FE',
          tags: ['frontend'],
          done: 1,
          total: 2,
          percentage: 50,
          delta: null,
          registeredAt: null,
          completedAt: null,
          durationDays: null,
        },
        {
          id: 'b',
          name: 'Loose',
          done: 0,
          total: 3,
          percentage: 0,
          delta: null,
          registeredAt: null,
          completedAt: null,
          durationDays: null,
        },
      ],
    };
    const md = formatMarkdown(r);
    expect(md).toContain('## Untagged');
    expect(md.indexOf('## frontend')).toBeLessThan(md.indexOf('## Untagged'));
  });

  it('renders flat (no group headings) when no task has tags', () => {
    const md = formatMarkdown(report);
    expect(md).not.toContain('## ');
    expect(md).not.toContain('Untagged');
  });
});

describe('markdown milestone columns', () => {
  const baseTask = {
    id: 'a',
    name: 'A',
    done: 4,
    total: 10,
    percentage: 40,
    delta: null,
    registeredAt: null as string | null,
    completedAt: null as string | null,
    durationDays: null as number | null,
  };

  it('adds Registered, Completed, and Duration columns', () => {
    const md = formatMarkdown({
      timestamp: '2026-05-28T12:00:00.000Z',
      hasChanges: true,
      tasks: [{ ...baseTask, registeredAt: '2026-03-12T00:00:00.000Z' }],
    });
    expect(md).toMatch(/Refactor\s*\|.*Registered\s*\|.*Completed\s*\|.*Duration/);
    expect(md).toContain('Mar 12');
    expect(md).toContain('—'); // completed and duration cells empty
  });

  it('renders duration for completed refactors', () => {
    const md = formatMarkdown({
      timestamp: '2026-05-28T12:00:00.000Z',
      hasChanges: false,
      tasks: [
        {
          ...baseTask,
          done: 10,
          percentage: 100,
          registeredAt: '2026-04-01T00:00:00.000Z',
          completedAt: '2026-05-30T00:00:00.000Z',
          durationDays: 59,
        },
      ],
    });
    expect(md).toContain('Apr 1');
    expect(md).toContain('May 30');
    expect(md).toContain('59d');
  });
});
