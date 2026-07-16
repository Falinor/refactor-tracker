import { describe, it, expect } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { BadgeReporter, colorFor } from '../../src/reporters/badge.js';
import type { Report, TaskResult } from '../../src/types.js';

function task(overrides: Partial<TaskResult> = {}): TaskResult {
  return {
    id: 'a',
    name: 'Lazy routes',
    done: 4,
    total: 11,
    percentage: 36,
    delta: 3,
    registeredAt: null,
    completedAt: null,
    durationDays: null,
    ...overrides,
  };
}

function report(tasks: TaskResult[]): Report {
  return {
    timestamp: '2026-05-28T12:00:00.000Z',
    hasChanges: true,
    tasks,
  };
}

describe('colorFor', () => {
  it('returns red below 50%', () => {
    expect(colorFor(0)).toBe('red');
    expect(colorFor(49)).toBe('red');
  });

  it('returns yellow from 50% to 79%', () => {
    expect(colorFor(50)).toBe('yellow');
    expect(colorFor(79)).toBe('yellow');
  });

  it('returns green from 80% to 99%', () => {
    expect(colorFor(80)).toBe('green');
    expect(colorFor(99)).toBe('green');
  });

  it('returns brightgreen at 100%', () => {
    expect(colorFor(100)).toBe('brightgreen');
  });
});

describe('BadgeReporter', () => {
  it('writes an SVG badge, creating parent directories', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'rt-badge-'));
    try {
      const out = path.join(dir, 'nested', 'badge.svg');
      await new BadgeReporter(out).report(report([task({ done: 5, total: 10, percentage: 50 })]));
      const svg = await readFile(out, 'utf8');
      expect(svg).toContain('refactor-tracker');
      expect(svg).toContain('50%');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('aggregates by summing done and total across tasks, not averaging percentages', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'rt-badge-'));
    try {
      const out = path.join(dir, 'badge.svg');
      // Task a: 1/1 (100%), task b: 1/9 (11%). Average of percentages = 56%.
      // Sum-based aggregate = (1+1)/(1+9) = 20%. These must disagree so the
      // test actually distinguishes the two aggregation strategies.
      await new BadgeReporter(out).report(
        report([
          task({ id: 'a', done: 1, total: 1, percentage: 100 }),
          task({ id: 'b', done: 1, total: 9, percentage: 11 }),
        ]),
      );
      const svg = await readFile(out, 'utf8');
      expect(svg).toContain('20%');
      expect(svg).not.toContain('56%');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('renders a lightgrey "no refactors tracked" badge when total is zero', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'rt-badge-'));
    try {
      const out = path.join(dir, 'badge.svg');
      await new BadgeReporter(out).report(report([]));
      const svg = await readFile(out, 'utf8');
      expect(svg).toContain('no refactors tracked');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('always labels the badge refactor-tracker, regardless of task names', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'rt-badge-'));
    try {
      const out = path.join(dir, 'badge.svg');
      await new BadgeReporter(out).report(
        report([
          task({ id: 'z', name: 'Something else entirely', done: 1, total: 1, percentage: 100 }),
        ]),
      );
      const svg = await readFile(out, 'utf8');
      expect(svg).toContain('refactor-tracker');
      expect(svg).not.toContain('Something else entirely');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('wants the raw report so the badge ignores --show-completed/--sort-by view filters', () => {
    expect(new BadgeReporter('badge.svg').wantsRaw).toBe(true);
  });
});
