import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Report, TaskResult } from 'refactor-tracker';

const setOutputMock = vi.fn();
vi.mock('@actions/core', () => ({
  setOutput: (...args: unknown[]) => setOutputMock(...args),
}));

const { hasRegression, setOutputs } = await import('../src/outputs.js');

function task(over: Partial<TaskResult> = {}): TaskResult {
  return {
    id: 'demo',
    name: 'Demo',
    done: 1,
    total: 2,
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

beforeEach(() => {
  setOutputMock.mockClear();
});

describe('setOutputs', () => {
  it('emits delta, total, has-changes, and report-json', () => {
    const r = report({
      tasks: [task({ delta: 3 }), task({ id: 'b', name: 'B', delta: -1 })],
      hasChanges: true,
    });
    setOutputs(r);

    expect(setOutputMock).toHaveBeenCalledWith('delta', 2);
    expect(setOutputMock).toHaveBeenCalledWith('total', 2);
    expect(setOutputMock).toHaveBeenCalledWith('has-changes', 'true');
    expect(setOutputMock).toHaveBeenCalledWith('report-json', expect.any(String));

    const jsonCall = setOutputMock.mock.calls.find((c) => c[0] === 'report-json');
    expect(JSON.parse(jsonCall![1] as string)).toEqual(r);
  });

  it('treats null deltas as zero in the total', () => {
    setOutputs(report({ tasks: [task({ delta: null }), task({ id: 'b', name: 'B', delta: 4 })] }));
    expect(setOutputMock).toHaveBeenCalledWith('delta', 4);
  });
});

describe('hasRegression', () => {
  it('returns true when any task has a negative delta', () => {
    expect(hasRegression(report({ tasks: [task({ delta: -1 })] }))).toBe(true);
  });

  it('returns false when no task has a negative delta', () => {
    expect(
      hasRegression(report({ tasks: [task({ delta: 0 }), task({ id: 'b', delta: 3 })] })),
    ).toBe(false);
  });

  it('ignores null deltas (first-run baseline)', () => {
    expect(hasRegression(report({ tasks: [task({ delta: null })] }))).toBe(false);
  });
});
