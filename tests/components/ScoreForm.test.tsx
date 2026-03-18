// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ScoreForm } from '../../components/ScoreForm';

// Mock nuqs — make useQueryStates return mutable state
let mockState = { tohop: '', score: null as number | null, mode: 'quick' };

vi.mock('nuqs', () => {
  const setMockState = (updates: Partial<typeof mockState>) => {
    mockState = { ...mockState, ...updates };
  };

  return {
    useQueryStates: vi.fn(() => [mockState, setMockState]),
    useQueryState: vi.fn(() => [null, vi.fn()]),
    parseAsString: { withDefault: (d: string) => d },
    parseAsFloat: { withDefault: (d: number) => d },
    parseAsJson: () => ({ withDefault: (d: unknown) => d }),
  };
});

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock fetch
const mockTohopData = {
  data: [
    { code: 'A00', subjects: ['Toan', 'Ly', 'Hoa'] },
    { code: 'B00', subjects: ['Toan', 'HoaHoc', 'SinhHoc'] },
  ],
};
const mockRecommendData = {
  data: [],
  meta: { count: 0, years_available: [] },
};

beforeEach(() => {
  mockState = { tohop: '', score: null, mode: 'quick' };
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if ((url as string).includes('/api/tohop')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockTohopData),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockRecommendData),
    });
  }) as unknown as typeof fetch;
});

describe('ScoreForm', () => {
  it('renders quick mode and detailed mode tabs', async () => {
    render(<ScoreForm />);
    await waitFor(() => {
      expect(screen.getByText('quickMode')).toBeDefined();
      expect(screen.getByText('detailedMode')).toBeDefined();
    });
  });

  it('renders tohop dropdown in quick mode', async () => {
    render(<ScoreForm />);
    await waitFor(() => {
      const selects = document.querySelectorAll('select');
      expect(selects.length).toBeGreaterThan(0);
    });
  });

  it('shows score input in quick mode', async () => {
    render(<ScoreForm />);
    await waitFor(() => {
      const inputs = document.querySelectorAll('input[type="number"]');
      expect(inputs.length).toBeGreaterThan(0);
    });
  });

  it('component renders without crashing', async () => {
    const { container } = render(<ScoreForm />);
    expect(container).toBeDefined();
  });
});
