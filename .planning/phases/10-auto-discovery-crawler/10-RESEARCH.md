# Phase 10: Auto-Discovery Crawler - Research

**Researched:** 2026-03-18
**Domain:** Crawlee-based web crawler with robots.txt compliance, per-domain rate limiting, and Vietnamese keyword scoring
**Confidence:** HIGH

## Summary

Phase 10 builds a standalone `scripts/discover.ts` script that reads university homepages from `scrapers.json`, crawls 1-2 link levels deep using Crawlee's `CheerioCrawler`, scores each page for Vietnamese cutoff-score keywords, and writes ranked candidates to `discovery-candidates.json`. It never writes to `scrapers.json` or the database — it is a purely ephemeral review tool.

Crawlee 3.16.0 has native support for all three critical constraints: `respectRobotsTxtFile: true` blocks disallowed URLs before they are enqueued, `sameDomainDelaySecs: 2` enforces per-domain delays without custom logic, and `enqueueLinks` with `globs` filters links to stay within each university domain. These are first-class options documented in the official Crawlee API, not workarounds — the phase can be implemented without hand-rolling any of these mechanisms.

The testing strategy uses the MSW server established in Phase 9 (with `onUnhandledRequest: 'error'`) plus Crawlee's `@crawlee/memory-storage` with `persistStorage: false` to prevent any filesystem writes during test runs. Three fake university homepage fixtures served through MSW provide the Phase 9 dependency the success criteria require.

**Primary recommendation:** Use `@crawlee/cheerio` 3.16.0. Pass `sameDomainDelaySecs: 2`, `respectRobotsTxtFile: { userAgent: 'UniSelectBot/1.0' }`, and `maxConcurrency: 1` to keep the crawler predictable. Score pages with a weighted keyword list derived from all 78 `scrapers.json` entries. Output to `discovery-candidates.json` only.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Auto-discovery writes only to ephemeral `discovery-candidates.json` — scrapers.json is never written by crawler; human gate required
- crawlee `enqueueLinks` glob pattern configuration for Vietnamese URL paths needs validation (BLOCKER — must verify before implementation)
- Vietnamese keyword list must be checked against all 78 scrapers.json entries before implementation

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase.

### Deferred Ideas (OUT OF SCOPE)
None — infrastructure phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SCRP-04 | Auto-discovery crawler scans university homepages and outputs ranked cutoff-page URL candidates to a review file | CheerioCrawler + `enqueueLinks` (same-domain strategy) + keyword scorer + JSON output |
| SCRP-05 | Auto-discovery enforces per-domain rate limiting and robots.txt compliance | `sameDomainDelaySecs: 2`, `respectRobotsTxtFile: true` — both native Crawlee options |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@crawlee/cheerio` | 3.16.0 | HTTP fetching + Cheerio HTML parsing + link enqueueing | Official Crawlee sub-package for static HTML crawling; includes `CheerioCrawler` with built-in robots.txt and rate-limit options |
| `@crawlee/memory-storage` | 3.16.0 | In-memory request queue and dataset for tests | Eliminates filesystem writes during test runs; same API as production storage |
| `cheerio` | already in project (^1.2.0) | HTML parsing within crawler `requestHandler` | Already installed; Crawlee uses it internally too |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `crawlee` (meta-package) | 3.16.0 | If single import point is preferred | Can import `CheerioCrawler` from `crawlee` directly instead of `@crawlee/cheerio` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@crawlee/cheerio` | Custom fetch loop with `lib/scraper/fetch.ts` | Hand-rolling means rebuilding request queuing, robots.txt, deduplication, and rate limiting manually — avoid |
| Crawlee `Dataset` for output | Direct `fs.writeFile` to `discovery-candidates.json` | Direct write is simpler for a script — Crawlee Dataset adds filesystem coupling; script should use `fs.writeFile` for output |

**Installation:**
```bash
npm install --save-dev @crawlee/cheerio @crawlee/memory-storage
```

