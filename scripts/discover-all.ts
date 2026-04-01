/**
 * discover-all.ts — Scalable multi-phase discovery for 300+ Vietnamese universities.
 *
 * Phase 1: Probe common URL patterns (fast, ~15 paths/uni, 20 concurrent)
 * Phase 2: Homepage link extraction + follow (medium, for Phase 1 misses)
 * Phase 3: Report remaining misses for manual review
 *
 * All phases score pages with keyword-scorer + ground-truth validation.
 *
 * Usage:
 *   npx tsx scripts/discover-all.ts                    # all pending
 *   npx tsx scripts/discover-all.ts --ids BKA,KHA,QHI  # specific universities
 *   npx tsx scripts/discover-all.ts --limit 50          # first N pending
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import * as cheerio from 'cheerio';
import { scorePageForCutoffs } from '../lib/scraper/discovery/keyword-scorer';
import { scorePageByGroundTruth, loadGroundTruth } from '../lib/scraper/discovery/ground-truth';
import { SCORE_THRESHOLD } from '../lib/scraper/discovery/constants';
import type { DiscoveryCandidate } from '../lib/scraper/discovery/candidate';

// ─── Config ──────────────────────────────────────────────────────────────────

const CONCURRENCY = 20;
const FETCH_TIMEOUT_MS = 15_000;
const PHASE2_CONCURRENCY = 10;

/**
 * Common Vietnamese university cutoff page URL path patterns.
 * These cover the vast majority of .edu.vn sites.
 */
const PROBE_PATHS = [
  // Direct cutoff pages
  '/diem-chuan',
  '/diem-chuan/',
  '/diem-chuan.html',
  '/tuyen-sinh/diem-chuan',
  '/tuyen-sinh/diem-chuan/',
  '/tuyen-sinh/diem-chuan.html',
  '/diem-trung-tuyen',
  '/tuyen-sinh/diem-trung-tuyen',
  '/ket-qua-trung-tuyen',
  '/tuyen-sinh/ket-qua-trung-tuyen',
  '/tin-tuyen-sinh/diem-chuan',
  '/xet-tuyen/diem-chuan',
  // /vi/ prefix variants (common Vietnamese CMS)
  '/vi/tuyen-sinh',
  '/vi/tuyen-sinh/',
  '/vi/tuyen-sinh.html',
  '/vi/diem-chuan',
  '/vi/diem-chuan.html',
  '/vi/diem-trung-tuyen',
  '/vi/diem-trung-tuyen.html',
  // Year-specific variants
  '/diem-chuan-2024',
  '/diem-chuan-2025',
  '/tuyen-sinh/diem-chuan-2024',
  '/tuyen-sinh/diem-chuan-2025',
  '/diem-trung-tuyen-2024',
  '/diem-trung-tuyen-2025',
  // Common CMS patterns
  '/category/tuyen-sinh',
  '/category/diem-chuan',
  '/tin-tuc/tuyen-sinh',
  '/dao-tao/tuyen-sinh',
  // Admission info pages (may link to cutoff)
  '/tuyen-sinh',
  '/tuyen-sinh/',
  '/tuyen-sinh.html',
  '/thong-tin-tuyen-sinh',
  '/thong-tin-tuyen-sinh.html',
];

/**
 * Subdomain prefixes to try (many universities host admission info on a subdomain).
 */
const SUBDOMAIN_PREFIXES = ['tuyensinh', 'ts', 'daotao'];

// ─── Types ───────────────────────────────────────────────────────────────────

interface ScraperEntry {
  id: string;
  website_url: string;
  scrape_url: string | null;
  adapter_type: string;
  [key: string]: unknown;
}

interface ProbeResult {
  universityId: string;
  url: string;
  score: number;
  reasons: string[];
  groundTruthMatches: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function safeFetch(url: string): Promise<{ html: string; finalUrl: string } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'UniSelectBot/1.0 (educational; open source)' },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain') && contentType !== '') {
      return null;
    }
    const html = await res.text();
    return { html, finalUrl: res.url || url };
  } catch {
    return null;
  }
}

function scorePage(universityId: string, url: string, html: string): ProbeResult {
  const $ = cheerio.load(html);
  const keyword = scorePageForCutoffs(url, $ as cheerio.CheerioAPI);
  const groundTruth = scorePageByGroundTruth(universityId, $ as cheerio.CheerioAPI);

  return {
    universityId,
    url,
    score: keyword.score + groundTruth.score,
    reasons: [...keyword.reasons, ...groundTruth.reasons],
    groundTruthMatches: groundTruth.matches,
  };
}

