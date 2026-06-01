import { readFile } from 'node:fs/promises';
import yaml from 'js-yaml';
import { z } from 'zod';

const commandField = z.object({ command: z.string() });

const detectBinary = z.object({
  command: z.string(),
  binary: z.literal(true),
});

const detectCounts = z
  .object({
    done: commandField.optional(),
    remaining: commandField.optional(),
    total: commandField.optional(),
  })
  .refine((d) => [d.done, d.remaining, d.total].filter(Boolean).length >= 2, {
    message: 'detect must provide at least two of done/remaining/total',
  });

const detectSchema = z.union([detectBinary, detectCounts]);

const refactorSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  detect: detectSchema,
});

const reporterSchema = z.looseObject({ type: z.string() });

export const configSchema = z.object({
  reporters: z.array(reporterSchema).optional(),
  refactors: z.array(refactorSchema),
});

export type Config = z.infer<typeof configSchema>;
export type DetectConfig = z.infer<typeof detectSchema>;
export type RefactorConfig = z.infer<typeof refactorSchema>;
export type ReporterConfig = z.infer<typeof reporterSchema>;

const ENV_REF = /^\$([A-Za-z_][A-Za-z0-9_]*)$/;

export function expandEnv<T>(value: T): T {
  if (typeof value === 'string') {
    const match = value.match(ENV_REF);
    if (!match) return value;
    const resolved = process.env[match[1]];
    if (resolved === undefined) throw new Error(`Environment variable not set: ${match[1]}`);
    return resolved as unknown as T;
  }
  if (Array.isArray(value)) return value.map((v) => expandEnv(v)) as unknown as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, expandEnv(v)])) as T;
  }
  return value;
}

export function parseConfig(raw: string): Config {
  const config = configSchema.parse(yaml.load(raw));
  if (config.reporters) config.reporters = config.reporters.map((r) => expandEnv(r));
  return config;
}

export async function loadConfig(path: string): Promise<Config> {
  return parseConfig(await readFile(path, 'utf8'));
}
