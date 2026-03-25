/**
 * discover-deep.ts — Deep article discovery from admission pages
 *
 * Takes the admission pages found by discover-all.ts and follows links
 * to find the actual article pages with score data tables.
 *
 * Strategy:
 * 1. Load existing discovery-candidates.json (from discover-all.ts)
 * 2. For each candidate URL + university homepage, extract all links
 * 3. Follow links that look like score articles (year + score keywords in URL/text)
 * 4. Score pages by actual data presence: tables with score-range numbers + major codes
 * 5. Validate with ground truth
 *
 * Usage:
 *   npx tsx scripts/discover-deep.ts                    # all
 *   npx tsx scripts/discover-deep.ts --ids BKA,DDN      # specific
 *   npx tsx scripts/discover-deep.ts --limit 50          # first N
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import * as cheerio from 'cheerio';
import { scorePageByGroundTruth, loadGroundTruth } from '../lib/scraper/discovery/ground-truth';
import type { DiscoveryCandidate } from '../lib/scraper/discovery/candidate';

const FETCH_TIMEOUT = 15_000;
const CONCURRENCY = 10;

interface ScraperEntry {
  id: string;
  website_url: string;
  scrape_url: string | null;
  adapter_type: string;
  [key: string]: unknown;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function safeFetch(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'UniSelectBot/1.0 (educational; open source)' },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') ?? '';
    if (ct && !ct.includes('text/html') && !ct.includes('text/plain')) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Check if page has actual score data patterns */
