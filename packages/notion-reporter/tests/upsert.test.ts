import { describe, expect, it, vi } from 'vitest';
import type { Report } from 'refactor-tracker';
import type { NotionClient, NotionPage } from '../src/client.js';
import { syncReport } from '../src/upsert.js';

function makeClient(existing: NotionPage[] = []): NotionClient & {
  queryByIds: ReturnType<typeof vi.fn>;
  createPage: ReturnType<typeof vi.fn>;
  updatePage: ReturnType<typeof vi.fn>;
} {
  return {
    queryByIds: vi.fn(async () => existing),
    createPage: vi.fn(async () => {}),
    updatePage: vi.fn(async () => {}),
  };
}

const ts = '2026-06-02T09:14:00.000Z';

const baseReport: Report = {
  timestamp: ts,
  hasChanges: true,
  tasks: [
    {
      id: 'a',
      name: 'A',
      done: 1,
      total: 2,
      percentage: 50,
      delta: 1,
      registeredAt: null,
      completedAt: null,
      durationDays: null,
    },
    {
      id: 'b',
      name: 'B',
      done: 2,
      total: 2,
      percentage: 100,
      delta: 0,
      registeredAt: null,
      completedAt: ts,
      durationDays: 1,
    },
  ],
};

describe('syncReport', () => {
  it('creates rows when none exist', async () => {
    const client = makeClient();
    const result = await syncReport(client, 'db_1', 'ds_1', baseReport);
    expect(client.queryByIds).toHaveBeenCalledWith('ds_1', 'ID', ['a', 'b']);
    expect(client.createPage).toHaveBeenCalledTimes(2);
    expect(client.createPage).toHaveBeenCalledWith('db_1', expect.any(Object));
    expect(client.updatePage).not.toHaveBeenCalled();
    expect(result).toEqual({ created: 2, updated: 0 });
  });

  it('updates rows whose ID property matches an existing page', async () => {
    const client = makeClient([
      { id: 'page-a', properties: { ID: { rich_text: [{ plain_text: 'a' }] } } },
    ]);
    const result = await syncReport(client, 'db_1', 'ds_1', baseReport);
    expect(client.updatePage).toHaveBeenCalledWith('page-a', expect.any(Object));
    expect(client.createPage).toHaveBeenCalledTimes(1);
    expect(client.createPage).toHaveBeenCalledWith('db_1', expect.any(Object));
    expect(result).toEqual({ created: 1, updated: 1 });
  });

  it('does nothing when the report has no tasks', async () => {
    const client = makeClient();
    const result = await syncReport(client, 'db_1', 'ds_1', { ...baseReport, tasks: [] });
    expect(client.queryByIds).not.toHaveBeenCalled();
    expect(client.createPage).not.toHaveBeenCalled();
    expect(client.updatePage).not.toHaveBeenCalled();
    expect(result).toEqual({ created: 0, updated: 0 });
  });

  it('ignores existing pages whose ID does not match any task', async () => {
    const client = makeClient([
      { id: 'page-x', properties: { ID: { rich_text: [{ plain_text: 'x' }] } } },
    ]);
    const result = await syncReport(client, 'db_1', 'ds_1', baseReport);
    expect(client.updatePage).not.toHaveBeenCalled();
    expect(client.createPage).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ created: 2, updated: 0 });
  });
});
