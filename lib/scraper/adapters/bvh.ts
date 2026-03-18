/**
 * BVH Adapter — Học viện Công nghệ Bưu chính Viễn thông (PTIT)
 *
 * Verified: 2026-03-18
 * Page: static HTML table at tuyensinh.ptit.edu.vn
 * Table headers: TT | Ma nganh/CT | Ten nganh/chuong trinh | BVH | BVS | THPT (100) | TN (302) | KH (410) | DGNL (402)
 * Note: Score column is "THPT (100)" — the standard THPT exam method. Other columns are alternative admission methods.
 * TODO: URL contains year (2024). Update annually when new scores publish.
 *
 * University: Học viện Công nghệ Bưu chính Viễn thông
 * Ministry code: BVH
 * Homepage: https://portal.ptit.edu.vn/
 */

import * as cheerio from 'cheerio';
import { fetchHTML } from '../fetch';
import { RawRow, ScraperAdapter } from '../types';

export const bvhAdapter: ScraperAdapter = {
  id: 'BVH',
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
        // Use first row as headers
        headers = $(allRows[0])
          .find('td')
          .map((_, el) => $(el).text().trim().toLowerCase())
          .get();
      }

      // Match THPT column first (PTIT uses "THPT (100)"), fallback to generic score columns
      const scoreIdx = headers.findIndex(
        (h) =>
          h.includes('thpt') || // matches "THPT (100)" on PTIT
          h.includes('diem chuan') ||
          h.includes('diem trung tuyen')
      );

      // Match major/program code column
      const codeIdx = headers.findIndex(
        (h) =>
          h.includes('ma nganh') ||
          h.includes('ma xet tuyen') ||
          h.includes('nganh')
      );

      // PTIT table has no tohop column — emit empty string, normalizer handles it
      const tohopIdx = headers.findIndex(
        (h) =>
          h.includes('to hop') ||
          h.includes('khoi') ||
          h.includes('to hop') ||
          h.includes('to hop xet tuyen')
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
        // Skip non-numeric major codes (section headers like "Chuong trinh chuan")
        if (!/^\d/.test(majorCode)) return;

        rows.push({
          university_id: 'BVH',
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
        `BVH adapter returned 0 rows — possible JS rendering or layout change at ${url}`
      );
    }

    return rows;
  },
};
