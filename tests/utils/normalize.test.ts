import { describe, it, expect } from 'vitest';
import { normalizeVi } from '../../lib/utils/normalize-vi';

describe('normalizeVi', () => {
  it('strips Vietnamese diacritics', () => {
    expect(normalizeVi('\u0110\u1ea1i h\u1ecdc B\u00e1ch khoa H\u00e0 N\u1ed9i'))
      .toBe('dai hoc bach khoa ha noi');
  });
  it('lowercases', () => {
    expect(normalizeVi('TRUONG DAI HOC')).toBe('truong dai hoc');
  });
  it('handles empty string', () => {
    expect(normalizeVi('')).toBe('');
  });
  it('handles ASCII-only input', () => {
    expect(normalizeVi('Dai hoc Bach Khoa')).toBe('dai hoc bach khoa');
  });
});
