/**
 * probe-vietnamnet-api.ts — Capture ALL network requests from VietNamNet score lookup
 *
 * Usage: npx tsx scripts/probe-vietnamnet-api.ts
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const LOOKUP_URL = 'https://vietnamnet.vn/giao-duc/diem-thi/tra-cuu-diem-chuan-cd-dh-2025';

interface CapturedRequest {
  url: string;
  method: string;
  postData: string | null;
  status?: number;
  responseBody?: string;
}

async function main() {
  const captured: CapturedRequest[] = [];

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Capture ALL XHR/fetch requests (not just newsapi pattern)
  page.on('response', async (res) => {
    const url = res.url();
    // Skip static assets
    if (/\.(js|css|png|jpg|gif|svg|woff|ico|webp)(\?|$)/.test(url)) return;
    if (url.includes('google') || url.includes('facebook') || url.includes('analytics')) return;

    const req = res.request();
    const isApi = req.method() === 'POST' || url.includes('api') || url.includes('newsapi') ||
      url.includes('score') || url.includes('education') || url.includes('diem');

    if (!isApi && req.resourceType() === 'document') return; // skip HTML page loads
    if (!isApi) return;

    let body = '';
    try {
      body = await res.text();
    } catch {
      body = '<failed>';
    }

    console.log(`[${req.method()}] ${res.status()} ${url.substring(0, 120)}`);
    if (req.postData()) console.log(`  POST: ${req.postData()?.substring(0, 200)}`);
    if (body.length > 0 && body.length < 500) console.log(`  RES: ${body.substring(0, 300)}`);
    else if (body.length >= 500) console.log(`  RES: ${body.substring(0, 200)}... (${body.length} chars)`);

    captured.push({
      url,
      method: req.method(),
      postData: req.postData() ?? null,
      status: res.status(),
      responseBody: body.substring(0, 10000),
    });
  });

  console.log(`Navigating to ${LOOKUP_URL}...`);
  await page.goto(LOOKUP_URL, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForTimeout(2000);

  // Type into search input
  const input = page.locator('input[name="keyword"]');
  if (await input.isVisible()) {
    console.log('\n--- Typing "BKA" ---');
    await input.fill('BKA');
    await page.waitForTimeout(3000);

    // Try clicking suggestions
    const allVisible = await page.locator('li, [class*="item"], [class*="option"]').all();
    for (const el of allVisible) {
      const text = await el.textContent().catch(() => '');
      const vis = await el.isVisible().catch(() => false);
      if (vis && text && (text.includes('Bách khoa') || text.includes('BKA'))) {
        console.log(`\n--- Clicking: "${text.substring(0, 80)}" ---`);
        await el.click();
        await page.waitForTimeout(5000);
        break;
      }
    }
  }

  const outputDir = resolve(process.cwd(), 'data/seed');
  mkdirSync(outputDir, { recursive: true });

  writeFileSync(resolve(outputDir, 'vietnamnet-api-spec.json'), JSON.stringify(captured, null, 2));

  console.log(`\nCaptured ${captured.length} API requests`);

  // Take screenshot
  await page.screenshot({ path: resolve(outputDir, 'vietnamnet-page.png'), fullPage: true });

  await browser.close();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
