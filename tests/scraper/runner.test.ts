import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RawRow, ScraperAdapter } from '../../lib/scraper/types';

// Capture all .values() arguments across all insert() calls
const capturedInsertValues: Array<Record<string, unknown>> = [];

const { mockInsert } = vi.hoisted(() => {
  const capturedInsertValues: Array<Record<string, unknown>> = [];

  const mockInsert = vi.fn().mockImplementation(() => {
    const valuesForThisInsert = vi.fn().mockImplementation((v: Record<string, unknown>) => {
      capturedInsertValues.push(v);
      return {
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      };
    });
    return { values: valuesForThisInsert };
  });

  return { mockInsert, capturedInsertValues };
});

vi.mock('../../lib/db', () => ({
  db: {
    insert: mockInsert,
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

// Helper: extract values() args that have a `status` field from all insert() calls this test
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
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-apply implementation after clearAllMocks
    mockInsert.mockImplementation(() => {
      const valuesFn = vi.fn().mockImplementation((v: Record<string, unknown>) => ({
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        _capturedValue: v,
      }));
      return { values: valuesFn };
    });
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
});
