import { describe, it, expect } from 'vitest';
import { renderConfig } from '../src/commands/init-template.js';

const URL = 'https://cdn.jsdelivr.net/npm/refactor-tracker@9.9.9/schema.json';

describe('renderConfig', () => {
  it('puts the schema url on the modeline', () => {
    const out = renderConfig({ schemaUrl: URL, examples: ['counts'], reporter: 'stdout' });
    expect(out.startsWith(`# yaml-language-server: $schema=${URL}\n`)).toBe(true);
  });

  it('includes only the selected example blocks', () => {
    const out = renderConfig({ schemaUrl: URL, examples: ['remaining'], reporter: 'stdout' });
    expect(out).toContain('id: example-remaining');
    expect(out).not.toContain('id: example-counts');
    expect(out).not.toContain('id: example-binary');
  });

  it('renders all three example shapes when requested', () => {
    const out = renderConfig({
      schemaUrl: URL,
      examples: ['counts', 'remaining', 'binary'],
      reporter: 'stdout',
    });
    expect(out).toContain('id: example-counts');
    expect(out).toContain('id: example-remaining');
    expect(out).toContain('id: example-binary');
    expect(out).toContain('binary: true');
  });

  it('leaves reporters commented for stdout and none', () => {
    for (const reporter of ['stdout', 'none'] as const) {
      const out = renderConfig({ schemaUrl: URL, examples: ['counts'], reporter });
      expect(out).toContain('# reporters:');
      expect(out).not.toMatch(/^reporters:/m);
    }
  });

  it('emits an active reporters block with a default output for file reporters', () => {
    const out = renderConfig({ schemaUrl: URL, examples: ['counts'], reporter: 'markdown' });
    expect(out).toMatch(/^reporters:/m);
    expect(out).toContain('- type: markdown');
    expect(out).toContain('output: refactor-progress.md');
  });
});
