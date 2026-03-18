import type { NextRequest } from 'next/server';
import { db } from '../../../../lib/db';
import { universities } from '../../../../lib/db/schema';
import { eq } from 'drizzle-orm';
import { withTimeout } from '../../../../lib/db/timeout';
import { errorResponse } from '../../../../lib/api/helpers';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params; // MUST await in Next.js 15+

  try {
    const rows = await withTimeout(
      db.select().from(universities).where(eq(universities.id, id)).limit(1),
      10_000
    );

    const uni = rows[0];

    if (!uni) {
      return errorResponse('NOT_FOUND', 'University not found', 404);
    }

    return Response.json({ data: uni });
  } catch (err) {
    if (err instanceof Error && err.message === 'DB_TIMEOUT') {
      return errorResponse('DB_UNAVAILABLE', 'Service temporarily unavailable', 503, {
        'Retry-After': '30',
      });
    }
    throw err;
  }
}
