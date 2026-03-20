import { db } from '../db';
import { cutoffScores, majors, scrapeRuns } from '../db/schema';
import { normalize } from './normalizer';
import { ScraperAdapter } from './types';
import type { NormalizedRow } from './types';
import { sql } from 'drizzle-orm';

interface AdapterConfig {
  id: string;
  adapter: ScraperAdapter;
  url: string;
}

export interface RunSummary {
  attempted: number;
  succeeded: number;
  failed: number;
  zero_rows: number;
}

const CHUNK_SIZE = 500;

function chunks<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

export async function runScraper(configs: AdapterConfig[], githubRunId?: string): Promise<RunSummary> {
  const summary: RunSummary = { attempted: 0, succeeded: 0, failed: 0, zero_rows: 0 };

  for (const config of configs) {
    summary.attempted++;
    let rowsWritten = 0;
    let rowsRejected = 0;
    const rejectionLog: string[] = [];

    try {
      const rawRows = await config.adapter.scrape(config.url);

      if (rawRows.length === 0) {
        await db.insert(scrapeRuns).values({
          university_id: config.id,
          status: 'zero_rows',
          rows_written: 0,
          rows_rejected: 0,
          error_log: `Adapter returned 0 rows — possible JS rendering or layout change`,
          github_run_id: githubRunId ?? null,
        });
        summary.zero_rows++;
        continue; // skip to next adapter
      }

      // Phase A: Normalize all rows
      const normalizedRows: NormalizedRow[] = [];
      for (const raw of rawRows) {
        const normalized = normalize(raw);
        if (!normalized) {
          rowsRejected++;
          rejectionLog.push(JSON.stringify(raw));
          continue;
        }
        normalizedRows.push(normalized);
      }
      rowsWritten = normalizedRows.length;

      // Phase B: Batch insert in transaction
      if (normalizedRows.length > 0) {
        await db.transaction(async (tx) => {
          // 1. Upsert unique majors (FK dependency)
          const uniqueMajorIds = [...new Set(normalizedRows.map(r => r.major_id))];
          for (const chunk of chunks(uniqueMajorIds.map(id => ({ id, name_vi: id })), CHUNK_SIZE)) {
            await tx.insert(majors).values(chunk).onConflictDoNothing();
          }

          // 2. Batch upsert cutoffScores
          for (const chunk of chunks(normalizedRows, CHUNK_SIZE)) {
            await tx.insert(cutoffScores)
              .values(chunk.map(r => ({
                university_id: r.university_id,
                major_id: r.major_id,
                tohop_code: r.tohop_code,
                year: r.year,
                score: String(r.score),
                admission_method: r.admission_method,
                source_url: r.source_url,
                scraped_at: r.scraped_at,
              })))
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
          }
        });
      }

      const status = rowsRejected > 0 ? 'flagged' : 'ok';
      await db.insert(scrapeRuns).values({
        university_id: config.id,
        status,
        rows_written: rowsWritten,
        rows_rejected: rowsRejected,
        error_log: rejectionLog.length > 0 ? JSON.stringify(rejectionLog) : null,
        github_run_id: githubRunId ?? null,
      });
      summary.succeeded++;
    } catch (err) {
      await db.insert(scrapeRuns).values({
        university_id: config.id,
        status: 'error',
        rows_written: 0,
        rows_rejected: 0,
        error_log: String(err),
        github_run_id: githubRunId ?? null,
      });
      summary.failed++;
      // continue to next adapter — fail-open
    }
  }

  return summary;
}
