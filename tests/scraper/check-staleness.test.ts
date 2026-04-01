import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getConfiguredScraperIds, classifyStaleness } from '../../scripts/check-staleness';
import type { ScraperEntry } from '../../scripts/check-staleness';

describe('getConfiguredScraperIds', () => {
  it('returns IDs of entries with scrape_url and active adapter_type', () => {
    const entries: ScraperEntry[] = [
      { id: 'BKA', scrape_url: 'https://example.com', adapter_type: 'cheerio' },
      { id: 'HTC', scrape_url: 'https://example.com', adapter_type: 'cheerio' },
      { id: 'DCN', scrape_url: 'https://example.com', adapter_type: 'playwright' },
    ];
    const ids = getConfiguredScraperIds(entries);
    expect(ids.size).toBe(3);
    expect(ids.has('BKA')).toBe(true);
    expect(ids.has('HTC')).toBe(true);
    expect(ids.has('DCN')).toBe(true);
  });

  it('excludes entries with null scrape_url', () => {
    const entries: ScraperEntry[] = [
      { id: 'BKA', scrape_url: null, adapter_type: 'pending' },
      { id: 'HTC', scrape_url: 'https://example.com', adapter_type: 'cheerio' },
    ];
    const ids = getConfiguredScraperIds(entries);
    expect(ids.size).toBe(1);
    expect(ids.has('HTC')).toBe(true);
    expect(ids.has('BKA')).toBe(false);
  });

  it('excludes skip and pending adapter types', () => {
    const entries: ScraperEntry[] = [
      { id: 'A', scrape_url: 'https://example.com', adapter_type: 'skip' },
      { id: 'B', scrape_url: 'https://example.com', adapter_type: 'pending' },
      { id: 'C', scrape_url: 'https://example.com', adapter_type: 'cheerio' },
    ];
    const ids = getConfiguredScraperIds(entries);
    expect(ids.size).toBe(1);
    expect(ids.has('C')).toBe(true);
  });

  it('returns empty set when no active scrapers', () => {
    const entries: ScraperEntry[] = [
      { id: 'A', scrape_url: null, adapter_type: 'pending' },
      { id: 'B', scrape_url: 'https://example.com', adapter_type: 'skip' },
    ];
    const ids = getConfiguredScraperIds(entries);
    expect(ids.size).toBe(0);
  });
});

describe('classifyStaleness', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Set current time to 2026-03-31T12:00:00Z
    vi.setSystemTime(new Date('2026-03-31T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('classifies recently-scraped universities as neither stale nor never-scraped', () => {
    const ids = ['HTC', 'BVH'];
    const lastOkMap = new Map<string, Date | null>([
      ['HTC', new Date('2026-03-30T10:00:00Z')],  // 1 day ago
      ['BVH', new Date('2026-03-29T10:00:00Z')],  // 2 days ago
    ]);

    const result = classifyStaleness(ids, lastOkMap, 10);
    expect(result.stale).toHaveLength(0);
    expect(result.neverScraped).toHaveLength(0);
  });

  it('classifies universities with no scrape history as never-scraped', () => {
    const ids = ['HTC', 'NEW_UNI'];
    const lastOkMap = new Map<string, Date | null>([
      ['HTC', new Date('2026-03-30T10:00:00Z')],
    ]);

    const result = classifyStaleness(ids, lastOkMap, 10);
    expect(result.neverScraped).toEqual(['NEW_UNI']);
    expect(result.stale).toHaveLength(0);
  });

  it('classifies universities past staleness window as stale', () => {
    const ids = ['HTC'];
    const lastOkMap = new Map<string, Date | null>([
      ['HTC', new Date('2026-03-15T10:00:00Z')],  // 16 days ago
    ]);

    const result = classifyStaleness(ids, lastOkMap, 10);
    expect(result.stale).toHaveLength(1);
    expect(result.stale[0].id).toBe('HTC');
    expect(result.neverScraped).toHaveLength(0);
  });

  it('does not classify as stale when exactly at boundary', () => {
    const ids = ['HTC'];
    // Exactly 10 days ago — should be stale (cutoff is strictly <)
    const tenDaysAgo = new Date('2026-03-21T12:00:00Z');
    const lastOkMap = new Map<string, Date | null>([
      ['HTC', tenDaysAgo],
    ]);

    const result = classifyStaleness(ids, lastOkMap, 10);
    // At exactly the boundary, getTime() < cutoffTime is false (equal), so NOT stale
    expect(result.stale).toHaveLength(0);
  });

  it('correctly separates mixed states', () => {
    const ids = ['FRESH', 'STALE', 'NEVER'];
    const lastOkMap = new Map<string, Date | null>([
      ['FRESH', new Date('2026-03-30T10:00:00Z')],   // 1 day ago — OK
      ['STALE', new Date('2026-03-10T10:00:00Z')],   // 21 days ago — stale
      // NEVER not in map — never scraped
    ]);

    const result = classifyStaleness(ids, lastOkMap, 10);
    expect(result.stale).toHaveLength(1);
    expect(result.stale[0].id).toBe('STALE');
    expect(result.neverScraped).toEqual(['NEVER']);
  });

  it('uses correct staleness window from days parameter', () => {
    const ids = ['UNI'];
    // 4 days ago
    const lastOkMap = new Map<string, Date | null>([
      ['UNI', new Date('2026-03-27T12:00:00Z')],
    ]);

    // With 3-day window: stale
    const r3 = classifyStaleness(ids, lastOkMap, 3);
    expect(r3.stale).toHaveLength(1);

    // With 10-day window: not stale
    const r10 = classifyStaleness(ids, lastOkMap, 10);
    expect(r10.stale).toHaveLength(0);
  });
});
