const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(iso: string, nowIso: string): string {
  const d = new Date(iso);
  const now = new Date(nowIso);
  const sameYear = d.getUTCFullYear() === now.getUTCFullYear();
  const day = d.getUTCDate();
  const month = MONTH[d.getUTCMonth()];
  return sameYear ? `${month} ${day}` : `${month} ${day}, ${d.getUTCFullYear()}`;
}

export function ageDays(fromIso: string, toIso: string): number {
  return Math.floor((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000);
}