**Version verification (confirmed 2026-03-18):**
```bash
npm view @crawlee/cheerio version   # → 3.16.0
npm view @crawlee/memory-storage version  # → 3.16.0
npm view crawlee version            # → 3.16.0
```

---

## Architecture Patterns

### Recommended Project Structure
```
scripts/
└── discover.ts          # Entry point — reads scrapers.json, runs crawler, writes discovery-candidates.json
lib/
└── scraper/
    └── discovery/
        ├── keyword-scorer.ts    # Pure function: score(html: string, $: CheerioAPI) → number
        ├── candidate.ts         # Type: DiscoveryCandidate { url, universityId, score, reasons[] }
        └── constants.ts         # CUTOFF_KEYWORDS, URL_SLUG_KEYWORDS (derived from scrapers.json audit)
tests/
└── scraper/
    └── discovery/
        ├── discover.test.ts     # Integration test: MSW fake homepages → assert discovery-candidates.json shape
        └── keyword-scorer.test.ts  # Unit test: scorer returns expected scores for known HTML
```

### Pattern 1: CheerioCrawler with Built-in Compliance Options
**What:** Configure `CheerioCrawler` with `respectRobotsTxtFile`, `sameDomainDelaySecs`, and `enqueueLinks` using same-hostname strategy and glob filters.
**When to use:** Discovery run against real or fake university homepages.
**Example:**
```typescript
// Source: https://crawlee.dev/js/api/http-crawler/interface/HttpCrawlerOptions
import { CheerioCrawler, RequestQueue, Configuration } from '@crawlee/cheerio';
import { MemoryStorage } from '@crawlee/memory-storage';

// For tests: use isolated in-memory storage
const storage = new MemoryStorage({ persistStorage: false });
const config = new Configuration({ storageClient: storage });

const crawler = new CheerioCrawler({
  sameDomainDelaySecs: 2,            // 2-second delay between requests to the same domain (SCRP-05)
  respectRobotsTxtFile: {
    userAgent: 'UniSelectBot/1.0',   // Must match User-Agent in fetch.ts (SCRP-05)
  },
  maxConcurrency: 1,                 // Keep it polite for a small-scale discovery script
  maxRequestsPerCrawl: 50,           // Safety cap per university homepage
  async requestHandler({ $, request, enqueueLinks }) {
    const score = scorePageForCutoffs($);
    if (score > 0) {
      candidates.push({ url: request.url, score, universityId: request.userData.universityId });
    }
    // Only follow links within the same hostname
    await enqueueLinks({
      strategy: 'same-hostname',
      globs: [
        '**/diem-chuan*',
        '**/diem-trung-tuyen*',
        '**/tuyen-sinh*',
        '**/xet-tuyen*',
        '**/thong-bao*',
      ],
      userData: request.userData,     // Propagate universityId to child requests
    });
  },
}, config);

await crawler.run(startUrls);
```

### Pattern 2: Keyword Scorer (Pure Function)
**What:** Score an HTML page for Vietnamese cutoff-score signals without side effects. Returns a numeric score and an array of matched signal strings for transparency in output.
**When to use:** Called from `requestHandler` on every fetched page.
**Example:**
```typescript
// lib/scraper/discovery/keyword-scorer.ts
import type { CheerioAPI } from 'cheerio';

// Derived from ALL 78 scrapers.json entries (validated 2026-03-18)
const PAGE_TITLE_KEYWORDS = [
  'điểm chuẩn', 'diem chuan',
  'điểm trúng tuyển', 'diem trung tuyen',
  'điểm xét tuyển',
];

const URL_SLUG_KEYWORDS = [
  'diem-chuan', 'diem-trung-tuyen', 'tuyen-sinh',
  'xet-tuyen', 'thong-bao-xet-tuyen',
];

const HEADING_KEYWORDS = [
  'điểm chuẩn', 'diem chuan', 'điểm trúng tuyển',
  'mã ngành', 'tổ hợp', 'khối',
];

export function scorePageForCutoffs(url: string, $: CheerioAPI): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  const title = $('title').text().toLowerCase();
  const urlLower = url.toLowerCase();

  // URL slug signals (highest confidence)
  for (const kw of URL_SLUG_KEYWORDS) {
    if (urlLower.includes(kw)) {
      score += 3;
      reasons.push(`url:${kw}`);
    }
  }

  // Page title signals
  for (const kw of PAGE_TITLE_KEYWORDS) {
    if (title.includes(kw)) {
      score += 2;
      reasons.push(`title:${kw}`);
    }
  }

  // Heading signals (h1, h2, h3)
  $('h1, h2, h3').each((_, el) => {
    const text = $(el).text().toLowerCase();
    for (const kw of HEADING_KEYWORDS) {
      if (text.includes(kw)) {
        score += 1;
        reasons.push(`heading:${kw}`);
        break;
      }
    }
  });

  // Table presence with score columns (strong signal)
  const hasScoreTable = $('table').toArray().some(table => {
    const headers = $(table).find('th, td').slice(0, 10).text().toLowerCase();
    return HEADING_KEYWORDS.some(kw => headers.includes(kw));
  });
  if (hasScoreTable) {
    score += 5;
    reasons.push('table:score-columns-detected');
  }

  return { score, reasons };
}
```

