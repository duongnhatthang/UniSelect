import { describe, it, expect } from 'vitest';
import { normalize } from '../../lib/scraper/normalizer';
import { RawRow } from '../../lib/scraper/types';

const baseRow: RawRow = {
  university_id: 'BKA',
  major_raw: '7480201',
  tohop_raw: 'A00',
  year: 2024,
  score_raw: '28.50',
  source_url: 'https://example.com',
};

describe('normalize', () => {
  it('converts comma-decimal score (28,50 to 28.5)', () => {
    const result = normalize({ ...baseRow, score_raw: '28,50' });
    expect(result).not.toBeNull();
    expect(result!.score).toBe(28.5);
  });

  it('passes through dot-decimal score (28.50 to 28.5)', () => {
    const result = normalize({ ...baseRow, score_raw: '28.50' });
    expect(result).not.toBeNull();
    expect(result!.score).toBe(28.5);
  });

  it('uppercases lowercase tohop code (a00 to A00)', () => {
    const result = normalize({ ...baseRow, tohop_raw: 'a00' });
    expect(result).not.toBeNull();
    expect(result!.tohop_code).toBe('A00');
  });

  it('strips whitespace from tohop code (  A00   to A00)', () => {
    const result = normalize({ ...baseRow, tohop_raw: '  A00  ' });
    expect(result).not.toBeNull();
    expect(result!.tohop_code).toBe('A00');
  });

  it('rejects score below 10.0 (9.5 → null)', () => {
    const result = normalize({ ...baseRow, score_raw: '9.5' });
    expect(result).toBeNull();
  });

  it('rejects score above 30.0 (31.0 → null)', () => {
    const result = normalize({ ...baseRow, score_raw: '31.0' });
    expect(result).toBeNull();
  });

  it('rejects non-numeric score (abc → null)', () => {
    const result = normalize({ ...baseRow, score_raw: 'abc' });
    expect(result).toBeNull();
  });

  it('rejects non-letter-digit tohop pattern (99A → null)', () => {
    const result = normalize({ ...baseRow, tohop_raw: '99A' });
    expect(result).toBeNull();
  });

  it('rejects tohop with too many digits (A0001 → null)', () => {
    const result = normalize({ ...baseRow, tohop_raw: 'A0001' });
    expect(result).toBeNull();
  });

  it('accepts extended tohop codes (X01, H02, M03)', () => {
    expect(normalize({ ...baseRow, tohop_raw: 'X01' })).not.toBeNull();
    expect(normalize({ ...baseRow, tohop_raw: 'H02' })).not.toBeNull();
    expect(normalize({ ...baseRow, tohop_raw: 'M03' })).not.toBeNull();
  });

  it('rejects empty major code ("" → null)', () => {
    const result = normalize({ ...baseRow, major_raw: '' });
    expect(result).toBeNull();
  });

  it('rejects whitespace-only major code ("  " → null)', () => {
    const result = normalize({ ...baseRow, major_raw: '  ' });
    expect(result).toBeNull();
  });

  it('returns complete NormalizedRow with scraped_at as Date and admission_method "THPT"', () => {
    const result = normalize(baseRow);
    expect(result).not.toBeNull();
    expect(result!.university_id).toBe('BKA');
    expect(result!.major_id).toBe('7480201');
    expect(result!.tohop_code).toBe('A00');
    expect(result!.year).toBe(2024);
    expect(result!.score).toBe(28.5);
    expect(result!.admission_method).toBe('THPT');
    expect(result!.source_url).toBe('https://example.com');
    expect(result!.scraped_at).toBeInstanceOf(Date);
  });
});
