/**
 * check-vietnamnet-year.ts — Check if VietNamNet has published data for a new year
 *
 * Tries the autocomplete API for a known university with the target year.
 * If VietNamNet returns results, new year data is available.
 *
 * Exit codes:
 *   0 — Data available for the target year
 *   1 — No data yet
 *
 * Usage:
 *   npx tsx scripts/check-vietnamnet-year.ts           # checks current year
 *   npx tsx scripts/check-vietnamnet-year.ts --year 2026
 */

import { chromium } from 'playwright';

const BASE_URL = 'https://vietnamnet.vn/giao-duc/diem-thi/tra-cuu-diem-chuan-cd-dh';
const AUTOCOMPLETE_URL = 'https://vietnamnet.vn/newsapi-edu/EducationScore/SchoolAutocomplete';
const COMPONENT_ID = 'COMPONENT002301';
const PAGE_ID = '81168c66d7474084b0864bb36c93f250';
const TEST_CODE = 'BKA'; // Well-known university for testing

async function main() {
  const args = process.argv.slice(2);
  const yearIdx = args.indexOf('--year');
  const year = yearIdx >= 0 ? parseInt(args[yearIdx + 1]) : new Date().getFullYear();

  console.log(`Checking VietNamNet for year ${year} data...`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // Navigate to establish page context
    await page.goto(`${BASE_URL}-${year}`, { waitUntil: 'networkidle', timeout: 20_000 }).catch(() => {
      // 404 is expected if year doesn't exist yet
    });

    // Try autocomplete API from page context
    const result = await page.evaluate(async ({ url, componentId, pageId, keyword, year }) => {
      try {
        const params = new URLSearchParams({
          componentId, keyword, pageId, type: '2', year: String(year),
        });
        const res = await fetch(`${url}?${params}`, {
          headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' },
        });
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
    }, { url: AUTOCOMPLETE_URL, componentId: COMPONENT_ID, pageId: PAGE_ID, keyword: TEST_CODE, year });

    await browser.close();

    if (result?.status && result?.data?.model?.length > 0) {
      console.log(`DATA_AVAILABLE: VietNamNet has data for year ${year}`);
      console.log(`  Found: ${result.data.model[0].schoolName} (${result.data.model[0].schoolCode})`);
      process.exit(0);
    } else {
      console.log(`No data for year ${year} yet.`);
      process.exit(1);
    }
  } catch (err) {
    await browser.close();
    console.error('Error:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
