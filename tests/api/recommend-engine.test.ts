import { describe, it, expect } from 'vitest';
import { recommend } from '../../lib/recommend/engine';
import type { CutoffDataRow, RecommendInput } from '../../lib/recommend/types';

// ─── Test helpers ────────────────────────────────────────────────────────────

function makeRow(
  overrides: Partial<CutoffDataRow> & { year: number; score: string }
): CutoffDataRow {
  return {
    university_id: 'BKA',
    university_name_vi: 'Bach Khoa Ha Noi',
    major_id: '7480201',
    major_name_vi: 'Cong nghe thong tin',
    tohop_code: 'A00',
    scraped_at: null,
    source_url: null,
    ...overrides,
  };
}

// ─── Test 1: Three-year weighted average ─────────────────────────────────────
describe('recommend - 3-year weighted average', () => {
  it('computes correct weighted average and classifies tier (safe — well above cutoff)', () => {
    const rows: CutoffDataRow[] = [
      makeRow({ year: 2023, score: '24.00' }),
      makeRow({ year: 2024, score: '25.00' }),
      makeRow({ year: 2025, score: '26.00' }),
    ];
    // weighted_cutoff = (24*1 + 25*2 + 26*3) / 6 = (24+50+78)/6 = 152/6 ≈ 25.333
    const input: RecommendInput = { tohop_code: 'A00', total_score: 29.0 }; // 29 >= 25.333 + 3 → safe
    const results = recommend(input, rows);
    expect(results).toHaveLength(1);
    expect(results[0].weighted_cutoff).toBeCloseTo(25.333, 2);
    expect(results[0].tier).toBe('safe');
    expect(results[0].data_years_limited).toBe(false);
    expect(results[0].years_available).toBe(3);
  });

  it('computes correct weighted average with known scores', () => {
    const rows: CutoffDataRow[] = [
      makeRow({ year: 2023, score: '24.00' }),
      makeRow({ year: 2024, score: '25.00' }),
      makeRow({ year: 2025, score: '26.00' }),
    ];
    const input: RecommendInput = { tohop_code: 'A00', total_score: 25.0 };
    // 25 is in practical: weighted_cutoff ≈ 25.333, practical = cutoff - 1 to cutoff + 2
    // 25.333 - 1 = 24.333, so 25.0 >= 24.333 and 25.0 <= 25.333 + 2 = 27.333 → practical
    const results = recommend(input, rows);
    expect(results).toHaveLength(1);
    expect(results[0].tier).toBe('practical');
  });
});

// ─── Test 2: Two-year data → data_years_limited=true ─────────────────────────
describe('recommend - 2-year data', () => {
  it('uses weights [1,2] and sets data_years_limited=true', () => {
    const rows: CutoffDataRow[] = [
      makeRow({ year: 2024, score: '24.00' }),
      makeRow({ year: 2025, score: '27.00' }),
    ];
    // weighted_cutoff = (24*1 + 27*2) / 3 = (24+54)/3 = 78/3 = 26
    const input: RecommendInput = { tohop_code: 'A00', total_score: 29.5 }; // >= 26 + 3 = 29 → safe
    const results = recommend(input, rows);
    expect(results).toHaveLength(1);
    expect(results[0].weighted_cutoff).toBeCloseTo(26.0, 5);
    expect(results[0].data_years_limited).toBe(true);
    expect(results[0].years_available).toBe(2);
    expect(results[0].tier).toBe('safe');
  });
});

// ─── Test 3: One-year data → data_years_limited=true ─────────────────────────
describe('recommend - 1-year data', () => {
  it('uses weight [1] (score = cutoff) and sets data_years_limited=true', () => {
    const rows: CutoffDataRow[] = [
      makeRow({ year: 2025, score: '25.00' }),
    ];
    const input: RecommendInput = { tohop_code: 'A00', total_score: 24.5 };
    // cutoff = 25.0, safe = 25 - 5 to 25 - 2 = [20, 23], 24.5 is in practical range (25-1=24 to 25+2=27)
    const results = recommend(input, rows);
    expect(results).toHaveLength(1);
    expect(results[0].weighted_cutoff).toBeCloseTo(25.0, 5);
    expect(results[0].data_years_limited).toBe(true);
    expect(results[0].years_available).toBe(1);
    expect(results[0].tier).toBe('practical');
  });
});

