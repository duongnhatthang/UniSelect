import { describe, it, expect } from 'vitest';
import { calculateTotal } from '../../lib/utils/calculate-total';

describe('calculateTotal', () => {
  it('returns the sum when all subjects are present', () => {
    const result = calculateTotal(
      { Toan: 9.5, Ly: 8.0, Hoa: 7.5 },
      ['Toan', 'Ly', 'Hoa']
    );
    expect(result).toBeCloseTo(25.0);
  });

  it('returns null when a required subject is missing', () => {
    const result = calculateTotal(
      { Toan: 9.5 },
      ['Toan', 'Ly', 'Hoa']
    );
    expect(result).toBeNull();
  });

  it('returns null when subject scores are empty', () => {
    const result = calculateTotal({}, ['Toan', 'Ly', 'Hoa']);
    expect(result).toBeNull();
  });

  it('returns 0 when subjects array is empty', () => {
    const result = calculateTotal({}, []);
    expect(result).toBe(0);
  });

  it('handles single subject correctly', () => {
    const result = calculateTotal({ VanHoc: 8.5 }, ['VanHoc']);
    expect(result).toBeCloseTo(8.5);
  });

  it('handles floating point scores correctly', () => {
    const result = calculateTotal(
      { Toan: 9.25, Ly: 8.75, Hoa: 7.0 },
      ['Toan', 'Ly', 'Hoa']
    );
    expect(result).toBeCloseTo(25.0);
  });
});
