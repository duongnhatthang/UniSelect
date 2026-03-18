import type { NextRequest } from 'next/server';
import { db } from '../../../lib/db';
import { cutoffScores } from '../../../lib/db/schema';
import { sql } from 'drizzle-orm';
import { withTimeout } from '../../../lib/db/timeout';
import { errorResponse } from '../../../lib/api/helpers';

export async function GET(_req: NextRequest) {
  try {
    const rows = await withTimeout(
      db
        .selectDistinct({ year: cutoffScores.year })
        .from(cutoffScores)
        .orderBy(sql`${cutoffScores.year} desc`),
      10_000
    );

    const years = rows.map((r) => r.year);

    return Response.json(
      { data: years, meta: { count: years.length } },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600',
        },
      }
    );
  } catch (err) {
    if (err instanceof Error && err.message === 'DB_TIMEOUT') {
      return errorResponse('DB_UNAVAILABLE', 'Service temporarily unavailable', 503, {
        'Retry-After': '30',
      });
    }
    throw err;
  }
}
