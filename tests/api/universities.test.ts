import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockDb } = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const mockDb = { select: mockSelect };
  return { mockDb };
});

vi.mock('../../lib/db', () => ({ db: mockDb }));

vi.mock('../../lib/db/schema', () => ({
  universities: { _tag: 'universities', id: 'id' },
  cutoffScores: { _tag: 'cutoffScores' },
  majors: { _tag: 'majors' },
  tohopCodes: { _tag: 'tohopCodes' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col, _val) => ({ _eq: true })),
  and: vi.fn(),
  gt: vi.fn((_col, _val) => ({ _gt: true })),
  asc: vi.fn((_col) => ({ _asc: true })),
  sql: (strings: TemplateStringsArray, ..._values: unknown[]) => strings.join(''),
}));

// Helper to build a chainable Drizzle mock for select queries
const makeMockSelectChain = (resolvedValue: unknown) => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue(resolvedValue);
  return chain;
};

import { GET as ListGET } from '../../app/api/universities/route';
import { GET as DetailGET } from '../../app/api/universities/[id]/route';

const makeUni = (id: string) => ({
  id,
  name_vi: `University ${id}`,
  name_en: null,
  website_url: null,
  created_at: new Date(),
});

describe('GET /api/universities (list)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns first page with meta.next_cursor when more rows exist', async () => {
    // Create 51 rows (default limit 50 → has more)
    const mockRows = Array.from({ length: 51 }, (_, i) => makeUni(`UNI${String(i).padStart(3, '0')}`));
    const chain = makeMockSelectChain(mockRows);
    mockDb.select.mockReturnValue(chain);

    const req = new NextRequest('http://localhost/api/universities');
    const res = await ListGET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(50);
    expect(body.meta.next_cursor).toBe('UNI049');
    expect(body.meta.count).toBe(50);
  });

  it('passes cursor param to query when provided', async () => {
    const mockRows = [makeUni('UNI100'), makeUni('UNI101')];
    const chain = makeMockSelectChain(mockRows);
    mockDb.select.mockReturnValue(chain);

    const req = new NextRequest('http://localhost/api/universities?cursor=UNI099');
    const res = await ListGET(req);

    expect(res.status).toBe(200);
    // gt should have been called with the cursor value
    const { gt } = await import('drizzle-orm');
    expect(gt).toHaveBeenCalledWith(expect.anything(), 'UNI099');
  });

  it('clamps limit to max 200', async () => {
    const mockRows = Array.from({ length: 201 }, (_, i) => makeUni(`UNI${i}`));
    const chain = makeMockSelectChain(mockRows);
    mockDb.select.mockReturnValue(chain);

    const req = new NextRequest('http://localhost/api/universities?limit=999');
    const res = await ListGET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    // 201 returned → has more → data is 200 rows
    expect(body.data).toHaveLength(200);
  });

  it('sets Cache-Control header with s-maxage=86400', async () => {
    const chain = makeMockSelectChain([makeUni('UNI001')]);
    mockDb.select.mockReturnValue(chain);

    const req = new NextRequest('http://localhost/api/universities');
    const res = await ListGET(req);

    expect(res.headers.get('Cache-Control')).toContain('s-maxage=86400');
  });

  it('returns 503 with Retry-After when DB throws DB_TIMEOUT', async () => {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    chain.from = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockReturnValue(chain);
    chain.orderBy = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockRejectedValue(new Error('DB_TIMEOUT'));
    mockDb.select.mockReturnValue(chain);

    const req = new NextRequest('http://localhost/api/universities');
    const res = await ListGET(req);

    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('30');
  });
});

describe('GET /api/universities/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 for unknown university ID', async () => {
    const chain = makeMockSelectChain([]);
    mockDb.select.mockReturnValue(chain);

    const req = new NextRequest('http://localhost/api/universities/UNKNOWN');
    const res = await DetailGET(req, { params: Promise.resolve({ id: 'UNKNOWN' }) });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns university data for known ID', async () => {
    const uni = makeUni('BKA');
    const chain = makeMockSelectChain([uni]);
    mockDb.select.mockReturnValue(chain);

    const req = new NextRequest('http://localhost/api/universities/BKA');
    const res = await DetailGET(req, { params: Promise.resolve({ id: 'BKA' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe('BKA');
    expect(body.data.name_vi).toBe('University BKA');
  });
});
