// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { NguyenVongList } from '../../components/NguyenVongList';
import type { RecommendResult } from '../../lib/recommend/types';

// Mock nuqs
vi.mock('nuqs', () => ({
  useQueryState: vi.fn(() => [null, vi.fn()]),
  parseAsJson: () => ({ withDefault: (_d: unknown) => _d }),
}));

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

function makeResult(
  id: string,
  tier: RecommendResult['tier'],
  suggested_top_15: boolean
): RecommendResult {
  return {
    university_id: id,
    university_name_vi: `Truong ${id}`,
    major_id: `major-${id}`,
    major_name_vi: `Nganh ${id}`,
    tohop_code: 'A00',
    weighted_cutoff: 24.0,
    tier,
    trend: 'stable',
    data_years_limited: false,
    years_available: 3,
    suggested_top_15,
    scraped_at: null,
    source_url: null,
  };
}

describe('NguyenVongList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing when there are no suggested_top_15 results', () => {
    const results = [
      makeResult('u1', 'practical', false),
      makeResult('u2', 'safe', false),
    ];
    const { container } = render(<NguyenVongList results={results} userScore={22.0} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders only suggested_top_15 items', () => {
    const results = [
      makeResult('u1', 'dream', true),
      makeResult('u2', 'practical', true),
      makeResult('u3', 'safe', false), // not in top15
    ];
    render(<NguyenVongList results={results} userScore={22.0} />);
    expect(screen.getByText('Truong u1')).toBeDefined();
    expect(screen.getByText('Truong u2')).toBeDefined();
    // u3 is not suggested_top_15
    expect(screen.queryByText('Truong u3')).toBeNull();
  });

  it('renders rank numbers 1 through N for top 15 items', () => {
    const results = Array.from({ length: 5 }, (_, i) =>
      makeResult(`u${i + 1}`, 'practical', true)
    );
    render(<NguyenVongList results={results} userScore={22.0} />);
    const rankSpans = document.querySelectorAll('[data-testid="nv-rank"]');
    expect(rankSpans.length).toBe(5);
    const rankTexts = Array.from(rankSpans).map(s => s.textContent?.trim());
    expect(rankTexts).toContain('1');
    expect(rankTexts).toContain('5');
  });

  it('renders tier badges for each item', () => {
    const results = [
      makeResult('u1', 'dream', true),
      makeResult('u2', 'practical', true),
      makeResult('u3', 'safe', true),
    ];
    render(<NguyenVongList results={results} userScore={22.0} />);
    // TierBadge renders the tier text
    expect(screen.getAllByText('dream').length).toBeGreaterThan(0);
    expect(screen.getAllByText('practical').length).toBeGreaterThan(0);
    expect(screen.getAllByText('safe').length).toBeGreaterThan(0);
  });

  it('limits display to 15 items even if more are marked suggested_top_15', () => {
    const results = Array.from({ length: 20 }, (_, i) =>
      makeResult(`u${i + 1}`, 'practical', true)
    );
    render(<NguyenVongList results={results} userScore={22.0} />);
    const rankSpans = document.querySelectorAll('[data-testid="nv-rank"]');
    expect(rankSpans.length).toBe(15);
    const rankTexts = Array.from(rankSpans).map(s => s.textContent?.trim());
    expect(rankTexts).toContain('15');
    expect(rankTexts).not.toContain('16');
  });
});
