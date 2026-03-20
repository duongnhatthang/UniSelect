import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mocks must be defined before any imports that use them
const { mockReadFileSync, mockCreateCheerioAdapter } = vi.hoisted(() => {
  const mockReadFileSync = vi.fn();
  const mockCreateCheerioAdapter = vi.fn();
  return { mockReadFileSync, mockCreateCheerioAdapter };
});

vi.mock('fs', () => ({
  readFileSync: mockReadFileSync,
}));

vi.mock('../../lib/scraper/factory', () => ({
  createCheerioAdapter: mockCreateCheerioAdapter,
}));

// Fixture: scrapers.json test data
const FIXTURE_ENTRIES = [
  {
    id: 'TST1',
    adapter: 'tst1',
    website_url: 'https://example.com',
    scrape_url: 'https://example.com/cutoff',
    adapter_type: 'cheerio',
    factory_config: { scoreKeywords: ['diem'], majorKeywords: ['nganh'] },
  },
  {
    id: 'TST2',
    adapter: 'tst2',
    website_url: 'https://example2.com',
    scrape_url: null,
    adapter_type: 'pending',
  },
  {
    id: 'SKIP1',
    adapter: 'skip1',
    website_url: 'https://skip.com',
    scrape_url: 'https://skip.com/cutoff',
    adapter_type: 'skip',
  },
  {
    id: 'MINISTRY',
    adapter: 'ministry',
    website_url: 'https://thisinh.thitotnghiepthpt.edu.vn/',
    scrape_url: null,
    adapter_type: 'skip',
    note: 'Ministry portal',
  },
];

// A mock ScraperAdapter returned by createCheerioAdapter
const makeMockAdapter = (id: string) => ({
  id,
  scrape: vi.fn().mockResolvedValue([]),
});

describe('loadRegistry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    mockReadFileSync.mockReturnValue(JSON.stringify(FIXTURE_ENTRIES));

    // createCheerioAdapter returns a mock adapter whose id matches entry.id
    mockCreateCheerioAdapter.mockImplementation((config: { id: string }) =>
      makeMockAdapter(config.id)
    );
  });

  it('loads entries where scrape_url is non-null and adapter_type is not skip', async () => {
    const { loadRegistry } = await import('../../lib/scraper/registry');
    const resolved = await loadRegistry();

    const ids = resolved.map((r) => r.id);
    expect(ids).toContain('TST1');
  });

  it('skips entries where scrape_url is null and logs a no scrape_url message', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { loadRegistry } = await import('../../lib/scraper/registry');
    const resolved = await loadRegistry();

    const ids = resolved.map((r) => r.id);
    expect(ids).not.toContain('TST2');

    const logMessages = consoleSpy.mock.calls.map((args) => args.join(' '));
    const hasNoscrapeMsg = logMessages.some((msg) => msg.includes('no scrape_url'));
    expect(hasNoscrapeMsg).toBe(true);

    consoleSpy.mockRestore();
  });

  it('skips entries where adapter_type is skip even when scrape_url is set', async () => {
    const { loadRegistry } = await import('../../lib/scraper/registry');
    const resolved = await loadRegistry();

    const ids = resolved.map((r) => r.id);
    expect(ids).not.toContain('SKIP1');
  });

  it('uses scrape_url (not website_url) as the url passed to the resolved entry', async () => {
    const { loadRegistry } = await import('../../lib/scraper/registry');
    const resolved = await loadRegistry();

    const tst1 = resolved.find((r) => r.id === 'TST1');
    expect(tst1).toBeDefined();
    expect(tst1!.url).toBe('https://example.com/cutoff');
    expect(tst1!.url).not.toBe('https://example.com');
  });

  it('never loads the MINISTRY entry with adapter_type skip', async () => {
    const { loadRegistry } = await import('../../lib/scraper/registry');
    const resolved = await loadRegistry();

    const ids = resolved.map((r) => r.id);
    expect(ids).not.toContain('MINISTRY');
  });
});
