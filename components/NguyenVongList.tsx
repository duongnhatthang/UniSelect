'use client';

import { useTranslations } from 'next-intl';
import type { RecommendResult } from '../lib/recommend/types';
import { TierBadge } from './TierBadge';
import { computeDelta } from '../lib/recommend/delta';

export interface NvItem {
  u: string;
  m: string;
}

interface NguyenVongListProps {
  nguyenVong: NvItem[];
  setNguyenVong: (items: NvItem[]) => void;
  results: RecommendResult[];
  userScore: number;
}

interface TierGroupHeader {
  index: number;
  labelKey: 'tierDream' | 'tierPractical' | 'tierSafe';
  descKey: 'tierDreamDesc' | 'tierPracticalDesc' | 'tierSafeDesc';
  range: string;
}

const TIER_HEADERS: TierGroupHeader[] = [
  { index: 0, labelKey: 'tierDream', descKey: 'tierDreamDesc', range: '1-5' },
  { index: 5, labelKey: 'tierPractical', descKey: 'tierPracticalDesc', range: '6-10' },
  { index: 10, labelKey: 'tierSafe', descKey: 'tierSafeDesc', range: '11-15' },
];

export function NguyenVongList({ nguyenVong, setNguyenVong, results, userScore }: NguyenVongListProps) {
  const t = useTranslations('common');

  function moveUp(index: number) {
    if (index === 0) return;
    const next = [...nguyenVong];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    setNguyenVong(next);
  }

  function moveDown(index: number) {
    if (index === nguyenVong.length - 1) return;
    const next = [...nguyenVong];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    setNguyenVong(next);
  }

  function removeFromList(index: number) {
    const next = nguyenVong.filter((_, i) => i !== index);
    setNguyenVong(next);
  }

  const list = nguyenVong.slice(0, 15);

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
        {t('nguyenVong')}
      </h2>

      {list.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
          {t('addToList')}
        </p>
      ) : (
        <ol className="space-y-2">
          {list.map((item, index) => {
            // Insert tier group header before positions 1, 6, 11 (indices 0, 5, 10)
            const header = TIER_HEADERS.find(h => h.index === index && list.length > h.index);

            // Look up full result for display
            const result = results.find(r => r.university_id === item.u && r.major_id === item.m);
            const deltaStr = result ? computeDelta(userScore, result.weighted_cutoff) : undefined;

            return (
              <li key={`${item.u}-${item.m}-${index}`}>
                {header && (
                  <div className="flex items-center gap-2 mt-4 mb-2 first:mt-0">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      {t(header.labelKey)} ({header.range})
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      — {t(header.descKey)}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-3 border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800 shadow-sm">
                  <span
                    data-testid="nv-rank"
                    className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-bold text-gray-700 dark:text-gray-300"
                  >
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <TierBadge tier={result?.tier ?? 'practical'} delta={deltaStr} />
                    </div>
                    <p className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">
                      {result?.university_name_vi ?? item.u}
                    </p>
                    <p className="text-gray-600 dark:text-gray-400 text-xs truncate">
                      {result?.major_name_vi ?? item.m}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => moveUp(index)}
                      disabled={index === 0}
                      aria-label={t('moveUp')}
                      className="w-7 h-7 flex items-center justify-center rounded text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveDown(index)}
                      disabled={index === list.length - 1}
                      aria-label={t('moveDown')}
                      className="w-7 h-7 flex items-center justify-center rounded text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      ↓
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFromList(index)}
                    aria-label={t('removeFromList')}
                    className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:text-gray-500 dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* Share link hint */}
      {list.length > 0 && (
        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('shareLink')}
          </p>
        </div>
      )}
    </div>
  );
}