// ─── Test 4: Score below safe threshold → pair excluded ───────────────────────
describe('recommend - exclusion below safe threshold', () => {
  it('excludes pair when student score < weighted_cutoff - 5', () => {
    const rows: CutoffDataRow[] = [
      makeRow({ year: 2025, score: '26.00' }),
    ];
    // cutoff = 26, safe threshold = 26 - 5 = 21, student score = 20 → excluded
    const input: RecommendInput = { tohop_code: 'A00', total_score: 20.0 };
    const results = recommend(input, rows);
    expect(results).toHaveLength(0);
  });

  it('includes pair when student score exactly at dream lower bound (cutoff - 5)', () => {
    const rows: CutoffDataRow[] = [
      makeRow({ year: 2025, score: '26.00' }),
    ];
    // cutoff = 26, dream = 21 to 24, student score = 21 → dream tier (at lower bound)
    const input: RecommendInput = { tohop_code: 'A00', total_score: 21.0 };
    const results = recommend(input, rows);
    expect(results).toHaveLength(1);
    expect(results[0].tier).toBe('dream');
  });
});

// ─── Test 5: Safe tier classification (well above cutoff) ────────────────────
describe('recommend - safe tier (above cutoff)', () => {
  it('classifies as safe when student score >= cutoff + 3', () => {
    const rows: CutoffDataRow[] = [
      makeRow({ year: 2025, score: '20.00' }),
    ];
    const input: RecommendInput = { tohop_code: 'A00', total_score: 23.0 }; // 20 + 3 = 23 → safe
    const results = recommend(input, rows);
    expect(results[0].tier).toBe('safe');
  });

  it('classifies as practical (not dream) when student score = cutoff + 2', () => {
    const rows: CutoffDataRow[] = [
      makeRow({ year: 2025, score: '20.00' }),
    ];
    const input: RecommendInput = { tohop_code: 'A00', total_score: 22.0 }; // 20 + 2 → practical
    const results = recommend(input, rows);
    expect(results[0].tier).toBe('practical');
  });
});

// ─── Test 6: Practical tier classification ────────────────────────────────────
describe('recommend - practical tier', () => {
  it('classifies as practical when cutoff - 1 <= score <= cutoff + 2', () => {
    const rows: CutoffDataRow[] = [
      makeRow({ year: 2025, score: '25.00' }),
    ];
    const input: RecommendInput = { tohop_code: 'A00', total_score: 24.5 }; // 25 - 1 = 24 ≤ 24.5 ≤ 27 → practical
    const results = recommend(input, rows);
    expect(results[0].tier).toBe('practical');
  });

  it('classifies as practical at lower bound (cutoff - 1)', () => {
    const rows: CutoffDataRow[] = [
      makeRow({ year: 2025, score: '25.00' }),
    ];
    const input: RecommendInput = { tohop_code: 'A00', total_score: 24.0 }; // exactly cutoff - 1 → practical
    const results = recommend(input, rows);
    expect(results[0].tier).toBe('practical');
  });
});

// ─── Test 7: Dream tier classification (below cutoff, aspirational) ──────────
describe('recommend - dream tier (below cutoff)', () => {
  it('classifies as dream when cutoff - 5 <= score <= cutoff - 2', () => {
    const rows: CutoffDataRow[] = [
      makeRow({ year: 2025, score: '25.00' }),
    ];
    const input: RecommendInput = { tohop_code: 'A00', total_score: 21.0 }; // 25 - 5 = 20, 25 - 2 = 23, so 21 → dream
    const results = recommend(input, rows);
    expect(results[0].tier).toBe('dream');
  });

  it('classifies as dream at upper bound (cutoff - 2)', () => {
    const rows: CutoffDataRow[] = [
      makeRow({ year: 2025, score: '25.00' }),
    ];
    const input: RecommendInput = { tohop_code: 'A00', total_score: 23.0 }; // exactly cutoff - 2 → dream
    const results = recommend(input, rows);
    expect(results[0].tier).toBe('dream');
  });
});

