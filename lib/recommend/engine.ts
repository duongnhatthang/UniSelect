import type { CutoffDataRow, RecommendInput, RecommendResult, Tier } from './types';

// Tier classification margins (locked in CONTEXT.md)
const DREAM_MARGIN = 3;     // student_score >= cutoff + 3
const PRACTICAL_LOWER = -1; // student_score >= cutoff - 1
const PRACTICAL_UPPER = 2;  // student_score <= cutoff + 2
const SAFE_LOWER = -5;      // student_score >= cutoff - 5
const SAFE_UPPER = -2;      // student_score <= cutoff - 2

// Trend threshold: diff > 0.5 = rising, diff < -0.5 = falling, else stable
const TREND_THRESHOLD = 0.5;

// Weights for 1, 2, 3 years (most recent year = highest weight)
const WEIGHTS: Record<number, number[]> = {
  1: [1],
  2: [1, 2],
  3: [1, 2, 3],
};

function classifyTier(totalScore: number, weightedCutoff: number): Tier | null {
  const diff = totalScore - weightedCutoff;
  if (diff >= DREAM_MARGIN) return 'dream';
  if (diff >= PRACTICAL_LOWER && diff <= PRACTICAL_UPPER) return 'practical';
  if (diff >= SAFE_LOWER && diff <= SAFE_UPPER) return 'safe';
  return null; // below safe threshold — exclude
}

function computeTrend(sortedScores: number[]): 'rising' | 'falling' | 'stable' {
  if (sortedScores.length < 2) return 'stable';
  const last = sortedScores[sortedScores.length - 1];
  const prev = sortedScores[sortedScores.length - 2];
  const diff = last - prev;
  if (diff > TREND_THRESHOLD) return 'rising';
  if (diff < -TREND_THRESHOLD) return 'falling';
  return 'stable';
}

function isSuPham(nameVi: string): boolean {
  const lower = nameVi.toLowerCase();
  return lower.includes('su pham') || lower.includes('sư phạm') ||
    lower.includes('giao duc') || lower.includes('giáo dục');
}

const TIER_ORDER: Record<Tier, number> = {
  practical: 0,
  dream: 1,
  safe: 2,
};

export function recommend(input: RecommendInput, rows: CutoffDataRow[]): RecommendResult[] {
  if (rows.length === 0) return [];

  // Step 1: Group rows by composite key university_id|major_id
  const groups = new Map<string, CutoffDataRow[]>();
  for (const row of rows) {
    const key = `${row.university_id}|${row.major_id}`;
    const existing = groups.get(key);
    if (existing) {
      existing.push(row);
    } else {
      groups.set(key, [row]);
    }
  }

  // Step 2: For each group, compute weighted average, classify tier, compute trend
  const results: RecommendResult[] = [];

  for (const [, groupRows] of groups) {
    // Sort by year ascending
    groupRows.sort((a, b) => a.year - b.year);

    // Take last 3 years only
    const lastRows = groupRows.slice(-3);
    const yearsCount = lastRows.length;
    const weights = WEIGHTS[yearsCount] ?? [1];

    // Compute weighted average — IMPORTANT: parseFloat on score string
    const scores = lastRows.map(r => parseFloat(r.score));
    const weightSum = weights.reduce((a, b) => a + b, 0);
    const weightedCutoff = scores.reduce((acc, s, i) => acc + s * weights[i], 0) / weightSum;

    // Classify tier
    const tier = classifyTier(input.total_score, weightedCutoff);
    if (tier === null) continue; // exclude below-safe pairs

    // Compute trend from last 2 years
    const trend = computeTrend(scores);

    const representative = lastRows[lastRows.length - 1];

    results.push({
      university_id: representative.university_id,
      university_name_vi: representative.university_name_vi,
      major_id: representative.major_id,
      major_name_vi: representative.major_name_vi,
      tohop_code: representative.tohop_code,
      weighted_cutoff: weightedCutoff,
      tier,
      trend,
      data_years_limited: yearsCount < 3,
      years_available: yearsCount,
      suggested_top_15: false, // will be set in Step 3
    });
  }

  // Step 3: Apply suggested_top_15
  // Sort: practical first, then dream, then safe
  // Within each tier:
  //   - practical: ascending abs(total_score - weighted_cutoff) (closest match first)
  //   - dream: descending margin (highest clearance first)
  //   - safe: descending weighted_cutoff (highest score first)
  // Then deprioritize su pham programs to end of their tier
  results.sort((a, b) => {
    const tierDiff = TIER_ORDER[a.tier] - TIER_ORDER[b.tier];
    if (tierDiff !== 0) return tierDiff;

    // Su pham deprioritization within same tier
    const aSuPham = isSuPham(a.major_name_vi);
    const bSuPham = isSuPham(b.major_name_vi);
    if (aSuPham !== bSuPham) return aSuPham ? 1 : -1;

    // Within-tier sort by score proximity/margin
    if (a.tier === 'practical') {
      // Ascending distance from cutoff
      const aDist = Math.abs(input.total_score - a.weighted_cutoff);
      const bDist = Math.abs(input.total_score - b.weighted_cutoff);
      return aDist - bDist;
    }
    if (a.tier === 'dream') {
      // Descending margin (most clearance first)
      const aMargin = input.total_score - a.weighted_cutoff;
      const bMargin = input.total_score - b.weighted_cutoff;
      return bMargin - aMargin;
    }
    if (a.tier === 'safe') {
      // Descending weighted_cutoff (highest cutoff = closest to student = safest choice)
      return b.weighted_cutoff - a.weighted_cutoff;
    }

    return 0;
  });

  // Mark first 15 as suggested_top_15
  for (let i = 0; i < results.length; i++) {
    results[i].suggested_top_15 = i < 15;
  }

  return results;
}
