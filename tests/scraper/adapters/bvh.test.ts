/**
 * BVH Adapter Behavioral Tests
 *
 * Tests the BVH adapter with mock HTML fixtures to verify:
 * 1. Returns 3 RawRow[] from PTIT HTML fixture with THPT (100) column
 * 2. Each row has university_id === 'BVH'
 * 3. Each row has non-empty major_raw and non-empty score_raw
 * 4. Adapter finds score in THPT column (not generic "Diem chuan")
 * 5. Adapter throws on HTML with no score table
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetchHTML before importing the adapter
vi.mock('../../../lib/scraper/fetch', () => ({
  fetchHTML: vi.fn(),
}));

import { fetchHTML } from '../../../lib/scraper/fetch';
import { bvhAdapter } from '../../../lib/scraper/adapters/bvh';
import type { RawRow } from '../../../lib/scraper/types';

const mockFetchHTML = vi.mocked(fetchHTML);

// Realistic BVH/PTIT cutoff score HTML fixture
// Mirrors actual PTIT tuyensinh page table structure with THPT (100) column
const BVH_CUTOFF_HTML_FIXTURE = `
<!DOCTYPE html>
<html>
  <head><title>Diem trung tuyen PTIT 2024</title></head>
  <body>
    <h1>Diem trung tuyen dai hoc chinh quy nam 2024</h1>
    <table>
      <thead>
        <tr>
          <th>TT</th>
          <th>Ma nganh/CT</th>
          <th>Ten nganh/ chuong trinh</th>
          <th>BVH</th>
          <th>BVS</th>
          <th>THPT (100)</th>
          <th>TN (302)</th>
          <th>KH (410)</th>
          <th>DGNL (402)</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>1</td><td>7480201</td><td>Cong nghe thong tin</td><td>BVH</td><td>BVS1</td><td>27,50</td><td>25,00</td><td>700</td><td>800</td></tr>
        <tr><td>2</td><td>7520201</td><td>Ky thuat dien tu vien thong</td><td>BVH</td><td>BVS2</td><td>26,00</td><td>24,00</td><td>680</td><td>750</td></tr>
        <tr><td>3</td><td>7340101</td><td>Quan tri kinh doanh</td><td>BVH</td><td>BVS3</td><td>25,50</td><td>23,50</td><td>650</td><td>720</td></tr>
      </tbody>
    </table>
  </body>
</html>
`;

// HTML with no cutoff table — only unrelated tables
const NO_CUTOFF_TABLE_HTML = `
<!DOCTYPE html>
<html>
  <head><title>PTIT Home</title></head>
  <body>
    <h1>Hoc vien Cong nghe Buu chinh Vien thong</h1>
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

describe('BVH adapter behavioral tests', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('when HTML contains a valid PTIT cutoff table with THPT (100) column', () => {
    beforeEach(() => {
      mockFetchHTML.mockResolvedValue(BVH_CUTOFF_HTML_FIXTURE);
    });

    it('returns a non-empty RawRow array', async () => {
      const rows = await bvhAdapter.scrape('https://tuyensinh.ptit.edu.vn/diem-trung-tuyen-2024/');
      expect(rows).toBeDefined();
      expect(Array.isArray(rows)).toBe(true);
      expect(rows.length).toBeGreaterThan(0);
    });

    it('returns exactly 3 rows matching the fixture tbody rows', async () => {
      const rows = await bvhAdapter.scrape('https://tuyensinh.ptit.edu.vn/diem-trung-tuyen-2024/');
      expect(rows).toHaveLength(3);
    });

    it('sets university_id to "BVH" on every row', async () => {
      const rows = await bvhAdapter.scrape('https://tuyensinh.ptit.edu.vn/diem-trung-tuyen-2024/');
      for (const row of rows) {
        expect(row.university_id).toBe('BVH');
      }
    });

    it('populates non-empty major_raw and score_raw on every row', async () => {
      const rows = await bvhAdapter.scrape('https://tuyensinh.ptit.edu.vn/diem-trung-tuyen-2024/');
      for (const row of rows) {
        expect(row.major_raw.length).toBeGreaterThan(0);
        expect(row.score_raw.length).toBeGreaterThan(0);
      }
    });

    it('extracts score_raw from the THPT (100) column, not a generic diem chuan column', async () => {
      const rows = await bvhAdapter.scrape('https://tuyensinh.ptit.edu.vn/diem-trung-tuyen-2024/');
      const scoreRaws = rows.map((r: RawRow) => r.score_raw);
      expect(scoreRaws).toContain('27,50');
      expect(scoreRaws).toContain('26,00');
      expect(scoreRaws).toContain('25,50');
    });

    it('extracts the correct major codes from column index 1 (Ma nganh/CT)', async () => {
      const rows = await bvhAdapter.scrape('https://tuyensinh.ptit.edu.vn/diem-trung-tuyen-2024/');
      const majorCodes = rows.map((r: RawRow) => r.major_raw);
      expect(majorCodes).toContain('7480201');
      expect(majorCodes).toContain('7520201');
      expect(majorCodes).toContain('7340101');
    });

    it('sets tohop_raw to empty string (PTIT table has no tohop column)', async () => {
      const rows = await bvhAdapter.scrape('https://tuyensinh.ptit.edu.vn/diem-trung-tuyen-2024/');
      for (const row of rows) {
        expect(row.tohop_raw).toBe('');
      }
    });

    it('sets source_url to the provided URL on every row', async () => {
      const url = 'https://tuyensinh.ptit.edu.vn/diem-trung-tuyen-2024/';
      const rows = await bvhAdapter.scrape(url);
      for (const row of rows) {
        expect(row.source_url).toBe(url);
      }
    });

    it('sets year to a number on every row', async () => {
      const rows = await bvhAdapter.scrape('https://tuyensinh.ptit.edu.vn/diem-trung-tuyen-2024/');
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
        bvhAdapter.scrape('https://tuyensinh.ptit.edu.vn/')
      ).rejects.toThrow(/BVH adapter returned 0 rows/);
    });

    it('error message includes the URL for diagnostics', async () => {
      const url = 'https://tuyensinh.ptit.edu.vn/';
      await expect(bvhAdapter.scrape(url)).rejects.toThrow(url);
    });
  });
});
