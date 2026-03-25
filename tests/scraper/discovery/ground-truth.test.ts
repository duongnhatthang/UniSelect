import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as cheerio from 'cheerio';

// Mock the seed file path before importing
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: vi.fn((path: string) => {
      if (path.includes('tuyensinh247-scores.json')) return true;
      return actual.existsSync(path);
    }),
    readFileSync: vi.fn((path: string, encoding?: string) => {
      if (typeof path === 'string' && path.includes('tuyensinh247-scores.json')) {
        return JSON.stringify([
          { university_id: 'HTC', major_raw: '7310101', tohop_raw: 'A00', year: 2025, score_raw: '25.43' },
          { university_id: 'HTC', major_raw: '7220201', tohop_raw: 'A01', year: 2025, score_raw: '24.10' },
          { university_id: 'HTC', major_raw: '7340115', tohop_raw: 'A00', year: 2025, score_raw: '26.23' },
          { university_id: 'HTC', major_raw: '7310102', tohop_raw: 'A00', year: 2025, score_raw: '24.92' },
          { university_id: 'BKA', major_raw: '7480201', tohop_raw: 'A00', year: 2025, score_raw: '28.50' },
        ]);
      }
      return actual.readFileSync(path, encoding as BufferEncoding);
    }),
  };
});

// Must import AFTER mocks
const { scorePageByGroundTruth, loadGroundTruth, MIN_MATCHES } = await import(
  '../../../lib/scraper/discovery/ground-truth'
);

describe('ground-truth scoring', () => {
  beforeEach(() => {
    // Reset cached ground truth by re-loading
    // The module caches internally, but mocks ensure consistent data
  });

  it('loads ground truth data from seed file', () => {
    const truth = loadGroundTruth();
    expect(truth.size).toBeGreaterThan(0);
    expect(truth.has('HTC')).toBe(true);
    expect(truth.has('BKA')).toBe(true);
  });

  it('scores page with 3+ matching score-major pairs as ground-truth match', () => {
    const html = `
      <html><body>
        <table>
          <tr><th>Mã ngành</th><th>Điểm chuẩn</th></tr>
          <tr><td>7310101</td><td>25.43</td></tr>
          <tr><td>7220201</td><td>24.10</td></tr>
          <tr><td>7340115</td><td>26.23</td></tr>
        </table>
      </body></html>
    `;
    const $ = cheerio.load(html);
    const result = scorePageByGroundTruth('HTC', $ as cheerio.CheerioAPI);

    expect(result.matches).toBeGreaterThanOrEqual(MIN_MATCHES);
    expect(result.score).toBeGreaterThan(0);
    expect(result.reasons.some((r: string) => r.includes('ground-truth'))).toBe(true);
  });

  it('does not score page with fewer than MIN_MATCHES matches', () => {
    const html = `
      <html><body>
        <table>
          <tr><th>Mã ngành</th><th>Điểm chuẩn</th></tr>
          <tr><td>7310101</td><td>25.43</td></tr>
          <tr><td>9999999</td><td>15.00</td></tr>
        </table>
      </body></html>
    `;
    const $ = cheerio.load(html);
    const result = scorePageByGroundTruth('HTC', $ as cheerio.CheerioAPI);

    expect(result.score).toBe(0);
    expect(result.matches).toBeLessThan(MIN_MATCHES);
  });

  it('returns zero for university not in ground truth', () => {
    const html = `<html><body><table><tr><td>7310101</td><td>25.43</td></tr></table></body></html>`;
    const $ = cheerio.load(html);
    const result = scorePageByGroundTruth('UNKNOWN', $ as cheerio.CheerioAPI);

    expect(result.score).toBe(0);
    expect(result.matches).toBe(0);
  });

  it('returns zero for page with no score-like numbers', () => {
    const html = `<html><body><p>Welcome to the university homepage</p></body></html>`;
    const $ = cheerio.load(html);
    const result = scorePageByGroundTruth('HTC', $ as cheerio.CheerioAPI);

    expect(result.score).toBe(0);
  });
});
