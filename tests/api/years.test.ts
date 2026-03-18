import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockDb } = vi.hoisted(() => {
  const mockSelectDistinct = vi.fn();
  const mockDb = { selectDistinct: mockSelectDistinct };
  return { mockDb };
});

vi.mock('../../lib/db', () => ({ db: mockDb }));

vi.mock('../../lib/db/schema', () => ({
  cutoffScores: { _tag: 'cutoffScores', year: 'year' },
  universities: { _tag: 'universities' },
  majors: { _tag: 'majors' },
  tohopCodes: { _tag: 'tohopCodes' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  gt: vi.fn(),
  asc: vi.fn(),
  sql: (strings: TemplateStringsArray, ..._values: unknown[]) => strings.join(''),
}));

import { GET } from '../../app/api/years/route';

const makeMockChain = (resolvedValue: unknown) => {
  const chain = {
    from: vi.fn(),
    orderBy: vi.fn(),
  };
  chain.from.mockReturnValue(chain);
  chain.orderBy.mockResolvedValue(resolvedValue);
  return chain;
};

describe('GET /api/years', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns distinct years array in { data, meta } envelope', async () => {
    const mockRows = [{ year: 2024 }, { year: 2023 }, { year: 2022 }];
    const chain = makeMockChain(mockRows);
    mockDb.selectDistinct.mockReturnValue(chain);

    const req = new NextRequest('http://localhost/api/years');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([2024, 2023, 2022]);
    expect(body.meta.count).toBe(3);
  });

  it('sets Cache-Control header with s-maxage=86400', async () => {
    const chain = makeMockChain([{ year: 2024 }]);
    mockDb.selectDistinct.mockReturnValue(chain);

    const req = new NextRequest('http://localhost/api/years');
    const res = await GET(req);

    expect(res.headers.get('Cache-Control')).toContain('s-maxage=86400');
  });

  it('returns 503 with Retry-After when DB throws DB_TIMEOUT', async () => {
    const chain = {
      from: vi.fn(),
      orderBy: vi.fn(),
    };
    chain.from.mockReturnValue(chain);
    chain.orderBy.mockRejectedValue(new Error('DB_TIMEOUT'));
    mockDb.selectDistinct.mockReturnValue(chain);

    const req = new NextRequest('http://localhost/api/years');
    const res = await GET(req);

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe('DB_UNAVAILABLE');
    expect(res.headers.get('Retry-After')).toBe('30');
  });
});