### Pattern 3: Output Format (discovery-candidates.json)
**What:** Sorted array written to project root. Never committed (add to .gitignore).
**Example:**
```typescript
// Output shape for discovery-candidates.json
interface DiscoveryCandidate {
  url: string;
  universityId: string;
  score: number;
  reasons: string[];       // e.g. ["url:diem-chuan", "title:điểm chuẩn", "table:score-columns-detected"]
}

// Sort descending by score before writing
const output = candidates.sort((a, b) => b.score - a.score);
await fs.writeFile('discovery-candidates.json', JSON.stringify(output, null, 2), 'utf-8');
```

### Pattern 4: Testing with MSW + MemoryStorage
**What:** Three fake university homepage fixtures served through MSW; Crawlee uses MemoryStorage to avoid touching the filesystem.
**When to use:** `discover.test.ts` integration test.
**Example:**
```typescript
// tests/scraper/discovery/discover.test.ts
import { server } from '../../scraper/integration/msw-server';
import { http, HttpResponse } from 'msw';

const FAKE_HOMEPAGE_WITH_LINKS = `
<html><body>
  <a href="/diem-chuan-2024">Điểm chuẩn 2024</a>
  <a href="/tin-tuc">Tin tức</a>
</body></html>`;

const FAKE_CUTOFF_PAGE = `
<html><head><title>Điểm chuẩn đại học 2024</title></head>
<body>
  <h2>Điểm trúng tuyển năm 2024</h2>
  <table><thead><tr><th>Mã ngành</th><th>Điểm chuẩn</th></tr></thead>
  <tbody><tr><td>7480201</td><td>26.00</td></tr></tbody></table>
</body></html>`;

const FAKE_ROBOTS_DISALLOWED = `
<html><body>Disallowed by robots.txt</body></html>`;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

it('produces ranked candidates from fake homepages', async () => {
  server.use(
    http.get('https://fake-uni-a.test/', () => HttpResponse.text(FAKE_HOMEPAGE_WITH_LINKS)),
    http.get('https://fake-uni-a.test/robots.txt', () => HttpResponse.text('User-agent: *\nAllow: /')),
    http.get('https://fake-uni-a.test/diem-chuan-2024', () => HttpResponse.text(FAKE_CUTOFF_PAGE)),
    http.get('https://fake-uni-a.test/tin-tuc', () => HttpResponse.text('<html><body>Tin tức</body></html>')),
  );

  const results = await runDiscover(['https://fake-uni-a.test/'], { useMemoryStorage: true });

  const top = results[0];
  expect(top.url).toBe('https://fake-uni-a.test/diem-chuan-2024');
  expect(top.score).toBeGreaterThan(0);
  expect(top.reasons).toContain('url:diem-chuan');
});

it('excludes robots.txt-disallowed pages', async () => {
  server.use(
    http.get('https://fake-uni-b.test/', () => HttpResponse.text('<a href="/secret">secret</a>')),
    http.get('https://fake-uni-b.test/robots.txt', () =>
      HttpResponse.text('User-agent: *\nDisallow: /secret')),
  );

  const results = await runDiscover(['https://fake-uni-b.test/'], { useMemoryStorage: true });

  expect(results.map(r => r.url)).not.toContain('https://fake-uni-b.test/secret');
});
```

