import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './msw-server';
import { createCheerioAdapter } from '../../../lib/scraper/factory';
import { GENERIC_TABLE_HTML } from '../../fixtures/generic-table';
import { NO_THEAD_HEADERS_HTML } from '../../fixtures/no-thead-headers';
import { COMMA_DECIMAL_HTML } from '../../fixtures/comma-decimal';
import { WINDOWS_1252_BODY } from '../../fixtures/windows-1252';
import { BROKEN_TABLE_HTML } from '../../fixtures/broken-table';
import { RENAMED_HEADERS_HTML } from '../../fixtures/renamed-headers';
import { JS_STUB_HTML } from '../../fixtures/js-stub';

// This tests the real fetchHTML -> chardet -> iconv -> cheerio pipeline
// with MSW intercepting native fetch at the Node level.
// No mocking is used — real fetchHTML is exercised end-to-end.

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('cheerio adapter integration tests (MSW-intercepted, no live requests)', () => {
  it('parses generic thead/th table', async () => {
    server.use(
      http.get('https://fake.test/generic', () =>
        HttpResponse.text(GENERIC_TABLE_HTML, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      )
    );

    const adapter = createCheerioAdapter({
      id: 'TEST-GENERIC',
      scoreKeywords: ['điểm chuẩn'],
      majorKeywords: ['mã ngành'],
      tohopKeywords: ['tổ hợp'],
    });

    const rows = await adapter.scrape('https://fake.test/generic');

    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows[0].score_raw).toBe('26.00');
    expect(rows[0].tohop_raw).not.toBe('');
  });

  it('parses no-thead headers (first-row td)', async () => {
    server.use(
      http.get('https://fake.test/no-thead', () =>
        HttpResponse.text(NO_THEAD_HEADERS_HTML, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      )
    );

    const adapter = createCheerioAdapter({
      id: 'TEST-NOTHEAD',
      scoreKeywords: ['điểm trúng tuyển', 'điểm chuẩn'],
      majorKeywords: ['mã ngành'],
      defaultTohop: 'A00',
    });

    const rows = await adapter.scrape('https://fake.test/no-thead');

    expect(rows.length).toBeGreaterThanOrEqual(1);
    // Section header row ("I") must be excluded — all major_raw must start with digit
    expect(rows.every((r) => /^\d/.test(r.major_raw))).toBe(true);
    expect(rows[0].major_raw).toMatch(/^7/);
  });

  it('preserves comma-decimal scores in score_raw', async () => {
    server.use(
      http.get('https://fake.test/comma', () =>
        HttpResponse.text(COMMA_DECIMAL_HTML, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      )
    );

    const adapter = createCheerioAdapter({
      id: 'TEST-COMMA',
      scoreKeywords: ['điểm chuẩn'],
      majorKeywords: ['mã ngành'],
      tohopKeywords: ['tổ hợp'],
    });

    const rows = await adapter.scrape('https://fake.test/comma');

    expect(rows.length).toBeGreaterThanOrEqual(1);
    // Score must preserve the comma — not converted to dot
    expect(rows[0].score_raw).toMatch(/,/);
  });

  it('decodes windows-1252 charset via iconv path', async () => {
    server.use(
      http.get('https://fake.test/win1252', () =>
        new HttpResponse(WINDOWS_1252_BODY, {
          headers: { 'Content-Type': 'text/html; charset=windows-1252' },
        })
      )
    );

    const adapter = createCheerioAdapter({
      id: 'TEST-WIN1252',
      scoreKeywords: ['diem chuan', 'điểm chuẩn'],
      majorKeywords: ['ma nganh', 'mã ngành'],
      tohopKeywords: ['to hop', 'tổ hợp'],
    });

    // Critical test: iconv decodes the Buffer and cheerio parses the result
    const rows = await adapter.scrape('https://fake.test/win1252');

    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it('throws on broken table (no score column match)', async () => {
    server.use(
      http.get('https://fake.test/broken', () =>
        HttpResponse.text(BROKEN_TABLE_HTML, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      )
    );

    const adapter = createCheerioAdapter({
      id: 'TEST-BROKEN',
      scoreKeywords: ['điểm chuẩn', 'điểm trúng tuyển'],
      majorKeywords: ['mã ngành'],
    });

    await expect(
      adapter.scrape('https://fake.test/broken')
    ).rejects.toThrow(/0 rows/);
  });

  it('parses renamed keyword headers', async () => {
    server.use(
      http.get('https://fake.test/renamed', () =>
        HttpResponse.text(RENAMED_HEADERS_HTML, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      )
    );

    const adapter = createCheerioAdapter({
      id: 'TEST-RENAMED',
      scoreKeywords: ['điểm trúng tuyển', 'điểm chuẩn'],
      majorKeywords: ['mã xét tuyển', 'mã ngành'],
      tohopKeywords: ['tổ hợp xét tuyển', 'tổ hợp'],
    });

    const rows = await adapter.scrape('https://fake.test/renamed');

    expect(rows.length).toBeGreaterThanOrEqual(1);
    // Score must be a numeric string (dot decimal or comma decimal)
    expect(rows[0].score_raw).toMatch(/^\d+[.,]\d+$/);
  });

  it('throws on JS-stub page (no table)', async () => {
    server.use(
      http.get('https://fake.test/js-stub', () =>
        HttpResponse.text(JS_STUB_HTML, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      )
    );

    const adapter = createCheerioAdapter({
      id: 'TEST-JS-STUB',
      scoreKeywords: ['điểm chuẩn', 'điểm trúng tuyển'],
      majorKeywords: ['mã ngành'],
    });

    await expect(
      adapter.scrape('https://fake.test/js-stub')
    ).rejects.toThrow(/0 rows/);
  });
});
