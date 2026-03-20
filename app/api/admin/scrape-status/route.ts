import { getScrapeStatus } from '../../../../lib/api/scrape-status';
import { withTimeout } from '../../../../lib/db/timeout';
import { errorResponse } from '../../../../lib/api/helpers';

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
