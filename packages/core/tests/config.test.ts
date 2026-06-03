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

  it('parses optional tags on a refactor as a string array', () => {
    const config = parseConfig(`
refactors:
  - id: abc
    name: Lazy routes
    tags: [frontend, performance]
    detect:
      done: { command: "echo 1" }
      total: { command: "echo 2" }
`);
    expect(config.refactors[0].tags).toEqual(['frontend', 'performance']);
  });

  it('leaves tags undefined when the field is omitted', () => {
    const config = parseConfig(`
refactors:
  - id: abc
    name: Lazy routes
    detect:
      done: { command: "echo 1" }
      total: { command: "echo 2" }
`);
    expect(config.refactors[0].tags).toBeUndefined();
  });

  it('accepts an optional list command alongside count fields', () => {
    const config = parseConfig(`
refactors:
  - id: abc
    name: Lazy routes
    detect:
      done: { command: "echo 1" }
      total: { command: "echo 2" }
      list: { command: "echo foo" }
`);
    expect(config.refactors[0].detect).toMatchObject({
      list: { command: 'echo foo' },
    });
  });

  it('rejects a list field combined with binary: true', () => {
    expect(() =>
      parseConfig(`
refactors:
  - id: bin
    name: Bin
    detect:
      command: "node -e 'process.exit(0)'"
      binary: true
      list: { command: "echo foo" }
`),
    ).toThrow();
  });

  it('rejects a non-string-array tags value', () => {
    expect(() =>
      parseConfig(`
refactors:
  - id: abc
    name: Lazy routes
    tags: "frontend"
    detect:
      done: { command: "echo 1" }
      total: { command: "echo 2" }
`),
    ).toThrow();
  });
});

describe('registeredAt', () => {
  it('accepts a bare ISO date and normalizes it to a full timestamp', () => {
    const config = parseConfig(`
refactors:
  - id: a
    name: A
    registeredAt: 2026-03-12
    detect:
      done: { command: "echo 1" }
      total: { command: "echo 2" }
`);
    expect(config.refactors[0].registeredAt).toBe('2026-03-12T00:00:00.000Z');
  });

  it('accepts a full ISO timestamp unchanged', () => {
    const config = parseConfig(`
refactors:
  - id: a
    name: A
    registeredAt: 2026-03-12T10:00:00.000Z
    detect:
      done: { command: "echo 1" }
      total: { command: "echo 2" }
`);
    expect(config.refactors[0].registeredAt).toBe('2026-03-12T10:00:00.000Z');
  });

  it('rejects malformed date strings', () => {
    expect(() =>
      parseConfig(`
refactors:
  - id: a
    name: A
    registeredAt: not-a-date
    detect:
      done: { command: "echo 1" }
      total: { command: "echo 2" }
`),
    ).toThrow();
  });

  it('treats registeredAt as optional', () => {
    const config = parseConfig(`
refactors:
  - id: a
    name: A
    detect:
      done: { command: "echo 1" }
      total: { command: "echo 2" }
`);
    expect(config.refactors[0].registeredAt).toBeUndefined();
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
