import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockDb } = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const mockDb = { select: mockSelect };
  return { mockDb };
});

vi.mock('../../lib/db', () => ({ db: mockDb }));

vi.mock('../../lib/db/schema', () => ({
  tohopCodes: { _tag: 'tohopCodes', code: 'code' },
  cutoffScores: { _tag: 'cutoffScores' },
  universities: { _tag: 'universities' },
  majors: { _tag: 'majors' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  gt: vi.fn(),
  asc: vi.fn(),
  sql: (strings: TemplateStringsArray, ..._values: unknown[]) => strings.join(''),
}));

import { GET } from '../../app/api/tohop/route';

const makeMockChain = (resolvedValue: unknown) => {
  const chain = {
    from: vi.fn(),
    orderBy: vi.fn(),
  };
  chain.from.mockReturnValue(chain);
  chain.orderBy.mockResolvedValue(resolvedValue);
  return chain;
};

describe('GET /api/tohop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with { data, meta } shape', async () => {
    const mockRows = [
      { code: 'A00', subjects: ['Toan', 'Ly', 'HoaHoc'], label_vi: 'Toán - Lý - Hóa' },
      { code: 'D01', subjects: ['Toan', 'Ngu_van', 'Ngoai_ngu'], label_vi: null },
    ];
    const chain = makeMockChain(mockRows);
    mockDb.select.mockReturnValue(chain);

    const req = new NextRequest('http://localhost/api/tohop');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual(mockRows);
    expect(body.meta.count).toBe(2);
  });

  it('sets Cache-Control header with s-maxage=86400', async () => {
    const chain = makeMockChain([]);
    mockDb.select.mockReturnValue(chain);

    const req = new NextRequest('http://localhost/api/tohop');
    const res = await GET(req);

    expect(res.headers.get('Cache-Control')).toContain('s-maxage=86400');
  });

  it('returns static fallback with X-Served-By header when DB throws DB_TIMEOUT', async () => {
    const chain = {
      from: vi.fn(),
      orderBy: vi.fn(),
    };
    chain.from.mockReturnValue(chain);
    chain.orderBy.mockRejectedValue(new Error('DB_TIMEOUT'));
    mockDb.select.mockReturnValue(chain);

    const req = new NextRequest('http://localhost/api/tohop');
    const res = await GET(req);

    // Static fallback files exist, so we get 200 with static data
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Served-By')).toBe('static-fallback');
  });
});
