/**
 * GHA Adapter Behavioral Tests
 *
 * Tests the GHA (UTC) PaddleOCR adapter with mocked dependencies to verify:
 * 1. Calls fetchHTML with the provided URL
 * 2. Calls execSync with command containing ocr_table.py
 * 3. Returns RawRow[] with university_id 'GHA'
 * 4. Throws on 0 rows (OCR returned no parseable data)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to create mock references safely before vi.mock hoisting
const { mockFetchHTML, mockExecSync, mockReadFileSync, mockWriteFileSync, mockUnlinkSync } =
  vi.hoisted(() => {
    return {
      mockFetchHTML: vi.fn(),
      mockExecSync: vi.fn(),
      mockReadFileSync: vi.fn(),
      mockWriteFileSync: vi.fn(),
      mockUnlinkSync: vi.fn(),
    };
  });

vi.mock('../../../lib/scraper/fetch', () => ({ fetchHTML: mockFetchHTML }));
vi.mock('child_process', () => ({ execSync: mockExecSync }));
vi.mock('fs', async (importOriginal) => {
  const orig = await importOriginal<typeof import('fs')>();
  return {
    ...orig,
    readFileSync: mockReadFileSync,
    writeFileSync: mockWriteFileSync,
    unlinkSync: mockUnlinkSync,
  };
});

import { ghaAdapter } from '../../../lib/scraper/adapters/gha';
import type { RawRow } from '../../../lib/scraper/types';

// GHA announcement page fixture — contains image tags with score image URLs
const GHA_ANNOUNCEMENT_HTML_FIXTURE = `
<!DOCTYPE html>
<html>
  <head><title>Diem trung tuyen UTC 2025</title></head>
  <body>
    <div class="field-item">
      <p>Truong Dai hoc Giao thong van tai thong bao diem trung tuyen</p>
      <img src="/sites/default/files/diem_chuan_2025_page-0001.jpg" />
      <img src="/sites/default/files/diem_chuan_2025_page-0002.jpg" />
    </div>
  </body>
</html>
`;

// HTML with no score images
const NO_IMAGES_HTML = `
<!DOCTYPE html>
<html>
  <head><title>UTC Home</title></head>
  <body>
    <h1>Truong Dai hoc Giao thong van tai</h1>
    <p>Thong tin tuyen sinh</p>
  </body>
</html>
`;

// OCR output fixture — what readFileSync returns after execSync runs ocr_table.py
const OCR_OUTPUT_WITH_ROWS = JSON.stringify({
  lines: [
    'STT',
    'Ma nganh',
    'Ten nganh',
    'To hop',
    'Diem chuan',
    '1',
    '7480201',
    'Ky thuat xay dung',
    'A00',
    '24,00',
    '2',
    '7520103',
    'Co khi',
    'A01',
    '23,50',
  ],
});

// OCR output with no parseable major codes
const OCR_OUTPUT_NO_ROWS = JSON.stringify({
  lines: ['some', 'text', 'without', 'major', 'codes'],
});

describe('GHA adapter behavioral tests (PaddleOCR)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Re-set global fetch mock for image download
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
    }) as unknown as typeof fetch;
    mockWriteFileSync.mockReturnValue(undefined);
    mockUnlinkSync.mockReturnValue(undefined);
  });

  describe('when announcement page has score images and OCR returns valid data', () => {
    beforeEach(() => {
      mockFetchHTML.mockResolvedValue(GHA_ANNOUNCEMENT_HTML_FIXTURE);
      mockExecSync.mockReturnValue(Buffer.from(''));
      mockReadFileSync.mockReturnValue(OCR_OUTPUT_WITH_ROWS);
    });

    it('calls fetchHTML with the provided URL', async () => {
      const url = 'https://tuyensinh.utc.edu.vn/?q=tin-tuyen-sinh/diem-trung-tuyen-2025';
      await ghaAdapter.scrape(url);
      expect(mockFetchHTML).toHaveBeenCalledWith(url);
    });

    it('calls execSync with a command containing ocr_table.py', async () => {
      await ghaAdapter.scrape('https://tuyensinh.utc.edu.vn/?q=tin-tuyen-sinh/diem-trung-tuyen-2025');
      expect(mockExecSync).toHaveBeenCalled();
      const callArg = mockExecSync.mock.calls[0][0] as string;
      expect(callArg).toMatch(/ocr_table\.py/);
    });

    it('returns RawRow array with university_id GHA', async () => {
      const rows = await ghaAdapter.scrape(
        'https://tuyensinh.utc.edu.vn/?q=tin-tuyen-sinh/diem-trung-tuyen-2025'
      );
      expect(Array.isArray(rows)).toBe(true);
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.university_id).toBe('GHA');
      }
    });

    it('extracts major codes from OCR output', async () => {
      const rows = await ghaAdapter.scrape(
        'https://tuyensinh.utc.edu.vn/?q=tin-tuyen-sinh/diem-trung-tuyen-2025'
      );
      const majorCodes = rows.map((r: RawRow) => r.major_raw);
      expect(majorCodes).toContain('7480201');
      expect(majorCodes).toContain('7520103');
    });
  });

  describe('when announcement page has no score images', () => {
    beforeEach(() => {
      mockFetchHTML.mockResolvedValue(NO_IMAGES_HTML);
    });

    it('throws when no score images are found on the page', async () => {
      await expect(
        ghaAdapter.scrape('https://tuyensinh.utc.edu.vn/?q=tin-tuyen-sinh/diem-trung-tuyen-2025')
      ).rejects.toThrow(/GHA adapter found 0 score images/);
    });
  });

  describe('when OCR returns no parseable row data', () => {
    beforeEach(() => {
      mockFetchHTML.mockResolvedValue(GHA_ANNOUNCEMENT_HTML_FIXTURE);
      mockExecSync.mockReturnValue(Buffer.from(''));
      mockReadFileSync.mockReturnValue(OCR_OUTPUT_NO_ROWS);
    });

    it('throws when OCR output has no parseable major codes', async () => {
      await expect(
        ghaAdapter.scrape('https://tuyensinh.utc.edu.vn/?q=tin-tuyen-sinh/diem-trung-tuyen-2025')
      ).rejects.toThrow(/GHA OCR adapter returned 0 rows/);
    });
  });
});
