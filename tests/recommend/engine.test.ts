import { describe, it, expect } from 'vitest';
import { recommend } from '../../lib/recommend/engine';
import type { CutoffDataRow, RecommendInput } from '../../lib/recommend/types';

function row(overrides: Partial<CutoffDataRow> & { score: string }): CutoffDataRow {
  return {
    university_id: 'U01',
    university_name_vi: 'Test University',
    major_id: 'M01',
    major_name_vi: 'Test Major',
    tohop_code: 'A00',
    year: 2024,
    scraped_at: null,
    source_url: null,
    ...overrides,
  };
}

const INPUT: RecommendInput = { tohop_code: 'A00', total_score: 21 };

describe('recommend', () => {
  describe('NaN and null score filtering', () => {
    it('excludes a single row with score "NaN" and returns empty', () => {
      const result = recommend(INPUT, [row({ score: 'NaN' })]);
      expect(result).toHaveLength(0);
    });

    it('excludes a single row with score "null" (cast to string) and returns empty', () => {
      // null coerced to string "null" is not a valid float
      const result = recommend(INPUT, [row({ score: 'null' })]);
      expect(result).toHaveLength(0);
    });

    it('uses valid rows and excludes null rows; data_years_limited=true when only 1 valid year', () => {
      const rows = [
        row({ score: 'null', year: 2022 }),
        row({ score: '20', year: 2024 }),
      ];
      const result = recommend(INPUT, rows);
      expect(result).toHaveLength(1);
      expect(result[0].data_years_limited).toBe(true);
      expect(result[0].years_available).toBe(1);
    });
  });

  describe('comma-decimal score handling', () => {
    it('parses score "20,5" as 20 via parseFloat (known JS behavior)', () => {
      const result = recommend(INPUT, [row({ score: '20,5' })]);
      // parseFloat('20,5') === 20 in JS — the comma stops parsing
      expect(result).toHaveLength(1);
      expect(result[0].weighted_cutoff).toBeCloseTo(20, 1);
    });
  });

  describe('tier boundary classification', () => {
    // All tests use cutoff=20, diff = total_score - cutoff
    // safe >= 3 (above cutoff, easy), practical: -1..2, dream: -5..-2 (aspirational), excluded < -5

    it('classifies as safe when diff = 3 (cutoff=20, score=23)', () => {
      const input: RecommendInput = { tohop_code: 'A00', total_score: 23 };
      const result = recommend(input, [row({ score: '20' })]);
      expect(result).toHaveLength(1);
      expect(result[0].tier).toBe('safe');
    });

    it('classifies as practical at lower boundary: diff = -1 (cutoff=20, score=19)', () => {
      const input: RecommendInput = { tohop_code: 'A00', total_score: 19 };
      const result = recommend(input, [row({ score: '20' })]);
      expect(result).toHaveLength(1);
      expect(result[0].tier).toBe('practical');
    });

    it('classifies as practical at upper boundary: diff = 2 (cutoff=20, score=22)', () => {
      const input: RecommendInput = { tohop_code: 'A00', total_score: 22 };
      const result = recommend(input, [row({ score: '20' })]);
      expect(result).toHaveLength(1);
      expect(result[0].tier).toBe('practical');
    });

    it('classifies as dream at upper boundary: diff = -2 (cutoff=20, score=18)', () => {
      const input: RecommendInput = { tohop_code: 'A00', total_score: 18 };
      const result = recommend(input, [row({ score: '20' })]);
      expect(result).toHaveLength(1);
      expect(result[0].tier).toBe('dream');
    });

    it('classifies as dream at lower boundary: diff = -5 (cutoff=20, score=15)', () => {
      const input: RecommendInput = { tohop_code: 'A00', total_score: 15 };
      const result = recommend(input, [row({ score: '20' })]);
      expect(result).toHaveLength(1);
      expect(result[0].tier).toBe('dream');
    });

    it('returns empty when excluded: diff = -6 (cutoff=20, score=14)', () => {
      const input: RecommendInput = { tohop_code: 'A00', total_score: 14 };
      const result = recommend(input, [row({ score: '20' })]);
      expect(result).toHaveLength(0);
    });
  });

  describe('pool size edge cases', () => {
    it('returns only dream and safe results when 0-practical pool (no practical matches)', () => {
      // score=24 (diff=4) = safe; score=27 (diff=-3) = dream; nothing in -1..2 range = no practical
      const rows = [
        row({ university_id: 'U1', major_id: 'M1', score: '20' }),  // diff=4 → safe
        row({ university_id: 'U2', major_id: 'M2', score: '27' }),  // diff=-3 → dream
        row({ university_id: 'U3', major_id: 'M3', score: '21' }),  // diff=3 → safe boundary
      ];
      const input: RecommendInput = { tohop_code: 'A00', total_score: 24 };
      const result = recommend(input, rows);
      const tiers = result.map(r => r.tier);
      expect(tiers).not.toContain('practical');
      expect(result.filter(r => r.tier === 'safe')).toHaveLength(2);
      expect(result.filter(r => r.tier === 'dream')).toHaveLength(1);
    });

    it('marks all results as suggested_top_15=true when pool has exactly 15 entries', () => {
      const rows = Array.from({ length: 15 }, (_, i) =>
        row({ university_id: `U${i}`, major_id: `M${i}`, score: '20' })
      );
      const input: RecommendInput = { tohop_code: 'A00', total_score: 21 }; // diff=1 → practical
      const result = recommend(input, rows);
      expect(result).toHaveLength(15);
      expect(result.every(r => r.suggested_top_15)).toBe(true);
    });

    it('marks only first 15 as suggested_top_15=true when pool has more than 15', () => {
      const rows = Array.from({ length: 20 }, (_, i) =>
        row({ university_id: `U${i}`, major_id: `M${i}`, score: '20' })
      );
      const input: RecommendInput = { tohop_code: 'A00', total_score: 21 }; // diff=1 → practical
      const result = recommend(input, rows);
      expect(result).toHaveLength(20);
      const topFifteen = result.filter(r => r.suggested_top_15);
      const rest = result.filter(r => !r.suggested_top_15);
      expect(topFifteen).toHaveLength(15);
      expect(rest).toHaveLength(5);
    });
  });
});
