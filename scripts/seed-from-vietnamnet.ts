/**
 * seed-from-vietnamnet.ts — Bulk scrape cutoff scores from VietNamNet
 *
 * Strategy:
 * 1. Load all university codes from uni_list.json
 * 2. For each code, use VietNamNet autocomplete API to get slug (via Playwright page context)
 * 3. Navigate to /truong/{slug}?keyword={CODE} and extract table data
 * 4. Output as RawRow[] JSON file
 *
 * Usage:
 *   npx tsx scripts/seed-from-vietnamnet.ts                  # all universities
 *   npx tsx scripts/seed-from-vietnamnet.ts --limit 10       # first 10
 *   npx tsx scripts/seed-from-vietnamnet.ts --year 2025      # specific year
 *   npx tsx scripts/seed-from-vietnamnet.ts --ids BKA,KHA    # specific codes
 */

import { chromium, type Browser, type Page } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import type { RawRow } from '../lib/scraper/types';

const BASE_URL = 'https://vietnamnet.vn/giao-duc/diem-thi/tra-cuu-diem-chuan-cd-dh';
const AUTOCOMPLETE_URL = 'https://vietnamnet.vn/newsapi-edu/EducationScore/SchoolAutocomplete';
const COMPONENT_ID = 'COMPONENT002301';
const PAGE_ID = '81168c66d7474084b0864bb36c93f250';

interface UniEntry { id: string; name_vi: string; }
interface SlugResult { code: string; slug: string; name: string; }

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Look up university slug via VietNamNet autocomplete API.
 * Must be called from within a Playwright page context to bypass CORS/403.
 */
async function lookupSlug(page: Page, code: string, year: number): Promise<SlugResult | null> {
  try {
    const result = await page.evaluate(async ({ url, componentId, pageId, keyword, year }) => {
      const params = new URLSearchParams({
        componentId, keyword, pageId, type: '2', year: String(year),
      });
      const res = await fetch(`${url}?${params}`, {
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json',
        },
      });
      if (!res.ok) return null;
      return await res.json();
    }, { url: AUTOCOMPLETE_URL, componentId: COMPONENT_ID, pageId: PAGE_ID, keyword: code, year });

    if (result?.status && result?.data?.model?.length > 0) {
      const m = result.data.model[0];
      return { code: m.schoolCode, slug: m.slug, name: m.schoolName };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extract score table from a university's VietNamNet page.
 */
async function extractScores(page: Page, slug: string, code: string, year: number): Promise<RawRow[]> {
  const url = `${BASE_URL}-${year}/truong/${slug}?keyword=${code}`;

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20_000 });
    await page.waitForSelector('table', { timeout: 10_000 }).catch(() => {});

    const tableData = await page.evaluate(() => {
      const tables = document.querySelectorAll('table');
      const rows: string[][] = [];
      tables.forEach(table => {
        const trs = table.querySelectorAll('tr');
        trs.forEach(tr => {
          const cells = Array.from(tr.querySelectorAll('td, th')).map(c => c.textContent?.trim() || '');
          if (cells.length >= 3) rows.push(cells);
        });
      });
      return rows;
    });

    if (tableData.length < 2) return [];

    // Parse table: find score column index
    const headers = tableData[0].map(h => h.toLowerCase());
    const scoreIdx = headers.findIndex(h =>
      h.includes('điểm chuẩn') || h.includes('diem chuan') || h.includes('điểm')
    );
    const majorIdx = headers.findIndex(h =>
      h.includes('ngành') || h.includes('nganh') || h.includes('chuyên ngành')
    );
    const tohopIdx = headers.findIndex(h =>
      h.includes('khối') || h.includes('tổ hợp') || h.includes('to hop')
    );

    if (scoreIdx === -1) return [];

    const rows: RawRow[] = [];
    for (let i = 1; i < tableData.length; i++) {
      const cells = tableData[i];
      const scoreRaw = cells[scoreIdx] ?? '';
      const majorRaw = majorIdx !== -1 ? cells[majorIdx] ?? '' : '';
      const tohopRaw = tohopIdx !== -1 ? cells[tohopIdx] ?? '' : '';

      // Parse score
      const score = parseFloat(scoreRaw.replace(',', '.'));
      if (isNaN(score) || score < 10 || score > 30) continue; // Skip non-THPT scores (>30)

      // Use major name as major_raw (VietNamNet doesn't show 7-digit codes)
      if (!majorRaw) continue;

      rows.push({
        university_id: code,
        major_raw: majorRaw,
        tohop_raw: tohopRaw || 'UNKNOWN',
        year,
        score_raw: String(score),
        source_url: url,
        source_type: 'aggregator',
      });
    }

    return rows;
  } catch (err) {
    console.error(`  [${code}] Error navigating: ${err instanceof Error ? err.message : err}`);
    return [];
  }
}

