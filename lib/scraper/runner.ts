import { db } from '../db';
import { cutoffScores, scrapeRuns } from '../db/schema';
import { normalize } from './normalizer';
import { ScraperAdapter } from './types';
import { sql } from 'drizzle-orm';

interface AdapterConfig {
  id: string;
  adapter: ScraperAdapter;
  url: string;
}

export async function runScraper(configs: AdapterConfig[], githubRunId?: string): Promise<void> {
  for (const config of configs) {
    let rowsWritten = 0;
    let rowsRejected = 0;
    const rejectionLog: string[] = [];

    try {
      const rawRows = await config.adapter.scrape(config.url);

      for (const raw of rawRows) {
        const normalized = normalize(raw);
        if (!normalized) {
          rowsRejected++;
          rejectionLog.push(JSON.stringify(raw));
          continue;
        }

        await db.insert(cutoffScores)
          .values({
            university_id: normalized.university_id,
            major_id: normalized.major_id,
            tohop_code: normalized.tohop_code,
            year: normalized.year,
            score: String(normalized.score),
            admission_method: normalized.admission_method,
            source_url: normalized.source_url,
            scraped_at: normalized.scraped_at,
          })
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
        rowsWritten++;
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
    } catch (err) {
      await db.insert(scrapeRuns).values({
        university_id: config.id,
        status: 'error',
        rows_written: 0,
        rows_rejected: 0,
        error_log: String(err),
        github_run_id: githubRunId ?? null,
      });
      // continue to next adapter — fail-open
    }
  }
}
