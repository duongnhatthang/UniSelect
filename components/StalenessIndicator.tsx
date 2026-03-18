'use client';
import { useLocale, useTranslations } from 'next-intl';
import { formatStaleness, isStale } from '../lib/utils/staleness';

interface Props {
  scrapedAt: string | null;
  sourceUrl: string | null;
}

export function StalenessIndicator({ scrapedAt, sourceUrl }: Props) {
  const locale = useLocale();
  const t = useTranslations('common');

  if (!scrapedAt) return null;

  const stale = isStale(scrapedAt);
  const age = formatStaleness(scrapedAt, locale);

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
      <time dateTime={scrapedAt}>{age}</time>
      {sourceUrl && (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:text-blue-700"
          aria-label={t('source')}
        >
          &#x1F517;
        </a>
      )}
      {stale && (
        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">
          {t('dataOutdated')}
        </span>
      )}
    </span>
  );
}