function scoreDataPresence(html: string): { tables: number; scores: number; majors: number } {
  const tables = (html.match(/<table/gi) || []).length;
  const scoreMatches = html.match(/\b(\d{2}[.,]\d{1,2})\b/g) || [];
  const scores = scoreMatches.filter(s => {
    const v = parseFloat(s.replace(',', '.'));
    return v >= 15 && v <= 30;
  }).length;
  const majors = (html.match(/\b7\d{6,}\b/g) || []).length;
  return { tables, scores, majors };
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function pooled<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

/** Article link detection keywords */
const ARTICLE_URL_KEYWORDS = [
  'diem-chuan', 'diem-trung-tuyen', 'ket-qua-trung-tuyen',
  'trung-tuyen', 'diem-san', 'cong-bo-diem',
];
const ARTICLE_TEXT_KEYWORDS = [
  'điểm chuẩn', 'điểm trúng tuyển', 'kết quả trúng tuyển',
  'công bố điểm', 'điểm sàn',
];
const YEAR_PATTERN = /202[3-6]/;

function isArticleLink(href: string, text: string): boolean {
  const hrefLower = href.toLowerCase();
  const textLower = text.toLowerCase();

  const hasScoreKeyword =
    ARTICLE_URL_KEYWORDS.some(kw => hrefLower.includes(kw)) ||
    ARTICLE_TEXT_KEYWORDS.some(kw => textLower.includes(kw));

  const hasYear = YEAR_PATTERN.test(href) || YEAR_PATTERN.test(text);

  // Must have at least a score keyword
  return hasScoreKeyword && (hasYear || hrefLower.includes('diem-chuan'));
}

// ─── Deep discovery per university ───────────────────────────────────────────

interface DeepTask {
  id: string;
  websiteUrl: string;
  startUrls: string[]; // Previously discovered admission pages
}

async function deepDiscoverOne(task: DeepTask): Promise<DiscoveryCandidate | null> {
  const visited = new Set<string>();
  let bestCandidate: DiscoveryCandidate | null = null;

  // Gather starting pages: previously discovered + common paths
  const pagesToScan: string[] = [...task.startUrls];

  // Also try the homepage + tuyensinh subdomain
  try {
    const parsed = new URL(task.websiteUrl);
    pagesToScan.push(task.websiteUrl);
    pagesToScan.push(`${parsed.protocol}//${parsed.hostname}/tuyen-sinh`);
    pagesToScan.push(`${parsed.protocol}//${parsed.hostname}/tuyen-sinh/`);
    const baseDomain = parsed.hostname.replace(/^www\./, '');
    pagesToScan.push(`https://tuyensinh.${baseDomain}/`);
  } catch { /* skip */ }

  const baseDomain = (() => {
    try { return new URL(task.websiteUrl).hostname.replace(/^www\./, ''); }
    catch { return ''; }
  })();

  // For each starting page, extract and follow article links
  for (const startUrl of pagesToScan) {
    if (visited.has(startUrl)) continue;
    visited.add(startUrl);

    const html = await safeFetch(startUrl);
    if (!html) continue;

    // Check the starting page itself for data
    const presence = scoreDataPresence(html);
    if (presence.tables >= 1 && presence.scores >= 3 && presence.majors >= 3) {
      const $ = cheerio.load(html);
      const gt = scorePageByGroundTruth(task.id, $ as cheerio.CheerioAPI);
      const score = 20 + gt.score;
      if (!bestCandidate || score > bestCandidate.score) {
        bestCandidate = {
          url: startUrl,
          universityId: task.id,
          score,
          reasons: [`data-found`, `tables:${presence.tables}`, `scores:${presence.scores}`, `majors:${presence.majors}`, ...gt.reasons],
        };
      }
    }

    // Extract article links
    const $ = cheerio.load(html);
    const articleLinks: string[] = [];

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      const text = $(el).text();
      if (!href) return;

      if (isArticleLink(href, text)) {
        try {
          const fullUrl = new URL(href, startUrl).href;
          // Must be on same base domain
          if (fullUrl.includes(baseDomain) && !visited.has(fullUrl)) {
            articleLinks.push(fullUrl);
          }
        } catch { /* skip */ }
      }
    });

    // Follow article links (max 15 per starting page)
    for (const link of articleLinks.slice(0, 15)) {
      if (visited.has(link)) continue;
      visited.add(link);

      const pageHtml = await safeFetch(link);
      if (!pageHtml) continue;

      const p = scoreDataPresence(pageHtml);

      // Require actual table data
      if ((p.tables >= 1 && p.scores >= 3 && p.majors >= 3) || (p.scores >= 5 && p.majors >= 5)) {
        const $page = cheerio.load(pageHtml);
        const gt = scorePageByGroundTruth(task.id, $page as cheerio.CheerioAPI);
        const score = 20 + gt.score;

        if (!bestCandidate || score > bestCandidate.score) {
          bestCandidate = {
            url: link,
            universityId: task.id,
            score,
            reasons: [`article-discovered`, `tables:${p.tables}`, `scores:${p.scores}`, `majors:${p.majors}`, ...gt.reasons],
          };
        }

        // If we found a ground-truth match, that's good enough
        if (gt.matches >= 3) break;
      }
    }

    // If we found something strong, stop trying more starting pages
    if (bestCandidate && bestCandidate.score >= 30) break;
  }

  return bestCandidate;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  let filterIds: Set<string> | null = null;
  let limit: number | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--ids' && args[i + 1]) {
      filterIds = new Set(args[i + 1].split(','));
      i++;
    } else if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    }
  }

  loadGroundTruth();

  const scrapersPath = resolve(process.cwd(), 'scrapers.json');
  const scrapers: ScraperEntry[] = JSON.parse(readFileSync(scrapersPath, 'utf-8'));

  // Load previously discovered candidates (from discover-all.ts Phase 1/2)
  const prevCandidatesPath = resolve(process.cwd(), 'discovery-candidates.json');
  let prevCandidates: DiscoveryCandidate[] = [];
  if (existsSync(prevCandidatesPath)) {
    prevCandidates = JSON.parse(readFileSync(prevCandidatesPath, 'utf-8'));
  }

  // Build lookup: universityId -> previous candidate URLs
  const prevUrlsByUni = new Map<string, string[]>();
  for (const c of prevCandidates) {
    if (!prevUrlsByUni.has(c.universityId)) prevUrlsByUni.set(c.universityId, []);
    prevUrlsByUni.get(c.universityId)!.push(c.url);
  }

  // Filter to pending entries
  let entries = scrapers.filter(
    e => e.scrape_url === null && e.adapter_type !== 'skip',
  );

  if (filterIds) entries = entries.filter(e => filterIds!.has(e.id));
  if (limit) entries = entries.slice(0, limit);

  const tasks: DeepTask[] = entries.map(e => ({
    id: e.id,
    websiteUrl: e.website_url,
    startUrls: prevUrlsByUni.get(e.id) || [],
  }));

  console.log(`Deep discovery for ${tasks.length} universities (${prevCandidates.length} starting URLs from Phase 1/2)\n`);

  let found = 0;
  const candidates: DiscoveryCandidate[] = [];

  await pooled(tasks, CONCURRENCY, async (task) => {
    const result = await deepDiscoverOne(task);
    if (result) {
      console.log(`[${task.id}] FOUND: ${result.url} (score=${result.score}, ${result.reasons.join(', ')})`);
      candidates.push(result);
      found++;
    } else {
      console.log(`[${task.id}] NOT FOUND`);
    }
  });

  candidates.sort((a, b) => b.score - a.score);

  const outputPath = resolve(process.cwd(), 'discovery-deep-candidates.json');
  writeFileSync(outputPath, JSON.stringify(candidates, null, 2), 'utf-8');

  console.log(`\n=== Summary ===`);
  console.log(`Checked: ${tasks.length}`);
  console.log(`Found data pages: ${found}`);
  console.log(`  With ground-truth: ${candidates.filter(c => c.reasons.some(r => r.includes('ground-truth'))).length}`);
  console.log(`Not found: ${tasks.length - found}`);
  console.log(`Output: ${outputPath}`);
  console.log(`\nNext: npx tsx scripts/apply-discovery.ts ${outputPath}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
