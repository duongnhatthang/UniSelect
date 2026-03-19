import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockDb, mockRecommend } = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const mockDb = { select: mockSelect };
  const mockRecommend = vi.fn();
  return { mockDb, mockRecommend };
});

vi.mock('../../lib/db', () => ({ db: mockDb }));

// Mock fs/promises so fallback path doesn't read real files
vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue(JSON.stringify({ A00: [], D01: [] })),
}));

vi.mock('../../lib/db/schema', () => ({
  cutoffScores: {
    _tag: 'cutoffScores',
    id: 'id',
    year: 'year',
    tohop_code: 'tohop_code',
    university_id: 'university_id',
    major_id: 'major_id',
    score: 'score',
    scraped_at: 'scraped_at',
    source_url: 'source_url',
  },
  universities: { _tag: 'universities', id: 'id', name_vi: 'name_vi' },
  majors: { _tag: 'majors', id: 'id', name_vi: 'name_vi' },
  tohopCodes: { _tag: 'tohopCodes' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col, _val) => ({ _eq: true })),
  and: vi.fn((...args: unknown[]) => ({ _and: args })),
  gt: vi.fn((_col, _val) => ({ _gt: true })),
  gte: vi.fn((_col, _val) => ({ _gte: true })),
  asc: vi.fn((_col) => ({ _asc: true })),
  desc: vi.fn((_col) => ({ _desc: true })),
  sql: (strings: TemplateStringsArray, ..._values: unknown[]) => strings.join(''),
}));

vi.mock('../../lib/recommend/engine', () => ({
  recommend: mockRecommend,
}));

import { GET } from '../../app/api/recommend/route';

// Build a chainable mock for max year query
const makeMaxYearChain = (maxYear: number | null) => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockResolvedValue([{ maxYear }]);
  return chain;
};

// Build a chainable mock for the full data fetch
const makeDataFetchChain = (rows: unknown[]) => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockResolvedValue(rows);
  return chain;
};

const makeMockResult = (id: number) => ({
  university_id: `UNI${id}`,
  university_name_vi: `University ${id}`,
  major_id: `748020${id}`,
  major_name_vi: `Major ${id}`,
  tohop_code: 'A00',
  weighted_cutoff: 24.5,
  tier: 'practical' as const,
  trend: 'stable' as const,
  data_years_limited: false,
  years_available: 3,
  suggested_top_15: id <= 15,
  scraped_at: '2024-01-15T10:00:00Z',
  source_url: `https://example.com/university/${id}`,
});

describe('GET /api/recommend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when tohop param is missing', async () => {
    const req = new NextRequest('http://localhost/api/recommend?score=25.0');
    const res = await GET(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_PARAMS');
    expect(body.error.message).toContain('tohop');
  });

  it('returns 400 when score param is missing', async () => {
    const req = new NextRequest('http://localhost/api/recommend?tohop=A00');
    const res = await GET(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_PARAMS');
    expect(body.error.message).toContain('Score');
  });

  it('returns 400 when score is out of range (too low)', async () => {
    const req = new NextRequest('http://localhost/api/recommend?tohop=A00&score=-1.0');
    const res = await GET(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_PARAMS');
  });

  it('returns 400 when score is out of range (too high)', async () => {
    const req = new NextRequest('http://localhost/api/recommend?tohop=A00&score=35.0');
    const res = await GET(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_PARAMS');
  });

  it('returns 400 when tohop format is invalid', async () => {
    const req = new NextRequest('http://localhost/api/recommend?tohop=ZZZ&score=25.0');
    const res = await GET(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_PARAMS');
  });

  it('returns 200 with { data, meta } on valid params', async () => {
    const maxYearChain = makeMaxYearChain(2024);
    const dataRows = [
      { university_id: 'BKA', university_name_vi: 'Bách Khoa', major_id: '7480201', major_name_vi: 'CNTT', tohop_code: 'A00', year: 2024, score: '25.00' },
    ];
    const dataChain = makeDataFetchChain(dataRows);

    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? maxYearChain : dataChain;
    });

    const mockResults = [makeMockResult(1), makeMockResult(2)];
    mockRecommend.mockReturnValue(mockResults);

    const req = new NextRequest('http://localhost/api/recommend?tohop=A00&score=25.0');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta.count).toBe(2);
    expect(body.meta.years_available).toEqual([2024]);
  });

  it('returns 200 with fallback: true when DB throws DB_TIMEOUT', async () => {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    chain.from = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockRejectedValue(new Error('DB_TIMEOUT'));
    mockDb.select.mockReturnValue(chain);

    const req = new NextRequest('http://localhost/api/recommend?tohop=A00&score=25.0');
    const res = await GET(req);

    // Route now falls back to static JSON instead of returning 503
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta.fallback).toBe(true);
  });

  it('response includes scraped_at and source_url per result', async () => {
    const maxYearChain = makeMaxYearChain(2024);
    const dataRows = [
      {
        university_id: 'BKA', university_name_vi: 'Bách Khoa', major_id: '7480201',
        major_name_vi: 'CNTT', tohop_code: 'A00', year: 2024, score: '25.00',
        scraped_at: '2024-01-15T10:00:00Z', source_url: 'https://example.com/bka',
      },
    ];
    const dataChain = makeDataFetchChain(dataRows);

    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? maxYearChain : dataChain;
    });

    const mockResults = [makeMockResult(1)];
    mockRecommend.mockReturnValue(mockResults);

    const req = new NextRequest('http://localhost/api/recommend?tohop=A00&score=25.0');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0]).toHaveProperty('scraped_at', '2024-01-15T10:00:00Z');
    expect(body.data[0]).toHaveProperty('source_url', 'https://example.com/university/1');
  });

  it('does not set Cache-Control header (personalized endpoint)', async () => {
    const maxYearChain = makeMaxYearChain(2024);
    const dataChain = makeDataFetchChain([]);
    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? maxYearChain : dataChain;
    });
    mockRecommend.mockReturnValue([]);

    const req = new NextRequest('http://localhost/api/recommend?tohop=A00&score=25.0');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const cacheControl = res.headers.get('Cache-Control');
    // Either no header at all, or it does not contain s-maxage
    if (cacheControl !== null) {
      expect(cacheControl).not.toContain('s-maxage');
    }
    // null means no Cache-Control header — that's the correct behavior
  });
});
