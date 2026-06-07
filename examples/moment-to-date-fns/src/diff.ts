import { differenceInDays } from 'date-fns';

export function daysBetween(from: Date, to: Date): number {
  return differenceInDays(to, from);
}
