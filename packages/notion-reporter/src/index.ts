import type { Reporter } from 'refactor-tracker';

export interface NotionReporterConfig {
  token: string;
  databaseId: string;
  dataSourceId: string;
}

export default function createNotionReporter(_config: NotionReporterConfig): Reporter {
  return {
    report: async () => {
      throw new Error('createNotionReporter: not yet implemented');
    },
  };
}