// ─── Test 8: suggested_top_15 flag ───────────────────────────────────────────
describe('recommend - suggested_top_15', () => {
  it('marks exactly 15 results when >15 qualify, with practical first priority', () => {
    // Create 20 university-major pairs all with the same cutoff = 20.0
    // Student score = 22.0, which is cutoff + 2 → practical for all
    const rows: CutoffDataRow[] = Array.from({ length: 20 }, (_, i) =>
      makeRow({
        university_id: `UNI${String(i).padStart(2, '0')}`,
        university_name_vi: `University ${i}`,
        major_id: `748020${String(i).padStart(1, '0')}`,
        major_name_vi: `Major ${i}`,
        year: 2025,
        score: '20.00',
      })
    );

    const input: RecommendInput = { tohop_code: 'A00', total_score: 22.0 };
    const results = recommend(input, rows);

    expect(results).toHaveLength(20);
    const top15 = results.filter(r => r.suggested_top_15);
    const rest = results.filter(r => !r.suggested_top_15);
    expect(top15).toHaveLength(15);
    expect(rest).toHaveLength(5);
  });

  it('marks all results when fewer than 15 qualify', () => {
    const rows: CutoffDataRow[] = [
      makeRow({ university_id: 'UNI1', major_id: '7480201', year: 2025, score: '20.00' }),
      makeRow({ university_id: 'UNI2', major_id: '7480201', year: 2025, score: '21.00' }),
    ];
    const input: RecommendInput = { tohop_code: 'A00', total_score: 23.0 };
    const results = recommend(input, rows);
    expect(results.every(r => r.suggested_top_15)).toBe(true);
  });

  it('sorts dream before practical before safe in suggested_top_15 ordering', () => {
    // New tier semantics:
    // dream = below cutoff (aspirational), practical = close match, safe = well above cutoff
    // student score = 23
    // DREAM: cutoff=27, diff=23-27=-4 → dream (below cutoff, aspirational)
    // PRAC: cutoff=22, diff=23-22=1 → practical (close match)
    // SAFE: cutoff=19, diff=23-19=4 → safe (well above cutoff, easy)
    const rows: CutoffDataRow[] = [
      makeRow({ university_id: 'DREAM', major_id: '7000001', university_name_vi: 'Dream Uni', major_name_vi: 'Dream Major', year: 2025, score: '27.00' }),
      makeRow({ university_id: 'PRAC', major_id: '7000002', university_name_vi: 'Prac Uni', major_name_vi: 'Prac Major', year: 2025, score: '22.00' }),
      makeRow({ university_id: 'SAFE', major_id: '7000003', university_name_vi: 'Safe Uni', major_name_vi: 'Safe Major', year: 2025, score: '19.00' }),
    ];
    const input: RecommendInput = { tohop_code: 'A00', total_score: 23.0 };
    const results = recommend(input, rows);

    expect(results).toHaveLength(3);
    expect(results.every(r => r.suggested_top_15)).toBe(true);

    // Verify tier classification
    const dreamResult = results.find(r => r.university_id === 'DREAM');
    const pracResult = results.find(r => r.university_id === 'PRAC');
    const safeResult = results.find(r => r.university_id === 'SAFE');
    expect(dreamResult?.tier).toBe('dream');
    expect(pracResult?.tier).toBe('practical');
    expect(safeResult?.tier).toBe('safe');

    // Verify sort order: dream first, then practical, then safe
    const sortedIds = results.map(r => r.university_id);
    expect(sortedIds.indexOf('DREAM')).toBeLessThan(sortedIds.indexOf('PRAC'));
    expect(sortedIds.indexOf('PRAC')).toBeLessThan(sortedIds.indexOf('SAFE'));
  });
});

// ─── Test 9: Su pham deprioritization ────────────────────────────────────────
describe('recommend - su pham deprioritization', () => {
  it('moves su pham programs to end of their tier group', () => {
    // All practical tier (cutoff=22, student=23 → practical)
    const rows: CutoffDataRow[] = [
      makeRow({ university_id: 'NORMAL', major_id: '7000001', major_name_vi: 'Ky thuat phan mem', year: 2025, score: '22.00' }),
      makeRow({ university_id: 'SUPHAM', major_id: '7000002', major_name_vi: 'Su pham Toan hoc', year: 2025, score: '22.00' }),
      makeRow({ university_id: 'GIAODUC', major_id: '7000003', major_name_vi: 'Giao duc Mam non', year: 2025, score: '22.00' }),
    ];
    const input: RecommendInput = { tohop_code: 'A00', total_score: 23.0 };
    const results = recommend(input, rows);

    expect(results).toHaveLength(3);
    const normalIdx = results.findIndex(r => r.university_id === 'NORMAL');
    const suphamIdx = results.findIndex(r => r.university_id === 'SUPHAM');
    const giaoduc = results.findIndex(r => r.university_id === 'GIAODUC');
    expect(normalIdx).toBeLessThan(suphamIdx);
    expect(normalIdx).toBeLessThan(giaoduc);
  });
});

