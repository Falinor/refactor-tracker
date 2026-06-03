import { describe, it, expect } from 'vitest';
import { resolveDetection, resolveList, type CommandRunner } from '../src/detect.js';

// Fake runner: maps a command string to a canned result.
function fakeRunner(map: Record<string, { stdout?: string; exitCode?: number }>): CommandRunner {
  return async (command: string) => ({
    stdout: map[command]?.stdout ?? '',
    exitCode: map[command]?.exitCode ?? 0,
  });
}

describe('resolveDetection', () => {
  it('computes remaining from done + total', async () => {
    const run = fakeRunner({ d: { stdout: '4' }, t: { stdout: '11' } });
    const counts = await resolveDetection(
      { done: { command: 'd' }, total: { command: 't' } } as any,
      run,
    );
    expect(counts).toEqual({ done: 4, total: 11 });
  });

  it('computes total from done + remaining', async () => {
    const run = fakeRunner({ d: { stdout: '7' }, r: { stdout: '2' } });
    const counts = await resolveDetection(
      { done: { command: 'd' }, remaining: { command: 'r' } } as any,
      run,
    );
    expect(counts).toEqual({ done: 7, total: 9 });
  });

  it('computes done from remaining + total', async () => {
    const run = fakeRunner({ r: { stdout: '3' }, t: { stdout: '10' } });
    const counts = await resolveDetection(
      { remaining: { command: 'r' }, total: { command: 't' } } as any,
      run,
    );
    expect(counts).toEqual({ done: 7, total: 10 });
  });

  it('treats exit code 0 as done for binary detection', async () => {
    const run = fakeRunner({ check: { exitCode: 0 } });
    const counts = await resolveDetection({ command: 'check', binary: true } as any, run);
    expect(counts).toEqual({ done: 1, total: 1 });
  });

  it('treats non-zero exit code as not done for binary detection', async () => {
    const run = fakeRunner({ check: { exitCode: 1 } });
    const counts = await resolveDetection({ command: 'check', binary: true } as any, run);
    expect(counts).toEqual({ done: 0, total: 1 });
  });

  it('throws when a command does not print a non-negative integer', async () => {
    const run = fakeRunner({ d: { stdout: 'not-a-number' }, t: { stdout: '5' } });
    await expect(
      resolveDetection({ done: { command: 'd' }, total: { command: 't' } } as any, run),
    ).rejects.toThrow(/non-negative integer/);
  });
});

describe('resolveList', () => {
  it('returns undefined when detect has no list field', async () => {
    const run = fakeRunner({});
    const items = await resolveList(
      { done: { command: 'd' }, total: { command: 't' } } as any,
      run,
    );
    expect(items).toBeUndefined();
  });

  it('returns undefined for binary detection', async () => {
    const run = fakeRunner({});
    const items = await resolveList({ command: 'check', binary: true } as any, run);
    expect(items).toBeUndefined();
  });

  it('parses lines, trims, drops empty lines', async () => {
    const run = fakeRunner({
      ls: { stdout: '  src/foo.ts  \n\nsrc/bar.ts\n   \nsrc/baz.ts\n' },
    });
    const items = await resolveList(
      {
        done: { command: 'd' },
        total: { command: 't' },
        list: { command: 'ls' },
      } as any,
      run,
    );
    expect(items).toEqual(['src/foo.ts', 'src/bar.ts', 'src/baz.ts']);
  });

  it('returns undefined when the list command produces no items', async () => {
    const run = fakeRunner({ ls: { stdout: '\n  \n' } });
    const items = await resolveList(
      {
        done: { command: 'd' },
        total: { command: 't' },
        list: { command: 'ls' },
      } as any,
      run,
    );
    expect(items).toBeUndefined();
  });
});
