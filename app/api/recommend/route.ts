import type { NextRequest } from 'next/server';
import { db } from '../../../lib/db';
import { cutoffScores, universities, majors } from '../../../lib/db/schema';
import { eq, and, gte, desc, sql } from 'drizzle-orm';
import { withTimeout } from '../../../lib/db/timeout';
import { errorResponse } from '../../../lib/api/helpers';
import { recommend } from '../../../lib/recommend/engine';
import type { CutoffDataRow } from '../../../lib/recommend/types';

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const rawTohop = params.get('tohop');
  const scoreStr = params.get('score');

  // Validate tohop code: must match /^[A-D]\d{2}$/ after trim+toUpperCase
  const tohop = rawTohop?.trim().toUpperCase();
  if (!tohop || !/^[A-D]\d{2}$/.test(tohop)) {
    return errorResponse('INVALID_PARAMS', 'Valid tohop code required (e.g. A00, D01)', 400);
  }

  // Validate score: must be a float between 10.0 and 30.0
  const totalScore = parseFloat(scoreStr ?? '');
  if (isNaN(totalScore) || totalScore < 10.0 || totalScore > 30.0) {
    return errorResponse('INVALID_PARAMS', 'Score must be between 10.0 and 30.0', 400);
  }

  try {
    // Determine anchor year: max year in cutoff_scores for this tohop
    const [maxYearRow] = await withTimeout(
      db
        .select({ maxYear: sql<number>`max(${cutoffScores.year})` })
        .from(cutoffScores)
        .where(eq(cutoffScores.tohop_code, tohop)),
      10_000
    );

    const anchorYear = maxYearRow?.maxYear ?? new Date().getFullYear();
    const minYear = anchorYear - 2; // last 3 years inclusive

    const rows = await withTimeout(
      db
        .select({
          university_id: universities.id,
          university_name_vi: universities.name_vi,
          major_id: majors.id,
          major_name_vi: majors.name_vi,
          tohop_code: cutoffScores.tohop_code,
          year: cutoffScores.year,
          score: cutoffScores.score,
          scraped_at: cutoffScores.scraped_at,
          source_url: cutoffScores.source_url,
        })
        .from(cutoffScores)
        .innerJoin(universities, eq(cutoffScores.university_id, universities.id))
        .innerJoin(majors, eq(cutoffScores.major_id, majors.id))
        .where(
          and(
            eq(cutoffScores.tohop_code, tohop),
            gte(cutoffScores.year, minYear)
          )
        )
        .orderBy(desc(cutoffScores.year)),
      10_000
    );

    // Cast rows to CutoffDataRow[] (score comes as string from Drizzle — correct)
    const results = recommend(
      { tohop_code: tohop, total_score: totalScore },
      rows as CutoffDataRow[]
    );

    // Collect distinct years from rows for meta
    const distinctYears = [...new Set(rows.map((r) => r.year))].sort((a, b) => b - a);

    return Response.json({
      data: results,
      meta: { count: results.length, years_available: distinctYears },
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
