/**
 * Ministry Portal Adapter
 *
 * IMPORTANT: This adapter's URL and HTML structure are UNVERIFIED.
 * The Ministry portal at thisinh.thitotnghiepthpt.edu.vn changes its URL
 * structure and HTML layout between admission cycles.
 *
 * Before enabling this adapter (setting static_verified: true in scrapers.json):
 * 1. Visit the portal in a browser and locate the "Diem chuan" (cutoff scores) page
 *    — NOT the "Diem thi" (exam scores) page; these are separate sections published at different times
 * 2. View page source (Ctrl+U) and confirm the table is present in raw HTML
 * 3. Update TODO_CUTOFF_URL_PATH below with the actual path to the cutoff scores page
 * 4. Audit the table structure: which column contains "Ma truong", "Ma nganh", "To hop", "Diem chuan"
 * 5. Update the semantic text anchors in the scraper below to match the actual column headers
 *
 * See: .planning/phases/01-data-foundation/01-RESEARCH.md — Pitfall 1
 * See: .planning/phases/01-data-foundation/01-CONTEXT.md — Ministry portal runs first
 */

import * as cheerio from 'cheerio';
import { fetchHTML } from '../fetch';
import { RawRow, ScraperAdapter } from '../types';

// TODO: Replace with the actual URL path to the cutoff scores page after manual audit.
// The homepage URL in scrapers.json is a placeholder only.
// Expected pattern: https://thisinh.thitotnghiepthpt.edu.vn/[path-to-diem-chuan-page]
const TODO_CUTOFF_URL_PATH = '/'; // placeholder — update after manual audit

export const ministryAdapter: ScraperAdapter = {
  id: 'MINISTRY',
  async scrape(url: string): Promise<RawRow[]> {
    // TODO: Verify and update this URL path after manual portal audit
    const targetUrl = url.endsWith('/')
      ? url.slice(0, -1) + TODO_CUTOFF_URL_PATH
      : url + TODO_CUTOFF_URL_PATH;

    const html = await fetchHTML(targetUrl);
    const $ = cheerio.load(html);
    const rows: RawRow[] = [];
    const year = new Date().getFullYear() - 1; // Previous year's cutoff scores

    // TODO: After manual audit, verify these header keywords match the actual column names.
    // The Ministry portal table is expected to have columns like:
    // "Ma truong" (university code), "Ma nganh" (major code), "To hop" (subject combination), "Diem chuan" (cutoff score)
    // Adjust the includes() strings below to match the actual Vietnamese text on the page.
    $('table').each((_, table) => {
      const headers = $(table)
        .find('th, thead td')
        .map((_, el) => $(el).text().trim())
        .get();

      // Semantic text anchors — TODO: verify these match actual column headers after audit
      const universityIdx = headers.findIndex(
        (h) => h.includes('Ma truong') || h.includes('Truong') || h.includes('truong')
      );
      const majorIdx = headers.findIndex(
        (h) =>
          h.includes('Ma nganh') ||
          h.includes('Nganh') ||
          h.includes('ma nganh') ||
          h.includes('nganh')
      );
      const tohopIdx = headers.findIndex(
        (h) =>
          h.includes('To hop') ||
          h.includes('Khoi') ||
          h.includes('to hop') ||
          h.includes('khoi')
      );
      const scoreIdx = headers.findIndex(
        (h) => h.includes('Diem chuan') || h.includes('diem chuan')
      );

      // Skip tables that don't look like cutoff score tables
      if (scoreIdx === -1) return;

      $(table)
        .find('tbody tr')
        .each((_, tr) => {
          const cells = $(tr)
            .find('td')
            .map((_, td) => $(td).text().trim())
            .get();
          if (cells.length === 0) return;

          // Extract university_id from "Ma truong" column if present,
          // otherwise this table may not be the multi-university portal table
          const universityId =
            universityIdx !== -1 ? (cells[universityIdx] ?? '').toUpperCase().trim() : 'MINISTRY';

          if (!universityId) return; // Skip rows with empty university code

          rows.push({
            university_id: universityId,
            major_raw: cells[majorIdx] ?? '',
            tohop_raw: cells[tohopIdx] ?? '',
            year,
            score_raw: cells[scoreIdx] ?? '',
            source_url: targetUrl,
          });
        });
    });

    // Minimum-rows assertion (Pitfall 4: JS-rendered page or layout change)
    if (rows.length === 0) {
      throw new Error(
        `[MINISTRY] adapter returned 0 rows — possible JS rendering, login wall, or layout change at ${targetUrl}. ` +
          `Manual audit required: verify the cutoff scores URL path and HTML table structure.`
      );
    }

    return rows;
  },
};
