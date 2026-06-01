import { describe, it, expect } from 'vitest';
import { formatHtml } from '../../src/reporters/html.js';
import type { Report } from '../../src/types.js';

const report: Report = {
  timestamp: '2026-05-28T12:00:00.000Z',
  hasChanges: true,
  tasks: [
    { id: 'a', name: 'Lazy routes', done: 4, total: 11, percentage: 36, delta: 3 },
    { id: 'b', name: 'Drop legacy <Modal>', done: 0, total: 5, percentage: 0, delta: null },
  ],
};

describe('formatHtml', () => {
  it('renders a complete HTML5 document with the title and timestamp', () => {
    const html = formatHtml(report);
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('<title>Refactor progress</title>');
    expect(html).toContain('<h1>Refactor progress</h1>');
    expect(html).toContain('2026-05-28T12:00:00.000Z');
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
      tasks: [{ id: 'a', name: 'Stable', done: 4, total: 10, percentage: 40, delta: 0 }],
    };
    const html = formatHtml(zeroReport);
    expect(html).not.toContain('class="delta');
  });

  it('renders a red delta chip with U+2212 minus for negative delta', () => {
    const regressionReport: Report = {
      timestamp: '2026-05-28T12:00:00.000Z',
      hasChanges: true,
      tasks: [{ id: 'a', name: 'Backslid', done: 3, total: 10, percentage: 30, delta: -2 }],
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
    expect(html).toContain('<section class="summary">');
    expect(html).toContain('4 / 16');
    expect(html).toContain('25%');
    // 25% → hue round(25 * 1.2) = 30
    expect(html).toContain('background: hsl(30, 65%, 45%)');
  });

  it('treats overall percentage as 0 when grandTotal is 0', () => {
    const emptyReport: Report = {
      timestamp: '2026-05-28T12:00:00.000Z',
      hasChanges: false,
      tasks: [{ id: 'a', name: 'Empty', done: 0, total: 0, percentage: 0, delta: null }],
    };
    const html = formatHtml(emptyReport);
    expect(html).toContain('0 / 0');
    expect(html).toMatch(/<section class="summary">[\s\S]*?0%/);
  });

  it('html-escapes task names containing < and >', () => {
    const html = formatHtml(report);
    // "Drop legacy <Modal>" must be escaped — never appear raw
    expect(html).toContain('Drop legacy &lt;Modal&gt;');
    expect(html).not.toContain('Drop legacy <Modal>');
  });
});
