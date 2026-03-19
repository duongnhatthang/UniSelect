import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock withTimeout to always throw DB_TIMEOUT
vi.mock('../../lib/db/timeout', () => ({
  withTimeout: vi.fn().mockRejectedValue(new Error('DB_TIMEOUT')),
}));

// Mock readFile to return known test data
// Note: vi.mock is hoisted, so mockFallbackData must be defined inline here
vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue(
    JSON.stringify({
      A00: [
        {
          university_id: 'HTC',
          university_name_vi: 'Học viện Tài chính',
          major_id: '7340101',
          major_name_vi: '7340101',
          tohop_code: 'A00',
          year: 2024,
          score: '25.00',
          scraped_at: null,
          source_url: 'https://example.com',
        },
      ],
      D01: [],
    })
  ),
}));

// Mock db with a chainable select that returns a promise (withTimeout will throw before it resolves)
vi.mock('../../lib/db', () => {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockResolvedValue([]);
  chain.then = undefined; // not a thenable itself
  return { db: chain };
});

vi.mock('../../lib/db/schema', () => ({
  cutoffScores: {
    year: 'year',
    tohop_code: 'tohop_code',
    university_id: 'university_id',
    major_id: 'major_id',
    score: 'score',
    scraped_at: 'scraped_at',
    source_url: 'source_url',
  },
  universities: { id: 'id', name_vi: 'name_vi' },
  majors: { id: 'id', name_vi: 'name_vi' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  gte: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
  sql: (strings: TemplateStringsArray) => strings.join(''),
}));

import { GET } from '../../app/api/recommend/route';
import { NextRequest } from 'next/server';

describe('/api/recommend fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with fallback: true when DB times out', async () => {
    const req = new NextRequest('http://localhost/api/recommend?tohop=A00&score=25.0');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta.fallback).toBe(true);
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('returns empty results array for tohop with no fallback data', async () => {
    const req = new NextRequest('http://localhost/api/recommend?tohop=B01&score=25.0');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta.fallback).toBe(true);
    expect(body.data).toEqual([]);
  });

  it('still returns 400 for invalid params even during DB outage', async () => {
    const req = new NextRequest('http://localhost/api/recommend?tohop=INVALID&score=25.0');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });
});
