/**
 * seed-to-supabase.ts
 *
 * Inserts extracted score data from data/seed/tuyensinh247-scores.json
 * into Supabase tables: majors and cutoff_scores.
 *
 * Requires: DATABASE_URL env var pointing to Supabase pooler (port 6543).
 * Prerequisites: universities table must be seeded (run scripts/seed-universities.ts first).
 *
 * Usage: npx tsx scripts/seed-to-supabase.ts
 */

import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { normalize } from '../lib/scraper/normalizer';
import type { RawRow, NormalizedRow } from '../lib/scraper/types';
import { db } from '../lib/db';
import { cutoffScores, majors } from '../lib/db/schema';
import { sql } from 'drizzle-orm';

const SEED_PATH = resolve(process.cwd(), 'data/seed/tuyensinh247-scores.json');
const CHUNK_SIZE = 500;

function chunks<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required. Set it in .env.local');
    process.exit(1);
  }

  // Step 1: Load and normalize seed data
  const rawRows: RawRow[] = JSON.parse(readFileSync(SEED_PATH, 'utf-8'));
  console.log(`Loaded ${rawRows.length} raw rows`);

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

  // Step 2: Upsert unique majors
  const majorMap = new Map<string, string>(); // id -> name
  for (const raw of rawRows) {
    if (raw.major_raw && !majorMap.has(raw.major_raw)) {
      // Try to find the name from the original data
      majorMap.set(raw.major_raw, raw.major_raw);
    }
  }

  const majorEntries = Array.from(majorMap.entries()).map(([id]) => ({
    id,
    name_vi: id, // Will be overwritten if major already exists
  }));

  for (const chunk of chunks(majorEntries, CHUNK_SIZE)) {
    await db.insert(majors).values(chunk).onConflictDoNothing();
  }
  console.log(`Upserted ${majorEntries.length} major entries`);

  // Step 3: Upsert cutoff scores
  const scoreValues = normalized.map((row) => ({
    university_id: row.university_id,
    major_id: row.major_id,
    tohop_code: row.tohop_code,
    year: row.year,
    score: sql`${row.score}::numeric`,
    admission_method: row.admission_method,
    source_url: row.source_url,
    scraped_at: row.scraped_at,
  }));

  let inserted = 0;
  for (const chunk of chunks(scoreValues, CHUNK_SIZE)) {
    const result = await db
      .insert(cutoffScores)
      .values(chunk)
      .onConflictDoUpdate({
        target: [
          cutoffScores.university_id,
          cutoffScores.major_id,
          cutoffScores.tohop_code,
          cutoffScores.year,
          cutoffScores.admission_method,
        ],
        set: {
          score: sql`excluded.score`,
          source_url: sql`excluded.source_url`,
          scraped_at: sql`excluded.scraped_at`,
        },
      });
    inserted += chunk.length;
    process.stdout.write(`\rInserted ${inserted}/${scoreValues.length} rows`);
  }

  console.log(`\nDone. Seeded ${inserted} cutoff score rows into Supabase.`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
