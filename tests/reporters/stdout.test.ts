import { describe, it, expect } from 'vitest';
import { formatTable } from '../../src/reporters/stdout.js';
import type { Report } from '../../src/types.js';

const report: Report = {
  timestamp: '2026-05-28T12:00:00.000Z',
  hasChanges: true,
  tasks: [
    { id: 'a', name: 'Lazy routes', done: 4, total: 11, percentage: 36, delta: 3 },
    { id: 'b', name: 'react-hook-form', done: 7, total: 9, percentage: 78, delta: null },
    { id: 'c', name: 'Regressed', done: 2, total: 5, percentage: 40, delta: -1 },
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
