import { describe, it, expect } from 'vitest';
import { formatTable } from '../../src/reporters/stdout.js';
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
    {
      id: 'b',
      name: 'react-hook-form',
      done: 7,
      total: 9,
      percentage: 78,
      delta: null,
      registeredAt: null,
      completedAt: null,
      durationDays: null,
    },
    {
      id: 'c',
      name: 'Regressed',
      done: 2,
      total: 5,
      percentage: 40,
      delta: -1,
      registeredAt: null,
      completedAt: null,
      durationDays: null,
    },
  ],
};

describe('formatTable', () => {
  it('renders each task with counts, percentage, and signed delta', () => {
    const out = formatTable(report);
    expect(out).toContain('Lazy routes: 4/11 (36%) (+3)');
    expect(out).toContain('react-hook-form: 7/9 (78%)');
    expect(out).not.toContain('react-hook-form: 7/9 (78%) (');
    expect(out).toContain('Regressed: 2/5 (40%) (-1)');
  });
});

describe('formatTable grouped by tag', () => {
  it('emits a heading per group when any task has tags', () => {
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
    const out = formatTable(r);
    expect(out).toContain('## frontend');
    expect(out).toContain('## backend');
    expect(out).toContain('FE: 1/2 (50%)');
    expect(out).toContain('BE: 0/3 (0%)');
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
    const out = formatTable(r);
    expect(out.indexOf('## frontend')).toBeLessThan(out.indexOf('## Untagged'));
    expect(out).toContain('Loose: 0/3 (0%)');
  });

  it('renders flat (no headings) when no task has tags', () => {
    expect(formatTable(report)).not.toContain('## ');
  });
});

describe('formatTable ignores items', () => {
  it('does not render item content in stdout output', () => {
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
    const out = formatTable(r);
    expect(out).toContain('Lazy routes: 1/3 (33%)');
    expect(out).not.toContain('src/foo.ts');
    expect(out).not.toContain('src/bar.ts');
  });
});
