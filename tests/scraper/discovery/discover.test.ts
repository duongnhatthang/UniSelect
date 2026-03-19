import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../integration/msw-server';
import { runDiscover } from '../../../scripts/discover';
import { SCORE_THRESHOLD } from '../../../lib/scraper/discovery/constants';

// Integration tests for discover.ts using MSW fake university homepages.
// All fake domains must have a robots.txt handler — Crawlee fetches /robots.txt
// before processing any page on a domain (Pitfall 2 from research).
// onUnhandledRequest: 'error' ensures zero live network requests.

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ──────────────────────────────────────────────────────────────────────────────
// HTML Fixtures
// ──────────────────────────────────────────────────────────────────────────────

const HOMEPAGE_WITH_CUTOFF_LINKS = `
<html>
<head><title>Truong Dai Hoc ABC - Trang chu</title></head>
<body>
  <nav>
    <a href="/diem-chuan-2024">Diem chuan 2024</a>
    <a href="/tin-tuc">Tin tuc</a>
    <a href="/lien-he">Lien he</a>
  </nav>
</body>
</html>`;

const CUTOFF_PAGE_WITH_TABLE = `
<html>
<head><title>Diem chuan dai hoc 2024</title></head>
<body>
  <h2>Diem chuan nam 2024</h2>
  <table>
    <thead>
      <tr><th>Ma nganh</th><th>Diem chuan</th><th>To hop</th></tr>
    </thead>
    <tbody>
      <tr><td>7480201</td><td>26.00</td><td>A00</td></tr>
      <tr><td>7480202</td><td>24.50</td><td>A01</td></tr>
    </tbody>
  </table>
</body>
</html>`;

const HOMEPAGE_B_WITH_TUYEN_SINH = `
<html>
<head><title>Truong Dai Hoc XYZ</title></head>
<body>
  <a href="/tuyen-sinh/diem-trung-tuyen">Tuyen sinh - Diem trung tuyen</a>
  <a href="/gioi-thieu">Gioi thieu</a>
</body>
</html>`;

const CUTOFF_PAGE_B = `
<html>
<head><title>Diem trung tuyen 2024 - Truong XYZ</title></head>
<body>
  <h2>Ket qua xet tuyen 2024</h2>
  <table>
    <thead>
      <tr><th>Ma nganh</th><th>Diem chuan</th></tr>
    </thead>
    <tbody>
      <tr><td>7480101</td><td>22.00</td></tr>
    </tbody>
  </table>
</body>
</html>`;

const HOMEPAGE_C_NO_CUTOFF = `
<html>
<head><title>Truong DEF - Trang chu</title></head>
<body>
  <a href="/tin-tuc">Tin tuc</a>
  <a href="/su-kien">Su kien</a>
  <a href="/lien-he">Lien he</a>
</body>
</html>`;

const ROBOTS_ALLOW_ALL = `User-agent: *\nAllow: /`;

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────

