/**
 * FBU Adapter — Trường Đại học Tài chính Ngân hàng Hà Nội
 *
 * TODO: Before setting static_verified: true in scrapers.json:
 * 1. Visit https://fbu.edu.vn/gioi-thieu/ and find the cutoff scores page (Tuyển sinh -> Điểm chuẩn)
 * 2. View page source (Ctrl+U) and confirm the table is in raw HTML (not JS-rendered)
 * 3. Update the url in scrapers.json to the specific cutoff page URL, not the homepage
 * 4. Verify column headers match the text anchors used below
 *
 * University: Trường Đại học Tài chính Ngân hàng Hà Nội
 * Ministry code: FBU
 * Homepage: https://fbu.edu.vn/gioi-thieu/
 */

import * as cheerio from 'cheerio';
import { fetchHTML } from '../fetch';
import { RawRow, ScraperAdapter } from '../types';

export const fbuAdapter: ScraperAdapter = {
  id: 'FBU',
  async scrape(url: string): Promise<RawRow[]> {
    const html = await fetchHTML(url);
    const $ = cheerio.load(html);
    const rows: RawRow[] = [];
    const year = new Date().getFullYear() - 1;

    $('table').each((_, table) => {
      const headers = $(table)
        .find('th, thead td')
        .map((_, el) => $(el).text().trim())
        .get();

      const scoreIdx = headers.findIndex(
        (h) => h.includes('Diem chuan') || h.includes('diem chuan') || h.includes('Điểm chuẩn')
      );
      const tohopIdx = headers.findIndex(
        (h) => h.includes('To hop') || h.includes('Khoi') || h.includes('to hop') || h.includes('Tổ hợp')
      );
      const majorIdx = headers.findIndex(
        (h) =>
          h.includes('Ma nganh') ||
          h.includes('Nganh') ||
          h.includes('ma nganh') ||
          h.includes('nganh') ||
          h.includes('Ngành')
      );

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
            university_id: 'FBU',
            major_raw: cells[majorIdx] ?? '',
            tohop_raw: cells[tohopIdx] ?? '',
            year,
            score_raw: cells[scoreIdx] ?? '',
            source_url: url,
          });
        });
    });

    if (rows.length === 0) {
      throw new Error(
        `FBU adapter returned 0 rows — possible JS rendering or layout change at ${url}`
      );
    }

    return rows;
  },
};
