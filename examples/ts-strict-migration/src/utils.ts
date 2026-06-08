import type { Money } from './types.js';

export function formatMoney({ amount, currency }: Money): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount / 100);
}