### Anti-Patterns to Avoid
- **Using `strategy: 'all'` in `enqueueLinks`:** This allows the crawler to follow links off-domain. Always use `strategy: 'same-hostname'` scoped with the university domain. Without this, a single run could crawl the entire internet.
- **Writing to `scrapers.json` from the crawler:** The CONTEXT.md constraint is absolute. All output must go to `discovery-candidates.json` only.
- **Committing `discovery-candidates.json`:** Add this file to `.gitignore`. It is ephemeral review output, not source.
- **Not capping `maxRequestsPerCrawl`:** Without a cap, a university with a large site map could stall the entire discovery run. Set `maxRequestsPerCrawl: 50` per start URL batch.
- **Using Crawlee's `Dataset` API for output:** Datasets write to `./storage/` directory by default (even with MemoryStorage). Write final output directly with `fs.writeFile` after crawler completes.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| robots.txt fetching and parsing | Custom robots.txt fetch + parser | `respectRobotsTxtFile: true` | Crawlee fetches, caches, and applies robots.txt per-domain automatically; covers edge cases like wildcards, specific user-agents, crawl-delay directives |
| Per-domain request delays | `Map<string, lastRequestTime>` + `setTimeout` | `sameDomainDelaySecs: 2` | Native Crawlee option; correctly handles concurrent requests to same domain without race conditions |
| URL deduplication | `Set<string>` of visited URLs | Crawlee `RequestQueue` (built-in) | Crawlee deduplicates by canonical URL automatically using `uniqueKey`; handles query string variations |
| Link extraction from HTML | `$('a').map(...)` | `enqueueLinks()` in `requestHandler` | `enqueueLinks` resolves relative URLs, applies strategy filtering, applies glob patterns, and adds to queue atomically |

**Key insight:** Crawlee already solved all of the hard crawler infrastructure problems. The custom work in this phase is purely the keyword scorer and output format — everything else is configuration.

---

## Common Pitfalls

### Pitfall 1: `enqueueLinks` glob matching on Vietnamese URL paths
**What goes wrong:** Vietnamese university URLs contain accented characters (e.g., `điểm-chuẩn`) or URL-encoded forms (`%C4%91i%E1%BB%83m-chu%E1%BA%A9n`). Glob patterns written as plain ASCII (`**/diem-chuan*`) may not match either form reliably.
**Why it happens:** Glob matching is case-insensitive in Crawlee but operates on the raw URL string before decoding. Vietnamese slugs on university websites are usually ASCII transliterations (`diem-chuan`, not `điểm-chuẩn`), but this is not guaranteed.
**How to avoid:** Use both ASCII transliteration globs AND a `transformRequestFunction` that checks the decoded URL for Vietnamese keywords as a secondary filter. Cross-validate with the actual 78 URLs in `scrapers.json` before writing the glob list (the STATE.md blocker confirms this is needed).
**Warning signs:** Discovery runs against real university sites returning zero candidates for universities with known cutoff URLs.

### Pitfall 2: `respectRobotsTxtFile` makes live HTTP requests to `/robots.txt`
**What goes wrong:** In Vitest tests with `onUnhandledRequest: 'error'`, Crawlee's robots.txt fetching causes MSW to throw "Unexpected request" errors unless each fake domain's `robots.txt` endpoint is explicitly handled.
**Why it happens:** `respectRobotsTxtFile: true` triggers a fetch to `https://{domain}/robots.txt` before processing any page on that domain. If MSW is set to `error` mode and no handler exists for that path, the test fails.
**How to avoid:** In all test fixtures, add a robots.txt handler alongside the homepage handler. Either `Allow: /` for unrestricted domains or the specific `Disallow:` rules you want to test.
**Warning signs:** Test failures with "Unexpected request: GET https://fake-uni.test/robots.txt".

