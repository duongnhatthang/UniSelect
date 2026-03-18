/**
 * Build-time static JSON generator.
 *
 * Run: npm run generate-static
 *
 * Writes three JSON files to public/data/ that mirror live API response shapes.
 * These files are served from Vercel CDN and used as fallbacks when Supabase is unavailable.
 *
 * Requires: DATABASE_URL env var pointing to Supabase pooler (port 6543).
 */

import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { asc, desc, eq, sql } from 'drizzle-orm';
import { universities, cutoffScores, tohopCodes } from '../lib/db/schema';

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL env var is required');
  process.exit(1);
}

// Use pooler URL (port 6543) with prepare: false — same as lib/db/index.ts
const client = postgres(process.env.DATABASE_URL, { prepare: false });
const db = drizzle({ client });

const OUT_DIR = join(process.cwd(), 'public', 'data');

async function generateUniversities(): Promise<void> {
  // Subquery: distinct tohop codes per university
  const tohopSub = db
    .select({
      university_id: cutoffScores.university_id,
      tohop_codes: sql<string[]>`array_agg(distinct ${cutoffScores.tohop_code})`.as('tohop_codes'),
    })
    .from(cutoffScores)
    .groupBy(cutoffScores.university_id)
    .as('tohop_sub');

  const rows = await db
    .select({
      id: universities.id,
      name_vi: universities.name_vi,
      name_en: universities.name_en,
      website_url: universities.website_url,
      created_at: universities.created_at,
      tohop_codes: sql<string[]>`coalesce(${tohopSub.tohop_codes}, '{}')`,
    })
    .from(universities)
    .leftJoin(tohopSub, eq(universities.id, tohopSub.university_id))
    .orderBy(asc(universities.id))
    .limit(500);

  const payload = {
    data: rows,
    meta: { count: rows.length, next_cursor: null },
  };

  writeFileSync(join(OUT_DIR, 'universities.json'), JSON.stringify(payload), 'utf-8');
  console.log(`Generated universities.json (${rows.length} records)`);
}

async function generateScoresByTohop(): Promise<void> {
  // Find anchor year: max year with data
  const anchorResult = await db
    .select({ max_year: sql<number>`max(${cutoffScores.year})` })
    .from(cutoffScores);

  const anchorYear = anchorResult[0]?.max_year ?? new Date().getFullYear();
  const minYear = anchorYear - 2; // anchor year + 2 prior years

  const rows = await db
    .select({
      university_id: cutoffScores.university_id,
      major_id: cutoffScores.major_id,
      tohop_code: cutoffScores.tohop_code,
      year: cutoffScores.year,
      score: cutoffScores.score,
      scraped_at: cutoffScores.scraped_at,
      source_url: cutoffScores.source_url,
    })
    .from(cutoffScores)
    .where(sql`${cutoffScores.year} >= ${minYear}`)
    .orderBy(asc(cutoffScores.tohop_code), desc(cutoffScores.year));

  // Group by tohop_code
  const byTohop: Record<string, typeof rows> = {};
  for (const row of rows) {
    const key = row.tohop_code;
    if (!byTohop[key]) byTohop[key] = [];
    byTohop[key].push(row);
  }

  writeFileSync(join(OUT_DIR, 'scores-by-tohop.json'), JSON.stringify(byTohop), 'utf-8');
  console.log(`Generated scores-by-tohop.json (${rows.length} rows across ${Object.keys(byTohop).length} tohop codes)`);
}

async function generateTohop(): Promise<void> {
  const rows = await db
    .select({
      code: tohopCodes.code,
      subjects: tohopCodes.subjects,
      label_vi: tohopCodes.label_vi,
    })
    .from(tohopCodes)
    .orderBy(asc(tohopCodes.code));

  const payload = { data: rows };
  writeFileSync(join(OUT_DIR, 'tohop.json'), JSON.stringify(payload), 'utf-8');
  console.log(`Generated tohop.json (${rows.length} records)`);
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });

  await generateUniversities();
  await generateScoresByTohop();
  await generateTohop();

  await client.end();
  console.log('Done. Static JSON written to public/data/');
}

main().catch((err) => {
  console.error('generate-static-json failed:', err);
  process.exit(1);
});
