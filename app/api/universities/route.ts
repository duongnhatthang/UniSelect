import type { NextRequest } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getUniversities } from '../../../lib/api/universities';
import { withTimeout } from '../../../lib/db/timeout';
import { errorResponse } from '../../../lib/api/helpers';

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const cursor = params.get('cursor') ?? undefined;
  const limit = parseInt(params.get('limit') ?? '50', 10);

  try {
    const result = await withTimeout(getUniversities(cursor, limit), 10_000);

    return Response.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600',
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'DB_TIMEOUT') {
      try {
        const staticData = JSON.parse(
          readFileSync(join(process.cwd(), 'public/data/universities.json'), 'utf-8')
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
