import { writeFileSync } from 'node:fs';
import { z } from 'zod';

export async function buildSchema(): Promise<string> {
  const { configSchema } = await import('../src/config.ts');

  const schema = z.toJSONSchema(configSchema, {
    target: 'draft-2020-12',
    unrepresentable: 'any',
    override: (ctx) => {
      // The isoDateOrTimestampSchema wraps a transform; emit it as a date string.
      if (ctx.path[ctx.path.length - 1] === 'registeredAt') {
        ctx.jsonSchema.type = 'string';
        ctx.jsonSchema.anyOf = [{ format: 'date' }, { format: 'date-time' }];
        ctx.jsonSchema.description =
          'ISO-8601 date (YYYY-MM-DD) or full timestamp; recorded when the refactor was registered.';
      }
    },
  });

  schema.$id =
    'https://raw.githubusercontent.com/Falinor/refactor-tracker/main/packages/core/schema.json';
  schema.title = 'refactor-tracker config';
  schema.description =
    'Schema for refactor-tracker YAML config files (typically .refactor-tracker.yml).';

  return JSON.stringify(schema, null, 2) + '\n';
}

// Run as CLI: write schema.json next to this package.
if (import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync(new URL('../schema.json', import.meta.url), await buildSchema());
}
