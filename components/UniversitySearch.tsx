'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { normalizeVi } from '../lib/utils/normalize-vi';

interface University {
  id: string;
  name_vi: string;
  website_url: string | null;
}

interface TohopCode {
  code: string;
  subjects: string[];
  label_vi: string | null;
}

async function fetchAllUniversities(): Promise<University[]> {
  const all: University[] = [];
  let cursor: string | null = null;

  do {
    const url = cursor
      ? `/api/universities?limit=200&cursor=${encodeURIComponent(cursor)}`
      : '/api/universities?limit=200';
    const res = await fetch(url);
    if (!res.ok) break;
    const json = await res.json() as { data: University[]; meta: { count: number; next_cursor: string | null } };
    all.push(...json.data);
    cursor = json.meta.next_cursor;
  } while (cursor);

  return all;
}

export function UniversitySearch() {
  const t = useTranslations('common');
  const [universities, setUniversities] = useState<University[]>([]);
  const [tohopCodes, setTohopCodes] = useState<TohopCode[]>([]);
  const [query, setQuery] = useState('');
  const [selectedTohop, setSelectedTohop] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [unis, tohopRes] = await Promise.all([
          fetchAllUniversities(),
          fetch('/api/tohop').then(r => r.ok ? r.json() : { data: [] }),
        ]);
        if (!cancelled) {
          setUniversities(unis);
          setTohopCodes((tohopRes as { data: TohopCode[] }).data ?? []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  const filtered = universities.filter(u => {
    const matchesName = !query || normalizeVi(u.name_vi).includes(normalizeVi(query));
    return matchesName;
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={t('search')}
          className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <select
          value={selectedTohop}
          onChange={e => setSelectedTohop(e.target.value)}
          aria-label={t('filterByTohop')}
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">{t('allTohop')}</option>
          {tohopCodes.map(tc => (
            <option key={tc.code} value={tc.code}>
              {tc.code}{tc.label_vi ? ` — ${tc.label_vi}` : ''}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">{t('loading')}</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500">{t('noResults')}</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {filtered.map(u => (
            <li key={u.id} className="py-2 text-sm">
              <span className="font-medium">{u.name_vi}</span>
              {u.website_url && (
                <a
                  href={u.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-xs text-blue-500 hover:text-blue-700"
                >
                  {u.website_url}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
