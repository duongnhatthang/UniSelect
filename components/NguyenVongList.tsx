'use client';

import { useTranslations } from 'next-intl';
import type { RecommendResult } from '../lib/recommend/types';
import { TierBadge } from './TierBadge';
import { computeDelta } from '../lib/recommend/delta';

export interface NvItem {
  u: string;   // university_id
  m: string;   // major_id
  un?: string;  // university_name_vi (for display after reload)
  mn?: string;  // major_name_vi
  t?: string;   // tier
  wc?: number;  // weighted_cutoff
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

  const list = (nguyenVong ?? []).slice(0, 15);

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-on-surface">
        {t('nguyenVong')}
      </h2>

      {list.length === 0 ? (
        <p className="text-sm text-on-surface-muted text-center py-4">
          {t('addToList')}
        </p>
      ) : (
        <ol className="space-y-2">
          {list.map((item, index) => {
            // Insert tier group header before positions 1, 6, 11 (indices 0, 5, 10)
            const header = TIER_HEADERS.find(h => h.index === index && list.length > h.index);

            // Look up full result for display; fall back to stored data from NvItem
            const result = results.find(r => r.university_id === item.u && r.major_id === item.m);
            const cutoff = result?.weighted_cutoff ?? item.wc;
            const deltaStr = cutoff != null ? computeDelta(userScore, cutoff) : undefined;

            return (
              <li key={`${item.u}-${item.m}-${index}`}>
                {header && (
                  <div className="flex items-center gap-2 mt-4 mb-2 first:mt-0">
                    <span className="text-xs font-semibold uppercase tracking-wide text-on-surface-muted">
                      {t(header.labelKey)} ({header.range})
                    </span>
                    <span className="text-xs text-on-surface-muted opacity-70">
                      — {t(header.descKey)}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-3 border border-border rounded-lg p-3 bg-surface shadow-sm">
                  <span
                    data-testid="nv-rank"
                    className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-surface-subtle text-xs font-bold text-on-surface"
                  >
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <TierBadge tier={result?.tier ?? item.t ?? 'practical'} />
                    </div>
                    <p className="font-medium text-on-surface text-sm truncate">
                      {result?.university_name_vi ?? item.un ?? item.u}
                    </p>
                    <p className="text-on-surface-muted text-xs truncate">
                      {result?.major_name_vi ?? item.mn ?? item.m}
                    </p>
                  </div>
                  {/* Score + delta */}
                  {cutoff != null && (
                    <div className="text-right flex-shrink-0 mr-1">
                      <p className="font-semibold text-on-surface text-sm">{cutoff.toFixed(1)}</p>
                      {deltaStr && (
                        <p className="text-xs text-on-surface-muted">{deltaStr}</p>
                      )}
                    </div>
                  )}
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => moveUp(index)}
                      disabled={index === 0}
                      aria-label={t('moveUp')}
                      className="w-7 h-7 flex items-center justify-center rounded text-on-surface-muted hover:text-on-surface hover:bg-surface-subtle disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveDown(index)}
                      disabled={index === list.length - 1}
                      aria-label={t('moveDown')}
                      className="w-7 h-7 flex items-center justify-center rounded text-on-surface-muted hover:text-on-surface hover:bg-surface-subtle disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      ↓
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFromList(index)}
                    aria-label={t('removeFromList')}
                    className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded text-on-surface-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* Share link */}
      {list.length > 0 && (
        <div className="mt-3 p-3 bg-surface-subtle rounded-lg border border-border flex items-center justify-between">
          <p className="text-xs text-on-surface-muted">
            {t('shareLink')}
          </p>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
            }}
            className="text-xs font-medium text-primary hover:text-primary-hover transition-colors ml-2"
          >
            {t('copyLink')}
          </button>
        </div>
      )}
    </div>
  );
}
