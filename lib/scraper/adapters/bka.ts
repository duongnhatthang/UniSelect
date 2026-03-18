/**
 * BKA Adapter — Đại học Bách Khoa Hà Nội (HUST)
 *
 * TODO: Before setting static_verified: true in scrapers.json:
 * 1. Visit https://hust.edu.vn/ and find the cutoff scores page (likely under
 *    Tuyển sinh -> Điểm chuẩn or similar navigation path)
 * 2. View page source (Ctrl+U) and confirm the table is in raw HTML (not JS-rendered)
 * 3. Update the url in scrapers.json to the specific cutoff page URL, not just the homepage
 * 4. Verify the column headers match the text anchors used below
 *
 * University: Trường Đại học Bách Khoa Hà Nội
 * Ministry code: BKA
 * Homepage: https://hust.edu.vn/
 */

import * as cheerio from 'cheerio';
import { fetchHTML } from '../fetch';
import { RawRow, ScraperAdapter } from '../types';

export const bkaAdapter: ScraperAdapter = {
  id: 'BKA',
  async scrape(url: string): Promise<RawRow[]> {
    const html = await fetchHTML(url);
    const $ = cheerio.load(html);
    const rows: RawRow[] = [];
    const year = new Date().getFullYear() - 1; // Previous year's cutoff scores

    // Semantic text anchors — find tables by header content, not positional CSS selectors
    $('table').each((_, table) => {
      const headers = $(table)
        .find('th, thead td')
        .map((_, el) => $(el).text().trim())
        .get();

      const scoreIdx = headers.findIndex(
        (h) => h.includes('Diem chuan') || h.includes('diem chuan')
      );
      const tohopIdx = headers.findIndex(
        (h) => h.includes('To hop') || h.includes('Khoi') || h.includes('to hop')
      );
      const majorIdx = headers.findIndex(
        (h) =>
          h.includes('Ma nganh') ||
          h.includes('Nganh') ||
          h.includes('ma nganh') ||
          h.includes('nganh')
      );

      // Not a cutoff table — skip
      if (scoreIdx === -1) return;

      $(table)
        .find('tbody tr')
        .each((_, tr) => {
          const cells = $(tr)
            .find('td')
            .map((_, td) => $(td).text().trim())
            .get();
          if (cells.length === 0) return;

          rows.push({
            university_id: 'BKA',
            major_raw: cells[majorIdx] ?? '',
            tohop_raw: cells[tohopIdx] ?? '',
            year,
            score_raw: cells[scoreIdx] ?? '',
            source_url: url,
          });
        });
    });

    // Minimum-rows assertion (Pitfall 4: JS-rendered page or layout change)
    if (rows.length === 0) {
      throw new Error(
        `BKA adapter returned 0 rows — possible JS rendering or layout change at ${url}`
      );
    }

    return rows;
  },
};
