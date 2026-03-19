import { describe, it, expect } from 'vitest';
import { computeDelta } from '../../lib/recommend/delta';

describe('computeDelta', () => {
  it('returns +1.0 when student is above cutoff', () => {
    expect(computeDelta(25, 24)).toBe('+1.0');
  });

  it('returns -1.0 when student is below cutoff', () => {
    expect(computeDelta(23, 24)).toBe('-1.0');
  });

  it('returns +0.0 when student is exactly at cutoff', () => {
    expect(computeDelta(24, 24)).toBe('+0.0');
  });

  it('rounds to 1 decimal place correctly', () => {
    expect(computeDelta(25.55, 24.05)).toBe('+1.5');
  });
});
