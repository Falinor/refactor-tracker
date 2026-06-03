import { describe, expect, it } from 'vitest';
import type { TaskResult } from 'refactor-tracker';
import { taskToProperties } from '../src/properties.js';

const baseTask: TaskResult = {
  id: 'lazy-routes',
  name: 'Lazy-load top-level routes',
  description: 'Reduce initial JS bundle',
  tags: ['frontend', 'performance'],
  done: 7,
  total: 10,
  percentage: 70,
  delta: 2,
  registeredAt: '2026-04-01T00:00:00.000Z',
  completedAt: null,
  durationDays: null,
};

const ts = '2026-06-02T09:14:00.000Z';

describe('taskToProperties', () => {
  it('maps a typical in-progress task', () => {
    const props = taskToProperties(baseTask, ts);
    expect(props.Task).toEqual({ title: [{ text: { content: 'Lazy-load top-level routes' } }] });
    expect(props.ID).toEqual({ rich_text: [{ text: { content: 'lazy-routes' } }] });
    expect(props.Description).toEqual({
      rich_text: [{ text: { content: 'Reduce initial JS bundle' } }],
    });
    expect(props.Tags).toEqual({ multi_select: [{ name: 'frontend' }, { name: 'performance' }] });
    expect(props.Done).toEqual({ number: 7 });
    expect(props.Total).toEqual({ number: 10 });
    expect(props.Percentage).toEqual({ number: 70 });
    expect(props['Δ Last run']).toEqual({ number: 2 });
    expect(props.Completed).toEqual({ checkbox: false });
    expect(props.Registered).toEqual({ date: { start: '2026-04-01T00:00:00.000Z' } });
    expect(props['Completed at']).toEqual({ date: null });
    expect(props['Duration (days)']).toEqual({ number: null });
    expect(props['Last synced']).toEqual({ date: { start: ts } });
  });

  it('marks Completed=true when completedAt is set, and includes durationDays', () => {
    const task: TaskResult = {
      ...baseTask,
      done: 10,
      percentage: 100,
      completedAt: '2026-05-28T00:00:00.000Z',
      durationDays: 57,
    };
    const props = taskToProperties(task, ts);
    expect(props.Completed).toEqual({ checkbox: true });
    expect(props['Completed at']).toEqual({ date: { start: '2026-05-28T00:00:00.000Z' } });
    expect(props['Duration (days)']).toEqual({ number: 57 });
  });

  it('omits Description when absent, and Tags when empty/missing', () => {
    const task: TaskResult = {
      ...baseTask,
      description: undefined,
      tags: undefined,
    };
    const props = taskToProperties(task, ts);
    expect('Description' in props).toBe(false);
    expect('Tags' in props).toBe(false);
  });

  it('writes null delta as Δ Last run = { number: null }', () => {
    const props = taskToProperties({ ...baseTask, delta: null }, ts);
    expect(props['Δ Last run']).toEqual({ number: null });
  });

  it('writes null Registered as a cleared date', () => {
    const props = taskToProperties({ ...baseTask, registeredAt: null }, ts);
    expect(props.Registered).toEqual({ date: null });
  });
});
