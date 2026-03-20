import { describe, it, expect } from 'vitest';
import { applyDiscovery } from '../../scripts/apply-discovery';
import type { DiscoveryCandidate } from '../../lib/scraper/discovery/candidate';

// ---- Fixtures ----

const makeEntry = (overrides: Partial<{
  id: string;
  adapter: string;
  website_url: string;
  scrape_url: string | null;
  adapter_type: string;
  note: string;
  factory_config: unknown;
}> = {}) => ({
  id: 'TST',
  adapter: 'tst',
  website_url: 'https://example.com',
  scrape_url: null,
  adapter_type: 'pending',
  ...overrides,
});

const makeCandidate = (overrides: Partial<DiscoveryCandidate> = {}): DiscoveryCandidate => ({
  url: 'https://example.com/cutoff',
  universityId: 'TST',
  score: 0.8,
  reasons: ['has-cutoff-keyword'],
  ...overrides,
});

// ---- Tests ----

describe('applyDiscovery', () => {
  it('patches scrape_url for pending entries with null scrape_url when candidate exists', () => {
    const entries = [makeEntry({ id: 'BKA', scrape_url: null, adapter_type: 'pending' })];
    const candidates = [makeCandidate({ universityId: 'BKA', url: 'https://hust.edu.vn/cutoff' })];

    const { entries: result, patched } = applyDiscovery(entries, candidates);

    expect(result[0].scrape_url).toBe('https://hust.edu.vn/cutoff');
    expect(patched).toBe(1);
  });

  it('sets adapter_type to "cheerio" when patching (so registry gate runs the adapter)', () => {
    const entries = [makeEntry({ id: 'BKA', scrape_url: null, adapter_type: 'pending' })];
    const candidates = [makeCandidate({ universityId: 'BKA', url: 'https://hust.edu.vn/cutoff' })];

    const { entries: result } = applyDiscovery(entries, candidates);

    expect(result[0].adapter_type).toBe('cheerio');
  });

  it('never overwrites entries that already have a non-null scrape_url even if candidate has higher score', () => {
    const entries = [makeEntry({
      id: 'UET',
      scrape_url: 'https://uet.vnu.edu.vn/existing-cutoff',
      adapter_type: 'cheerio',
    })];
    const candidates = [makeCandidate({
      universityId: 'UET',
      url: 'https://uet.vnu.edu.vn/new-cutoff',
      score: 0.99,
    })];

    const { entries: result, patched } = applyDiscovery(entries, candidates);

    // never overwrites: existing scrape_url must be preserved
    expect(result[0].scrape_url).toBe('https://uet.vnu.edu.vn/existing-cutoff');
    expect(patched).toBe(0);
  });

  it('never touches entries with adapter_type "skip" even if candidate exists', () => {
    const entries = [makeEntry({
      id: 'MINISTRY',
      scrape_url: null,
      adapter_type: 'skip',
    })];
    const candidates = [makeCandidate({ universityId: 'MINISTRY', url: 'https://ministry.gov.vn/cutoff' })];

    const { entries: result, patched } = applyDiscovery(entries, candidates);

    expect(result[0].scrape_url).toBeNull();
    expect(result[0].adapter_type).toBe('skip');
    expect(patched).toBe(0);
  });

  it('picks the highest-scored candidate per universityId (candidates pre-sorted descending)', () => {
    const entries = [makeEntry({ id: 'NEU', scrape_url: null, adapter_type: 'pending' })];
    // Pre-sorted descending: highest score first
    const candidates = [
      makeCandidate({ universityId: 'NEU', url: 'https://neu.edu.vn/best', score: 0.95 }),
      makeCandidate({ universityId: 'NEU', url: 'https://neu.edu.vn/second', score: 0.7 }),
    ];

    const { entries: result } = applyDiscovery(entries, candidates);

    // First occurrence wins (highest score since pre-sorted)
    expect(result[0].scrape_url).toBe('https://neu.edu.vn/best');
  });

  it('reports count of patched entries to stdout', () => {
    const entries = [
      makeEntry({ id: 'A', scrape_url: null, adapter_type: 'pending' }),
      makeEntry({ id: 'B', scrape_url: null, adapter_type: 'pending' }),
      makeEntry({ id: 'C', scrape_url: 'https://c.com/existing', adapter_type: 'cheerio' }),
    ];
    const candidates = [
      makeCandidate({ universityId: 'A', url: 'https://a.com/cutoff' }),
      makeCandidate({ universityId: 'B', url: 'https://b.com/cutoff' }),
      makeCandidate({ universityId: 'C', url: 'https://c.com/new' }),
    ];

    const { patched } = applyDiscovery(entries, candidates);

    // Only A and B are eligible (C has existing scrape_url)
    expect(patched).toBe(2);
  });

  it('handles empty candidates array — patches 0 entries, does not corrupt scrapers.json', () => {
    const entries = [
      makeEntry({ id: 'A', scrape_url: null, adapter_type: 'pending' }),
      makeEntry({ id: 'B', scrape_url: 'https://b.com/cutoff', adapter_type: 'cheerio' }),
    ];

    const { entries: result, patched } = applyDiscovery(entries, []);

    expect(patched).toBe(0);
    // Entries unchanged
    expect(result[0].scrape_url).toBeNull();
    expect(result[1].scrape_url).toBe('https://b.com/cutoff');
  });
});
