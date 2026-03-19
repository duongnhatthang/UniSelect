import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/scraper/fetch', () => ({
  fetchHTML: vi.fn(),
}));

import { createCheerioAdapter } from '../../lib/scraper/factory';
import { fetchHTML } from '../../lib/scraper/fetch';

const htcConfig = {
  id: 'TEST-HTC',
  scoreKeywords: ['điểm trúng tuyển', 'diem trung tuyen', 'điểm chuẩn', 'diem chuan'],
  majorKeywords: ['mã ngành', 'ma nganh', 'mã xét tuyển', 'ma xet tuyen'],
  defaultTohop: 'A00',
};

// HTC-style: headers in first-row <td>, no <th>, single-tohop
const htcStyleHtml = `
<table>
  <tr><td>TT</td><td>Mã ngành</td><td>Tên ngành</td><td>Điểm trúng tuyển</td></tr>
  <tr><td>1</td><td>7340101</td><td>Quản trị kinh doanh</td><td>25.00</td></tr>
  <tr><td>2</td><td>7340201</td><td>Tài chính - Ngân hàng</td><td>24.50</td></tr>
  <tr><td>I</td><td></td><td>Chương trình chuẩn</td><td></td></tr>
</table>
`;

// Standard HTML: headers in <thead><th>, with tohop column
const standardHtml = `
<table>
  <thead><tr><th>Mã ngành</th><th>Tổ hợp</th><th>Điểm chuẩn</th></tr></thead>
  <tbody>
    <tr><td>7480201</td><td>A01</td><td>26.00</td></tr>
    <tr><td>7480202</td><td>D01</td><td>23.50</td></tr>
  </tbody>
</table>
`;

// Empty table: no data rows
const emptyHtml = `
<table><tr><td>No data available</td></tr></table>
`;

describe('createCheerioAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extracts rows from HTC-style table (headers in first-row td)', async () => {
    vi.mocked(fetchHTML).mockResolvedValue(htcStyleHtml);
    const adapter = createCheerioAdapter(htcConfig);
    const rows = await adapter.scrape('https://test.example.com');

    // Section header row ("I") should be skipped — only 2 valid rows
    expect(rows).toHaveLength(2);
    expect(rows[0].university_id).toBe('TEST-HTC');
    expect(rows[0].major_raw).toBe('7340101');
    expect(rows[0].score_raw).toBe('25.00');
    expect(rows[0].tohop_raw).toBe('A00');
    expect(rows[0].source_url).toBe('https://test.example.com');
    expect(rows[1].major_raw).toBe('7340201');
    expect(rows[1].score_raw).toBe('24.50');
    expect(rows[1].tohop_raw).toBe('A00');
  });

  it('skips section header rows with non-numeric major codes', async () => {
    vi.mocked(fetchHTML).mockResolvedValue(htcStyleHtml);
    const adapter = createCheerioAdapter(htcConfig);
    const rows = await adapter.scrape('https://test.example.com');

    // "I" row (non-numeric major code) must be absent
    const sectionHeaderRow = rows.find((r) => r.major_raw === 'I' || r.major_raw === '');
    expect(sectionHeaderRow).toBeUndefined();
    expect(rows.every((r) => /^\d/.test(r.major_raw))).toBe(true);
  });

  it('extracts tohop from column when tohopKeywords provided', async () => {
    vi.mocked(fetchHTML).mockResolvedValue(standardHtml);
    const adapter = createCheerioAdapter({
      id: 'TEST-STD',
      scoreKeywords: ['điểm chuẩn', 'diem chuan'],
      majorKeywords: ['mã ngành', 'ma nganh'],
      tohopKeywords: ['tổ hợp', 'to hop'],
    });
    const rows = await adapter.scrape('https://test.example.com');

    expect(rows).toHaveLength(2);
    expect(rows[0].tohop_raw).toBe('A01');
    expect(rows[1].tohop_raw).toBe('D01');
  });

  it('throws when no table matches (0 rows)', async () => {
    vi.mocked(fetchHTML).mockResolvedValue(emptyHtml);
    const adapter = createCheerioAdapter(htcConfig);

    await expect(adapter.scrape('https://test.example.com')).rejects.toThrow('0 rows');
  });

  it('uses th/thead headers when available and extracts rows correctly', async () => {
    vi.mocked(fetchHTML).mockResolvedValue(standardHtml);
    const adapter = createCheerioAdapter({
      id: 'TEST-TH',
      scoreKeywords: ['điểm chuẩn', 'diem chuan'],
      majorKeywords: ['mã ngành', 'ma nganh'],
      tohopKeywords: ['tổ hợp', 'to hop'],
    });
    const rows = await adapter.scrape('https://test.example.com');

    expect(rows).toHaveLength(2);
    expect(rows[0].major_raw).toBe('7480201');
    expect(rows[0].score_raw).toBe('26.00');
    expect(rows[1].major_raw).toBe('7480202');
    expect(rows[1].score_raw).toBe('23.50');
  });

  it('uses defaultTohop when no tohopKeywords configured', async () => {
    vi.mocked(fetchHTML).mockResolvedValue(htcStyleHtml);
    const adapter = createCheerioAdapter({
      id: 'TEST-DEFAULT',
      scoreKeywords: ['điểm trúng tuyển', 'diem trung tuyen', 'điểm chuẩn', 'diem chuan'],
      majorKeywords: ['mã ngành', 'ma nganh'],
      defaultTohop: 'B00',
    });
    const rows = await adapter.scrape('https://test.example.com');

    expect(rows.every((r) => r.tohop_raw === 'B00')).toBe(true);
  });
});
