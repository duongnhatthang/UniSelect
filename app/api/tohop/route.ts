import type { NextRequest } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { db } from '../../../lib/db';
import { tohopCodes } from '../../../lib/db/schema';
import { withTimeout } from '../../../lib/db/timeout';
import { errorResponse } from '../../../lib/api/helpers';

export async function GET(_req: NextRequest) {
  try {
    const rows = await withTimeout(
      db.select().from(tohopCodes).orderBy(tohopCodes.code),
      10_000
    );

    return Response.json(
      { data: rows, meta: { count: rows.length } },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600',
        },
      }
    );
  } catch (err) {
    if (err instanceof Error && err.message === 'DB_TIMEOUT') {
      try {
        const staticData = JSON.parse(
          readFileSync(join(process.cwd(), 'public/data/tohop.json'), 'utf-8')
        );
        return Response.json(staticData, {
          headers: {
            'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600',
            'X-Served-By': 'static-fallback',
          },
        });
      } catch {
        return errorResponse('DB_UNAVAILABLE', 'Service temporarily unavailable', 503, {
          'Retry-After': '30',
        });
      }
    }
    throw err;
  }
}
