import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDb } = vi.hoisted(() => {
  const mockGroupBy = vi.fn();
  const mockFrom = vi.fn();
  const mockSelect = vi.fn();
  const mockDb = { select: mockSelect };

  mockFrom.mockReturnValue({ groupBy: mockGroupBy });
  mockSelect.mockReturnValue({ from: mockFrom });

  return { mockDb };
});

vi.mock('../../../../lib/db', () => ({ db: mockDb }));

vi.mock('../../../../lib/db/schema', () => ({
  scrapeRuns: {
    university_id: 'university_id',
    run_at: 'run_at',
    status: 'status',
    rows_written: 'rows_written',
  },
}));

vi.mock('drizzle-orm', () => ({
  max: vi.fn((col) => ({ _max: col })),
  sql: Object.assign(
    (strings: TemplateStringsArray, ..._values: unknown[]) => {
      return strings.join('?');
    },
    { raw: {} }
  ),
}));

import { getScrapeStatus } from '../../app/api/admin/scrape-status/route';

const makeRow = (
  university_id: string,
  last_run_at: Date,
  last_status: string,
  last_rows_written: number,
  has_error: boolean
) => ({ university_id, last_run_at, last_status, last_rows_written, has_error });

describe('getScrapeStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const mockGroupBy = vi.fn();
    const mockFrom = vi.fn();
    mockFrom.mockReturnValue({ groupBy: mockGroupBy });
    mockDb.select.mockReturnValue({ from: mockFrom });

    // Store groupBy ref so tests can configure resolved values
    (mockDb as any)._groupBy = mockGroupBy;
  });

  it('returns array of objects with university_id, last_run_at, last_status, last_rows_written, has_error fields', async () => {
    const now = new Date();
    const rows = [makeRow('BKA', now, 'ok', 42, false)];
    (mockDb as any)._groupBy.mockResolvedValue(rows);

    const result = await getScrapeStatus();

    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('university_id', 'BKA');
    expect(result[0]).toHaveProperty('last_run_at');
    expect(result[0]).toHaveProperty('last_status', 'ok');
    expect(result[0]).toHaveProperty('last_rows_written', 42);
    expect(result[0]).toHaveProperty('has_error', false);
  });

  it('returns empty array when no scrape_runs exist', async () => {
    (mockDb as any)._groupBy.mockResolvedValue([]);

    const result = await getScrapeStatus();

    expect(result).toEqual([]);
  });

  it('returns multiple university entries when multiple universities have runs', async () => {
    const now = new Date();
    const rows = [
      makeRow('BKA', now, 'ok', 100, false),
      makeRow('NEU', now, 'error', 0, true),
      makeRow('HUS', now, 'flagged', 50, false),
    ];
    (mockDb as any)._groupBy.mockResolvedValue(rows);

    const result = await getScrapeStatus();

    expect(result).toHaveLength(3);
    expect(result.map((r) => r.university_id)).toEqual(['BKA', 'NEU', 'HUS']);
  });

  it('reflects has_error=true for rows with error status', async () => {
    const now = new Date();
    const rows = [makeRow('DCN', now, 'error', 0, true)];
    (mockDb as any)._groupBy.mockResolvedValue(rows);

    const result = await getScrapeStatus();

    expect(result[0].has_error).toBe(true);
    expect(result[0].last_status).toBe('error');
  });

  it('calls db.select with scrapeRuns table', async () => {
    (mockDb as any)._groupBy.mockResolvedValue([]);

    await getScrapeStatus();

    expect(mockDb.select).toHaveBeenCalledTimes(1);
    const fromMock = mockDb.select.mock.results[0].value.from;
    expect(fromMock).toHaveBeenCalledWith(
      expect.objectContaining({ university_id: 'university_id' })
    );
  });
});
