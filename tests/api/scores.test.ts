import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockDb } = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const mockDb = { select: mockSelect };
  return { mockDb };
});

vi.mock('../../lib/db', () => ({ db: mockDb }));

vi.mock('../../lib/db/schema', () => ({
  cutoffScores: { _tag: 'cutoffScores', id: 'id', year: 'year', tohop_code: 'tohop_code' },
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

import { GET } from '../../app/api/scores/route';

const makeScoreRow = (id: number) => ({
  id,
  university_id: 'BKA',
  university_name_vi: 'Trường ĐH Bách Khoa',
  major_id: '7480201',
  major_name_vi: 'Công nghệ thông tin',
  tohop_code: 'A00',
  year: 2024,
  score: '25.00',
  source_url: 'https://example.com',
  scraped_at: new Date(),
});

// Build a chainable mock that resolves at .limit()
const makeMockSelectChain = (resolvedValue: unknown) => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue(resolvedValue);
  return chain;
};

describe('GET /api/scores', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated scores with { data, meta } envelope', async () => {
    const mockRows = [makeScoreRow(1), makeScoreRow(2), makeScoreRow(3)];
    const chain = makeMockSelectChain(mockRows);
    mockDb.select.mockReturnValue(chain);

    const req = new NextRequest('http://localhost/api/scores');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(3);
    expect(body.meta.count).toBe(3);
    expect(body.meta.next_cursor).toBeNull();
  });

  it('sets Cache-Control header with s-maxage=300', async () => {
    const chain = makeMockSelectChain([makeScoreRow(1)]);
    mockDb.select.mockReturnValue(chain);

    const req = new NextRequest('http://localhost/api/scores');
    const res = await GET(req);

    expect(res.headers.get('Cache-Control')).toContain('s-maxage=300');
  });

  it('accepts optional year filter', async () => {
    const chain = makeMockSelectChain([makeScoreRow(1)]);
    mockDb.select.mockReturnValue(chain);

    const req = new NextRequest('http://localhost/api/scores?year=2024');
    const res = await GET(req);

    expect(res.status).toBe(200);
    // eq should have been called with year filter
    const { eq } = await import('drizzle-orm');
    const eqCalls = (eq as ReturnType<typeof vi.fn>).mock.calls;
    const yearCall = eqCalls.find(([, val]) => val === 2024);
    expect(yearCall).toBeDefined();
  });

  it('accepts optional tohop_code filter', async () => {
    const chain = makeMockSelectChain([makeScoreRow(1)]);
    mockDb.select.mockReturnValue(chain);

    const req = new NextRequest('http://localhost/api/scores?tohop_code=A00');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const { eq } = await import('drizzle-orm');
    const eqCalls = (eq as ReturnType<typeof vi.fn>).mock.calls;
    const tohopCall = eqCalls.find(([, val]) => val === 'A00');
    expect(tohopCall).toBeDefined();
  });

  it('returns static fallback with X-Served-By header on DB_TIMEOUT', async () => {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    chain.from = vi.fn().mockReturnValue(chain);
    chain.innerJoin = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockReturnValue(chain);
    chain.orderBy = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockRejectedValue(new Error('DB_TIMEOUT'));
    mockDb.select.mockReturnValue(chain);

    const req = new NextRequest('http://localhost/api/scores');
    const res = await GET(req);

    // Static fallback files exist, so we get 200 with static data
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Served-By')).toBe('static-fallback');
  });

  it('returns next_cursor when more rows exist', async () => {
    // 51 rows with default limit 50
    const mockRows = Array.from({ length: 51 }, (_, i) => makeScoreRow(i + 1));
    const chain = makeMockSelectChain(mockRows);
    mockDb.select.mockReturnValue(chain);

    const req = new NextRequest('http://localhost/api/scores');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(50);
    expect(body.meta.next_cursor).toBe('50');
  });
});
