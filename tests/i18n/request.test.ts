import { describe, it, expect, vi } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(undefined),
  }),
}));

describe('i18n/request.ts resolveLocale', () => {
  it('defaults locale to vi when NEXT_LOCALE cookie is absent', async () => {
    const { resolveLocale } = await import('../../i18n/request');
    expect(resolveLocale(undefined)).toBe('vi');
  });

  it('defaults locale to vi when cookieValue is empty string', async () => {
    const { resolveLocale } = await import('../../i18n/request');
    expect(resolveLocale('')).toBe('vi');
  });

  it('returns en when cookieValue is en', async () => {
    const { resolveLocale } = await import('../../i18n/request');
    expect(resolveLocale('en')).toBe('en');
  });

  it('returns vi when cookieValue is vi', async () => {
    const { resolveLocale } = await import('../../i18n/request');
    expect(resolveLocale('vi')).toBe('vi');
  });
});
