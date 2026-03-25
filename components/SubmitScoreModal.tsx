'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

interface TohopOption {
  code: string;
  label_vi?: string;
}

interface UniOption {
  id: string;
  name_vi: string;
}

interface SubmitScoreModalProps {
  onClose: () => void;
}

export function SubmitScoreModal({ onClose }: SubmitScoreModalProps) {
  const t = useTranslations('common');

  const [universities, setUniversities] = useState<UniOption[]>([]);
  const [tohopCodes, setTohopCodes] = useState<TohopOption[]>([]);

  useEffect(() => {
    fetch('/api/universities?limit=500')
      .then(r => r.json())
      .then(d => setUniversities(d.data ?? []))
      .catch(() => {});
    fetch('/api/tohop')
      .then(r => r.json())
      .then(d => setTohopCodes(d.data ?? []))
      .catch(() => {});
  }, []);

  const [uniId, setUniId] = useState('');
  const [uniSearch, setUniSearch] = useState('');
  const [tohop, setTohop] = useState('');
  const [score, setScore] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<'success' | 'error' | null>(null);

  const filteredUnis = uniSearch.length >= 2
    ? universities.filter(u =>
        u.name_vi.toLowerCase().includes(uniSearch.toLowerCase()) ||
        u.id.toLowerCase().includes(uniSearch.toLowerCase())
      ).slice(0, 10)
    : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uniId || !tohop || !score || !sourceUrl) return;

    setSubmitting(true);
    setResult(null);

    try {
      const res = await fetch('/api/submit-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          university_id: uniId,
          tohop_code: tohop,
          score: parseFloat(score),
          source_url: sourceUrl,
        }),
      });

      if (res.ok) {
        setResult('success');
        setTimeout(() => onClose(), 2000);
      } else {
        setResult('error');
      }
    } catch {
      setResult('error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-surface rounded-xl shadow-lg p-6 w-full max-w-md mx-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-on-surface">{t('submitScore')}</h2>
          <button onClick={onClose} className="text-on-surface-muted hover:text-on-surface" aria-label="Close">
            &times;
          </button>
        </div>

        {result === 'success' ? (
          <p className="text-green-600 text-sm py-4 text-center">{t('submitSuccess')}</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* University search */}
            <div>
              <label className="block text-sm text-on-surface-muted mb-1">{t('university')}</label>
              <input
                type="text"
                value={uniSearch}
                onChange={e => { setUniSearch(e.target.value); setUniId(''); }}
                placeholder={t('searchPlaceholder')}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-surface text-on-surface"
              />
              {filteredUnis.length > 0 && !uniId && (
                <ul className="border rounded-lg mt-1 max-h-40 overflow-y-auto bg-surface">
                  {filteredUnis.map(u => (
                    <li
                      key={u.id}
                      className="px-3 py-2 text-sm hover:bg-surface-subtle cursor-pointer"
                      onClick={() => { setUniId(u.id); setUniSearch(u.name_vi); }}
                    >
                      <span className="font-medium">{u.id}</span> — {u.name_vi}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Tohop */}
            <div>
              <label className="block text-sm text-on-surface-muted mb-1">{t('tohop')}</label>
              <select
                value={tohop}
                onChange={e => setTohop(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-surface text-on-surface"
              >
                <option value="">{t('selectTohop')}</option>
                {tohopCodes.map(tc => (
                  <option key={tc.code} value={tc.code}>
                    {tc.code}{tc.label_vi ? ` — ${tc.label_vi}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Score */}
            <div>
              <label className="block text-sm text-on-surface-muted mb-1">{t('submitScoreLabel')}</label>
              <input
                type="number"
                min="10"
                max="30"
                step="0.01"
                value={score}
                onChange={e => setScore(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-surface text-on-surface"
              />
            </div>

            {/* Source URL */}
            <div>
              <label className="block text-sm text-on-surface-muted mb-1">{t('submitSourceHint')}</label>
              <input
                type="url"
                value={sourceUrl}
                onChange={e => setSourceUrl(e.target.value)}
                placeholder="https://..."
                className="w-full border rounded-lg px-3 py-2 text-sm bg-surface text-on-surface"
              />
            </div>

            {result === 'error' && (
              <p className="text-red-600 text-sm">{t('submitError')}</p>
            )}

            <button
              type="submit"
              disabled={submitting || !uniId || !tohop || !score || !sourceUrl}
              className="w-full bg-primary text-white rounded-lg py-2 text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {submitting ? t('loading') : t('submit')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