async function main() {
  const args = process.argv.slice(2);
  let limit = Infinity;
  let year = new Date().getFullYear() - 1; // Default: previous year (2025)
  let filterIds: Set<string> | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) { limit = parseInt(args[i + 1]); i++; }
    else if (args[i] === '--year' && args[i + 1]) { year = parseInt(args[i + 1]); i++; }
    else if (args[i] === '--ids' && args[i + 1]) { filterIds = new Set(args[i + 1].split(',')); i++; }
  }

  // Load university codes
  const uniList: UniEntry[] = JSON.parse(
    readFileSync(resolve(process.cwd(), 'data/uni_list.json'), 'utf-8')
  );

  let codes = uniList.map(u => u.id);
  if (filterIds) codes = codes.filter(c => filterIds!.has(c));
  codes = codes.slice(0, limit);

  console.log(`VietNamNet scraper: ${codes.length} universities, year=${year}`);

  // Launch browser
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Navigate to VietNamNet to establish context for autocomplete API calls
  await page.goto(`${BASE_URL}-${year}`, { waitUntil: 'networkidle', timeout: 30_000 });
  console.log('Browser ready.\n');

  const allRows: RawRow[] = [];
  const stats = { attempted: 0, slugFound: 0, dataFound: 0, totalRows: 0, noSlug: 0, noData: 0 };

  for (const code of codes) {
    stats.attempted++;

    // Step 1: Lookup slug
    const slugResult = await lookupSlug(page, code, year);
    if (!slugResult) {
      console.log(`[${code}] No slug found`);
      stats.noSlug++;
      await sleep(300);
      continue;
    }
    stats.slugFound++;

    // Step 2: Extract scores
    const rows = await extractScores(page, slugResult.slug, code, year);
    if (rows.length === 0) {
      console.log(`[${code}] ${slugResult.name} — 0 rows`);
      stats.noData++;
    } else {
      console.log(`[${code}] ${slugResult.name} — ${rows.length} rows`);
      allRows.push(...rows);
      stats.dataFound++;
      stats.totalRows += rows.length;
    }

    await sleep(500); // Rate limit

    if (stats.attempted % 50 === 0) {
      console.log(`\n  Progress: ${stats.attempted}/${codes.length} (${stats.dataFound} with data, ${stats.totalRows} total rows)\n`);
    }
  }

  await browser.close();

  // Save output
  const outputDir = resolve(process.cwd(), 'data/seed');
  mkdirSync(outputDir, { recursive: true });
  const outputPath = resolve(outputDir, `vietnamnet-scores-${year}.json`);
  writeFileSync(outputPath, JSON.stringify(allRows, null, 2), 'utf-8');

  console.log(`\n=== Summary ===`);
  console.log(`Attempted: ${stats.attempted}`);
  console.log(`Slug found: ${stats.slugFound} (${stats.noSlug} missing)`);
  console.log(`Data found: ${stats.dataFound} (${stats.noData} empty)`);
  console.log(`Total rows: ${stats.totalRows}`);
  console.log(`Output: ${outputPath}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
