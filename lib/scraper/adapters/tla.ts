/**
 * TLA Adapter -- Truong Dai hoc Thuy loi (TLU)
 *
 * Verified: 2026-03-18 (candidate, static HTML expected)
 * Rendering: Static HTML
 * URL: https://tuyensinh.tlu.edu.vn/diem-chuan
 * Pattern: Static HTML adapter (cheerio) -- see htc.ts for reference pattern
 *
 * University: Truong Dai hoc Thuy loi
 * Ministry code: TLA
 * Homepage: https://www.tlu.edu.vn/
 */

import * as cheerio from 'cheerio';
import { fetchHTML } from '../fetch';
import { RawRow, ScraperAdapter } from '../types';

export const tlaAdapter: ScraperAdapter = {
  id: 'TLA',
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
      const thHeaders = $(table)
        .find('th, thead td')
        .map((_, el) => $(el).text().trim().toLowerCase())
        .get();
      if (thHeaders.length > 0) {
        headers = thHeaders;
      } else {
        headers = $(allRows[0])
          .find('td')
          .map((_, el) => $(el).text().trim().toLowerCase())
          .get();
      }

      // Match score column by semantic text -- supports both Vietnamese diacritics and ASCII fallback
      const scoreIdx = headers.findIndex(
        (h) =>
          h.includes('\u0111i\u1ec3m chu\u1ea9n') || // "diem chuan" with diacritics
          h.includes('diem chuan') ||
          h.includes('\u0111i\u1ec3m tr\u00fang tuy\u1ec3n') || // "diem trung tuyen" with diacritics
          h.includes('diem trung tuyen')
      );

      // Match major code column
      const codeIdx = headers.findIndex(
        (h) =>
          h.includes('m\u00e3 ng\u00e0nh') || // "ma nganh" with diacritics
          h.includes('ma nganh') ||
          h.includes('m\u00e3 x\u00e9t tuy\u1ec3n') || // "ma xet tuyen" with diacritics
          h.includes('ma xet tuyen')
      );

      // Match tohop column
      const tohopIdx = headers.findIndex(
        (h) =>
          h.includes('t\u1ed5 h\u1ee3p') || // "to hop" with diacritics
          h.includes('to hop') ||
          h.includes('kh\u1ed1i') || // "khoi" with diacritics
          h.includes('khoi')
      );

      if (scoreIdx === -1) return;

      // Process data rows -- skip header row for first-row-as-header tables
      const dataRows = thHeaders.length > 0 ? $(table).find('tbody tr') : allRows.slice(1);
      dataRows.each((_, tr) => {
        const cells = $(tr)
          .find('td')
          .map((_, td) => $(td).text().trim())
          .get();
        if (cells.length < 3) return;

        const majorCode = codeIdx !== -1 ? cells[codeIdx] : '';
        const scoreRaw = cells[scoreIdx] ?? '';

        if (!majorCode || !scoreRaw) return;
        // Skip non-numeric major codes (section headers like "I", "II", "Nganh...")
        if (!/^\d/.test(majorCode)) return;

        rows.push({
          university_id: 'TLA',
          major_raw: majorCode,
          tohop_raw: tohopIdx !== -1 ? (cells[tohopIdx] ?? '') : '',
          year,
          score_raw: scoreRaw,
          source_url: url,
        });
      });
    });

    if (rows.length === 0) {
      throw new Error(
        `TLA adapter returned 0 rows -- possible JS rendering or layout change at ${url}`
      );
    }

    return rows;
  },
};
