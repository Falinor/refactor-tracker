import moment from 'moment';

export function parseDate(input: string): Date {
  return moment(input, 'YYYY-MM-DD').toDate();
}
