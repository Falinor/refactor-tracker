import { describe, expect, it } from 'vitest';
import type { Report, TaskResult } from 'refactor-tracker';
import { formatComment, STICKY_MARKER } from '../src/comment.js';

function task(over: Partial<TaskResult> = {}): TaskResult {
  return {
    id: 'demo',
    name: 'Demo refactor',
    done: 5,
    total: 10,
    percentage: 50,
    delta: 0,
    registeredAt: null,
    completedAt: null,
    durationDays: null,
    ...over,
  };
}

function report(over: Partial<Report> = {}): Report {
  return {
    tasks: [task()],
    timestamp: '2026-06-07T00:00:00.000Z',
    hasChanges: false,
    ...over,
  };
}

describe('formatComment', () => {
  it('includes the sticky marker so the comment can be found and updated later', () => {
    const body = formatComment(report());
    expect(body.startsWith(STICKY_MARKER)).toBe(true);
  });

  it('shows a no-movement summary when no task moved', () => {
    const body = formatComment(
      report({
        tasks: [task({ delta: 0 }), task({ id: 'b', name: 'B', delta: null })],
        hasChanges: false,
      }),
    );
    expect(body).toContain('no movement');
    expect(body).toContain('2 tracked refactors');
  });

  it('shows a delta summary with the moved-task count and total delta', () => {
    const body = formatComment(
      report({
        tasks: [
          task({ delta: 3 }),
          task({ id: 'b', name: 'B', delta: 0 }),
          task({ id: 'c', name: 'C', delta: 2 }),
        ],
        hasChanges: true,
      }),
    );
    expect(body).toContain('2 of 3 tracked refactors moved');
    expect(body).toContain('(+5 total)');
  });

  it('shows a no-movement summary when hasChanges is true but nothing moved (e.g. a newly registered task)', () => {
    const body = formatComment(
      report({
        tasks: [task({ delta: null }), task({ id: 'b', name: 'B', delta: 0 })],
        hasChanges: true,
      }),
    );
    expect(body).toContain('no movement');
  });

  it('shows a negative summary on regression', () => {
    const body = formatComment(
      report({
        tasks: [task({ delta: -2 }), task({ id: 'b', name: 'B', delta: 1 })],
        hasChanges: true,
      }),
    );
    expect(body).toContain('(-1 total)');
  });

  it('renders the per-task table with formatted deltas', () => {
    const body = formatComment(
      report({
        tasks: [
          task({ id: 'up', name: 'Up', delta: 4 }),
          task({ id: 'down', name: 'Down', delta: -1 }),
          task({ id: 'fresh', name: 'Fresh', delta: null }),
        ],
        hasChanges: true,
      }),
    );
    expect(body).toContain('| Up | 5 / 10 | 50% | +4 |');
    expect(body).toContain('| Down | 5 / 10 | 50% | -1 |');
    expect(body).toContain('| Fresh | 5 / 10 | 50% | — |');
  });

  it('wraps the table in a collapsible details block', () => {
    const body = formatComment(report());
    expect(body).toContain('<details>');
    expect(body).toContain('<summary>Per-task details</summary>');
    expect(body).toContain('</details>');
  });
});
