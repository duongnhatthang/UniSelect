import * as cheerio from 'cheerio';
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
        const scoreIdx = headers.findIndex((h) =>
          config.scoreKeywords.some((kw) => h.includes(kw))
        );
        const codeIdx = headers.findIndex((h) =>
          config.majorKeywords.some((kw) => h.includes(kw))
        );
        const tohopIdx = config.tohopKeywords
          ? headers.findIndex((h) =>
              config.tohopKeywords!.some((kw) => h.includes(kw))
            )
          : -1;

        if (config.wideTable) {
          // Detect to hop columns: headers matching /^[A-D]\d{2}$/i
          const tohopCols: Array<{ idx: number; code: string }> = [];
          headers.forEach((h, idx) => {
            const cleaned = h.trim().toUpperCase();
            if (/^[A-D]\d{2}$/.test(cleaned)) {
              tohopCols.push({ idx, code: cleaned });
            }
          });

          if (tohopCols.length === 0) return; // wideTable: no [A-D]\d{2} headers found, skip this table

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

        if (scoreIdx === -1) return;

        // Skip header row (first row), process remaining
        allRows.slice(1).each((_, tr) => {
          const cells = $(tr)
            .find('td')
            .map((_, td) => $(td).text().trim())
            .get();
          if (cells.length < 3) return;

          const majorCode = codeIdx !== -1 ? cells[codeIdx] : '';
          const scoreRaw = cells[scoreIdx] ?? '';
          const tohopRaw =
            tohopIdx !== -1 ? cells[tohopIdx] : (config.defaultTohop ?? '');

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