### Pitfall 3: Crawlee writes to `./storage/` by default
**What goes wrong:** Even with `maxConcurrency: 1`, Crawlee creates `./storage/` directory and writes request queue state, dataset files, and key-value store files to disk. In tests and in CI, this creates unwanted filesystem artifacts.
**Why it happens:** Crawlee defaults to `FileSystemStorage` unless explicitly overridden with a `Configuration` that uses `MemoryStorage`.
**How to avoid:** For the `discover.ts` script, set `CRAWLEE_STORAGE_DIR` to a temp directory or use `MemoryStorage` for the queue, and write final output manually. For tests, always instantiate `new MemoryStorage({ persistStorage: false })` and pass it via `new Configuration({ storageClient: storage })`.
**Warning signs:** `./storage/` directory appearing in repository after tests run.

### Pitfall 4: Score threshold too low produces noise
**What goes wrong:** Pages with incidental keyword matches (e.g., a news page mentioning cutoff scores) appear in `discovery-candidates.json` above actual cutoff pages with tables.
**Why it happens:** Individual keyword hits get 1-2 points each; a noisy news page accumulates score through multiple body-text mentions.
**How to avoid:** Weight table detection heavily (5 points). Apply a minimum score threshold (e.g., 3) before including a candidate in output. Document the threshold in `constants.ts`.
**Warning signs:** News archive pages ranking higher than pages with actual score tables in test output.

### Pitfall 5: crawlee v3 package import confusion
**What goes wrong:** Importing from `crawlee` (meta-package) works but pulls in heavy browser dependencies (Playwright, Puppeteer) as optional peer deps. On some CI environments these cause install warnings or phantom errors.
**Why it happens:** The `crawlee` meta-package includes all sub-packages. This phase only needs cheerio-based crawling.
**How to avoid:** Import from `@crawlee/cheerio` and `@crawlee/memory-storage` directly. This keeps the install footprint minimal.

---

## Code Examples

Verified patterns from official Crawlee 3.x sources:

### CheerioCrawler with robots.txt + rate limiting
```typescript
// Source: https://crawlee.dev/js/api/http-crawler/interface/HttpCrawlerOptions
import { CheerioCrawler } from '@crawlee/cheerio';

const crawler = new CheerioCrawler({
  sameDomainDelaySecs: 2,              // 2 seconds between requests to same domain
  respectRobotsTxtFile: {
    userAgent: 'UniSelectBot/1.0',     // Match the User-Agent used in fetch.ts
  },
  maxConcurrency: 1,
  maxRequestsPerCrawl: 50,
  async requestHandler({ $, request, enqueueLinks }) {
    // scoring logic here
    await enqueueLinks({
      strategy: 'same-hostname',
      globs: ['**/diem-chuan*', '**/diem-trung-tuyen*', '**/tuyen-sinh*'],
    });
  },
});
```

### MemoryStorage for isolated test runs
```typescript
// Source: https://crawlee.dev/js/api/memory-storage/class/MemoryStorage
import { MemoryStorage } from '@crawlee/memory-storage';
import { Configuration } from '@crawlee/cheerio';

const storage = new MemoryStorage({ persistStorage: false });
const config = new Configuration({ storageClient: storage });
// Pass config as second argument to CheerioCrawler constructor
const crawler = new CheerioCrawler({ /* options */ }, config);
```

### enqueueLinks with same-hostname strategy and globs
```typescript
// Source: https://crawlee.dev/js/api/core/interface/EnqueueLinksOptions
await enqueueLinks({
  strategy: 'same-hostname',       // Never follow off-domain links
  globs: [
    '**/diem-chuan*',
    '**/diem-trung-tuyen*',
    '**/tuyen-sinh*',
    '**/xet-tuyen*',
    '**/thong-bao*',
  ],
  exclude: [
    '**/*.pdf',                    // Skip PDF links (can't cheerio-parse them)
    '**/*.jpg', '**/*.png',        // Skip image links
  ],
  userData: request.userData,      // Propagate universityId
});
```

