/**
 * verify-discovered.ts
 *
 * After apply-discovery.ts populates scrapers.json with new scrape_urls,
 * this script verifies each newly-populated entry by:
 *   1. Fetching the page
 *   2. Running the factory adapter against it
 *   3. Comparing extracted scores against ground-truth seed data
 *
 * Entries with <50% match rate are reverted to scrape_url: null.
 *
 * Usage: npx tsx scripts/verify-discovered.ts
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createCheerioAdapter } from '../lib/scraper/factory';

const SCRAPERS_PATH = resolve(process.cwd(), 'scrapers.json');
const SEED_PATH = resolve(process.cwd(), 'data/seed/tuyensinh247-scores.json');

interface ScraperEntry {
  id: string;
  adapter: string;
  website_url: string;
  scrape_url: string | null;
  adapter_type: string;
  note?: string;
  factory_config?: {
    scoreKeywords: string[];
    majorKeywords: string[];
    tohopKeywords?: string[];
  };
  [key: string]: unknown;
}

interface SeedRow {
  university_id: string;
  major_raw: string;
  tohop_raw: string;
  year: number;
  score_raw: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (!existsSync(SEED_PATH)) {
    console.error('Seed data not found. Run seed-from-tuyensinh247.ts first.');
    process.exit(1);
  }

  // Load ground truth
  const seedRows: SeedRow[] = JSON.parse(readFileSync(SEED_PATH, 'utf-8'));
  const truthByUni = new Map<string, Set<string>>();
  for (const row of seedRows) {
    const score = parseFloat(row.score_raw);
    if (isNaN(score)) continue;
    const fp = `${score.toFixed(2)}|${row.major_raw}`;
    if (!truthByUni.has(row.university_id)) {
      truthByUni.set(row.university_id, new Set());
    }
    truthByUni.get(row.university_id)!.add(fp);
  }

  // Load scrapers.json
  const entries: ScraperEntry[] = JSON.parse(readFileSync(SCRAPERS_PATH, 'utf-8'));

  // Find entries with scrape_url that are cheerio and haven't been verified
  const toVerify = entries.filter(
    (e) =>
      e.scrape_url !== null &&
      e.adapter_type === 'cheerio' &&
      e.note?.includes('auto-discovered'),
  );

  console.log(`[verify] ${toVerify.length} entries to verify`);

  let verified = 0;
  let reverted = 0;

  for (const entry of toVerify) {
    const truthSet = truthByUni.get(entry.id);
    if (!truthSet || truthSet.size === 0) {
      console.log(`[${entry.id}] No ground truth data — skipping verification`);
      continue;
    }

    try {
      const adapter = createCheerioAdapter({
        id: entry.id,
        scoreKeywords: entry.factory_config?.scoreKeywords ?? ['điểm chuẩn', 'diem chuan', 'Điểm chuẩn'],
        majorKeywords: entry.factory_config?.majorKeywords ?? ['mã ngành', 'ma nganh', 'Mã ngành', 'Ngành'],
        tohopKeywords: entry.factory_config?.tohopKeywords ?? ['tổ hợp', 'to hop', 'Tổ hợp', 'Khối'],
      });

      const rows = await adapter.scrape(entry.scrape_url!);

      if (rows.length === 0) {
        console.log(`[${entry.id}] 0 rows extracted — reverting`);
        entry.scrape_url = null;
        entry.adapter_type = 'pending';
        entry.note = 'Auto-discovered but extracted 0 rows — reverted';
        reverted++;
        await sleep(1000);
        continue;
      }

      // Check match rate against ground truth
      let matches = 0;
      for (const row of rows) {
        const score = parseFloat(row.score_raw.replace(',', '.'));
        if (isNaN(score)) continue;
        const fp = `${score.toFixed(2)}|${row.major_raw}`;
        if (truthSet.has(fp)) matches++;
      }

      const matchRate = matches / Math.min(rows.length, truthSet.size);
      const matchPct = (matchRate * 100).toFixed(1);

      if (matchRate >= 0.5) {
        console.log(
          `[${entry.id}] VERIFIED — ${rows.length} rows, ${matches} matches (${matchPct}%)`,
        );
        entry.note = `auto-discovered, verified (${matchPct}% match, ${rows.length} rows)`;
        verified++;
      } else {
        console.log(
          `[${entry.id}] LOW MATCH — ${rows.length} rows, ${matches} matches (${matchPct}%) — reverting`,
        );
        entry.scrape_url = null;
        entry.adapter_type = 'pending';
        entry.note = `Auto-discovered but low match rate (${matchPct}%) — reverted`;
        reverted++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`[${entry.id}] Error: ${msg} — reverting`);
      entry.scrape_url = null;
      entry.adapter_type = 'pending';
      entry.note = `Auto-discovered but verification failed: ${msg}`;
      reverted++;
    }

    await sleep(1500); // Rate limit
  }

  // Write updated scrapers.json
  writeFileSync(SCRAPERS_PATH, JSON.stringify(entries, null, 2) + '\n', 'utf-8');

  console.log(`\n=== Summary ===`);
  console.log(`Verified: ${verified}`);
  console.log(`Reverted: ${reverted}`);
  console.log(`Skipped (no truth data): ${toVerify.length - verified - reverted}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
