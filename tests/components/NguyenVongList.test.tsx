// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { NguyenVongList } from '../../components/NguyenVongList';
import type { NvItem } from '../../components/NguyenVongList';
import type { RecommendResult } from '../../lib/recommend/types';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// Cutoffs that produce each tier with userScore=22:
// dream: cutoff=27 (diff=22-27=-5), practical: cutoff=22 (diff=0), safe: cutoff=18 (diff=4)
const TIER_CUTOFFS: Record<string, number> = { dream: 27, practical: 22, safe: 18 };

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
    weighted_cutoff: TIER_CUTOFFS[tier] ?? 22,
    tier,
    trend: 'stable',
    data_years_limited: false,
    years_available: 3,
    suggested_top_15,
    scraped_at: null,
    source_url: null,
  };
}

function makeNvItem(id: string): NvItem {
  return { u: id, m: `major-${id}` };
}

describe('NguyenVongList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders empty state when nguyenVong is empty', () => {
    const { container } = render(
      <NguyenVongList
        nguyenVong={[]}
        setNguyenVong={vi.fn()}
        results={[]}
        userScore={22.0}
      />
    );
    // Shows the addToList key as empty state message
    expect(container.textContent).toContain('addToList');
  });

  it('renders items from nguyenVong list', () => {
    const results = [
      makeResult('u1', 'dream', true),
      makeResult('u2', 'practical', true),
    ];
    const nguyenVong = [makeNvItem('u1'), makeNvItem('u2')];
    render(
      <NguyenVongList
        nguyenVong={nguyenVong}
        setNguyenVong={vi.fn()}
        results={results}
        userScore={22.0}
      />
    );
    expect(screen.getByText('Truong u1')).toBeDefined();
    expect(screen.getByText('Truong u2')).toBeDefined();
  });

  it('does not render items not in nguyenVong', () => {
    const results = [
      makeResult('u1', 'dream', true),
      makeResult('u2', 'practical', true),
      makeResult('u3', 'safe', false),
    ];
    const nguyenVong = [makeNvItem('u1'), makeNvItem('u2')];
    render(
      <NguyenVongList
        nguyenVong={nguyenVong}
        setNguyenVong={vi.fn()}
        results={results}
        userScore={22.0}
      />
    );
    expect(screen.queryByText('Truong u3')).toBeNull();
  });

  it('renders rank numbers 1 through N for items', () => {
    const results = Array.from({ length: 5 }, (_, i) =>
      makeResult(`u${i + 1}`, 'practical', true)
    );
    const nguyenVong = results.map(r => makeNvItem(r.university_id));
    render(
      <NguyenVongList
        nguyenVong={nguyenVong}
        setNguyenVong={vi.fn()}
        results={results}
        userScore={22.0}
      />
    );
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
    const nguyenVong = results.map(r => makeNvItem(r.university_id));
    render(
      <NguyenVongList
        nguyenVong={nguyenVong}
        setNguyenVong={vi.fn()}
        results={results}
        userScore={22.0}
      />
    );
    // TierBadge renders the tier text (mocked as key)
    expect(screen.getAllByText('dream').length).toBeGreaterThan(0);
    expect(screen.getAllByText('practical').length).toBeGreaterThan(0);
    expect(screen.getAllByText('safe').length).toBeGreaterThan(0);
  });

  it('limits display to 15 items even if more are in nguyenVong', () => {
    const results = Array.from({ length: 20 }, (_, i) =>
      makeResult(`u${i + 1}`, 'practical', true)
    );
    const nguyenVong = results.map(r => makeNvItem(r.university_id));
    render(
      <NguyenVongList
        nguyenVong={nguyenVong}
        setNguyenVong={vi.fn()}
        results={results}
        userScore={22.0}
      />
    );
    const rankSpans = document.querySelectorAll('[data-testid="nv-rank"]');
    expect(rankSpans.length).toBe(15);
    const rankTexts = Array.from(rankSpans).map(s => s.textContent?.trim());
    expect(rankTexts).toContain('15');
    expect(rankTexts).not.toContain('16');
  });

  it('shows Practical tier grouping header when nguyenVong has 6+ items', () => {
    const results = Array.from({ length: 8 }, (_, i) =>
      makeResult(`u${i + 1}`, 'practical', true)
    );
    const nguyenVong = results.map(r => makeNvItem(r.university_id));
    render(
      <NguyenVongList
        nguyenVong={nguyenVong}
        setNguyenVong={vi.fn()}
        results={results}
        userScore={22.0}
      />
    );
    // The tierPractical key is used in tier grouping header
    const headers = screen.getAllByText(/tierPractical/);
    expect(headers.length).toBeGreaterThan(0);
  });

  it('calls setNguyenVong when moveUp button is clicked', () => {
    const setNguyenVong = vi.fn();
    const results = [
      makeResult('u1', 'dream', true),
      makeResult('u2', 'practical', true),
    ];
    const nguyenVong = [makeNvItem('u1'), makeNvItem('u2')];
    render(
      <NguyenVongList
        nguyenVong={nguyenVong}
        setNguyenVong={setNguyenVong}
        results={results}
        userScore={22.0}
      />
    );
    const moveUpButtons = screen.getAllByLabelText('moveUp');
    // Second item's moveUp should be enabled
    moveUpButtons[1].click();
    expect(setNguyenVong).toHaveBeenCalledWith([makeNvItem('u2'), makeNvItem('u1')]);
  });

  it('calls setNguyenVong when remove button is clicked', () => {
    const setNguyenVong = vi.fn();
    const results = [
      makeResult('u1', 'dream', true),
      makeResult('u2', 'practical', true),
    ];
    const nguyenVong = [makeNvItem('u1'), makeNvItem('u2')];
    render(
      <NguyenVongList
        nguyenVong={nguyenVong}
        setNguyenVong={setNguyenVong}
        results={results}
        userScore={22.0}
      />
    );
    const removeButtons = screen.getAllByLabelText('removeFromList');
    removeButtons[0].click();
    expect(setNguyenVong).toHaveBeenCalledWith([makeNvItem('u2')]);
  });
});
