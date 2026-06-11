import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildSchema } from '../scripts/build-schema.js';

describe('schema.json', () => {
  it('matches the output of buildSchema()', async () => {
    const committed = readFileSync(new URL('../schema.json', import.meta.url), 'utf8');
    expect(await buildSchema()).toBe(committed);
  });
});
