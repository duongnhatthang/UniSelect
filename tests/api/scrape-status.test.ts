import { describe, it, expect, vi, beforeEach } from 'vitest';

// Must use vi.hoisted to ensure mocks are hoisted before imports
const { mockDb, mockGroupBy, mockFrom } = vi.hoisted(() => {
  const mockGroupBy = vi.fn();
  const mockFrom = vi.fn();
  const mockSelect = vi.fn();
  const mockDb = { select: mockSelect };

  mockFrom.mockReturnValue({ groupBy: mockGroupBy });
  mockSelect.mockReturnValue({ from: mockFrom });

  return { mockDb, mockGroupBy, mockFrom };
});

// Mock lib/db — path relative to project root (vitest normalizes these)
vi.mock('../../lib/db', () => ({ db: mockDb }));

vi.mock('../../lib/db/schema', () => ({
  scrapeRuns: {
    university_id: 'col_university_id',
    run_at: 'col_run_at',
    status: 'col_status',
    rows_written: 'col_rows_written',
  },
}));

vi.mock('drizzle-orm', () => ({
  max: vi.fn((col) => `max(${col})`),
  sql: Object.assign(
    (strings: TemplateStringsArray, ..._values: unknown[]) => {
      return strings.raw.join('?');
    },
    { raw: {} }
  ),
}));

import { getScrapeStatus } from '../../lib/api/scrape-status';

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
    mockGroupBy.mockReset();
    mockFrom.mockReset();
    mockFrom.mockReturnValue({ groupBy: mockGroupBy });
    mockDb.select.mockReturnValue({ from: mockFrom });
  });

  it('returns array of objects with university_id, last_run_at, last_status, last_rows_written, has_error fields', async () => {
    const now = new Date();
    const rows = [makeRow('BKA', now, 'ok', 42, false)];
    mockGroupBy.mockResolvedValue(rows);

    const result = await getScrapeStatus();

    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('university_id', 'BKA');
    expect(result[0]).toHaveProperty('last_run_at');
    expect(result[0]).toHaveProperty('last_status', 'ok');
    expect(result[0]).toHaveProperty('last_rows_written', 42);
    expect(result[0]).toHaveProperty('has_error', false);
  });

  it('returns empty array when no scrape_runs exist', async () => {
    mockGroupBy.mockResolvedValue([]);

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
    mockGroupBy.mockResolvedValue(rows);

    const result = await getScrapeStatus();

    expect(result).toHaveLength(3);
    expect(result.map((r) => r.university_id)).toEqual(['BKA', 'NEU', 'HUS']);
  });

  it('reflects has_error=true for rows with error status', async () => {
    const now = new Date();
    const rows = [makeRow('DCN', now, 'error', 0, true)];
    mockGroupBy.mockResolvedValue(rows);

    const result = await getScrapeStatus();

    expect(result[0].has_error).toBe(true);
    expect(result[0].last_status).toBe('error');
  });

  it('calls db.select and groups by scrapeRuns.university_id', async () => {
    mockGroupBy.mockResolvedValue([]);

    await getScrapeStatus();

    expect(mockDb.select).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith(
      expect.objectContaining({ university_id: 'col_university_id' })
    );
    expect(mockGroupBy).toHaveBeenCalledWith('col_university_id');
  });
});
