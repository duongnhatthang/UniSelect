'use client';

import { useTranslations } from 'next-intl';
import type { RecommendResult } from '../lib/recommend/types';
import { TierBadge } from './TierBadge';
import { StalenessIndicator } from './StalenessIndicator';
import { computeDelta } from '../lib/recommend/delta';

interface ResultsListProps {
  results: RecommendResult[];
  loading: boolean;
  userScore: number;
}

const TREND_DISPLAY = {
  rising:  { icon: '↑', color: 'text-amber-600' },  // rising cutoff = harder to get in = warning
  falling: { icon: '↓', color: 'text-green-600' },  // falling cutoff = easier to get in = favorable
  stable:  { icon: '–', color: 'text-gray-400' },
} as const;

export function ResultsList({ results, loading, userScore }: ResultsListProps) {
  const t = useTranslations('common');

  if (loading) {
    return (
      <div aria-label="loading" className="space-y-3">
        {[1, 2, 3].map(i => (
          <div
            key={i}
            className="border rounded-lg p-4 shadow-sm animate-pulse bg-gray-50 h-20"
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-4">{t('noResults')}</p>
    );
  }

  return (
    <div className="space-y-3">
      {results.map(result => {
        const deltaStr = computeDelta(userScore, result.weighted_cutoff);
        const trend = TREND_DISPLAY[result.trend];

        return (
          <div
            key={`${result.university_id}-${result.major_id}`}
            className="border rounded-lg p-4 shadow-sm bg-white"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <TierBadge tier={result.tier} />
                  <span className={`text-sm ${trend.color}`} aria-label={`trend ${result.trend}`}>
                    {trend.icon}
                  </span>
                </div>
                <p className="font-semibold text-gray-900 text-sm truncate">
                  {result.university_name_vi}
                </p>
                <p className="text-gray-600 text-sm truncate">{result.major_name_vi}</p>
                <p className="text-xs text-gray-400 mt-1">{result.tohop_code}</p>
                <div className="mt-1">
                  <StalenessIndicator
                    scrapedAt={result.scraped_at}
                    sourceUrl={result.source_url}
                  />
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-semibold text-gray-900">{result.weighted_cutoff.toFixed(1)}</p>
                <p className="text-xs text-gray-500">
                  {deltaStr}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
