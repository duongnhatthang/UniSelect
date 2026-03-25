/**
 * seed-to-static.ts
 *
 * Takes extracted score data from data/seed/tuyensinh247-scores.json
 * and generates the static JSON files that the app needs:
 *   - public/data/scores-by-tohop.json
 *   - public/data/universities.json (merges with existing uni_list.json)
 *
 * This allows the app to display data without needing a Supabase connection.
 * Run after seed-from-tuyensinh247.ts completes.
 *
 * Usage: npx tsx scripts/seed-to-static.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { normalize } from '../lib/scraper/normalizer';
import type { RawRow, NormalizedRow } from '../lib/scraper/types';

const SEED_PATH = resolve(process.cwd(), 'data/seed/tuyensinh247-scores.json');
const UNI_LIST_PATH = resolve(process.cwd(), 'data/uni_list.json');
const OUT_DIR = join(process.cwd(), 'public', 'data');

interface UniListEntry {
  id: string;
  name_vi: string;
  website_url: string;
}

function main() {
  // Step 1: Load seed data
  const rawRows: RawRow[] = JSON.parse(readFileSync(SEED_PATH, 'utf-8'));
  console.log(`Loaded ${rawRows.length} raw rows from seed data`);

  // Step 2: Normalize rows (validates score range, tohop format, etc.)
  const normalized: NormalizedRow[] = [];
  let rejected = 0;
  for (const raw of rawRows) {
    const row = normalize(raw);
    if (row) {
      normalized.push(row);
    } else {
      rejected++;
    }
  }
  console.log(`Normalized: ${normalized.length} rows (${rejected} rejected)`);

  // Step 3: Generate scores-by-tohop.json
  const byTohop: Record<string, Array<{
    university_id: string;
    major_id: string;
    tohop_code: string;
    year: number;
    score: string;
    scraped_at: string;
    source_url: string;
  }>> = {};

  for (const row of normalized) {
    if (!byTohop[row.tohop_code]) byTohop[row.tohop_code] = [];
    byTohop[row.tohop_code].push({
      university_id: row.university_id,
      major_id: row.major_id,
      tohop_code: row.tohop_code,
      year: row.year,
      score: row.score.toFixed(2),
      scraped_at: row.scraped_at.toISOString(),
      source_url: row.source_url,
    });
  }

  // Sort each tohop group by year desc, then score desc
  for (const code of Object.keys(byTohop)) {
    byTohop[code].sort((a, b) => b.year - a.year || parseFloat(b.score) - parseFloat(a.score));
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, 'scores-by-tohop.json'), JSON.stringify(byTohop), 'utf-8');
  console.log(`Generated scores-by-tohop.json (${normalized.length} rows across ${Object.keys(byTohop).length} tohop codes)`);

  // Step 4: Generate universities.json with tohop coverage
  const uniList: UniListEntry[] = JSON.parse(readFileSync(UNI_LIST_PATH, 'utf-8'));

  // Build tohop_codes per university from seed data
  const uniTohopMap = new Map<string, Set<string>>();
  for (const row of normalized) {
    if (!uniTohopMap.has(row.university_id)) {
      uniTohopMap.set(row.university_id, new Set());
    }
    uniTohopMap.get(row.university_id)!.add(row.tohop_code);
  }

  const uniRows = uniList.map((u) => ({
    id: u.id,
    name_vi: u.name_vi,
    name_en: null,
    website_url: u.website_url,
    created_at: new Date().toISOString(),
    tohop_codes: Array.from(uniTohopMap.get(u.id) ?? []).sort(),
  }));

  const payload = {
    data: uniRows,
    meta: { count: uniRows.length, next_cursor: null },
  };

  writeFileSync(join(OUT_DIR, 'universities.json'), JSON.stringify(payload), 'utf-8');
  console.log(`Generated universities.json (${uniRows.length} universities, ${uniTohopMap.size} with score data)`);

  // Step 5: Print summary
  const uniqueUnis = new Set(normalized.map((r) => r.university_id));
  const uniqueMajors = new Set(normalized.map((r) => r.major_id));
  const uniqueTohops = new Set(normalized.map((r) => r.tohop_code));
  const years = new Set(normalized.map((r) => r.year));

  console.log(`\n=== Summary ===`);
  console.log(`Universities with data: ${uniqueUnis.size}`);
  console.log(`Unique majors: ${uniqueMajors.size}`);
  console.log(`Unique tohop codes: ${uniqueTohops.size}`);
  console.log(`Years: ${Array.from(years).sort().join(', ')}`);
  console.log(`Score range: ${Math.min(...normalized.map((r) => r.score)).toFixed(2)} - ${Math.max(...normalized.map((r) => r.score)).toFixed(2)}`);
}

main();
