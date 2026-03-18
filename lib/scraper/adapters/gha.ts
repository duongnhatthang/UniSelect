/**
 * GHA Adapter -- Truong Dai hoc Giao thong van tai (UTC)
 *
 * Verified: 2026-03-18
 * Rendering: JPEG images (PaddleOCR required)
 * URL: https://tuyensinh.utc.edu.vn/?q=tin-tuyen-sinh/diem-trung-tuyen-dai-hoc-he-chinh-quy-nam-2025
 * Pattern: PaddleOCR reference adapter -- use as template for other image-based pages
 *
 * University: Truong Dai hoc Giao thong van tai
 * Ministry code: GHA
 * Homepage: https://utc.edu.vn/
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { fetchHTML } from '../fetch';
import * as cheerio from 'cheerio';
import { RawRow, ScraperAdapter } from '../types';

export const ghaAdapter: ScraperAdapter = {
  id: 'GHA',
  async scrape(url: string): Promise<RawRow[]> {
    // Step 1: Fetch announcement page to find image URLs
    const html = await fetchHTML(url);
    const $ = cheerio.load(html);
    const imageUrls: string[] = [];
    $('img').each((_, el) => {
      const src = $(el).attr('src') ?? '';
      if (src.match(/diem.*\.(jpg|jpeg|png)/i) || src.match(/page-\d+\.(jpg|jpeg|png)/i)) {
        const absolute = src.startsWith('http') ? src : new URL(src, url).href;
        imageUrls.push(absolute);
      }
    });

    if (imageUrls.length === 0) {
      throw new Error(`GHA adapter found 0 score images at ${url}`);
    }

    const rows: RawRow[] = [];
    const year = new Date().getFullYear() - 1;

    for (const imgUrl of imageUrls) {
      const res = await fetch(imgUrl);
      if (!res.ok) continue;
      const buffer = Buffer.from(await res.arrayBuffer());
      const tempImg = join(tmpdir(), `gha_score_${Date.now()}.jpg`);
      const tempOut = join(tmpdir(), `gha_ocr_${Date.now()}.json`);

      try {
        writeFileSync(tempImg, buffer);

        execSync(`python3 scripts/ocr_table.py "${tempImg}" "${tempOut}"`, {
          timeout: 120000,
          cwd: process.cwd(),
        });

        const ocrResult = JSON.parse(readFileSync(tempOut, 'utf-8'));
        const lines: string[] = ocrResult.lines ?? [];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const majorMatch = line.match(/^(7\d{6})/);
          if (majorMatch) {
            const majorCode = majorMatch[1];
            const tohop = lines[i + 1] ?? '';
            const score = lines[i + 2] ?? '';
            if (/\d/.test(score)) {
              rows.push({
                university_id: 'GHA',
                major_raw: majorCode,
                tohop_raw: tohop,
                year,
                score_raw: score.replace(',', '.'),
                source_url: url,
              });
            }
          }
        }
      } finally {
        try { unlinkSync(tempImg); } catch { /* ignore */ }
        try { unlinkSync(tempOut); } catch { /* ignore */ }
      }
    }

    if (rows.length === 0) {
      throw new Error(`GHA OCR adapter returned 0 rows from ${imageUrls.length} images at ${url}`);
    }
    return rows;
  },
};
