'use client';

import { useState, useEffect } from 'react';
import { useQueryStates, useQueryState } from 'nuqs';
import { parseAsString, parseAsFloat, parseAsJson } from 'nuqs';
import { useTranslations } from 'next-intl';
import type { RecommendResult } from '../lib/recommend/types';
import type { TohopCode } from '../lib/utils/tohop-subjects';
import { calculateTotal } from '../lib/utils/calculate-total';
import { ResultsList } from './ResultsList';
import { NguyenVongList } from './NguyenVongList';
import type { NvItem } from './NguyenVongList';

export function ScoreForm() {
  const t = useTranslations('common');

  const [params, setParams] = useQueryStates({
    tohop: parseAsString.withDefault(''),
    score: parseAsFloat,
    mode: parseAsString.withDefault('quick'),
  });

  const [nguyenVong, setNguyenVong] = useQueryState(
    'nv',
    parseAsJson<NvItem[]>((value): NvItem[] | null => {
      if (!Array.isArray(value)) return null;
      return value as NvItem[];
    }).withDefault([])
  );

  const [tohopCodes, setTohopCodes] = useState<TohopCode[]>([]);
  const [subjectScores, setSubjectScores] = useState<Record<string, number>>({});
  const [results, setResults] = useState<RecommendResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [scoreError, setScoreError] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Fetch tohop codes on mount
  useEffect(() => {
    fetch('/api/tohop')
      .then(res => res.json())
      .then((data: { data: TohopCode[] }) => {
        setApiError(null);
        setTohopCodes(data.data || []);
      })
      .catch(() => setApiError(t('apiError')));
  }, []);

  const selectedTohop = tohopCodes.find(t => t.code === params.tohop);
  const selectedSubjects = selectedTohop?.subjects ?? [];

  // Calculated total for detailed mode
  const detailedTotal = params.mode === 'detailed' && selectedSubjects.length > 0
    ? calculateTotal(subjectScores, selectedSubjects)
    : null;

  function validateScore(value: number | null): boolean {
    if (value === null || value === undefined) return true;
    return value >= 0 && value <= 30.0;
  }

  function handleScoreChange(value: string) {
    const num = value === '' ? null : parseFloat(value);
    setParams({ score: num });
    if (num !== null && (num < 0 || num > 30.0)) {
      setScoreError(t('enterScore'));
    } else {
      setScoreError('');
    }
  }

  async function fetchRecommendations(tohop: string, score: number) {
    setApiError(null);
    setLoading(true);
    setHasSubmitted(true);
    try {
      const res = await fetch(`/api/recommend?tohop=${tohop}&score=${score}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { data: RecommendResult[] } = await res.json();
      setResults(data.data || []);
    } catch {
      setApiError(t('apiError'));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const totalScore = params.mode === 'quick' ? params.score : detailedTotal;
    if (!params.tohop || totalScore === null || totalScore === undefined) return;
    if (!validateScore(totalScore)) return;

    await fetchRecommendations(params.tohop, totalScore);
  }

  // Auto-submit with debounce to prevent blinking on keystroke
  useEffect(() => {
    if (params.mode === 'detailed' && params.tohop && detailedTotal !== null && detailedTotal >= 0) {
      const timer = setTimeout(() => fetchRecommendations(params.tohop, detailedTotal!), 400);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailedTotal, params.tohop, params.mode]);

  useEffect(() => {
    if (params.mode === 'quick' && params.tohop && params.score !== null && params.score !== undefined && params.score >= 0 && params.score <= 30) {
      const timer = setTimeout(() => fetchRecommendations(params.tohop, params.score!), 400);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.score, params.tohop, params.mode]);

  const activeScore = params.mode === 'quick' ? params.score : detailedTotal;

  function addToList(result: RecommendResult) {
    const item: NvItem = {
      u: result.university_id,
      m: result.major_id,
      un: result.university_name_vi,
      mn: result.major_name_vi,
      t: result.tier,
      wc: result.weighted_cutoff,
    };
    const already = nguyenVong.some(x => x.u === item.u && x.m === item.m);
    if (!already && nguyenVong.length < 15) {
      setNguyenVong([...nguyenVong, item]);
    }
  }

  function setNguyenVongList(items: NvItem[]) {
    setNguyenVong(items);
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-4">
      {/* Mode tabs */}
      <div className="flex gap-2 mb-4 border-b border-border">
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            params.mode === 'quick'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-muted hover:text-on-surface'
          }`}
          onClick={() => setParams({ mode: 'quick' })}
        >
          {t('quickMode')}
        </button>
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            params.mode === 'detailed'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-muted hover:text-on-surface'
          }`}
          onClick={() => setParams({ mode: 'detailed' })}
        >
          {t('detailedMode')}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Tohop selector (shared between modes) */}
        <div>
          <label className="block text-sm font-medium text-on-surface mb-1">
            {t('selectTohop')}
          </label>
          <select
            value={params.tohop}
            onChange={e => setParams({ tohop: e.target.value })}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="">{t('selectTohop')}</option>
            {tohopCodes.map(tc => (
              <option key={tc.code} value={tc.code}>
                {tc.code}{tc.label_vi ? ` — ${tc.label_vi}` : ` (${tc.subjects.join(', ')})`}
              </option>
            ))}
          </select>
        </div>

        {params.mode === 'quick' && (
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">
              {t('totalScore')}
            </label>
            <input
              type="number"
              min={0}
              max={30}
              step={0.1}
              value={params.score ?? ''}
              onChange={e => handleScoreChange(e.target.value)}
              placeholder={t('enterScore')}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            {scoreError && (
              <p data-testid="score-error" className="mt-1 text-sm text-red-600">
                {scoreError}
              </p>
            )}
          </div>
        )}

        {params.mode === 'detailed' && (
          <div className="space-y-3">
            {selectedSubjects.length === 0 && (
              <p className="text-sm text-on-surface-muted">{t('selectTohop')}</p>
            )}
            {selectedSubjects.map(subject => (
              <div key={subject}>
                <label className="block text-sm font-medium text-on-surface mb-1">
                  {subject}
                </label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={0.1}
                  value={subjectScores[subject] ?? ''}
                  onChange={e => {
                    const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                    setSubjectScores(prev => {
                      const next = { ...prev };
                      if (val === undefined) delete next[subject];
                      else next[subject] = val;
                      return next;
                    });
                  }}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            ))}
            {detailedTotal !== null && (
              <div className="p-3 bg-surface-subtle rounded-lg">
                <span className="text-sm font-medium text-on-surface">{t('totalScore')}: </span>
                <span className="text-sm font-semibold text-primary">{detailedTotal.toFixed(1)}</span>
              </div>
            )}
          </div>
        )}

        {/* Auto-submit in both modes — no button needed */}
      </form>

      {apiError && (
        <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 flex items-center justify-between">
          <p className="text-sm text-red-700">{apiError}</p>
          <button
            type="button"
            onClick={() => {
              const totalScore = params.mode === 'quick' ? params.score : detailedTotal;
              if (params.tohop && totalScore !== null && totalScore !== undefined) {
                fetchRecommendations(params.tohop, totalScore);
              }
            }}
            className="text-sm font-medium text-red-700 underline ml-3 whitespace-nowrap"
          >
            {t('retry')}
          </button>
        </div>
      )}

      {/* Nguyện vọng list first — right below input */}
      <div className="mt-6">
        <NguyenVongList
          nguyenVong={nguyenVong}
          setNguyenVong={setNguyenVongList}
          results={results}
          userScore={activeScore ?? 0}
        />
      </div>

      {/* Results list below */}
      <div className="mt-6">
        <ResultsList
          results={results}
          loading={loading}
          userScore={activeScore ?? 0}
          hasSubmitted={hasSubmitted}
          onAddToList={addToList}
          nguyenVong={nguyenVong}
        />
      </div>
    </div>
  );
}
