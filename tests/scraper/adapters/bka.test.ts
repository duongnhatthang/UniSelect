/**
 * BKA Adapter Behavioral Tests
 *
 * Tests the BKA adapter with mock HTML fixtures to verify:
 * 1. Returns a non-empty RawRow[] when the HTML contains a valid cutoff table
 * 2. Each returned row has university_id === 'BKA'
 * 3. Each returned row has non-empty major_raw, tohop_raw, score_raw fields
 * 4. Row count matches the number of <tr> rows in the fixture
 * 5. Throws an error when no cutoff table is found in the HTML
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetchHTML before importing the adapter
vi.mock('../../../lib/scraper/fetch', () => ({
  fetchHTML: vi.fn(),
}));

import { fetchHTML } from '../../../lib/scraper/fetch';
import { bkaAdapter } from '../../../lib/scraper/adapters/bka';
import type { RawRow } from '../../../lib/scraper/types';

const mockFetchHTML = vi.mocked(fetchHTML);

// Realistic BKA cutoff score HTML fixture
// Mirrors what a typical Vietnamese university cutoff page might look like
const BKA_CUTOFF_HTML_FIXTURE = `
<!DOCTYPE html>
<html>
  <head><title>Diem chuan Bach Khoa Ha Noi 2024</title></head>
  <body>
    <h1>Diem chuan tuyen sinh 2024</h1>
    <table>
      <thead>
        <tr>
          <th>STT</th>
          <th>Ma nganh</th>
          <th>Ten nganh</th>
          <th>To hop</th>
          <th>Diem chuan</th>
          <th>Ghi chu</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1</td>
          <td>7480201</td>
          <td>Cong nghe thong tin</td>
          <td>A00</td>
          <td>27,50</td>
          <td></td>
        </tr>
        <tr>
          <td>2</td>
          <td>7520201</td>
          <td>Ky thuat dien</td>
          <td>A01</td>
          <td>26,25</td>
          <td></td>
        </tr>
        <tr>
          <td>3</td>
          <td>7520116</td>
          <td>Ky thuat co dien tu</td>
          <td>A00</td>
          <td>25,75</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  </body>
</html>
`;

// HTML with no cutoff table — only unrelated tables
const NO_CUTOFF_TABLE_HTML = `
<!DOCTYPE html>
<html>
  <head><title>BKA Home</title></head>
  <body>
    <h1>Truong Dai hoc Bach Khoa Ha Noi</h1>
    <table>
      <thead>
        <tr>
          <th>Su kien</th>
          <th>Ngay</th>
          <th>Dia diem</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Le khai giang</td>
          <td>01/09/2024</td>
          <td>Ha Noi</td>
        </tr>
      </tbody>
    </table>
  </body>
</html>
`;

describe('BKA adapter behavioral tests', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('when HTML contains a valid cutoff table', () => {
    beforeEach(() => {
      mockFetchHTML.mockResolvedValue(BKA_CUTOFF_HTML_FIXTURE);
    });

    it('returns a non-empty RawRow array', async () => {
      const rows = await bkaAdapter.scrape('https://example.com/diem-chuan');
      expect(rows).toBeDefined();
      expect(Array.isArray(rows)).toBe(true);
      expect(rows.length).toBeGreaterThan(0);
    });

    it('returns exactly 3 rows matching the fixture tbody rows', async () => {
      const rows = await bkaAdapter.scrape('https://example.com/diem-chuan');
      expect(rows).toHaveLength(3);
    });

    it('sets university_id to "BKA" on every row', async () => {
      const rows = await bkaAdapter.scrape('https://example.com/diem-chuan');
      for (const row of rows) {
        expect(row.university_id).toBe('BKA');
      }
    });

    it('populates non-empty major_raw, tohop_raw, and score_raw on every row', async () => {
      const rows = await bkaAdapter.scrape('https://example.com/diem-chuan');
      for (const row of rows) {
        expect(row.major_raw.length).toBeGreaterThan(0);
        expect(row.tohop_raw.length).toBeGreaterThan(0);
        expect(row.score_raw.length).toBeGreaterThan(0);
      }
    });

    it('extracts the correct major codes from the fixture', async () => {
      const rows = await bkaAdapter.scrape('https://example.com/diem-chuan');
      const majorCodes = rows.map((r: RawRow) => r.major_raw);
      expect(majorCodes).toContain('7480201');
      expect(majorCodes).toContain('7520201');
      expect(majorCodes).toContain('7520116');
    });

    it('extracts the correct tohop codes from the fixture', async () => {
      const rows = await bkaAdapter.scrape('https://example.com/diem-chuan');
      const tohopCodes = rows.map((r: RawRow) => r.tohop_raw);
      expect(tohopCodes).toContain('A00');
      expect(tohopCodes).toContain('A01');
    });

    it('extracts score_raw values that include comma-decimal format', async () => {
      const rows = await bkaAdapter.scrape('https://example.com/diem-chuan');
      const scoreRaws = rows.map((r: RawRow) => r.score_raw);
      expect(scoreRaws).toContain('27,50');
      expect(scoreRaws).toContain('26,25');
      expect(scoreRaws).toContain('25,75');
    });

    it('sets source_url to the provided URL on every row', async () => {
      const url = 'https://example.com/diem-chuan';
      const rows = await bkaAdapter.scrape(url);
      for (const row of rows) {
        expect(row.source_url).toBe(url);
      }
    });

    it('sets year to a number on every row', async () => {
      const rows = await bkaAdapter.scrape('https://example.com/diem-chuan');
      for (const row of rows) {
        expect(typeof row.year).toBe('number');
        expect(row.year).toBeGreaterThan(2000);
      }
    });
  });

  describe('when HTML has no cutoff table (minimum-rows assertion)', () => {
    beforeEach(() => {
      mockFetchHTML.mockResolvedValue(NO_CUTOFF_TABLE_HTML);
    });

    it('throws an error when no cutoff table headers are found', async () => {
      await expect(
        bkaAdapter.scrape('https://example.com/homepage')
      ).rejects.toThrow(/BKA adapter returned 0 rows/);
    });

    it('error message includes the URL for diagnostics', async () => {
      const url = 'https://example.com/homepage';
      await expect(bkaAdapter.scrape(url)).rejects.toThrow(url);
    });
  });
});
