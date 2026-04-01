import type { NextRequest } from 'next/server';
import { db } from '../../../lib/db';
import { cutoffScores, universities, majors, tohopCodes } from '../../../lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { errorResponse } from '../../../lib/api/helpers';

// Simple in-memory rate limiter: max 20 submissions per IP per hour
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

interface SubmitBody {
  university_id: string;
  tohop_code: string;
  score: number;
  source_url: string;
}

export async function POST(req: NextRequest) {
  // Rate limit by IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(ip)) {
    return errorResponse('RATE_LIMITED', 'Too many submissions. Try again later.', 429);
  }

  let body: SubmitBody;
  try {
    body = await req.json();
  } catch {
    return errorResponse('INVALID_BODY', 'Invalid JSON body', 400);
  }

  const { university_id, tohop_code, score, source_url } = body;

  // Validate university_id
  if (!university_id || typeof university_id !== 'string') {
    return errorResponse('INVALID_PARAMS', 'university_id is required', 400);
  }

  // Validate tohop_code
  const tohop = tohop_code?.trim().toUpperCase();
  if (!tohop || !/^[A-Z]\d{2,3}$/.test(tohop)) {
    return errorResponse('INVALID_PARAMS', 'Valid tohop code required (e.g. A00, D01)', 400);
  }

  // Validate score
  if (typeof score !== 'number' || isNaN(score) || score < 10.0 || score > 30.0) {
    return errorResponse('INVALID_PARAMS', 'Score must be between 10.0 and 30.0', 400);
  }

  // Validate source_url
  if (!source_url || typeof source_url !== 'string') {
    return errorResponse('INVALID_PARAMS', 'source_url is required', 400);
  }
  try {
    new URL(source_url);
  } catch {
    return errorResponse('INVALID_PARAMS', 'source_url must be a valid URL', 400);
  }

  try {
    // Check university exists
    const [uni] = await db
      .select({ id: universities.id })
      .from(universities)
      .where(eq(universities.id, university_id.toUpperCase()))
      .limit(1);

    if (!uni) {
      return errorResponse('NOT_FOUND', 'University not found', 404);
    }

    // Check tohop exists
    const [tohopExists] = await db
      .select({ code: tohopCodes.code })
      .from(tohopCodes)
      .where(eq(tohopCodes.code, tohop))
      .limit(1);

    if (!tohopExists) {
      return errorResponse('NOT_FOUND', 'Tohop code not found', 404);
    }

    const currentYear = new Date().getFullYear();

    // Ensure GENERAL major exists for user submissions
    await db.insert(majors)
      .values({ id: 'GENERAL', name_vi: 'Chung (do người dùng đóng góp)' })
      .onConflictDoNothing();

    // Insert with ON CONFLICT DO NOTHING — aggregator data wins
    await db.insert(cutoffScores)
      .values({
        university_id: uni.id,
        major_id: 'GENERAL',
        tohop_code: tohop,
        year: currentYear,
        score: String(score),
        admission_method: 'THPT',
        source_url,
        source_type: 'user_submitted',
        scraped_at: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          cutoffScores.university_id,
          cutoffScores.major_id,
          cutoffScores.tohop_code,
          cutoffScores.year,
          cutoffScores.admission_method,
        ],
        set: {
          // Only update if current row is also user_submitted (don't overwrite aggregator data)
          score: sql`CASE WHEN ${cutoffScores.source_type} = 'user_submitted' THEN excluded.score ELSE ${cutoffScores.score} END`,
          source_url: sql`CASE WHEN ${cutoffScores.source_type} = 'user_submitted' THEN excluded.source_url ELSE ${cutoffScores.source_url} END`,
          scraped_at: sql`CASE WHEN ${cutoffScores.source_type} = 'user_submitted' THEN excluded.scraped_at ELSE ${cutoffScores.scraped_at} END`,
        },
      });

    return Response.json(
      { status: 'ok', message: 'Score submitted successfully' },
      { status: 201 },
    );
  } catch (err) {
    console.error('submit-score error:', err);
    return errorResponse('INTERNAL_ERROR', 'Failed to submit score', 500);
  }
}
