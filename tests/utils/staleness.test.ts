import { describe, it, expect } from 'vitest';
import { formatStaleness, isStale } from '../../lib/utils/staleness';

describe('isStale', () => {
  it('returns true for > 90 days', () => {
    const old = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString();
    expect(isStale(old)).toBe(true);
  });
  it('returns false for < 90 days', () => {
    const recent = new Date(Date.now() - 89 * 24 * 60 * 60 * 1000).toISOString();
    expect(isStale(recent)).toBe(false);
  });
  it('returns false for now', () => {
    expect(isStale(new Date().toISOString())).toBe(false);
  });
});

describe('formatStaleness', () => {
  it('returns a string for recent date', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const result = formatStaleness(twoDaysAgo, 'vi');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
