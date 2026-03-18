export function formatStaleness(scrapedAt: string, locale: string): string {
  const ageMs = Date.now() - new Date(scrapedAt).getTime();
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (ageDays < 1) return rtf.format(0, 'day');
  if (ageDays < 30) return rtf.format(-ageDays, 'day');
  if (ageDays < 365) return rtf.format(-Math.floor(ageDays / 30), 'month');
  return rtf.format(-Math.floor(ageDays / 365), 'year');
}

export function isStale(scrapedAt: string): boolean {
  return Date.now() - new Date(scrapedAt).getTime() > 90 * 24 * 60 * 60 * 1000;
}
