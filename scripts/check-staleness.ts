/**
 * check-staleness.ts
 *
 * Detects universities whose cutoff score data has not been refreshed within
 * the expected staleness window.
 *
 * Exit codes:
 *   0 — All universities have a recent successful scrape run
 *   1 — One or more universities are stale (triggers GitHub Actions failure + email alert)
 *
 * Usage:
 *   npx tsx scripts/check-staleness.ts
 *
 * Env vars:
 *   DATABASE_URL    — Supabase pooler URL (port 6543, required)
 *   STALENESS_DAYS  — Number of days before a university is considered stale (default: 7)
 */

import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { db } from '../lib/db';
import { scrapeRuns, universities } from '../lib/db/schema';
import { max, inArray } from 'drizzle-orm';

const STALENESS_DAYS = parseInt(process.env.STALENESS_DAYS ?? '10', 10);

export interface ScraperEntry {
  id: string;
  scrape_url: string | null;
  adapter_type: string;
}

/**
 * Return IDs of universities with active scrapers
 * (non-null scrape_url and adapter_type not in skip/pending).
 */
export function getConfiguredScraperIds(entries: ScraperEntry[]): Set<string> {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (entry.scrape_url !== null && entry.adapter_type !== 'skip' && entry.adapter_type !== 'pending') {
      ids.add(entry.id);
    }
  }
  return ids;
}

/**
 * Classify configured scrapers into "never scraped" and "stale" categories.
 */
export function classifyStaleness(
  idsToCheck: string[],
  lastOkMap: Map<string, Date | null>,
  stalenessDays: number,
): { neverScraped: string[]; stale: Array<{ id: string; lastOk: Date }> } {
  const stalenessMs = stalenessDays * 24 * 60 * 60 * 1000;
  const cutoffTime = Date.now() - stalenessMs;
  const neverScraped: string[] = [];
  const stale: Array<{ id: string; lastOk: Date }> = [];

  for (const id of idsToCheck) {
    const lastOk = lastOkMap.get(id) ?? null;
    if (lastOk === null) {
      neverScraped.push(id);
    } else if (lastOk.getTime() < cutoffTime) {
      stale.push({ id, lastOk });
    }
  }

  return { neverScraped, stale };
}

async function main() {
  // 1. Get configured scraper IDs (only check these for staleness)
  const configPath = resolve(process.cwd(), 'scrapers.json');
  const scraperEntries: ScraperEntry[] = JSON.parse(readFileSync(configPath, 'utf-8'));
  const configuredIds = getConfiguredScraperIds(scraperEntries);

  // Fetch all university IDs for coverage metric
  const allUniversities = await db
    .select({ id: universities.id })
    .from(universities);
  const totalCount = allUniversities.length;

  console.log(`Coverage: ${configuredIds.size}/${totalCount} universities have active scrapers`);

  // If no scrapers are configured, exit 0 with warning
  if (configuredIds.size === 0) {
    console.log('No configured scrapers yet — staleness check skipped');
    process.exit(0);
  }

  const idsToCheck = Array.from(configuredIds);

  // 2. Fetch most recent successful (ok or flagged) scrape run per configured university
  const recentRuns = await db
    .select({
      university_id: scrapeRuns.university_id,
      last_ok: max(scrapeRuns.run_at),
    })
    .from(scrapeRuns)
    .where(inArray(scrapeRuns.status, ['ok', 'flagged']))
    .groupBy(scrapeRuns.university_id);

  // Build a lookup: university_id -> last successful run_at
  const lastOkMap = new Map<string, Date | null>();
  for (const row of recentRuns) {
    if (row.university_id !== null) {
      lastOkMap.set(row.university_id, row.last_ok ?? null);
    }
  }

  // 3. Separate "never scraped" from "was working but went stale"
  const { neverScraped, stale } = classifyStaleness(idsToCheck, lastOkMap, STALENESS_DAYS);

  // 4. Print results
  console.log(
    `Checked ${idsToCheck.length} configured scrapers. ${stale.length} stale, ${neverScraped.length} never scraped.`
  );

  // Never-scraped is informational only — these may be newly configured
  if (neverScraped.length > 0) {
    for (const id of neverScraped) {
      console.log(`  [NEVER SCRAPED] ${id} — no successful run yet`);
    }
  }

  // Only FAIL if a previously-working scraper has gone stale
  if (stale.length > 0) {
    for (const { id, lastOk } of stale) {
      console.log(`  [STALE] ${id} — last ok run: ${lastOk.toISOString()}`);
    }
    process.exit(1);
  }

  process.exit(0);
}

// Only run when executed directly (not imported by tests)
if (process.argv[1]?.includes('check-staleness')) {
  main().catch((err) => {
    console.error('Fatal error in check-staleness:', err);
    process.exit(1);
  });
}
