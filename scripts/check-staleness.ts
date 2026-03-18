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

import { db } from '../lib/db';
import { scrapeRuns, universities } from '../lib/db/schema';
import { max, inArray } from 'drizzle-orm';

const STALENESS_DAYS = parseInt(process.env.STALENESS_DAYS ?? '7', 10);
const STALENESS_MS = STALENESS_DAYS * 24 * 60 * 60 * 1000;

async function main() {
  // 1. Fetch all university IDs
  const allUniversities = await db
    .select({ id: universities.id })
    .from(universities);

  const allIds = allUniversities.map((u) => u.id);

  // 2. Fetch most recent successful (ok or flagged) scrape run per university
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

  // 3. Identify stale universities
  const cutoffTime = Date.now() - STALENESS_MS;
  const stale: Array<{ id: string; lastOk: Date | null }> = [];

  for (const id of allIds) {
    const lastOk = lastOkMap.get(id) ?? null;
    if (lastOk === null || lastOk.getTime() < cutoffTime) {
      stale.push({ id, lastOk });
    }
  }

  // 4. Print results
  console.log(
    `Checked ${allIds.length} universities. ${stale.length} are stale (window: ${STALENESS_DAYS} days).`
  );

  if (stale.length > 0) {
    for (const { id, lastOk } of stale) {
      const lastOkStr = lastOk ? lastOk.toISOString() : 'never';
      console.log(`  [STALE] ${id} — last ok run: ${lastOkStr}`);
    }
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error in check-staleness:', err);
  process.exit(1);
});
