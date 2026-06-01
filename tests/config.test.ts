import { describe, it, expect, beforeEach } from 'vitest';
import { parseConfig, expandEnv } from '../src/config.js';

describe('parseConfig', () => {
  it('parses refactors with a done+total detection shape', () => {
    const config = parseConfig(`
refactors:
  - id: abc
    name: Lazy routes
    detect:
      done:
        command: "grep -rl x | wc -l"
      total:
        command: "ls views | wc -l"
`);
    expect(config.refactors).toHaveLength(1);
    expect(config.refactors[0].id).toBe('abc');
    expect(config.refactors[0].detect).toMatchObject({
      done: { command: 'grep -rl x | wc -l' },
      total: { command: 'ls views | wc -l' },
    });
  });

  it('accepts a binary detection shape', () => {
    const config = parseConfig(`
refactors:
  - id: bin
    name: Upgrade lib
    detect:
      command: "node -e 'process.exit(0)'"
      binary: true
`);
    expect(config.refactors[0].detect).toMatchObject({ binary: true });
  });

  it('parses an optional description on a refactor', () => {
    const config = parseConfig(`
refactors:
  - id: abc
    name: Lazy routes
    description: Frontend route lazy-loading rollout
    detect:
      done: { command: "echo 1" }
      total: { command: "echo 2" }
`);
    expect(config.refactors[0].description).toBe('Frontend route lazy-loading rollout');
  });

  it('rejects a detect with fewer than two of done/remaining/total', () => {
    expect(() =>
      parseConfig(`
refactors:
  - id: bad
    name: Bad
    detect:
      done:
        command: "echo 1"
`),
    ).toThrow();
  });
});

describe('expandEnv', () => {
  beforeEach(() => {
    process.env.TEST_TOKEN = 'secret-123';
  });

  it('expands a string that is exactly $VAR', () => {
    expect(expandEnv({ token: '$TEST_TOKEN' })).toEqual({ token: 'secret-123' });
  });

  it('leaves strings that merely contain $ untouched', () => {
    expect(expandEnv({ command: "grep '$foo' src" })).toEqual({ command: "grep '$foo' src" });
  });

  it('throws when the referenced env var is unset', () => {
    expect(() => expandEnv({ token: '$DEFINITELY_UNSET_VAR' })).toThrow(/DEFINITELY_UNSET_VAR/);
  });
});
