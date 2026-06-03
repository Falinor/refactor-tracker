import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Report } from 'refactor-tracker';
import createNotionReporter from '../src/index.js';
import type { NotionClient } from '../src/client.js';

const ts = '2026-06-02T09:14:00.000Z';

const report: Report = {
  timestamp: ts,
  hasChanges: true,
  tasks: [
    {
      id: 'a',
      name: 'A',
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

function fakeClient(): NotionClient {
  return {
    queryByIds: vi.fn(async () => []),
    createPage: vi.fn(async () => {}),
    updatePage: vi.fn(async () => {}),
  };
}

describe('createNotionReporter', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    logSpy.mockRestore();
  });

  it('throws when config is invalid', () => {
    expect(() => createNotionReporter({ token: '' })).toThrow();
  });

  it('returns a Reporter that calls the injected client and logs a summary', async () => {
    const client = fakeClient();
    const reporter = createNotionReporter(
      { token: 't', databaseId: 'db', dataSourceId: 'ds' },
      { client },
    );
    await reporter.report(report);
    expect(client.createPage).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith('notion: synced 1 task (1 created, 0 updated)');
  });

  it('pluralizes the summary line correctly for multiple tasks', async () => {
    const client = fakeClient();
    const reporter = createNotionReporter(
      { token: 't', databaseId: 'db', dataSourceId: 'ds' },
      { client },
    );
    await reporter.report({
      ...report,
      tasks: [report.tasks[0], { ...report.tasks[0], id: 'b', name: 'B' }],
    });
    expect(logSpy).toHaveBeenCalledWith('notion: synced 2 tasks (2 created, 0 updated)');
  });
});