describe(
  'discover.ts integration tests (MSW fake homepages)',
  { timeout: 30_000 },
  () => {
    it('produces ranked candidates from fake homepages with cutoff links', async () => {
      server.use(
        // University A — has diem-chuan link
        http.get('https://fake-uni-a.test/', () =>
          HttpResponse.text(HOMEPAGE_WITH_CUTOFF_LINKS, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          }),
        ),
        http.get('https://fake-uni-a.test/robots.txt', () =>
          HttpResponse.text(ROBOTS_ALLOW_ALL),
        ),
        http.get('https://fake-uni-a.test/diem-chuan-2024', () =>
          HttpResponse.text(CUTOFF_PAGE_WITH_TABLE, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          }),
        ),

        // University B — has tuyen-sinh/diem-trung-tuyen link
        http.get('https://fake-uni-b.test/', () =>
          HttpResponse.text(HOMEPAGE_B_WITH_TUYEN_SINH, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          }),
        ),
        http.get('https://fake-uni-b.test/robots.txt', () =>
          HttpResponse.text(ROBOTS_ALLOW_ALL),
        ),
        http.get('https://fake-uni-b.test/tuyen-sinh/diem-trung-tuyen', () =>
          HttpResponse.text(CUTOFF_PAGE_B, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          }),
        ),

        // University C — no cutoff links at all
        http.get('https://fake-uni-c.test/', () =>
          HttpResponse.text(HOMEPAGE_C_NO_CUTOFF, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          }),
        ),
        http.get('https://fake-uni-c.test/robots.txt', () =>
          HttpResponse.text(ROBOTS_ALLOW_ALL),
        ),
      );

      const results = await runDiscover(
        [
          { url: 'https://fake-uni-a.test/', universityId: 'UNI_A' },
          { url: 'https://fake-uni-b.test/', universityId: 'UNI_B' },
          { url: 'https://fake-uni-c.test/', universityId: 'UNI_C' },
        ],
        { useMemoryStorage: true },
      );

      // Should find cutoff pages from uni A and uni B
      expect(results.length).toBeGreaterThanOrEqual(2);

      // Results must be sorted by score descending
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
      }

      // Top result must have a positive score and non-empty reasons
      expect(results[0].score).toBeGreaterThan(0);
      expect(results[0].reasons.length).toBeGreaterThan(0);

      // Results must contain cutoff page URLs
      const urls = results.map((r) => r.url);
      const hasCutoffUrl = urls.some(
        (u) => u.includes('diem-chuan') || u.includes('diem-trung-tuyen'),
      );
      expect(hasCutoffUrl).toBe(true);
    });

    it('excludes pages disallowed by robots.txt', async () => {
      server.use(
        http.get('https://fake-uni-blocked.test/', () =>
          HttpResponse.text(
            `<html><body>
              <a href="/diem-chuan-secret">Secret cutoff page</a>
            </body></html>`,
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
          ),
        ),
        // Disallow the cutoff page in robots.txt
        // If the crawler tries to fetch /diem-chuan-secret, MSW will throw
        // "Unexpected request" (onUnhandledRequest: 'error') — proving compliance
        http.get('https://fake-uni-blocked.test/robots.txt', () =>
          HttpResponse.text(
            'User-agent: *\nDisallow: /diem-chuan-secret',
          ),
        ),
      );

      const results = await runDiscover(
        [{ url: 'https://fake-uni-blocked.test/', universityId: 'BLOCKED' }],
        { useMemoryStorage: true },
      );

      const urls = results.map((r) => r.url);
      expect(urls).not.toContain('https://fake-uni-blocked.test/diem-chuan-secret');
    });

    it('filters candidates below SCORE_THRESHOLD', async () => {
      // This page has only one heading keyword (score = 1, below threshold of 3)
      const WEAK_SIGNAL_PAGE = `
        <html>
        <head><title>Tin tuc truong hoc</title></head>
        <body>
          <h3>Khoi thi tuyen sinh</h3>
          <p>Some generic news content here with no table</p>
        </body>
        </html>`;

      server.use(
        http.get('https://fake-uni-weak.test/', () =>
          HttpResponse.text(
            `<html><body>
              <a href="/tuyen-sinh/tin-tuc-tuyen-sinh">Tin tuc tuyen sinh</a>
            </body></html>`,
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
          ),
        ),
        http.get('https://fake-uni-weak.test/robots.txt', () =>
          HttpResponse.text(ROBOTS_ALLOW_ALL),
        ),
        http.get('https://fake-uni-weak.test/tuyen-sinh/tin-tuc-tuyen-sinh', () =>
          HttpResponse.text(WEAK_SIGNAL_PAGE, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          }),
        ),
      );

      const results = await runDiscover(
        [{ url: 'https://fake-uni-weak.test/', universityId: 'WEAK' }],
        { useMemoryStorage: true },
      );

      // All results must meet the threshold
      for (const r of results) {
        expect(r.score).toBeGreaterThanOrEqual(SCORE_THRESHOLD);
      }

      // The weak-signal page's URL should not appear (tuyen-sinh slug hits threshold=3 though)
      // The heading-only page itself (if scored ≤ 2) should not appear
      const weakPageUrl = 'https://fake-uni-weak.test/tuyen-sinh/tin-tuc-tuyen-sinh';
      const weakResult = results.find((r) => r.url === weakPageUrl);
      if (weakResult) {
        // If it appears, it must meet the threshold
        expect(weakResult.score).toBeGreaterThanOrEqual(SCORE_THRESHOLD);
      }
    });

    it('deduplicates URLs keeping highest score', async () => {
      // Homepage has TWO different links pointing to the SAME cutoff page
      const HOMEPAGE_DUPLICATE_LINKS = `
        <html>
        <head><title>Truong DUP</title></head>
        <body>
          <a href="/diem-chuan-2024">Diem chuan 2024</a>
          <a href="/diem-chuan-2024">Xem diem chuan nam nay</a>
        </body>
        </html>`;

      server.use(
        http.get('https://fake-uni-dup.test/', () =>
          HttpResponse.text(HOMEPAGE_DUPLICATE_LINKS, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          }),
        ),
        http.get('https://fake-uni-dup.test/robots.txt', () =>
          HttpResponse.text(ROBOTS_ALLOW_ALL),
        ),
        http.get('https://fake-uni-dup.test/diem-chuan-2024', () =>
          HttpResponse.text(CUTOFF_PAGE_WITH_TABLE, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          }),
        ),
      );

      const results = await runDiscover(
        [{ url: 'https://fake-uni-dup.test/', universityId: 'DUP' }],
        { useMemoryStorage: true },
      );

      const cutoffUrls = results.filter((r) =>
        r.url.includes('/diem-chuan-2024'),
      );

      // The cutoff page URL should appear at most once
      expect(cutoffUrls.length).toBeLessThanOrEqual(1);
    });

    it('returns empty array when no candidates found', async () => {
      const GENERIC_HOMEPAGE = `
        <html>
        <head><title>Truong Empty - Trang chu</title></head>
        <body>
          <p>Welcome to our university. We have no cutoff links here.</p>
          <a href="/about">About</a>
          <a href="/contact">Contact</a>
        </body>
        </html>`;

      server.use(
        http.get('https://fake-uni-empty.test/', () =>
          HttpResponse.text(GENERIC_HOMEPAGE, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          }),
        ),
        http.get('https://fake-uni-empty.test/robots.txt', () =>
          HttpResponse.text(ROBOTS_ALLOW_ALL),
        ),
      );

      const results = await runDiscover(
        [{ url: 'https://fake-uni-empty.test/', universityId: 'EMPTY' }],
        { useMemoryStorage: true },
      );

      expect(results).toEqual([]);
    });
  },
);