/** Run promises with limited concurrency */
async function pooled<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
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

function buildProbeUrls(websiteUrl: string): string[] {
  const urls: string[] = [];
  let parsed: URL;
  try {
    parsed = new URL(websiteUrl);
  } catch {
    return urls;
  }

  const origin = `${parsed.protocol}//${parsed.hostname}`;

  // Probe paths on main domain
  for (const path of PROBE_PATHS) {
    urls.push(`${origin}${path}`);
  }

  // Probe subdomain variants (tuyensinh.{domain}, ts.{domain})
  const hostParts = parsed.hostname.split('.');
  if (hostParts.length >= 2) {
    // Remove www. if present
    const baseParts = hostParts[0] === 'www' ? hostParts.slice(1) : hostParts;
    const baseDomain = baseParts.join('.');

    for (const prefix of SUBDOMAIN_PREFIXES) {
      const subOrigin = `${parsed.protocol}//${prefix}.${baseDomain}`;
      // Just probe the root + a few key paths
      urls.push(`${subOrigin}/`);
      urls.push(`${subOrigin}/diem-chuan`);
      urls.push(`${subOrigin}/diem-chuan/`);
      urls.push(`${subOrigin}/diem-trung-tuyen`);
    }
  }

  return urls;
}

// ─── Phase 1: Direct URL probing ─────────────────────────────────────────────

async function phase1Probe(
  entries: ScraperEntry[],
): Promise<{ found: Map<string, ProbeResult>; missed: ScraperEntry[] }> {
  console.log(`\n=== Phase 1: Probing ${entries.length} universities ===`);

  const found = new Map<string, ProbeResult>();

  // Build all probe tasks: [{ universityId, url }]
  const probeTasks: Array<{ universityId: string; url: string; websiteUrl: string }> = [];
  for (const entry of entries) {
    const probeUrls = buildProbeUrls(entry.website_url);
    for (const url of probeUrls) {
      probeTasks.push({ universityId: entry.id, url, websiteUrl: entry.website_url });
    }
  }

  console.log(`  ${probeTasks.length} URLs to probe across ${entries.length} universities`);

  let completed = 0;
  let hits = 0;

  await pooled(probeTasks, CONCURRENCY, async (task) => {
    // Skip if we already found a good result for this university
    const existing = found.get(task.universityId);
    if (existing && existing.score >= SCORE_THRESHOLD + 5) {
      return;
    }

    const result = await safeFetch(task.url);
    completed++;

    if (completed % 200 === 0) {
      console.log(`  Progress: ${completed}/${probeTasks.length} probed, ${hits} hits so far`);
    }

    if (!result) return;

    const scored = scorePage(task.universityId, result.finalUrl, result.html);
    if (scored.score >= SCORE_THRESHOLD) {
      if (!existing || scored.score > existing.score) {
        found.set(task.universityId, scored);
        hits++;
      }
    }
  });

  const missed = entries.filter((e) => !found.has(e.id));
  console.log(`  Phase 1 complete: ${found.size} found, ${missed.length} missed`);

  return { found, missed };
}

// ─── Phase 2: Homepage link extraction + follow ──────────────────────────────

