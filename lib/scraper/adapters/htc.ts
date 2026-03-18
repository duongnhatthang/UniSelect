/**
 * HTC Adapter — Học viện Tài chính
 *
 * Verified: 2026-03-18
 * Page: static HTML table with columns: TT, Mã ngành, Tên ngành, Điểm trúng tuyển
 * Note: No <thead>/<th> — headers are in the first <tr> as <td>.
 *       No tổ hợp column; HTC programs primarily use A00, emitted as default.
 *
 * University: Học viện Tài chính
 * Ministry code: HTC
 * Homepage: https://hvtc.edu.vn/
 */

import * as cheerio from 'cheerio';
import { fetchHTML } from '../fetch';
import { RawRow, ScraperAdapter } from '../types';

export const htcAdapter: ScraperAdapter = {
  id: 'HTC',
  async scrape(url: string): Promise<RawRow[]> {
    const html = await fetchHTML(url);
    const $ = cheerio.load(html);
    const rows: RawRow[] = [];
    const year = new Date().getFullYear() - 1;

    $('table').each((_, table) => {
      const allRows = $(table).find('tr');
      if (allRows.length < 2) return;

      // Headers may be in <th> or first <tr> <td>
      let headers: string[];
      const thHeaders = $(table).find('th, thead td').map((_, el) => $(el).text().trim().toLowerCase()).get();
      if (thHeaders.length > 0) {
        headers = thHeaders;
      } else {
        // Use first row as headers
        headers = $(allRows[0]).find('td').map((_, el) => $(el).text().trim().toLowerCase()).get();
      }

      // Match on "điểm trúng tuyển" or "điểm chuẩn"
      const scoreIdx = headers.findIndex(
        (h) =>
          h.includes('điểm trúng tuyển') ||
          h.includes('diem trung tuyen') ||
          h.includes('điểm chuẩn') ||
          h.includes('diem chuan')
      );

      // Match on major/program code column
      const codeIdx = headers.findIndex(
        (h) =>
          h.includes('mã ngành') ||
          h.includes('ma nganh') ||
          h.includes('mã xét tuyển') ||
          h.includes('ma xet tuyen')
      );

      if (scoreIdx === -1) return;

      // Skip the header row (first row), process the rest
      allRows.slice(1).each((_, tr) => {
        const cells = $(tr)
          .find('td')
          .map((_, td) => $(td).text().trim())
          .get();
        if (cells.length < 3) return;

        const majorCode = codeIdx !== -1 ? cells[codeIdx] : '';
        const scoreRaw = cells[scoreIdx] ?? '';

        // Skip section headers (e.g., "I", "II") and empty rows
        if (!majorCode || !scoreRaw) return;
        // Skip non-numeric major codes (section headers like "Chương trình chuẩn")
        if (!/^\d/.test(majorCode)) return;

        rows.push({
          university_id: 'HTC',
          major_raw: majorCode,
          tohop_raw: 'A00',
          year,
          score_raw: scoreRaw,
          source_url: url,
        });
      });
    });

    if (rows.length === 0) {
      throw new Error(
        `HTC adapter returned 0 rows — possible JS rendering or layout change at ${url}`
      );
    }

    return rows;
  },
};
