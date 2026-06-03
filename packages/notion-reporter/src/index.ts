import type { Reporter } from 'refactor-tracker';
import { parseNotionConfig, type NotionReporterConfig } from './config.js';
import { createOfficialNotionClient, type NotionClient } from './client.js';
import { syncReport } from './upsert.js';

export type { NotionReporterConfig };
export type { NotionClient } from './client.js';

interface Internals {
  client?: NotionClient;
}

export default function createNotionReporter(raw: unknown, internals: Internals = {}): Reporter {
  const config = parseNotionConfig(raw);
  const client = internals.client ?? createOfficialNotionClient(config.token);
  return {
    report: async (report) => {
      const { created, updated } = await syncReport(
        client,
        config.databaseId,
        config.dataSourceId,
        report,
      );
      const total = created + updated;
      const noun = total === 1 ? 'task' : 'tasks';
      console.log(`notion: synced ${total} ${noun} (${created} created, ${updated} updated)`);
    },
  };
}
