import { db } from '../db';
import { universities, cutoffScores } from '../db/schema';
import { gt, asc, eq, sql } from 'drizzle-orm';

export interface UniversityWithTohop {
  id: string;
  name_vi: string;
  name_en: string | null;
  website_url: string | null;
  created_at: Date | null;
  tohop_codes: string[];
}

export async function getUniversities(cursor?: string, limit = 50): Promise<{
  data: UniversityWithTohop[];
  meta: { count: number; next_cursor: string | null };
}> {
  const safeLimit = Math.min(Math.max(1, limit), 200);

  // Subquery: distinct tohop codes per university
  const tohopSub = db
    .select({
      university_id: cutoffScores.university_id,
      tohop_codes: sql<string[]>`array_agg(distinct ${cutoffScores.tohop_code})`.as('tohop_codes'),
    })
    .from(cutoffScores)
    .groupBy(cutoffScores.university_id)
    .as('tohop_sub');

  const rows = await db
    .select({
      id: universities.id,
      name_vi: universities.name_vi,
      name_en: universities.name_en,
      website_url: universities.website_url,
      created_at: universities.created_at,
      tohop_codes: sql<string[]>`coalesce(${tohopSub.tohop_codes}, '{}')`,
    })
    .from(universities)
    .leftJoin(tohopSub, eq(universities.id, tohopSub.university_id))
    .where(cursor ? gt(universities.id, cursor) : undefined)
    .orderBy(asc(universities.id))
    .limit(safeLimit + 1);

  const hasMore = rows.length > safeLimit;
  const data = hasMore ? rows.slice(0, safeLimit) : rows;
  const nextCursor = hasMore ? data[data.length - 1].id : null;

  return { data, meta: { count: data.length, next_cursor: nextCursor } };
}
