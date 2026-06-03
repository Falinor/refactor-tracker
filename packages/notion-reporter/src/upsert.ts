import type { Report } from 'refactor-tracker';
import type { NotionClient, NotionPage } from './client.js';
import { taskToProperties } from './properties.js';

export interface SyncResult {
  created: number;
  updated: number;
}

const ID_PROPERTY = 'ID';

function readId(page: NotionPage): string | null {
  const prop = page.properties[ID_PROPERTY] as
    | { rich_text?: Array<{ plain_text?: string }> }
    | undefined;
  const first = prop?.rich_text?.[0];
  return first?.plain_text ?? null;
}

export async function syncReport(
  client: NotionClient,
  databaseId: string,
  dataSourceId: string,
  report: Report,
): Promise<SyncResult> {
  if (report.tasks.length === 0) return { created: 0, updated: 0 };

  const ids = report.tasks.map((t) => t.id);
  const existing = await client.queryByIds(dataSourceId, ID_PROPERTY, ids);
  const pageByTaskId = new Map<string, string>();
  for (const page of existing) {
    const id = readId(page);
    if (id) pageByTaskId.set(id, page.id);
  }

  let created = 0;
  let updated = 0;
  for (const task of report.tasks) {
    const properties = taskToProperties(task, report.timestamp);
    const pageId = pageByTaskId.get(task.id);
    if (pageId) {
      await client.updatePage(pageId, properties);
      updated += 1;
    } else {
      await client.createPage(databaseId, properties);
      created += 1;
    }
  }
  return { created, updated };
}
