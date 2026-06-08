import { describe, it, expect } from 'vitest';
import { formatMoney } from '../src/utils';

describe('formatMoney', () => {
  it('formats cents to a currency string', () => {
    expect(formatMoney(1234, 'USD')).toBe('$12.34');
  });

  it('handles zero', () => {
    expect(formatMoney(0, 'EUR')).toBe('€0.00');
  });
});
