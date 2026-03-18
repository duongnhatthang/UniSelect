import { db } from '../db';
import { cutoffScores, universities, majors } from '../db/schema';
import { gt, asc, eq, and } from 'drizzle-orm';

export async function getScores(opts: {
  cursor?: string;
  limit?: number;
  year?: number;
  tohop_code?: string;
}) {
  const safeLimit = Math.min(Math.max(1, opts.limit ?? 50), 200);

  // Build dynamic where conditions
  const conditions = [];
  if (opts.cursor) conditions.push(gt(cutoffScores.id, parseInt(opts.cursor, 10)));
  if (opts.year) conditions.push(eq(cutoffScores.year, opts.year));
  if (opts.tohop_code) conditions.push(eq(cutoffScores.tohop_code, opts.tohop_code));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: cutoffScores.id,
      university_id: cutoffScores.university_id,
      university_name_vi: universities.name_vi,
      major_id: cutoffScores.major_id,
      major_name_vi: majors.name_vi,
      tohop_code: cutoffScores.tohop_code,
      year: cutoffScores.year,
      score: cutoffScores.score,
      source_url: cutoffScores.source_url,
      scraped_at: cutoffScores.scraped_at,
    })
    .from(cutoffScores)
    .innerJoin(universities, eq(cutoffScores.university_id, universities.id))
    .innerJoin(majors, eq(cutoffScores.major_id, majors.id))
    .where(where)
    .orderBy(asc(cutoffScores.id))
    .limit(safeLimit + 1);

  const hasMore = rows.length > safeLimit;
  const data = hasMore ? rows.slice(0, safeLimit) : rows;
  const nextCursor = hasMore ? String(data[data.length - 1].id) : null;
  return { data, meta: { count: data.length, next_cursor: nextCursor } };
}
