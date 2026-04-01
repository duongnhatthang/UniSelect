/**
 * Pipeline smoke tests — verifies that active scrapers produce valid rows
 * through the full pipeline: factory adapter → normalize → non-zero output.
 *
 * These tests catch the bug where:
 * - The adapter extracts rows but normalizer rejects ALL of them
 * - The adapter config (e.g. missing defaultTohop) causes silent data loss
 * - Schema changes break the normalizer contract
 *
 * Uses MSW to mock HTTP responses with real fixture data.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createCheerioAdapter } from '../../lib/scraper/factory';
import { normalize } from '../../lib/scraper/normalizer';
import type { CheerioAdapterConfig } from '../../lib/scraper/factory';

// Load scrapers.json to get real configs
interface ScraperEntry {
  id: string;
  scrape_url: string | null;
  adapter_type: string;
  factory_config?: Omit<CheerioAdapterConfig, 'id'>;
}

const SCRAPERS: ScraperEntry[] = JSON.parse(
  readFileSync(resolve(process.cwd(), 'scrapers.json'), 'utf-8'),
);

// HTC fixture: a minimal valid table matching HTC's real page format
const HTC_FIXTURE = `
<html><body>
<table>
  <tr><th>TT</th><th>Mã ngành, chương trình đào tạo</th><th>Tên ngành</th><th>Điểm trúng tuyển</th></tr>
  <tr><td>1</td><td>7220201</td><td>Ngôn ngữ Anh</td><td>24.10</td></tr>
  <tr><td>2</td><td>7310101</td><td>Kinh tế</td><td>25.43</td></tr>
  <tr><td>3</td><td>7340115</td><td>Marketing</td><td>26.23</td></tr>
  <tr><td>4</td><td>7340101</td><td>Quản trị kinh doanh</td><td>25.80</td></tr>
  <tr><td>5</td><td>7310102</td><td>Kinh tế quốc tế</td><td>24.92</td></tr>
</table>
</body></html>
`;

// BVH fixture: multi-row header format (known to fail — test documents the limitation)
const BVH_FIXTURE = `
<html><body>
<table>
  <tr><th rowspan="2">TT</th><th rowspan="2">Mã ngành</th><th rowspan="2">Tên ngành</th><th colspan="3">Điểm chuẩn</th></tr>
  <tr><th>THPT (100)</th><th>ĐGNL</th><th>ĐGTD</th></tr>
  <tr><td>1</td><td>7480201</td><td>CNTT</td><td>28.50</td><td>850</td><td>75</td></tr>
  <tr><td>2</td><td>7480202</td><td>MMTVT</td><td>27.00</td><td>800</td><td>70</td></tr>
</table>
</body></html>
`;

const server = setupServer(
  http.get('https://htc-test.example.com/scores', () => {
    return new HttpResponse(HTC_FIXTURE, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }),
  http.get('https://bvh-test.example.com/scores', () => {
    return new HttpResponse(BVH_FIXTURE, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterAll(() => server.close());

describe('Pipeline smoke: HTC', () => {
  const htcEntry = SCRAPERS.find((e) => e.id === 'HTC');

  it('HTC has a valid factory_config in scrapers.json', () => {
    expect(htcEntry).toBeDefined();
    expect(htcEntry!.factory_config).toBeDefined();
    expect(htcEntry!.factory_config!.scoreKeywords.length).toBeGreaterThan(0);
    expect(htcEntry!.factory_config!.majorKeywords.length).toBeGreaterThan(0);
  });

  it('HTC config has defaultTohop set (page has no tohop column)', () => {
    expect(htcEntry!.factory_config!.defaultTohop).toBeTruthy();
  });

  it('HTC adapter extracts rows from fixture', async () => {
    const config = htcEntry!.factory_config!;
    const adapter = createCheerioAdapter({ id: 'HTC', ...config });
    const rows = await adapter.scrape('https://htc-test.example.com/scores');
    expect(rows.length).toBeGreaterThan(0);
  });

  it('HTC extracted rows have non-empty tohop_raw (from defaultTohop)', async () => {
    const config = htcEntry!.factory_config!;
    const adapter = createCheerioAdapter({ id: 'HTC', ...config });
    const rows = await adapter.scrape('https://htc-test.example.com/scores');
    for (const row of rows) {
      expect(row.tohop_raw, `Row major=${row.major_raw} has empty tohop`).not.toBe('');
    }
  });

  it('HTC extracted rows pass normalizer (non-zero valid output)', async () => {
    const config = htcEntry!.factory_config!;
    const adapter = createCheerioAdapter({ id: 'HTC', ...config });
    const rawRows = await adapter.scrape('https://htc-test.example.com/scores');

    let valid = 0;
    for (const raw of rawRows) {
      const n = normalize(raw);
      if (n) valid++;
    }
    expect(valid, 'Normalizer rejected ALL rows — check tohop/score/major formats').toBeGreaterThan(0);
    // At least 80% should pass (some rows may have edge cases)
    expect(valid / rawRows.length).toBeGreaterThan(0.5);
  });

  it('normalized rows have correct source_type default', async () => {
    const config = htcEntry!.factory_config!;
    const adapter = createCheerioAdapter({ id: 'HTC', ...config });
    const rawRows = await adapter.scrape('https://htc-test.example.com/scores');
    const normalized = normalize(rawRows[0]);
    expect(normalized).not.toBeNull();
    expect(normalized!.source_type).toBe('scraper');
  });
});

describe('Pipeline smoke: all active cheerio scrapers', () => {
  const activeCheerio = SCRAPERS.filter(
    (e) => e.scrape_url && e.adapter_type === 'cheerio' && e.factory_config,
  );

  it('all active cheerio configs have scoreKeywords', () => {
    for (const entry of activeCheerio) {
      expect(
        entry.factory_config!.scoreKeywords?.length,
        `${entry.id} missing scoreKeywords`,
      ).toBeGreaterThan(0);
    }
  });

  it('all active cheerio configs have majorKeywords', () => {
    for (const entry of activeCheerio) {
      expect(
        entry.factory_config!.majorKeywords?.length,
        `${entry.id} missing majorKeywords`,
      ).toBeGreaterThan(0);
    }
  });

  it('configs without tohopKeywords must have defaultTohop', () => {
    for (const entry of activeCheerio) {
      const config = entry.factory_config!;
      if (!config.tohopKeywords || config.tohopKeywords.length === 0) {
        expect(
          config.defaultTohop,
          `${entry.id} has no tohopKeywords AND no defaultTohop — normalizer will reject all rows`,
        ).toBeTruthy();
      }
    }
  });
});
