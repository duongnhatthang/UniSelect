import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import { fetchHTML } from './fetch';
import type { RawRow, ScraperAdapter } from './types';

export interface CheerioAdapterConfig {
  id: string;
  scoreKeywords: string[];    // e.g. ['điểm chuẩn', 'diem chuan', 'điểm trúng tuyển']
  majorKeywords: string[];    // e.g. ['mã ngành', 'ma nganh', 'mã xét tuyển']
  tohopKeywords?: string[];   // e.g. ['tổ hợp', 'to hop'] — omit for single-tohop
  defaultTohop?: string;      // e.g. 'A00' — used when tohopKeywords is omitted or tohop column not found
  wideTable?: boolean;        // true = one column per to hop code (A00, A01, D01…); each non-empty cell → one RawRow
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
 * Data-driven column detection: analyze the first few data rows to infer
 * which column contains major codes, scores, and tohop codes.
 * Returns column indices or -1 if not found.
 */
function inferColumnsFromData(
  $: cheerio.CheerioAPI,
  allRows: cheerio.Cheerio<AnyNode>,
  startRow: number,
): { codeIdx: number; scoreIdx: number; tohopIdx: number } {
  const sampleSize = Math.min(5, allRows.length - startRow);
  if (sampleSize < 1) return { codeIdx: -1, scoreIdx: -1, tohopIdx: -1 };

  // Collect cell values for each column across sample rows
  const colValues: string[][] = [];
  for (let r = startRow; r < startRow + sampleSize; r++) {
    const cells = $(allRows[r]).find('td').map((_, td) => $(td).text().trim()).get();
    for (let c = 0; c < cells.length; c++) {
      if (!colValues[c]) colValues[c] = [];
      colValues[c].push(cells[c]);
    }
  }

  let codeIdx = -1;
  let scoreIdx = -1;
  let tohopIdx = -1;
  let bestCodeCount = 0;
  let bestScoreCount = 0;
  let bestTohopCount = 0;

  for (let c = 0; c < colValues.length; c++) {
    const vals = colValues[c];
    const majorCount = vals.filter(isMajorCode).length;
    const scoreCount = vals.filter(isScore).length;
    const tohopCount = vals.filter(isTohopCode).length;

    // Pick the column with the most matches (minimum 2 out of sample)
    if (majorCount >= 2 && majorCount > bestCodeCount) {
      bestCodeCount = majorCount;
      codeIdx = c;
    }
    if (scoreCount >= 2 && scoreCount > bestScoreCount) {
      bestScoreCount = scoreCount;
      scoreIdx = c;
    }
    if (tohopCount >= 2 && tohopCount > bestTohopCount) {
      bestTohopCount = tohopCount;
      tohopIdx = c;
    }
  }

  // Ensure no column is used for two purposes
  if (codeIdx === scoreIdx && codeIdx !== -1) scoreIdx = -1;
  if (codeIdx === tohopIdx && codeIdx !== -1) tohopIdx = -1;
  if (scoreIdx === tohopIdx && scoreIdx !== -1) tohopIdx = -1;

  return { codeIdx, scoreIdx, tohopIdx };
}

export function createCheerioAdapter(config: CheerioAdapterConfig): ScraperAdapter {
  return {
    id: config.id,
    async scrape(url: string): Promise<RawRow[]> {
      const html = await fetchHTML(url);
      const $ = cheerio.load(html);
      const rows: RawRow[] = [];
      const year = new Date().getFullYear() - 1;

      $('table').each((_, table) => {
        const allRows = $(table).find('tr');
        if (allRows.length < 2) return;

        // Header detection: prefer <th>/<thead td>, fall back to first <tr><td>
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

        // Column index finding via keyword .includes()
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

        if (config.wideTable) {
          // Detect to hop columns: headers matching /^[A-Z]\d{2,3}$/i
          const tohopCols: Array<{ idx: number; code: string }> = [];
          headers.forEach((h, idx) => {
            const cleaned = h.trim().toUpperCase();
            if (/^[A-Z]\d{2,3}$/.test(cleaned)) {
              tohopCols.push({ idx, code: cleaned });
            }
          });

          if (tohopCols.length === 0) return; // wideTable: no tohop headers found, skip this table

          allRows.slice(1).each((_, tr) => {
            const cells = $(tr).find('td').map((_, td) => $(td).text().trim()).get();
            if (cells.length < 3) return;
            const majorCode = codeIdx !== -1 ? cells[codeIdx] : '';
            if (!majorCode || !/^\d/.test(majorCode)) return;

            for (const col of tohopCols) {
              const scoreRaw = cells[col.idx] ?? '';
              if (!scoreRaw || !/\d/.test(scoreRaw)) continue; // empty = not offered
              rows.push({
                university_id: config.id,
                major_raw: majorCode,
                tohop_raw: col.code,
                year,
                score_raw: scoreRaw,
                source_url: url,
              });
            }
          });
          return; // wide-table path handled, don't fall through to narrow path
        }

        // Determine the first data row (skip header rows)
        const dataStartRow = thHeaders.length > 0 ? 0 : 1;

        // --- Data-pattern fallback ---
        // If keyword-based header detection missed score or major columns,
        // try inferring from the actual cell data patterns.
        if (scoreIdx === -1 || codeIdx === -1) {
          const inferred = inferColumnsFromData($, allRows, dataStartRow);
          if (codeIdx === -1 && inferred.codeIdx !== -1) codeIdx = inferred.codeIdx;
          if (scoreIdx === -1 && inferred.scoreIdx !== -1) scoreIdx = inferred.scoreIdx;
          if (tohopIdx === -1 && inferred.tohopIdx !== -1) tohopIdx = inferred.tohopIdx;
        }

        // Also try multi-row headers: check rows 1-2 for keywords if still missing
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
            if (tohopIdx === -1 && config.tohopKeywords) {
              const idx = rowHeaders.findIndex((h) =>
                config.tohopKeywords!.some((kw) => h.includes(kw))
              );
              if (idx !== -1) tohopIdx = idx;
            }
          }
        }

        if (scoreIdx === -1 || codeIdx === -1) return; // Still can't find required columns

        // Process data rows
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
          `${config.id} adapter returned 0 rows — possible JS rendering or layout change at ${url}`
        );
      }

      return rows;
    },
  };
}
