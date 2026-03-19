import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RawRow, ScraperAdapter } from '../../lib/scraper/types';

const { mockInsert, mockTxInsert } = vi.hoisted(() => {
  const mockTxInsert = vi.fn().mockImplementation(() => {
    const valuesFn = vi.fn().mockImplementation(() => ({
      onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
    }));
    return { values: valuesFn };
  });

  const mockInsert = vi.fn().mockImplementation(() => {
    const valuesFn = vi.fn().mockImplementation(() => ({
      onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
    }));
    return { values: valuesFn };
  });

  return { mockInsert, mockTxInsert };
});

vi.mock('../../lib/db', () => ({
  db: {
    insert: mockInsert,
    transaction: vi.fn().mockImplementation(
      async (fn: (tx: { insert: typeof mockTxInsert }) => Promise<unknown>) =>
        fn({ insert: mockTxInsert })
    ),
  },
}));

vi.mock('../../lib/db/schema', () => ({
  cutoffScores: { _tag: 'cutoffScores' },
  majors: { _tag: 'majors' },
  scrapeRuns: { _tag: 'scrapeRuns' },
}));

vi.mock('drizzle-orm', () => ({
  // sql is used as a tagged template literal: sql`excluded.score`
  // Return a simple string from the template for mocking purposes
  sql: (strings: TemplateStringsArray, ..._values: unknown[]) => strings.join(''),
}));

import { runScraper } from '../../lib/scraper/runner';

const makeValidRow = (overrides: Partial<RawRow> = {}): RawRow => ({
  university_id: 'BKA',
  major_raw: '7480201',
  tohop_raw: 'A00',
  year: 2024,
  score_raw: '25.00',
  source_url: 'https://example.com',
  ...overrides,
});

const makeAdapter = (id: string, rows: RawRow[] | Error): ScraperAdapter => ({
  id,
  scrape: rows instanceof Error
    ? vi.fn().mockRejectedValue(rows)
    : vi.fn().mockResolvedValue(rows),
});

// Helper: extract values() args that have a `status` field from all mockInsert() calls this test
// scrapeRuns are still inserted via db.insert (not tx.insert), so we look at mockInsert
function getScrapeRunInserts(): Array<Record<string, unknown>> {
  const results: Array<Record<string, unknown>> = [];
  for (const result of mockInsert.mock.results) {
    if (result.type !== 'return') continue;
    const valuesArgs = result.value?.values?.mock?.calls?.[0]?.[0];
    if (valuesArgs && 'status' in valuesArgs) {
      results.push(valuesArgs);
    }
  }
  return results;
}

