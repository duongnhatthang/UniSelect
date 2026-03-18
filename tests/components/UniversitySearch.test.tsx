// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UniversitySearch } from '../../components/UniversitySearch';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const mockUniversities = [
  { id: 'BKA', name_vi: '\u0110\u1ea1i h\u1ecdc B\u00e1ch khoa H\u00e0 N\u1ed9i', website_url: null },
  { id: 'NEU', name_vi: '\u0110\u1ea1i h\u1ecdc Kinh t\u1ebf Qu\u1ed1c d\u00e2n', website_url: null },
  { id: 'HUT', name_vi: 'Tr\u01b0\u1eddng \u0110\u1ea1i h\u1ecdc X\u00e2y d\u1ef1ng', website_url: null },
];

const mockTohop = {
  data: [
    { code: 'A00', subjects: ['Toan', 'Ly', 'HoaHoc'], label_vi: null },
    { code: 'D01', subjects: ['Toan', 'Van', 'Anh'], label_vi: null },
  ],
  meta: { count: 2 },
};

beforeEach(() => {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.includes('/api/universities')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          data: mockUniversities,
          meta: { count: mockUniversities.length, next_cursor: null },
        }),
      });
    }
    if (url.includes('/api/tohop')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockTohop),
      });
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
  }) as unknown as typeof fetch;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('UniversitySearch', () => {
  it('renders search input', () => {
    const { getByRole } = render(<UniversitySearch />);
    const input = getByRole('textbox');
    expect(input).not.toBeNull();
  });

  it('renders all universities after loading', async () => {
    const { getByText } = render(<UniversitySearch />);
    await waitFor(() => {
      expect(getByText('\u0110\u1ea1i h\u1ecdc B\u00e1ch khoa H\u00e0 N\u1ed9i')).not.toBeNull();
    });
    expect(getByText('\u0110\u1ea1i h\u1ecdc Kinh t\u1ebf Qu\u1ed1c d\u00e2n')).not.toBeNull();
    expect(getByText('Tr\u01b0\u1eddng \u0110\u1ea1i h\u1ecdc X\u00e2y d\u1ef1ng')).not.toBeNull();
  });

  it('filters universities when query is typed (diacritic-aware)', async () => {
    const user = userEvent.setup();
    const { getByRole, getByText, queryByText } = render(<UniversitySearch />);

    // Wait for universities to load
    await waitFor(() => {
      expect(getByText('\u0110\u1ea1i h\u1ecdc B\u00e1ch khoa H\u00e0 N\u1ed9i')).not.toBeNull();
    });

    const input = getByRole('textbox');
    // Type ASCII "bach khoa" — should match Vietnamese "Bach khoa" with diacritics
    await user.type(input, 'bach khoa');

    await waitFor(() => {
      expect(getByText('\u0110\u1ea1i h\u1ecdc B\u00e1ch khoa H\u00e0 N\u1ed9i')).not.toBeNull();
      expect(queryByText('\u0110\u1ea1i h\u1ecdc Kinh t\u1ebf Qu\u1ed1c d\u00e2n')).toBeNull();
    });
  });

  it('shows all universities when query is cleared', async () => {
    const user = userEvent.setup();
    const { getByRole, getByText } = render(<UniversitySearch />);

    await waitFor(() => {
      expect(getByText('\u0110\u1ea1i h\u1ecdc B\u00e1ch khoa H\u00e0 N\u1ed9i')).not.toBeNull();
    });

    const input = getByRole('textbox');
    await user.type(input, 'bach');
    await user.clear(input);

    await waitFor(() => {
      expect(getByText('\u0110\u1ea1i h\u1ecdc B\u00e1ch khoa H\u00e0 N\u1ed9i')).not.toBeNull();
      expect(getByText('\u0110\u1ea1i h\u1ecdc Kinh t\u1ebf Qu\u1ed1c d\u00e2n')).not.toBeNull();
    });
  });

  it('renders tohop filter dropdown with options', async () => {
    const { getByRole, getByText } = render(<UniversitySearch />);

    await waitFor(() => {
      const select = getByRole('combobox');
      expect(select).not.toBeNull();
    });

    expect(getByText('A00')).not.toBeNull();
    expect(getByText('D01')).not.toBeNull();
  });
});
