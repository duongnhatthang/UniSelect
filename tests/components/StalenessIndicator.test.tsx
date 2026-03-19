// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { StalenessIndicator } from '../../components/StalenessIndicator';

afterEach(() => {
  cleanup();
});

// Mock next-intl hooks
vi.mock('next-intl', () => ({
  useLocale: () => 'vi',
  useTranslations: () => (key: string) => key,
}));

describe('StalenessIndicator', () => {
  it('returns null when scrapedAt is null', () => {
    const { container } = render(
      <StalenessIndicator scrapedAt={null} sourceUrl={null} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders relative time for a valid scrapedAt', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    render(<StalenessIndicator scrapedAt={twoDaysAgo} sourceUrl={null} />);
    const timeEl = document.querySelector('time');
    expect(timeEl).not.toBeNull();
    expect(timeEl?.getAttribute('dateTime')).toBe(twoDaysAgo.toISOString());
    expect(timeEl?.textContent?.length).toBeGreaterThan(0);
  });

  it('renders source link when sourceUrl is provided', () => {
    const recent = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    render(
      <StalenessIndicator scrapedAt={recent} sourceUrl="https://example.com/score" />
    );
    const link = screen.getByRole('link');
    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toBe('https://example.com/score');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('shows amber stale badge when scrapedAt is older than 90 days', () => {
    const ninetyOneDaysAgo = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000);
    render(
      <StalenessIndicator scrapedAt={ninetyOneDaysAgo} sourceUrl={null} />
    );
    // The translation mock returns the key 'dataOutdated' as the label
    expect(screen.getByText('dataOutdated')).not.toBeNull();
  });

  it('does not show amber badge when scrapedAt is within 90 days', () => {
    const recentDate = new Date(Date.now() - 89 * 24 * 60 * 60 * 1000);
    render(
      <StalenessIndicator scrapedAt={recentDate} sourceUrl={null} />
    );
    expect(screen.queryByText('dataOutdated')).toBeNull();
  });
});
