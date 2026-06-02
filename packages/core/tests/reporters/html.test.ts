import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { formatHtml, HtmlReporter } from '../../src/reporters/html.js';
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
    {
      id: 'b',
      name: 'Drop legacy <Modal>',
      done: 0,
      total: 5,
      percentage: 0,
      delta: null,
      registeredAt: null,
      completedAt: null,
      durationDays: null,
    },
  ],
};

describe('formatHtml', () => {
  it('renders a complete HTML5 document with the title and timestamp', () => {
    const html = formatHtml(report);
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('<title>Refactor progress</title>');
    expect(html).toContain('<h1>Refactor progress</h1>');
    expect(html).toContain('<time datetime="2026-05-28T12:00:00.000Z">');
  });

  it('renders the timestamp inside <time> with locale-formatted visible text', () => {
    const html = formatHtml(report);
    const visible =
      html.match(/<time datetime="2026-05-28T12:00:00\.000Z">([^<]*)<\/time>/)?.[1] ?? '';
    // Year appears in every common locale format; the raw ISO must not leak into the visible text.
    expect(visible).toContain('2026');
    expect(visible).not.toBe('2026-05-28T12:00:00.000Z');
    expect(visible.length).toBeGreaterThan(0);
  });

  it('elevates the overall summary with a colored left accent and a taller bar', () => {
    const html = formatHtml(report);
    // Overall percentage 25 → barColor hsl(30, 65%, 45%); the accent uses the same color.
    expect(html).toContain(
      '<section class="summary" style="border-left: 4px solid hsl(30, 65%, 45%);">',
    );
    expect(html).toContain('.summary .bar { height: 16px;');
  });

  it('renders one .refactor card per task with name, counts, and percentage', () => {
    const html = formatHtml(report);
    const cards = html.match(/<li class="refactor">/g) ?? [];
    expect(cards).toHaveLength(2);
    expect(html).toContain('Lazy routes');
    expect(html).toContain('4 / 11');
    expect(html).toContain('36%');
    expect(html).toContain('0 / 5');
    expect(html).toContain('0%');
  });

  it('renders a progress bar whose fill width matches the percentage', () => {
    const html = formatHtml(report);
    expect(html).toContain('width: 36%');
    expect(html).toContain('width: 0%');
  });

  it('renders a green delta chip for positive delta', () => {
    const html = formatHtml(report);
    expect(html).toContain('<span class="delta delta-up">+3</span>');
  });

  it('omits the delta chip when delta is null (first run)', () => {
    const html = formatHtml(report);
    // Second card belongs to "Drop legacy <Modal>" with delta: null.
    const cards = html.match(/<li class="refactor">[\s\S]*?<\/li>/g) ?? [];
    const modalCard = cards[1] ?? '';
    expect(modalCard).not.toContain('class="delta');
  });

  it('omits the delta chip when delta is 0', () => {
    const zeroReport: Report = {
      timestamp: '2026-05-28T12:00:00.000Z',
      hasChanges: false,
      tasks: [
        {
          id: 'a',
          name: 'Stable',
          done: 4,
          total: 10,
          percentage: 40,
          delta: 0,
          registeredAt: null,
          completedAt: null,
          durationDays: null,
        },
      ],
    };
    const html = formatHtml(zeroReport);
    expect(html).not.toContain('class="delta');
  });

  it('renders a red delta chip with U+2212 minus for negative delta', () => {
    const regressionReport: Report = {
      timestamp: '2026-05-28T12:00:00.000Z',
      hasChanges: true,
      tasks: [
        {
          id: 'a',
          name: 'Backslid',
          done: 3,
          total: 10,
          percentage: 30,
          delta: -2,
          registeredAt: null,
          completedAt: null,
          durationDays: null,
        },
      ],
    };
    const html = formatHtml(regressionReport);
    expect(html).toContain('<span class="delta delta-down">−2</span>');
  });

  it('colors each progress bar by completion using hsl', () => {
    const html = formatHtml(report);
    // 36% → hue round(36 * 1.2) = 43
    expect(html).toContain('background: hsl(43, 65%, 45%)');
    // 0% → hue 0 (red)
    expect(html).toContain('background: hsl(0, 65%, 45%)');
  });

  it('renders an overall summary with grand totals and aggregate percentage', () => {
    const html = formatHtml(report);
    // grandDone = 4 + 0 = 4; grandTotal = 11 + 5 = 16; round(4/16*100) = 25
    expect(html).toContain('<section class="summary"');
    expect(html).toContain('4 / 16');
    expect(html).toContain('25%');
    // 25% → hue round(25 * 1.2) = 30
    expect(html).toContain('background: hsl(30, 65%, 45%)');
  });

  it('treats overall percentage as 0 when grandTotal is 0', () => {
    const emptyReport: Report = {
      timestamp: '2026-05-28T12:00:00.000Z',
      hasChanges: false,
      tasks: [
        {
          id: 'a',
          name: 'Empty',
          done: 0,
          total: 0,
          percentage: 0,
          delta: null,
          registeredAt: null,
          completedAt: null,
          durationDays: null,
        },
      ],
    };
    const html = formatHtml(emptyReport);
    expect(html).toContain('0 / 0');
    expect(html).toMatch(/<section class="summary"[\s\S]*?0%/);
  });

  it('html-escapes task names containing < and >', () => {
    const html = formatHtml(report);
    // "Drop legacy <Modal>" must be escaped — never appear raw
    expect(html).toContain('Drop legacy &lt;Modal&gt;');
    expect(html).not.toContain('Drop legacy <Modal>');
  });

  it('renders a description subtitle when a task has one', () => {
    const withDesc: Report = {
      timestamp: '2026-05-28T12:00:00.000Z',
      hasChanges: true,
      tasks: [
        {
          id: 'a',
          name: 'Lazy routes',
          description: 'Frontend route lazy-loading rollout',
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
    const html = formatHtml(withDesc);
    expect(html).toContain('<p class="description">Frontend route lazy-loading rollout</p>');
  });

  it('omits the description element when a task has no description', () => {
    const html = formatHtml(report);
    // Neither fixture task has a description.
    expect(html).not.toContain('class="description"');
  });

  it('html-escapes a description containing < and &', () => {
    const withDesc: Report = {
      timestamp: '2026-05-28T12:00:00.000Z',
      hasChanges: true,
      tasks: [
        {
          id: 'a',
          name: 'Foo',
          description: 'A & B <C>',
          done: 1,
          total: 2,
          percentage: 50,
          delta: null,
          registeredAt: null,
          completedAt: null,
          durationDays: null,
        },
      ],
    };
    const html = formatHtml(withDesc);
    expect(html).toContain('A &amp; B &lt;C&gt;');
  });

  it('html-escapes task names containing &', () => {
    const ampReport: Report = {
      timestamp: '2026-05-28T12:00:00.000Z',
      hasChanges: false,
      tasks: [
        {
          id: 'a',
          name: 'Foo & Bar',
          done: 1,
          total: 2,
          percentage: 50,
          delta: null,
          registeredAt: null,
          completedAt: null,
          durationDays: null,
        },
      ],
    };
    const html = formatHtml(ampReport);
    expect(html).toContain('Foo &amp; Bar');
    expect(html).not.toContain('Foo & Bar');
  });
});

describe('formatHtml with items', () => {
  it('renders a <details class="items"> per refactor card that has items', () => {
    const r: Report = {
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
    const html = formatHtml(r);
    expect(html).toContain('<details class="items">');
    expect(html).toContain('<summary>2 remaining</summary>');
    expect(html).toContain('<li>src/foo.ts</li>');
    expect(html).toContain('<li>src/bar.ts</li>');
  });

  it('does not render any <details class="items"> when no task has items', () => {
    const html = formatHtml(report);
    expect(html).not.toContain('details class="items"');
  });

  it('HTML-escapes item content', () => {
    const r: Report = {
      timestamp: '2026-05-28T12:00:00.000Z',
      hasChanges: true,
      tasks: [
        {
          id: 'a',
          name: 'Foo',
          done: 0,
          total: 1,
          percentage: 0,
          delta: null,
          items: ['<Component />'],
          registeredAt: null,
          completedAt: null,
          durationDays: null,
        },
      ],
    };
    const html = formatHtml(r);
    expect(html).toContain('&lt;Component /&gt;');
    expect(html).not.toContain('<li><Component />');
  });
});

describe('formatHtml grouped by tag', () => {
  it('renders one <section class="tag-group"> with <h2> per tag', () => {
    const r: Report = {
      timestamp: '2026-05-28T12:00:00.000Z',
      hasChanges: true,
      tasks: [
        {
          id: 'a',
          name: 'FE',
          tags: ['frontend'],
          done: 1,
          total: 2,
          percentage: 50,
          delta: null,
          registeredAt: null,
          completedAt: null,
          durationDays: null,
        },
        {
          id: 'b',
          name: 'BE',
          tags: ['backend'],
          done: 0,
          total: 3,
          percentage: 0,
          delta: null,
          registeredAt: null,
          completedAt: null,
          durationDays: null,
        },
      ],
    };
    const html = formatHtml(r);
    expect(html).toContain('<section class="tag-group">');
    expect(html).toContain('<h2>frontend</h2>');
    expect(html).toContain('<h2>backend</h2>');
    expect(html.indexOf('<h2>frontend</h2>')).toBeLessThan(html.indexOf('<h2>backend</h2>'));
    expect(html).toContain('FE');
    expect(html).toContain('BE');
  });

  it('renders an "Untagged" section last when both tagged and untagged tasks exist', () => {
    const r: Report = {
      timestamp: '2026-05-28T12:00:00.000Z',
      hasChanges: true,
      tasks: [
        {
          id: 'a',
          name: 'FE',
          tags: ['frontend'],
          done: 1,
          total: 2,
          percentage: 50,
          delta: null,
          registeredAt: null,
          completedAt: null,
          durationDays: null,
        },
        {
          id: 'b',
          name: 'Loose',
          done: 0,
          total: 3,
          percentage: 0,
          delta: null,
          registeredAt: null,
          completedAt: null,
          durationDays: null,
        },
      ],
    };
    const html = formatHtml(r);
    expect(html).toContain('<h2>Untagged</h2>');
    expect(html.indexOf('<h2>frontend</h2>')).toBeLessThan(html.indexOf('<h2>Untagged</h2>'));
  });

  it('renders a single flat <ul class="refactors"> when no task has tags', () => {
    const html = formatHtml(report);
    expect(html).not.toContain('tag-group');
    expect(html).not.toContain('<h2>');
    expect((html.match(/<ul class="refactors">/g) ?? []).length).toBe(1);
  });
});

describe('html milestone columns', () => {
  const baseTask = {
    id: 'a',
    name: 'A',
    done: 4,
    total: 10,
    percentage: 40,
    delta: null,
    registeredAt: null as string | null,
    completedAt: null as string | null,
    durationDays: null as number | null,
  };

  it('renders Registered, Completed, and Duration columns with tooltips', () => {
    const html = formatHtml({
      timestamp: '2026-05-28T12:00:00.000Z',
      hasChanges: true,
      tasks: [
        {
          ...baseTask,
          done: 10,
          percentage: 100,
          registeredAt: '2026-04-01T00:00:00.000Z',
          completedAt: '2026-05-30T00:00:00.000Z',
          durationDays: 59,
        },
      ],
    });
    expect(html).toContain('Registered');
    expect(html).toContain('Completed');
    expect(html).toContain('Duration');
    expect(html).toContain('title="2026-04-01T00:00:00.000Z"');
    expect(html).toContain('title="2026-05-30T00:00:00.000Z"');
    expect(html).toContain('59d');
  });

  it('renders em dash for missing milestone fields', () => {
    const html = formatHtml({
      timestamp: '2026-05-28T12:00:00.000Z',
      hasChanges: true,
      tasks: [{ ...baseTask }],
    });
    // Accept literal em dash or HTML entities.
    expect(html).toMatch(/—|&mdash;|&#8212;/);
  });
});

describe('HtmlReporter', () => {
  it('writes html to the output file, creating parent directories', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'rt-html-'));
    try {
      const out = path.join(dir, 'docs', 'progress.html');
      await new HtmlReporter(out).report(report);
      const contents = await readFile(out, 'utf8');
      expect(contents).toMatch(/^<!DOCTYPE html>/);
      expect(contents).toContain('Lazy routes');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
