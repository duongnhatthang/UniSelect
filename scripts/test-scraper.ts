/**
 * test-scraper.ts — Quick manual test of the factory adapter against configured scrapers.
 * No DB required — just fetches and parses.
 *
 * Usage: npx tsx scripts/test-scraper.ts [university_id]
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createCheerioAdapter } from '../lib/scraper/factory';

interface ScraperEntry {
  id: string;
  scrape_url: string | null;
  adapter_type: string;
  factory_config?: {
    scoreKeywords: string[];
    majorKeywords: string[];
    tohopKeywords?: string[];
  };
}

async function main() {
  const targetId = process.argv[2]; // optional: test specific uni

  const entries: ScraperEntry[] = JSON.parse(
    readFileSync(resolve(process.cwd(), 'scrapers.json'), 'utf-8'),
  );

  const cheerioEntries = entries.filter(
    (e) =>
      e.scrape_url !== null &&
      e.adapter_type === 'cheerio' &&
      (!targetId || e.id === targetId),
  );

  console.log(`Testing ${cheerioEntries.length} cheerio adapters...\n`);

  for (const entry of cheerioEntries) {
    const config = entry.factory_config ?? {
      scoreKeywords: ['điểm chuẩn', 'diem chuan', 'Điểm chuẩn'],
      majorKeywords: ['mã ngành', 'ma nganh', 'Mã ngành', 'Ngành'],
      tohopKeywords: ['tổ hợp', 'to hop', 'Tổ hợp', 'Khối'],
    };

    const adapter = createCheerioAdapter({ id: entry.id, ...config });

    try {
      const rows = await adapter.scrape(entry.scrape_url!);
      console.log(`[${entry.id}] ${rows.length} rows from ${entry.scrape_url}`);
      if (rows.length > 0) {
        console.log(`  Sample: major=${rows[0].major_raw} tohop=${rows[0].tohop_raw} score=${rows[0].score_raw}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`[${entry.id}] ERROR: ${msg}`);
    }
  }
}

main();
