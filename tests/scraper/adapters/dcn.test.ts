/**
 * DCN Adapter Behavioral Tests
 *
 * Tests the DCN (HaUI) Playwright adapter with mocked playwright to verify:
 * 1. Returns RawRow[] from rendered HTML fixture via page.content()
 * 2. Each row has university_id === 'DCN'
 * 3. chromium.launch called with { headless: true }
 * 4. browser.close() called even when scrape succeeds
 * 5. browser.close() called when page.content() throws
 * 6. Throws on empty table HTML
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to create mock references safely — avoids ReferenceError from vi.mock hoisting
const { mockPage, mockBrowser, mockChromiumLaunch } = vi.hoisted(() => {
  const mockPage = {
    goto: vi.fn().mockResolvedValue(undefined),
    waitForSelector: vi.fn().mockResolvedValue(undefined),
    content: vi.fn(),
    setExtraHTTPHeaders: vi.fn().mockResolvedValue(undefined),
  };
  const mockBrowser = {
    newPage: vi.fn().mockResolvedValue(mockPage),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const mockChromiumLaunch = vi.fn().mockResolvedValue(mockBrowser);
  return { mockPage, mockBrowser, mockChromiumLaunch };
});

vi.mock('playwright', () => ({
  chromium: {
    launch: mockChromiumLaunch,
  },
}));

import { dcnAdapter } from '../../../lib/scraper/adapters/dcn';
import type { RawRow } from '../../../lib/scraper/types';

// DCN fixture HTML — what page.content() returns after JS rendering
const DCN_CUTOFF_HTML_FIXTURE = `
<!DOCTYPE html>
<html>
  <head><title>Diem chuan HaUI 2024</title></head>
  <body>
    <h1>Diem chuan trung tuyen dai hoc 2024</h1>
    <table>
      <thead>
        <tr>
          <th>STT</th>
          <th>Ma nganh</th>
          <th>Ten nganh</th>
          <th>To hop</th>
          <th>Diem chuan</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1</td>
          <td>7480201</td>
          <td>CNTT</td>
          <td>A00</td>
          <td>24,50</td>
        </tr>
        <tr>
          <td>2</td>
          <td>7520201</td>
          <td>Dien tu</td>
          <td>A01</td>
          <td>22,75</td>
        </tr>
        <tr>
          <td>3</td>
          <td>7340101</td>
          <td>QTKD</td>
          <td>D01</td>
          <td>23,00</td>
        </tr>
      </tbody>
    </table>
  </body>
</html>
`;

// HTML with no cutoff table
const NO_CUTOFF_TABLE_HTML = `
<!DOCTYPE html>
<html>
  <head><title>HaUI Home</title></head>
  <body>
    <h1>Truong Dai hoc Cong nghiep Ha Noi</h1>
    <table>
      <thead>
        <tr>
          <th>Su kien</th>
          <th>Ngay</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Le khai giang</td>
          <td>01/09/2024</td>
        </tr>
      </tbody>
    </table>
  </body>
</html>
`;

describe('DCN adapter behavioral tests (Playwright)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Re-apply defaults after resetAllMocks
    mockChromiumLaunch.mockResolvedValue(mockBrowser);
    mockBrowser.newPage.mockResolvedValue(mockPage);
    mockBrowser.close.mockResolvedValue(undefined);
    mockPage.goto.mockResolvedValue(undefined);
    mockPage.waitForSelector.mockResolvedValue(undefined);
    mockPage.setExtraHTTPHeaders.mockResolvedValue(undefined);
  });

  describe('when page.content() returns a valid cutoff table', () => {
    beforeEach(() => {
      mockPage.content.mockResolvedValue(DCN_CUTOFF_HTML_FIXTURE);
    });

    it('returns exactly 3 rows matching the fixture tbody rows', async () => {
      const rows = await dcnAdapter.scrape('https://tuyensinh.haui.edu.vn/diem-chuan');
      expect(rows).toHaveLength(3);
    });

    it('sets university_id to "DCN" on every row', async () => {
      const rows = await dcnAdapter.scrape('https://tuyensinh.haui.edu.vn/diem-chuan');
      for (const row of rows) {
        expect(row.university_id).toBe('DCN');
      }
    });

    it('calls chromium.launch with { headless: true }', async () => {
      await dcnAdapter.scrape('https://tuyensinh.haui.edu.vn/diem-chuan');
      expect(mockChromiumLaunch).toHaveBeenCalledWith({ headless: true });
    });

    it('calls browser.close() after successful scrape', async () => {
      await dcnAdapter.scrape('https://tuyensinh.haui.edu.vn/diem-chuan');
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });

    it('extracts correct major codes from the fixture', async () => {
      const rows = await dcnAdapter.scrape('https://tuyensinh.haui.edu.vn/diem-chuan');
      const majorCodes = rows.map((r: RawRow) => r.major_raw);
      expect(majorCodes).toContain('7480201');
      expect(majorCodes).toContain('7520201');
      expect(majorCodes).toContain('7340101');
    });

    it('extracts score_raw values from the fixture', async () => {
      const rows = await dcnAdapter.scrape('https://tuyensinh.haui.edu.vn/diem-chuan');
      const scores = rows.map((r: RawRow) => r.score_raw);
      expect(scores).toContain('24,50');
      expect(scores).toContain('22,75');
      expect(scores).toContain('23,00');
    });

    it('sets source_url to the provided URL on every row', async () => {
      const url = 'https://tuyensinh.haui.edu.vn/diem-chuan';
      const rows = await dcnAdapter.scrape(url);
      for (const row of rows) {
        expect(row.source_url).toBe(url);
      }
    });
  });

  describe('when page.content() throws an error', () => {
    beforeEach(() => {
      mockPage.content.mockRejectedValue(new Error('page navigation failed'));
    });

    it('calls browser.close() even when page.content() throws', async () => {
      await expect(
        dcnAdapter.scrape('https://tuyensinh.haui.edu.vn/diem-chuan')
      ).rejects.toThrow();
      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('when rendered HTML has no cutoff table', () => {
    beforeEach(() => {
      mockPage.content.mockResolvedValue(NO_CUTOFF_TABLE_HTML);
    });

    it('throws an error when no cutoff table is found', async () => {
      await expect(
        dcnAdapter.scrape('https://tuyensinh.haui.edu.vn/diem-chuan')
      ).rejects.toThrow(/DCN adapter returned 0 rows/);
    });
  });
});
