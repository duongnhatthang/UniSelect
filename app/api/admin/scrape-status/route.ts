import { db } from '../../../../lib/db';
import { scrapeRuns } from '../../../../lib/db/schema';
import { withTimeout } from '../../../../lib/db/timeout';
import { errorResponse } from '../../../../lib/api/helpers';
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

export async function GET() {
  try {
    const data = await withTimeout(getScrapeStatus(), 10_000);
    return Response.json({ data }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'DB_TIMEOUT') {
      return errorResponse('DB_TIMEOUT', 'Database query timed out', 503);
    }
    throw err;
  }
}
