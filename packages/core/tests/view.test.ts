import { describe, it, expect } from 'vitest';
import { applyView } from '../src/view.js';
import type { Report, TaskResult } from '../src/types.js';

function task(overrides: Partial<TaskResult> = {}): TaskResult {
  return {
    id: overrides.id ?? 'x',
    name: overrides.name ?? 'X',
    done: 1,
    total: 2,
    percentage: 50,
    delta: null,
    registeredAt: null,
    completedAt: null,
    durationDays: null,
    ...overrides,
  };
}

function report(tasks: TaskResult[]): Report {
  return { timestamp: '2026-05-28T12:00:00.000Z', hasChanges: true, tasks };
}

describe('applyView — filter completed', () => {
  it('hides tasks with a completedAt when showCompleted is false', () => {
    const r = report([
      task({ id: 'open' }),
      task({ id: 'done', completedAt: '2026-04-01T00:00:00.000Z' }),
    ]);
    const out = applyView(r, { showCompleted: false });
    expect(out.tasks.map((t) => t.id)).toEqual(['open']);
  });

  it('keeps all tasks when showCompleted is true', () => {
    const r = report([
      task({ id: 'open' }),
      task({ id: 'done', completedAt: '2026-04-01T00:00:00.000Z' }),
    ]);
    const out = applyView(r, { showCompleted: true });
    expect(out.tasks.map((t) => t.id)).toEqual(['open', 'done']);
  });

  it('preserves other Report fields', () => {
    const r = report([task()]);
    const out = applyView(r, { showCompleted: false });
    expect(out.timestamp).toBe(r.timestamp);
    expect(out.hasChanges).toBe(r.hasChanges);
  });
});

describe('applyView — sort', () => {
  it('sorts by registered ascending, nulls last', () => {
    const r = report([
      task({ id: 'a', registeredAt: '2026-03-01T00:00:00.000Z' }),
      task({ id: 'b', registeredAt: '2026-01-15T00:00:00.000Z' }),
      task({ id: 'c', registeredAt: null }),
    ]);
    const out = applyView(r, { showCompleted: true, sortBy: 'registered' });
    expect(out.tasks.map((t) => t.id)).toEqual(['b', 'a', 'c']);
  });

  it('sorts by completed descending, nulls last', () => {
    const r = report([
      task({ id: 'a', completedAt: '2026-04-01T00:00:00.000Z' }),
      task({ id: 'b', completedAt: '2026-05-30T00:00:00.000Z' }),
      task({ id: 'c', completedAt: null }),
    ]);
    const out = applyView(r, { showCompleted: true, sortBy: 'completed' });
    expect(out.tasks.map((t) => t.id)).toEqual(['b', 'a', 'c']);
  });

  it('sorts by progress ascending', () => {
    const r = report([
      task({ id: 'a', percentage: 80 }),
      task({ id: 'b', percentage: 20 }),
      task({ id: 'c', percentage: 50 }),
    ]);
    const out = applyView(r, { showCompleted: true, sortBy: 'progress' });
    expect(out.tasks.map((t) => t.id)).toEqual(['b', 'c', 'a']);
  });

  it('applies filter before sort', () => {
    const r = report([
      task({ id: 'open-late', registeredAt: '2026-04-01T00:00:00.000Z' }),
      task({
        id: 'done-early',
        registeredAt: '2026-01-01T00:00:00.000Z',
        completedAt: '2026-02-01T00:00:00.000Z',
      }),
    ]);
    const out = applyView(r, { showCompleted: false, sortBy: 'registered' });
    expect(out.tasks.map((t) => t.id)).toEqual(['open-late']);
  });
});