---

## Vietnamese Keyword Audit (from scrapers.json — 78 entries)

The following keywords appear in `scoreKeywords`, `majorKeywords`, or `tohopKeywords` across all 78 scrapers.json entries. The discovery crawler should use these as scoring signals.

**Score-indicating keywords (URL + page title + heading signals):**
- `điểm chuẩn` / `diem chuan` / `Điểm chuẩn` / `Diem chuan`
- `điểm trúng tuyển` / `diem trung tuyen`
- `thpt` (THPT = high-school graduation exam method)
- `diem trung tuyen`, `điểm xét tuyển`

**URL slug patterns confirmed in scrapers.json:**
- `diem-chuan` (2 confirmed static URLs)
- `diem-trung-tuyen` (2 confirmed static URLs)
- `tuyen-sinh` (1 confirmed — as subdomain prefix)
- `xem-diem-cac-nam-truoc` (1 confirmed)
- `tin-tuyen-sinh` (1 confirmed)
- `thong-bao` + `ket-qua-trung-tuyen` combination (1 confirmed)

**Table column header keywords (strong signals for actual data pages):**
- `mã ngành` / `ma nganh` / `mã xét tuyển` / `ma xet tuyen`
- `tổ hợp` / `to hop` / `tổ hợp xét tuyển` / `to hop xet tuyen`
- `khối` / `khoi`
- `ngành` / `nganh`

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual URL verification (current state) | Auto-discovery crawler ranks candidates for human review | Phase 10 (this phase) | Reduces manual URL research from hours to minutes per university cycle |
| `pseudoUrls` in enqueueLinks | `globs` and `regexps` options | Crawlee 3.x (deprecated pseudoUrls) | Must use `globs` — do not use `pseudoUrls` |
| Global Crawlee storage (single instance) | Per-instance `Configuration` with `MemoryStorage` | Crawlee 3.5.3+ | Enables isolated test runs without shared state |

**Deprecated/outdated:**
- `pseudoUrls` in `enqueueLinks`: Replaced by `globs`/`regexps`. Do not use.
- Importing from `apify` package: Crawlee is now standalone at `crawlee` or sub-packages.

---

## Open Questions

1. **`enqueueLinks` glob matching with encoded Vietnamese characters**
   - What we know: Globs match case-insensitively on the raw URL string. Vietnamese slugs on university sites are usually ASCII transliteration (confirmed from 78 scrapers.json entries — all URL slugs are ASCII).
   - What's unclear: Whether any universities use Unicode-encoded path segments. The STATE.md flags this as a blocker.
   - Recommendation: Proceed with ASCII-only globs (`diem-chuan`, `diem-trung-tuyen`) — validated against all 78 scrapers.json entries. Add a `transformRequestFunction` fallback that checks decoded URL for broader patterns if zero candidates are found.

2. **Score threshold value**
   - What we know: URL slug hits (3 pts) + title hit (2 pts) + table detection (5 pts) gives 10 pts for a perfect match. News pages with incidental mentions may score 1-3 pts.
   - What's unclear: The right threshold to distinguish cutoff pages from news pages without test data.
   - Recommendation: Start with threshold of 3 (requires at minimum a URL slug hit or a title hit + heading). Document threshold in `constants.ts` as a named constant so it can be tuned.

