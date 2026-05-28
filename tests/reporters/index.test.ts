import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReporters } from '../../src/reporters/index.js';
import { StdoutReporter } from '../../src/reporters/stdout.js';
import { JsonReporter } from '../../src/reporters/json.js';
import { MarkdownReporter } from '../../src/reporters/markdown.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(here, '..', 'fixtures');

describe('createReporters', () => {
  it('defaults to a single stdout reporter when none are configured', async () => {
    const reporters = await createReporters(undefined, process.cwd());
    expect(reporters).toHaveLength(1);
    expect(reporters[0]).toBeInstanceOf(StdoutReporter);
  });

  it('builds the configured built-in reporters', async () => {
    const reporters = await createReporters(
      [
        { type: 'stdout' },
        { type: 'json', output: 'out.json' },
        { type: 'markdown', output: 'out.md' },
      ],
      process.cwd(),
    );
    expect(reporters[0]).toBeInstanceOf(StdoutReporter);
    expect(reporters[1]).toBeInstanceOf(JsonReporter);
    expect(reporters[2]).toBeInstanceOf(MarkdownReporter);
  });

  it('loads a custom reporter from a module path relative to baseDir', async () => {
    const reporters = await createReporters(
      [{ type: 'custom', path: './custom-reporter.ts' }],
      fixturesDir,
    );
    expect(reporters).toHaveLength(1);
    expect(typeof reporters[0].report).toBe('function');
  });

  it('throws on an unknown reporter type', async () => {
    await expect(createReporters([{ type: 'banana' }], process.cwd())).rejects.toThrow(
      /Unknown reporter type: banana/,
    );
  });
});
