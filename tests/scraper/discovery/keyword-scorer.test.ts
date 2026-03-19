import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { scorePageForCutoffs } from '../../../lib/scraper/discovery/keyword-scorer';
import {
  URL_SLUG_WEIGHT,
  TITLE_WEIGHT,
  HEADING_WEIGHT,
  TABLE_WEIGHT,
} from '../../../lib/scraper/discovery/constants';

describe('scorePageForCutoffs', () => {
  // Test 1: URL slug containing "diem-chuan" scores at least URL_SLUG_WEIGHT
  it('scores URL slug "diem-chuan" at least URL_SLUG_WEIGHT', () => {
    const html = '<html><head><title>Generic Page</title></head><body><p>nothing relevant</p></body></html>';
    const $ = cheerio.load(html);
    const result = scorePageForCutoffs('https://uni.edu.vn/diem-chuan-2024', $);
    expect(result.score).toBeGreaterThanOrEqual(URL_SLUG_WEIGHT);
  });

  // Test 2: Page title containing "diem chuan" scores at least TITLE_WEIGHT
  it('scores page title "diem chuan" at least TITLE_WEIGHT', () => {
    const html = '<html><head><title>Diem chuan nam 2024</title></head><body><p>nothing relevant</p></body></html>';
    const $ = cheerio.load(html);
    const result = scorePageForCutoffs('https://uni.edu.vn/news/2024', $);
    expect(result.score).toBeGreaterThanOrEqual(TITLE_WEIGHT);
  });

  // Test 3: h2 heading "Diem chuan 2024" scores at least HEADING_WEIGHT
  it('scores h2 heading "Diem chuan 2024" at least HEADING_WEIGHT', () => {
    const html = '<html><head><title>Generic Page</title></head><body><h2>Diem chuan 2024</h2></body></html>';
    const $ = cheerio.load(html);
    const result = scorePageForCutoffs('https://uni.edu.vn/news/2024', $);
    expect(result.score).toBeGreaterThanOrEqual(HEADING_WEIGHT);
  });

  // Test 4: Table with "Ma nganh" and "Diem chuan" headers scores TABLE_WEIGHT from table detection
  it('scores table with "Ma nganh" and "Diem chuan" headers TABLE_WEIGHT', () => {
    const html = `
      <html><head><title>Generic</title></head>
      <body>
        <table>
          <thead>
            <tr><th>Ma nganh</th><th>Ten nganh</th><th>Diem chuan</th></tr>
          </thead>
          <tbody>
            <tr><td>7480201</td><td>Computer Science</td><td>26.00</td></tr>
          </tbody>
        </table>
      </body></html>`;
    const $ = cheerio.load(html);
    const result = scorePageForCutoffs('https://uni.edu.vn/news/2024', $);
    expect(result.score).toBeGreaterThanOrEqual(TABLE_WEIGHT);
  });

  // Test 5: Full cutoff page (URL slug + title + heading + table) scores at least 11
  it('full cutoff page scores at least URL_SLUG_WEIGHT + TITLE_WEIGHT + HEADING_WEIGHT + TABLE_WEIGHT', () => {
    const html = `
      <html>
        <head><title>Diem chuan dai hoc 2024</title></head>
        <body>
          <h2>Diem chuan 2024</h2>
          <table>
            <thead>
              <tr><th>Ma nganh</th><th>Diem chuan</th></tr>
            </thead>
            <tbody>
              <tr><td>7480201</td><td>26.00</td></tr>
            </tbody>
          </table>
        </body>
      </html>`;
    const $ = cheerio.load(html);
    const result = scorePageForCutoffs('https://uni.edu.vn/diem-chuan-2024', $);
    const expectedMin = URL_SLUG_WEIGHT + TITLE_WEIGHT + HEADING_WEIGHT + TABLE_WEIGHT; // 3+2+1+5=11
    expect(result.score).toBeGreaterThanOrEqual(expectedMin);
  });

  // Test 6: Generic news page mentioning "diem chuan" only in body text scores 0
  it('generic news page with "diem chuan" only in body text scores 0', () => {
    const html = `
      <html>
        <head><title>Tin tuc hom nay</title></head>
        <body>
          <p>Hom nay chung toi thong bao ve diem chuan cua cac truong dai hoc.</p>
          <p>Xem them tin tuc ve diem chuan tai day.</p>
        </body>
      </html>`;
    const $ = cheerio.load(html);
    const result = scorePageForCutoffs('https://uni.edu.vn/tin-tuc/123', $);
    expect(result.score).toBe(0);
  });

  // Test 7: reasons array contains specific matched signal strings
  it('reasons array contains specific matched signal strings', () => {
    const html = `
      <html>
        <head><title>Diem chuan 2024</title></head>
        <body>
          <h2>Diem chuan 2024</h2>
          <table>
            <thead>
              <tr><th>Ma nganh</th><th>Diem chuan</th></tr>
            </thead>
            <tbody>
              <tr><td>7480201</td><td>26.00</td></tr>
            </tbody>
          </table>
        </body>
      </html>`;
    const $ = cheerio.load(html);
    const result = scorePageForCutoffs('https://uni.edu.vn/diem-chuan-2024', $);
    expect(result.reasons).toContain('url:diem-chuan');
    expect(result.reasons).toContain('title:diem chuan');
    expect(result.reasons).toContain('table:score-columns-detected');
  });

  // Test 8: Empty HTML page scores 0 with empty reasons array
  it('empty HTML page scores 0 with empty reasons array', () => {
    const $ = cheerio.load('');
    const result = scorePageForCutoffs('https://uni.edu.vn/', $);
    expect(result.score).toBe(0);
    expect(result.reasons).toEqual([]);
  });
});
