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
});