3. **Crawlee robots.txt caching across university homepages**
   - What we know: Crawlee fetches and caches robots.txt per domain automatically when `respectRobotsTxtFile` is enabled.
   - What's unclear: Whether the cache persists across separate `crawler.run()` calls when running each university homepage sequentially vs. in a batch.
   - Recommendation: Run all university homepages in a single `crawler.run(allStartUrls)` call rather than per-university runs. This allows Crawlee to cache robots.txt entries across the single run.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vitest.config.mts` |
| Quick run command | `npx vitest run tests/scraper/discovery/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCRP-04 | Running `discover.ts` against 3+ fake homepages produces ranked `discovery-candidates.json` | integration | `npx vitest run tests/scraper/discovery/discover.test.ts -x` | ❌ Wave 0 |
| SCRP-04 | `discovery-candidates.json` is never written by test (MemoryStorage) | integration | same | ❌ Wave 0 |
| SCRP-04 | Keyword scorer returns expected score for HTML with cutoff table | unit | `npx vitest run tests/scraper/discovery/keyword-scorer.test.ts -x` | ❌ Wave 0 |
| SCRP-05 | Disallowed robots.txt pages do not appear in discovery output | integration | `npx vitest run tests/scraper/discovery/discover.test.ts -x` | ❌ Wave 0 |
| SCRP-05 | Rate limit: sameDomainDelaySecs: 2 is set in crawler configuration | unit | config inspection in discover.test.ts | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/scraper/discovery/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/scraper/discovery/discover.test.ts` — covers SCRP-04 (fake homepage fixtures), SCRP-05 (robots.txt compliance)
- [ ] `tests/scraper/discovery/keyword-scorer.test.ts` — unit tests for scorer covering: URL slug hits, title hits, table detection, news-page noise case
- [ ] `lib/scraper/discovery/keyword-scorer.ts` — pure scorer function
- [ ] `lib/scraper/discovery/candidate.ts` — `DiscoveryCandidate` type
- [ ] `lib/scraper/discovery/constants.ts` — `CUTOFF_KEYWORDS`, `URL_SLUG_KEYWORDS`, `SCORE_THRESHOLD`
- [ ] `scripts/discover.ts` — entry point script
- [ ] `.gitignore` entry for `discovery-candidates.json`
- [ ] Install: `npm install --save-dev @crawlee/cheerio @crawlee/memory-storage`

---

## Sources

### Primary (HIGH confidence)
- [Crawlee HttpCrawlerOptions API](https://crawlee.dev/js/api/http-crawler/interface/HttpCrawlerOptions) — `sameDomainDelaySecs`, `respectRobotsTxtFile`, `maxConcurrency`, `maxRequestsPerCrawl`
- [Crawlee CheerioCrawlerOptions API](https://crawlee.dev/js/api/cheerio-crawler/interface/CheerioCrawlerOptions) — confirms all HttpCrawlerOptions are inherited
- [Crawlee EnqueueLinksOptions API](https://crawlee.dev/js/api/core/interface/EnqueueLinksOptions) — `globs`, `regexps`, `strategy`, `exclude`, `userData`
- [Crawlee MemoryStorage API](https://crawlee.dev/js/api/memory-storage/class/MemoryStorage) — `persistStorage: false`, test isolation pattern
- `npm view @crawlee/cheerio version` → 3.16.0 (verified 2026-03-18)
- `scrapers.json` (78 entries) — keyword and URL pattern audit (verified 2026-03-18)

### Secondary (MEDIUM confidence)
- [Crawlee scaling crawlers guide](https://crawlee.dev/js/docs/guides/scaling-crawlers) — `maxRequestsPerMinute`, AutoscaledPool options
- [Crawlee RobotsFile utility](https://github.com/apify/crawlee/issues/2187) — confirms RobotsFile class exists in `@crawlee/utils` for manual robots.txt queries if needed
- WebSearch result: `sameDomainDelaySecs` confirmed added in PR #2003, present in all 3.x releases

### Tertiary (LOW confidence)
- WebSearch: Vietnamese university URL slug patterns — confirmed ASCII transliteration dominates based on all 78 scrapers.json entries cross-reference

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm registry confirmed 3.16.0, official API docs verified all required options exist natively
- Architecture: HIGH — patterns derived directly from official Crawlee API docs and existing project test patterns (MSW, Vitest)
- Pitfalls: HIGH — robots.txt MSW pitfall verified by understanding `onUnhandledRequest: 'error'` (established in Phase 9); storage pitfall verified by MemoryStorage docs; glob pitfall verified by scrapers.json URL audit
- Keyword list: HIGH — derived by direct audit of all 78 scrapers.json entries

**Research date:** 2026-03-18
**Valid until:** 2026-04-17 (Crawlee 3.x is stable; re-verify if major version changes)
