import { describe, it, expect } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { JsonReporter } from '../../src/reporters/json.js';
import type { Report } from '../../src/types.js';

const report: Report = {
  timestamp: '2026-05-28T12:00:00.000Z',
  hasChanges: true,
  tasks: [
    {
      id: 'a',
      name: 'Lazy routes',
      done: 4,
      total: 11,
      percentage: 36,
      delta: 3,
      registeredAt: null,
      completedAt: null,
      durationDays: null,
    },
  ],
};

describe('JsonReporter', () => {
  it('writes the report as JSON, creating parent directories', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'rt-json-'));
    try {
      const out = path.join(dir, 'nested', 'report.json');
      await new JsonReporter(out).report(report);
      const written = JSON.parse(await readFile(out, 'utf8'));
      expect(written).toEqual(report);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('serializes items when present on a task', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'rt-json-'));
    try {
      const out = path.join(dir, 'report.json');
      const withItems: Report = {
        timestamp: '2026-05-28T12:00:00.000Z',
        hasChanges: true,
        tasks: [
          {
            id: 'a',
            name: 'Lazy routes',
            done: 1,
            total: 3,
            percentage: 33,
            delta: null,
            items: ['src/foo.ts', 'src/bar.ts'],
            registeredAt: null,
            completedAt: null,
            durationDays: null,
          },
        ],
      };
      await new JsonReporter(out).report(withItems);
      const written = JSON.parse(await readFile(out, 'utf8'));
      expect(written.tasks[0].items).toEqual(['src/foo.ts', 'src/bar.ts']);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('passes registeredAt, completedAt, and durationDays through to the JSON output', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'rt-json-'));
    try {
      const out = path.join(dir, 'report.json');
      const withMilestones: Report = {
        timestamp: '2026-05-28T12:00:00.000Z',
        hasChanges: true,
        tasks: [
          {
            id: 'a',
            name: 'Lazy routes',
            done: 2,
            total: 5,
            percentage: 40,
            delta: null,
            registeredAt: '2026-03-12T00:00:00.000Z',
            completedAt: null,
            durationDays: null,
          },
        ],
      };
      await new JsonReporter(out).report(withMilestones);
      const parsed = JSON.parse(await readFile(out, 'utf8'));
      expect(parsed.tasks[0].registeredAt).toBe('2026-03-12T00:00:00.000Z');
      expect(parsed.tasks[0].completedAt).toBeNull();
      expect(parsed.tasks[0].durationDays).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
