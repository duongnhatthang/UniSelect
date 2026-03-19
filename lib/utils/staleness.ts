/** Coerce a Date or ISO string (from JSON serialization) to a Date object */
function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatStaleness(scrapedAt: Date | string, locale: string): string {
  const d = toDate(scrapedAt);
  const ageMs = Date.now() - d.getTime();
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (ageDays < 1) return rtf.format(0, 'day');
  if (ageDays < 30) return rtf.format(-ageDays, 'day');
  if (ageDays < 365) return rtf.format(-Math.floor(ageDays / 30), 'month');
  return rtf.format(-Math.floor(ageDays / 365), 'year');
}

export function isStale(scrapedAt: Date | string): boolean {
  const d = toDate(scrapedAt);
  return Date.now() - d.getTime() > 90 * 24 * 60 * 60 * 1000;
}
