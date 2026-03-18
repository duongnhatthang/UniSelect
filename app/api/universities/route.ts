import type { NextRequest } from 'next/server';
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
      return errorResponse('DB_UNAVAILABLE', 'Service temporarily unavailable', 503, {
        'Retry-After': '30',
      });
    }
    throw err;
  }
}
