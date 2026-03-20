import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

vi.mock('../../lib/scraper/fetch', () => ({
  fetchHTML: vi.fn(),
}));

import { createCheerioAdapter } from '../../lib/scraper/factory';
import { fetchHTML } from '../../lib/scraper/fetch';

const wideTableFixture = readFileSync(
  join(__dirname, 'fixtures/wide-table.html'),
  'utf-8'
);

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

const wideTableConfig = {
  id: 'TEST-WIDE',
  scoreKeywords: ['diem chuan'],
  majorKeywords: ['ma nganh', 'mã ngành'],
  wideTable: true,
};

describe('createCheerioAdapter — wide-table', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('wide-table produces one row per major per to hop column', async () => {
    vi.mocked(fetchHTML).mockResolvedValue(wideTableFixture);
    const adapter = createCheerioAdapter(wideTableConfig);
    const rows = await adapter.scrape('https://test.example.com');

    expect(rows).toHaveLength(4);
    expect(rows[0].major_raw).toBe('7480201');
    expect(rows[0].tohop_raw).toBe('A00');
    expect(rows[0].score_raw).toBe('27.50');
    expect(rows[1].major_raw).toBe('7480201');
    expect(rows[1].tohop_raw).toBe('A01');
    expect(rows[1].score_raw).toBe('26.75');
    expect(rows[2].major_raw).toBe('7520201');
    expect(rows[2].tohop_raw).toBe('A00');
    expect(rows[2].score_raw).toBe('25.00');
    expect(rows[3].major_raw).toBe('7520201');
    expect(rows[3].tohop_raw).toBe('D01');
    expect(rows[3].score_raw).toBe('24.50');
  });

  it('empty to hop cells are skipped — no rows with empty score_raw', async () => {
    vi.mocked(fetchHTML).mockResolvedValue(wideTableFixture);
    const adapter = createCheerioAdapter(wideTableConfig);
    const rows = await adapter.scrape('https://test.example.com');

    expect(rows.every((r) => r.score_raw !== '')).toBe(true);
    // Specifically, D01 for 7480201 and A01 for 7520201 must be absent
    const d01ForCntt = rows.find((r) => r.major_raw === '7480201' && r.tohop_raw === 'D01');
    const a01ForKtdt = rows.find((r) => r.major_raw === '7520201' && r.tohop_raw === 'A01');
    expect(d01ForCntt).toBeUndefined();
    expect(a01ForKtdt).toBeUndefined();
  });

  it('wideTable false still processes narrow-table (regression)', async () => {
    vi.mocked(fetchHTML).mockResolvedValue(standardHtml);
    const adapter = createCheerioAdapter({
      id: 'TEST-NARROW',
      scoreKeywords: ['điểm chuẩn', 'diem chuan'],
      majorKeywords: ['mã ngành', 'ma nganh'],
      tohopKeywords: ['tổ hợp', 'to hop'],
      wideTable: false,
    });
    const rows = await adapter.scrape('https://test.example.com');

    expect(rows).toHaveLength(2);
    expect(rows[0].major_raw).toBe('7480201');
    expect(rows[1].major_raw).toBe('7480202');
  });

  it('wide-table with no matching to hop headers throws 0-rows error', async () => {
    const noTohopHtml = `
<table>
  <thead>
    <tr><th>Mã ngành</th><th>Tên ngành</th><th>Ghi chú</th></tr>
  </thead>
  <tbody>
    <tr><td>7480201</td><td>Công nghệ thông tin</td><td>Chỉ tiêu: 50</td></tr>
  </tbody>
</table>
`;
    vi.mocked(fetchHTML).mockResolvedValue(noTohopHtml);
    const adapter = createCheerioAdapter(wideTableConfig);

    await expect(adapter.scrape('https://test.example.com')).rejects.toThrow('0 rows');
  });
});
