import type { Reporter } from 'refactor-tracker';
import { parseNotionConfig, type NotionReporterConfig } from './config.js';

export type { NotionReporterConfig };

export default function createNotionReporter(raw: unknown): Reporter {
  const config = parseNotionConfig(raw);
  return {
    report: async () => {
      throw new Error(
        `createNotionReporter: not yet implemented (databaseId=${config.databaseId}, dataSourceId=${config.dataSourceId})`,
      );
    },
  };
}