async function phase2LinkFollow(
  entries: ScraperEntry[],
  existingFound: Map<string, ProbeResult>,
): Promise<{ found: Map<string, ProbeResult>; missed: ScraperEntry[] }> {
  console.log(`\n=== Phase 2: Link-follow for ${entries.length} universities ===`);

  const found = new Map(existingFound);
  const admissionKeywords = [
    'điểm chuẩn', 'diem-chuan', 'điểm trúng tuyển', 'diem-trung-tuyen',
    'tuyển sinh', 'tuyen-sinh', 'xét tuyển', 'xet-tuyen',
    'kết quả trúng tuyển', 'ket-qua-trung-tuyen',
    'thông báo tuyển sinh', 'thong-bao',
  ];

  let completed = 0;

  await pooled(entries, PHASE2_CONCURRENCY, async (entry) => {
    completed++;
    if (completed % 20 === 0) {
      console.log(`  Phase 2 progress: ${completed}/${entries.length}`);
    }

    // Fetch homepage
    const homepage = await safeFetch(entry.website_url);
    if (!homepage) return;

    // Score homepage itself
    const homepageScored = scorePage(entry.id, homepage.finalUrl, homepage.html);
    if (homepageScored.score >= SCORE_THRESHOLD) {
      const existing = found.get(entry.id);
      if (!existing || homepageScored.score > existing.score) {
        found.set(entry.id, homepageScored);
      }
    }

    // Extract links that match admission keywords
    const $ = cheerio.load(homepage.html);
    const candidateLinks = new Set<string>();

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().toLowerCase();
      if (!href) return;

      const hrefLower = href.toLowerCase();
      const isAdmission = admissionKeywords.some(
        (kw) => hrefLower.includes(kw) || text.includes(kw),
      );

      if (isAdmission) {
        try {
          const fullUrl = new URL(href, homepage.finalUrl).href;
          // Only follow same-origin or common subdomains
          const base = new URL(entry.website_url).hostname.replace('www.', '');
          if (fullUrl.includes(base)) {
            candidateLinks.add(fullUrl);
          }
        } catch {
          // Invalid URL, skip
        }
      }
    });

    // Follow candidate links (max 15 per university)
    const linksToFollow = Array.from(candidateLinks).slice(0, 15);

    for (const link of linksToFollow) {
      // Skip if already found a strong match
      const existing = found.get(entry.id);
      if (existing && existing.score >= SCORE_THRESHOLD + 10) break;

      const result = await safeFetch(link);
      if (!result) continue;

      const scored = scorePage(entry.id, result.finalUrl, result.html);
      if (scored.score >= SCORE_THRESHOLD) {
        if (!existing || scored.score > existing.score) {
          found.set(entry.id, scored);
        }
      }
    }
  });

  const missed = entries.filter((e) => !found.has(e.id));
  const newFinds = found.size - existingFound.size;
  console.log(`  Phase 2 complete: ${newFinds} new finds, ${missed.length} still missed`);

  return { found, missed };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // Parse args
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

  // Load ground truth
  loadGroundTruth();

  // Load scrapers.json
  const scrapersPath = resolve(process.cwd(), 'scrapers.json');
  const allEntries: ScraperEntry[] = JSON.parse(readFileSync(scrapersPath, 'utf-8'));

  // Filter to pending entries only
  let entries = allEntries.filter(
    (e) => e.scrape_url === null && e.adapter_type !== 'skip',
  );

  if (filterIds) {
    entries = entries.filter((e) => filterIds!.has(e.id));
  }
  if (limit) {
    entries = entries.slice(0, limit);
  }

  console.log(`Discovering cutoff pages for ${entries.length} universities`);
  console.log(`Concurrency: ${CONCURRENCY} (phase 1), ${PHASE2_CONCURRENCY} (phase 2)`);

  // Phase 1: Probe common paths
  const phase1 = await phase1Probe(entries);

  // Phase 2: Link-follow for misses
  const phase2 = await phase2LinkFollow(phase1.missed, phase1.found);

  // Convert to DiscoveryCandidate format
  const candidates: DiscoveryCandidate[] = [];
  for (const [, result] of phase2.found) {
    candidates.push({
      url: result.url,
      universityId: result.universityId,
      score: result.score,
      reasons: result.reasons,
    });
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  // Output results
  const outputPath = resolve(process.cwd(), 'discovery-candidates.json');
  writeFileSync(outputPath, JSON.stringify(candidates, null, 2), 'utf-8');

  // Summary
  console.log(`\n=== Discovery Summary ===`);
  console.log(`Total universities checked: ${entries.length}`);
  console.log(`Pages discovered: ${candidates.length}`);
  console.log(`  With ground-truth validation: ${candidates.filter((c) => c.reasons.some((r) => r.includes('ground-truth'))).length}`);
  console.log(`  Keyword-only: ${candidates.filter((c) => !c.reasons.some((r) => r.includes('ground-truth'))).length}`);
  console.log(`Still missing: ${phase2.missed.length}`);

  if (phase2.missed.length > 0) {
    console.log(`\nMissed universities (may need manual review or Playwright):`);
    for (const entry of phase2.missed.slice(0, 30)) {
      console.log(`  ${entry.id}: ${entry.website_url}`);
    }
    if (phase2.missed.length > 30) {
      console.log(`  ... and ${phase2.missed.length - 30} more`);
    }
  }

  console.log(`\nOutput: ${outputPath}`);
  console.log(`Next: npx tsx scripts/apply-discovery.ts`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