// ─── Test 10: Trend calculation ───────────────────────────────────────────────
describe('recommend - trend', () => {
  it('marks trend as rising when last year score is > previous by >0.5', () => {
    const rows: CutoffDataRow[] = [
      makeRow({ year: 2024, score: '24.00' }),
      makeRow({ year: 2025, score: '25.00' }), // diff = 1.0 > 0.5 → rising
    ];
    const input: RecommendInput = { tohop_code: 'A00', total_score: 28.0 };
    // cutoff = (24*1 + 25*2)/3 = 74/3 ≈ 24.67, 28 >= 24.67+3 = 27.67 → safe
    const results = recommend(input, rows);
    expect(results[0].trend).toBe('rising');
  });

  it('marks trend as falling when last year score - previous < -0.5', () => {
    const rows: CutoffDataRow[] = [
      makeRow({ year: 2024, score: '26.00' }),
      makeRow({ year: 2025, score: '24.00' }), // diff = -2.0 < -0.5 → falling
    ];
    const input: RecommendInput = { tohop_code: 'A00', total_score: 29.0 };
    // cutoff = (26*1 + 24*2)/3 = 74/3 ≈ 24.67, 29 >= 24.67+3 = 27.67 → safe
    const results = recommend(input, rows);
    expect(results[0].trend).toBe('falling');
  });

  it('marks trend as stable when diff is within 0.5', () => {
    const rows: CutoffDataRow[] = [
      makeRow({ year: 2024, score: '25.00' }),
      makeRow({ year: 2025, score: '25.30' }), // diff = 0.30 ≤ 0.5 → stable
    ];
    const input: RecommendInput = { tohop_code: 'A00', total_score: 29.0 };
    const results = recommend(input, rows);
    expect(results[0].trend).toBe('stable');
  });

  it('marks trend as stable when only 1 year of data', () => {
    const rows: CutoffDataRow[] = [
      makeRow({ year: 2025, score: '25.00' }),
    ];
    const input: RecommendInput = { tohop_code: 'A00', total_score: 29.0 };
    const results = recommend(input, rows);
    expect(results[0].trend).toBe('stable');
  });
});

// ─── Test NaN filtering (FIX-03) ─────────────────────────────────────────────
describe('recommend - NaN filtering (FIX-03)', () => {
  it('excludes rows with null score from weighted average', () => {
    const rows: CutoffDataRow[] = [
      makeRow({ year: 2024, score: '24.00' }),
      makeRow({ year: 2025, score: null as unknown as string }),
    ];
    const input: RecommendInput = { tohop_code: 'A00', total_score: 28.0 };
    const results = recommend(input, rows);
    // Should use only 2024 data (weight [1]), cutoff = 24.0
    expect(results).toHaveLength(1);
    expect(results[0].weighted_cutoff).toBe(24.0);
    expect(isNaN(results[0].weighted_cutoff)).toBe(false);
  });

  it('skips group entirely when all scores are null', () => {
    const rows: CutoffDataRow[] = [
      makeRow({ year: 2024, score: null as unknown as string }),
      makeRow({ year: 2025, score: null as unknown as string }),
    ];
    const input: RecommendInput = { tohop_code: 'A00', total_score: 25.0 };
    const results = recommend(input, rows);
    expect(results).toHaveLength(0);
  });

  it('handles mix of valid and null scores correctly', () => {
    const rows: CutoffDataRow[] = [
      makeRow({ year: 2023, score: '24.00' }),
      makeRow({ year: 2024, score: null as unknown as string }),
      makeRow({ year: 2025, score: '26.00' }),
    ];
    const input: RecommendInput = { tohop_code: 'A00', total_score: 29.0 };
    const results = recommend(input, rows);
    expect(results).toHaveLength(1);
    // 2 valid rows: weights [1, 2], cutoff = (24*1 + 26*2) / 3 = 76/3 ≈ 25.333
    expect(results[0].weighted_cutoff).toBeCloseTo(25.333, 2);
    expect(results[0].years_available).toBe(2);
    expect(results[0].data_years_limited).toBe(true);
  });
});

// ─── Test 11: Empty rows input ────────────────────────────────────────────────
describe('recommend - empty input', () => {
  it('returns empty array when no rows provided', () => {
    const input: RecommendInput = { tohop_code: 'A00', total_score: 25.0 };
    const results = recommend(input, []);
    expect(results).toEqual([]);
  });
});

// ─── Test 12: String score parsing ───────────────────────────────────────────
describe('recommend - score string parsing', () => {
  it('correctly parses score string "25.50" without NaN', () => {
    const rows: CutoffDataRow[] = [
      makeRow({ year: 2025, score: '25.50' }),
    ];
    const input: RecommendInput = { tohop_code: 'A00', total_score: 29.0 };
    const results = recommend(input, rows);
    expect(results).toHaveLength(1);
    expect(results[0].weighted_cutoff).toBe(25.5);
    expect(isNaN(results[0].weighted_cutoff)).toBe(false);
  });

  it('correctly parses "24.00" from Postgres numeric column format', () => {
    expect(parseFloat('24.00')).toBe(24.0);
    // Engine should produce the same result
    const rows: CutoffDataRow[] = [
      makeRow({ year: 2025, score: '24.00' }),
    ];
    const input: RecommendInput = { tohop_code: 'A00', total_score: 28.0 };
    const results = recommend(input, rows);
    expect(results[0].weighted_cutoff).toBe(24.0);
  });
});
