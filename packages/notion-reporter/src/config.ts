import { z } from 'zod';

const schema = z.object({
  token: z.string().min(1, 'token must be a non-empty string'),
  databaseId: z.string().min(1, 'databaseId must be a non-empty string'),
  dataSourceId: z.string().min(1, 'dataSourceId must be a non-empty string'),
});

export type NotionReporterConfig = z.infer<typeof schema>;

export function parseNotionConfig(raw: unknown): NotionReporterConfig {
  return schema.parse(raw);
}
