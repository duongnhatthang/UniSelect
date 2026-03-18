/**
 * DCN Adapter -- Truong Dai hoc Cong nghiep Ha Noi (HaUI)
 *
 * Verified: 2026-03-18
 * Rendering: JS-rendered (Playwright required)
 * URL: https://tuyensinh.haui.edu.vn/diem-chuan-trung-tuyen-dai-hoc
 * Pattern: Playwright reference adapter -- use as template for other JS-rendered pages
 *
 * University: Truong Dai hoc Cong nghiep Ha Noi
 * Ministry code: DCN
 * Homepage: https://www.haui.edu.vn/
 */

import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import { RawRow, ScraperAdapter } from '../types';

export const dcnAdapter: ScraperAdapter = {
  id: 'DCN',
  async scrape(url: string): Promise<RawRow[]> {
    const browser = await chromium.launch({ headless: true });
    let html: string;
    try {
      const page = await browser.newPage();
      await page.setExtraHTTPHeaders({
        'User-Agent': 'UniSelectBot/1.0 (educational; open source)',
      });
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForSelector('table', { timeout: 15000 });
      html = await page.content();
    } finally {
      await browser.close();
    }

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

      const scoreIdx = headers.findIndex(
        (h) =>
          h.includes('diem chuan') ||
          h.includes('diem trung tuyen') ||
          h.includes('\u0111i\u1ec3m chu\u1ea9n') || // "diem chuan" with Vietnamese diacritics
          h.includes('\u0111i\u1ec3m tr\u00fang tuy\u1ec3n') // "diem trung tuyen" with diacritics
      );
      const codeIdx = headers.findIndex(
        (h) =>
          h.includes('ma nganh') ||
          h.includes('m\u00e3 ng\u00e0nh') || // Vietnamese diacritics
          h.includes('nganh')
      );
      const tohopIdx = headers.findIndex(
        (h) =>
          h.includes('to hop') ||
          h.includes('t\u1ed5 h\u1ee3p') || // Vietnamese diacritics
          h.includes('khoi')
      );

      if (scoreIdx === -1) return;

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
        // Skip non-numeric major codes (section headers)
        if (!/^\d/.test(majorCode)) return;

        rows.push({
          university_id: 'DCN',
          major_raw: majorCode,
          tohop_raw: tohopIdx !== -1 ? (cells[tohopIdx] ?? '') : '',
          year,
          score_raw: scoreRaw,
          source_url: url,
        });
      });
    });

    if (rows.length === 0) {
      throw new Error(`DCN adapter returned 0 rows -- possible rendering failure at ${url}`);
    }
    return rows;
  },
};
