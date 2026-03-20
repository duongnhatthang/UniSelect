import { db } from '../db';
import { scrapeRuns } from '../db/schema';
import { sql, max } from 'drizzle-orm';

export async function getScrapeStatus() {
  const rows = await db
    .select({
      university_id: scrapeRuns.university_id,
      last_run_at: max(scrapeRuns.run_at),
      last_status: sql<string>`(array_agg(${scrapeRuns.status} ORDER BY ${scrapeRuns.run_at} DESC))[1]`,
      last_rows_written: sql<number>`(array_agg(${scrapeRuns.rows_written} ORDER BY ${scrapeRuns.run_at} DESC))[1]`,
      has_error: sql<boolean>`(array_agg(${scrapeRuns.status} ORDER BY ${scrapeRuns.run_at} DESC))[1] = 'error'`,
    })
    .from(scrapeRuns)
    .groupBy(scrapeRuns.university_id);
  return rows;
}
