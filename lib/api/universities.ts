import { db } from '../db';
import { universities } from '../db/schema';
import { gt, asc } from 'drizzle-orm';

export async function getUniversities(cursor?: string, limit = 50) {
  const safeLimit = Math.min(Math.max(1, limit), 200);

  const rows = await db
    .select()
    .from(universities)
    .where(cursor ? gt(universities.id, cursor) : undefined)
    .orderBy(asc(universities.id))
    .limit(safeLimit + 1); // fetch one extra to detect hasMore

  const hasMore = rows.length > safeLimit;
  const data = hasMore ? rows.slice(0, safeLimit) : rows;
  const nextCursor = hasMore ? data[data.length - 1].id : null;

  return { data, meta: { count: data.length, next_cursor: nextCursor } };
}