describe('runScraper', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Re-apply implementations after clearAllMocks
    mockInsert.mockImplementation(() => {
      const valuesFn = vi.fn().mockImplementation((v: Record<string, unknown>) => ({
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        _capturedValue: v,
      }));
      return { values: valuesFn };
    });
    mockTxInsert.mockImplementation(() => {
      const valuesFn = vi.fn().mockImplementation(() => ({
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }));
      return { values: valuesFn };
    });
    // Re-apply transaction mock implementation after clearAllMocks
    const { db } = await import('../../lib/db');
    (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: (tx: { insert: typeof mockTxInsert }) => Promise<unknown>) =>
        fn({ insert: mockTxInsert })
    );
  });

  it('logs scrape_run with status "ok" and rows_written count when adapter succeeds with 0 rejections', async () => {
    const rows = [
      makeValidRow(),
      makeValidRow({ major_raw: '7480202' }),
      makeValidRow({ major_raw: '7480203' }),
    ];
    const adapter = makeAdapter('BKA', rows);

    await runScraper([{ id: 'BKA', adapter, url: 'https://example.com' }]);

    const scrapeRuns = getScrapeRunInserts();
    expect(scrapeRuns).toHaveLength(1);
    expect(scrapeRuns[0].status).toBe('ok');
    expect(scrapeRuns[0].rows_written).toBe(3);
    expect(scrapeRuns[0].rows_rejected).toBe(0);
  });

  it('logs scrape_run with status "flagged" when adapter succeeds but some rows are rejected', async () => {
    const rows = [
      makeValidRow(),
      makeValidRow({ major_raw: '7480202' }),
      makeValidRow({ score_raw: '9.0' }), // invalid — below 10.0
    ];
    const adapter = makeAdapter('BKA', rows);

    await runScraper([{ id: 'BKA', adapter, url: 'https://example.com' }]);

    const scrapeRuns = getScrapeRunInserts();
    expect(scrapeRuns).toHaveLength(1);
    expect(scrapeRuns[0].status).toBe('flagged');
    expect(scrapeRuns[0].rows_written).toBe(2);
    expect(scrapeRuns[0].rows_rejected).toBe(1);
    expect(typeof scrapeRuns[0].error_log).toBe('string');
    expect(scrapeRuns[0].error_log as string).toContain('9.0');
  });

  it('logs scrape_run with status "error" and error_log containing message when adapter throws', async () => {
    const adapter = makeAdapter('BKA', new Error('Network timeout'));

    await runScraper([{ id: 'BKA', adapter, url: 'https://example.com' }]);

    const scrapeRuns = getScrapeRunInserts();
    expect(scrapeRuns).toHaveLength(1);
    expect(scrapeRuns[0].status).toBe('error');
    expect(scrapeRuns[0].rows_written).toBe(0);
    expect(scrapeRuns[0].error_log as string).toContain('Network timeout');
  });

  it('continues to next adapter after one adapter throws (fail-open)', async () => {
    const failingAdapter = makeAdapter('BKA', new Error('Connection refused'));
    const successAdapter = makeAdapter('DHQGHN', [makeValidRow({ university_id: 'DHQGHN' })]);

    await runScraper([
      { id: 'BKA', adapter: failingAdapter, url: 'https://bka.example.com' },
      { id: 'DHQGHN', adapter: successAdapter, url: 'https://dhqghn.example.com' },
    ]);

    const scrapeRuns = getScrapeRunInserts();
    // Both adapters should have scrape_run entries
    expect(scrapeRuns).toHaveLength(2);

    const errorRun = scrapeRuns.find(v => v.status === 'error');
    const okRun = scrapeRuns.find(v => v.status === 'ok');
    expect(errorRun).toBeDefined();
    expect(okRun).toBeDefined();
    expect(errorRun!.university_id).toBe('BKA');
    expect(okRun!.university_id).toBe('DHQGHN');
  });

  it('logs status "zero_rows" when adapter returns empty array without throwing', async () => {
    const adapter = makeAdapter('BKA', []); // returns [] without throwing

    await runScraper([{ id: 'BKA', adapter, url: 'https://example.com' }]);

    const scrapeRuns = getScrapeRunInserts();
    expect(scrapeRuns).toHaveLength(1);
    expect(scrapeRuns[0].status).toBe('zero_rows');
    expect(scrapeRuns[0].rows_written).toBe(0);
    expect(scrapeRuns[0].rows_rejected).toBe(0);
    expect(scrapeRuns[0].error_log).toContain('0 rows');
  });

  it('does not call db.transaction when adapter returns empty array', async () => {
    const adapter = makeAdapter('BKA', []);

    await runScraper([{ id: 'BKA', adapter, url: 'https://example.com' }]);

    const { db } = await import('../../lib/db');
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('calls db.transaction for batch insert when adapter returns valid rows', async () => {
    const rows = [makeValidRow(), makeValidRow({ major_raw: '7480202' })];
    const adapter = makeAdapter('BKA', rows);

    await runScraper([{ id: 'BKA', adapter, url: 'https://example.com' }]);

    const { db } = await import('../../lib/db');
    expect(db.transaction).toHaveBeenCalledTimes(1);
  });

  it('continues to next adapter after zero_rows (fail-open preserved)', async () => {
    const emptyAdapter = makeAdapter('BKA', []);
    const successAdapter = makeAdapter('DHQGHN', [makeValidRow({ university_id: 'DHQGHN' })]);

    await runScraper([
      { id: 'BKA', adapter: emptyAdapter, url: 'https://bka.example.com' },
      { id: 'DHQGHN', adapter: successAdapter, url: 'https://dhqghn.example.com' },
    ]);

    const scrapeRuns = getScrapeRunInserts();
    expect(scrapeRuns).toHaveLength(2);
    const zeroRun = scrapeRuns.find(v => v.status === 'zero_rows');
    const okRun = scrapeRuns.find(v => v.status === 'ok');
    expect(zeroRun).toBeDefined();
    expect(okRun).toBeDefined();
    expect(zeroRun!.university_id).toBe('BKA');
    expect(okRun!.university_id).toBe('DHQGHN');
  });
});
