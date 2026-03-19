'use client';

import { useTranslations } from 'next-intl';
import type { RecommendResult } from '../lib/recommend/types';
import { TierBadge } from './TierBadge';
import { StalenessIndicator } from './StalenessIndicator';
import { computeDelta } from '../lib/recommend/delta';
import type { NvItem } from './NguyenVongList';

interface ResultsListProps {
  results: RecommendResult[];
  loading: boolean;
  userScore: number;
  hasSubmitted: boolean;
  onAddToList?: (result: RecommendResult) => void;
  nguyenVong?: NvItem[];
}

const TREND_DISPLAY = {
  rising:  { icon: '↑', color: 'text-amber-600' },  // rising cutoff = harder to get in = warning
  falling: { icon: '↓', color: 'text-green-600' },  // falling cutoff = easier to get in = favorable
  stable:  { icon: '', color: '' },                  // no indicator for stable trend
} as const;

export function ResultsList({ results, loading, userScore, hasSubmitted, onAddToList, nguyenVong }: ResultsListProps) {
  const t = useTranslations('common');

  if (loading) {
    return (
      <div aria-label="loading" className="space-y-3">
        {[1, 2, 3].map(i => (
          <div
            key={i}
            className="border rounded-lg p-4 shadow-sm animate-pulse bg-surface-subtle h-20"
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }

  if (!hasSubmitted && results.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-on-surface-muted">{t('emptyStateBeforeSubmission')}</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <p className="text-sm text-on-surface-muted text-center py-4">{t('noResults')}</p>
    );
  }

  return (
    <div className="space-y-3">
      {results.map(result => {
        const deltaStr = computeDelta(userScore, result.weighted_cutoff);
        const trend = TREND_DISPLAY[result.trend];

        const isInList = nguyenVong?.some(x => x.u === result.university_id && x.m === result.major_id) ?? false;
        const listFull = (nguyenVong?.length ?? 0) >= 15;

        return (
          <div
            key={`${result.university_id}-${result.major_id}`}
            className="border rounded-lg p-4 shadow-sm bg-surface"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <TierBadge tier={result.tier} />
                  <span className={`text-sm ${trend.color}`} aria-label={`trend ${result.trend}`}>
                    {trend.icon}
                  </span>
                </div>
                <p className="font-semibold text-on-surface text-sm truncate">
                  {result.university_name_vi}
                </p>
                <p className="text-on-surface-muted text-sm truncate">{result.major_name_vi}</p>
                <p className="text-xs text-on-surface-muted mt-1">{result.tohop_code}</p>
                <div className="mt-1">
                  <StalenessIndicator
                    scrapedAt={result.scraped_at}
                    sourceUrl={result.source_url}
                  />
                </div>
              </div>
              <div className="flex items-start gap-2 flex-shrink-0">
                <div className="text-right">
                  <p className="font-semibold text-on-surface">{result.weighted_cutoff.toFixed(1)}</p>
                  <p className="text-xs text-on-surface-muted">
                    {deltaStr}
                  </p>
                </div>
                {onAddToList && (
                  <button
                    type="button"
                    onClick={() => !isInList && !listFull && onAddToList(result)}
                    disabled={isInList || listFull}
                    aria-label={isInList ? t('alreadyInList') : listFull ? t('listFull') : t('addToList')}
                    className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
                      isInList
                        ? 'text-on-surface-muted cursor-default'
                        : listFull
                        ? 'text-on-surface-muted opacity-40 cursor-not-allowed'
                        : 'text-primary hover:bg-primary/10'
                    }`}
                  >
                    {isInList ? '✓' : '+'}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
