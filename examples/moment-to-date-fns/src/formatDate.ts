import moment from 'moment';

export function formatDate(input: string | Date): string {
  return moment(input).format('YYYY-MM-DD');
}
