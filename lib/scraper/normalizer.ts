import { RawRow, NormalizedRow } from './types';

export function normalize(raw: RawRow): NormalizedRow | null {
  // Step 1: Cosmetic normalization
  const tohop = raw.tohop_raw.trim().toUpperCase();
  const scoreStr = raw.score_raw.trim().replace(',', '.');
  const majorCode = raw.major_raw.trim();

  // Step 2: Hard validation — reject if fails
  const score = parseFloat(scoreStr);
  if (isNaN(score) || score < 10.0 || score > 30.0) return null;
  if (!/^[A-D]\d{2}$/.test(tohop)) return null;
  if (!majorCode) return null;

  return {
    university_id: raw.university_id,
    major_id: majorCode,
    tohop_code: tohop,
    year: raw.year,
    score,
    admission_method: 'THPT',
    source_url: raw.source_url,
    scraped_at: new Date(),
  };
}
