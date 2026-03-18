// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { LocaleToggle } from '../../components/LocaleToggle';

const mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.mock('next-intl', () => ({
  useLocale: vi.fn(() => 'vi'),
  useTranslations: vi.fn(() => (key: string) => key),
}));

afterEach(() => {
  cleanup();
  mockRefresh.mockClear();
});

describe('LocaleToggle', () => {
  it('renders button with "language" key text when locale is vi', () => {
    const { getByRole } = render(<LocaleToggle />);
    const btn = getByRole('button');
    // useTranslations returns key identity in mock, so t('language') === 'language'
    expect(btn).toBeTruthy();
    expect(btn.textContent).toBe('language');
  });

  it('sets NEXT_LOCALE cookie and calls router.refresh on click', () => {
    // Mock document.cookie setter
    const cookieSetter = vi.spyOn(document, 'cookie', 'set');
    const { getByRole } = render(<LocaleToggle />);
    const btn = getByRole('button');
    fireEvent.click(btn);
    // Should have set cookie (locale was 'vi', next is 'en')
    expect(cookieSetter).toHaveBeenCalledWith(
      expect.stringContaining('NEXT_LOCALE=en')
    );
    expect(mockRefresh).toHaveBeenCalledOnce();
    cookieSetter.mockRestore();
  });
});
