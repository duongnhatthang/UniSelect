'use client';

import { useEffect } from 'react';
import { useQueryState, parseAsJson } from 'nuqs';
import { useTranslations } from 'next-intl';
import type { RecommendResult } from '../lib/recommend/types';
import { TierBadge } from './TierBadge';

interface NguyenVongListProps {
  results: RecommendResult[];
  userScore: number;
}

interface NvItem {
  u: string;
  m: string;
}

export function NguyenVongList({ results, userScore }: NguyenVongListProps) {
  const t = useTranslations('common');

  const [nguyenVong, setNguyenVong] = useQueryState(
    'nv',
    parseAsJson<NvItem[]>((value): NvItem[] | null => {
      if (!Array.isArray(value)) return null;
      return value as NvItem[];
    }).withDefault([])
  );

  const top15 = results.filter(r => r.suggested_top_15);

  // Sync URL state whenever top15 changes
  useEffect(() => {
    if (top15.length > 0) {
      setNguyenVong(top15.map(r => ({ u: r.university_id, m: r.major_id })));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results]);

  if (top15.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-gray-900">
        {t('nguyenVong')}
      </h2>

      <ol className="space-y-2">
        {top15.slice(0, 15).map((result, index) => {
          const delta = (userScore - result.weighted_cutoff).toFixed(1);
          const sign = userScore >= result.weighted_cutoff ? '+' : '';

          return (
            <li
              key={`${result.university_id}-${result.major_id}`}
              className="flex items-center gap-3 border rounded-lg p-3 bg-white shadow-sm"
            >
              <span data-testid="nv-rank" className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-700">
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <TierBadge tier={result.tier} />
                </div>
                <p className="font-medium text-gray-900 text-sm truncate">
                  {result.university_name_vi}
                </p>
                <p className="text-gray-600 text-xs truncate">{result.major_name_vi}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs font-semibold text-gray-900">
                  {result.weighted_cutoff.toFixed(1)}
                </p>
                <p className="text-xs text-gray-500">
                  {sign}{delta}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Share link hint */}
      {nguyenVong && nguyenVong.length > 0 && (
        <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-500">
            {t('shareLink')}
          </p>
        </div>
      )}
    </div>
  );
}
