/**
 * Playwright-based factory adapter for JS-rendered university pages.
 *
 * Same extraction logic as the cheerio factory adapter, but renders the page
 * with Playwright first to handle JS-rendered content (React, Next.js, Angular).
 */

import { chromium, type Browser } from 'playwright';
import * as cheerio from 'cheerio';
import type { RawRow, ScraperAdapter } from './types';
import type { CheerioAdapterConfig } from './factory';

/** Shared browser instance for batch operations */
let sharedBrowser: Browser | null = null;

export async function getSharedBrowser(): Promise<Browser> {
  if (!sharedBrowser || !sharedBrowser.isConnected()) {
    sharedBrowser = await chromium.launch({ headless: true });
  }
  return sharedBrowser;
}

export async function closeSharedBrowser(): Promise<void> {
  if (sharedBrowser) {
    await sharedBrowser.close();
    sharedBrowser = null;
  }
}

/** Check if a string looks like a major code (7 followed by 6+ digits) */
function isMajorCode(s: string): boolean {
  return /^7\d{6,}/.test(s.trim());
}

/** Check if a string looks like a cutoff score (number in range [10, 30]) */
function isScore(s: string): boolean {
  const val = parseFloat(s.trim().replace(',', '.'));
  return !isNaN(val) && val >= 10 && val <= 30;
}

/** Check if a string looks like a tohop code (letter + 2-3 digits) */
function isTohopCode(s: string): boolean {
  return /^[A-Z]\d{2,3}$/i.test(s.trim());
}

/**
 * Data-driven column detection from cell data patterns.
 */
function inferColumnsFromData(
  $: cheerio.CheerioAPI,
  allRows: cheerio.Cheerio<cheerio.Element>,
  startRow: number,
): { codeIdx: number; scoreIdx: number; tohopIdx: number } {
  const sampleSize = Math.min(5, allRows.length - startRow);
  if (sampleSize < 1) return { codeIdx: -1, scoreIdx: -1, tohopIdx: -1 };

  const colValues: string[][] = [];
  for (let r = startRow; r < startRow + sampleSize; r++) {
    const cells = $(allRows[r]).find('td').map((_, td) => $(td).text().trim()).get();
    for (let c = 0; c < cells.length; c++) {
      if (!colValues[c]) colValues[c] = [];
      colValues[c].push(cells[c]);
    }
  }

  let codeIdx = -1, scoreIdx = -1, tohopIdx = -1;
  let bestCodeCount = 0, bestScoreCount = 0, bestTohopCount = 0;

  for (let c = 0; c < colValues.length; c++) {
    const vals = colValues[c];
    const majorCount = vals.filter(isMajorCode).length;
    const scoreCount = vals.filter(isScore).length;
    const tohopCount = vals.filter(isTohopCode).length;

    if (majorCount >= 2 && majorCount > bestCodeCount) { bestCodeCount = majorCount; codeIdx = c; }
    if (scoreCount >= 2 && scoreCount > bestScoreCount) { bestScoreCount = scoreCount; scoreIdx = c; }
    if (tohopCount >= 2 && tohopCount > bestTohopCount) { bestTohopCount = tohopCount; tohopIdx = c; }
  }

  if (codeIdx === scoreIdx && codeIdx !== -1) scoreIdx = -1;
  if (codeIdx === tohopIdx && codeIdx !== -1) tohopIdx = -1;
  if (scoreIdx === tohopIdx && scoreIdx !== -1) tohopIdx = -1;

  return { codeIdx, scoreIdx, tohopIdx };
}

/**
 * Render a page with Playwright and extract score data using the same logic
 * as the cheerio factory adapter.
 */
export function createPlaywrightAdapter(config: CheerioAdapterConfig): ScraperAdapter {
  return {
    id: config.id,
    async scrape(url: string): Promise<RawRow[]> {
      const browser = await getSharedBrowser();
      let html: string;
      try {
        const page = await browser.newPage();
        await page.setExtraHTTPHeaders({
          'User-Agent': 'UniSelectBot/1.0 (educational; open source)',
        });
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
        // Wait for either a table or a reasonable timeout
        await page.waitForSelector('table', { timeout: 10_000 }).catch(() => {});
        html = await page.content();
        await page.close();
      } catch (err) {
        throw new Error(`Playwright failed for ${config.id}: ${err instanceof Error ? err.message : err}`);
      }

      const $ = cheerio.load(html);
      const rows: RawRow[] = [];
      const year = new Date().getFullYear() - 1;

      $('table').each((_, table) => {
        const allRows = $(table).find('tr');
        if (allRows.length < 2) return;

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

        let scoreIdx = headers.findIndex((h) =>
          config.scoreKeywords.some((kw) => h.includes(kw))
        );
        let codeIdx = headers.findIndex((h) =>
          config.majorKeywords.some((kw) => h.includes(kw))
        );
        let tohopIdx = config.tohopKeywords
          ? headers.findIndex((h) =>
              config.tohopKeywords!.some((kw) => h.includes(kw))
            )
          : -1;

        const dataStartRow = thHeaders.length > 0 ? 0 : 1;

        // Data-pattern fallback
        if (scoreIdx === -1 || codeIdx === -1) {
          const inferred = inferColumnsFromData($, allRows, dataStartRow);
          if (codeIdx === -1 && inferred.codeIdx !== -1) codeIdx = inferred.codeIdx;
          if (scoreIdx === -1 && inferred.scoreIdx !== -1) scoreIdx = inferred.scoreIdx;
          if (tohopIdx === -1 && inferred.tohopIdx !== -1) tohopIdx = inferred.tohopIdx;
        }

        // Multi-row header fallback
        if (scoreIdx === -1 || codeIdx === -1) {
          for (let r = 1; r <= Math.min(2, allRows.length - 1); r++) {
            const rowHeaders = $(allRows[r])
              .find('td, th')
              .map((_, el) => $(el).text().trim().toLowerCase())
              .get();
            if (scoreIdx === -1) {
              const idx = rowHeaders.findIndex((h) =>
                config.scoreKeywords.some((kw) => h.includes(kw))
              );
              if (idx !== -1) scoreIdx = idx;
            }
            if (codeIdx === -1) {
              const idx = rowHeaders.findIndex((h) =>
                config.majorKeywords.some((kw) => h.includes(kw))
              );
              if (idx !== -1) codeIdx = idx;
            }
          }
        }

        if (scoreIdx === -1 || codeIdx === -1) return;

        allRows.slice(dataStartRow).each((_, tr) => {
          const cells = $(tr)
            .find('td')
            .map((_, td) => $(td).text().trim())
            .get();
          if (cells.length < 2) return;

          const majorCode = cells[codeIdx] ?? '';
          const scoreRaw = cells[scoreIdx] ?? '';
          const tohopRaw =
            tohopIdx !== -1 ? (cells[tohopIdx] ?? '') : (config.defaultTohop ?? '');

          if (!majorCode || !scoreRaw) return;
          if (!/^\d/.test(majorCode)) return;

          rows.push({
            university_id: config.id,
            major_raw: majorCode,
            tohop_raw: tohopRaw,
            year,
            score_raw: scoreRaw,
            source_url: url,
          });
        });
      });

      if (rows.length === 0) {
        throw new Error(
          `${config.id} playwright adapter returned 0 rows at ${url}`
        );
      }

      return rows;
    },
  };
}
