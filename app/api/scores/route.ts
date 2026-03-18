import type { NextRequest } from 'next/server';
import { getScores } from '../../../lib/api/scores';
import { withTimeout } from '../../../lib/db/timeout';
import { errorResponse } from '../../../lib/api/helpers';

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const cursor = params.get('cursor') ?? undefined;
  const limit = parseInt(params.get('limit') ?? '50', 10);
  const yearStr = params.get('year');
  const year = yearStr ? parseInt(yearStr, 10) : undefined;
  const tohop_code = params.get('tohop_code') ?? undefined;

  try {
    const result = await withTimeout(
      getScores({ cursor, limit, year, tohop_code }),
      10_000
    );

    return Response.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
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
