import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReporters } from '../../src/reporters/index.js';
import { StdoutReporter } from '../../src/reporters/stdout.js';
import { JsonReporter } from '../../src/reporters/json.js';
import { MarkdownReporter } from '../../src/reporters/markdown.js';
import { HtmlReporter } from '../../src/reporters/html.js';
import { BadgeReporter } from '../../src/reporters/badge.js';

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
        { type: 'html', output: 'out.html' },
        { type: 'badge', output: 'out.svg' },
      ],
      process.cwd(),
    );
    expect(reporters[0]).toBeInstanceOf(StdoutReporter);
    expect(reporters[1]).toBeInstanceOf(JsonReporter);
    expect(reporters[2]).toBeInstanceOf(MarkdownReporter);
    expect(reporters[3]).toBeInstanceOf(HtmlReporter);
    expect(reporters[4]).toBeInstanceOf(BadgeReporter);
  });

  it('resolves relative reporter outputs against baseDir, leaving absolute paths intact', async () => {
    const baseDir = path.resolve('/refactor-tracker-base');
    const absoluteOut = path.resolve('/tmp/refactor-tracker-absolute.json');
    const reporters = await createReporters(
      [
        { type: 'json', output: 'out.json' },
        { type: 'markdown', output: 'docs/out.md' },
        { type: 'html', output: absoluteOut },
        { type: 'badge', output: 'badge.svg' },
      ],
      baseDir,
    );
    expect((reporters[0] as JsonReporter).output).toBe(path.join(baseDir, 'out.json'));
    expect((reporters[1] as MarkdownReporter).output).toBe(path.join(baseDir, 'docs/out.md'));
    expect((reporters[2] as HtmlReporter).output).toBe(absoluteOut);
    expect((reporters[3] as BadgeReporter).output).toBe(path.join(baseDir, 'badge.svg'));
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
