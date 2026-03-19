# Architecture Research

**Domain:** Vietnamese university admissions data aggregation PWA — v2.0 integration
**Researched:** 2026-03-18
**Confidence:** HIGH (derived directly from reading the existing codebase, not from web search)

> This document supersedes the v1.0 architecture research (2026-03-17). It focuses exclusively on how the five new v2.0 feature areas integrate with the existing system. Unchanged parts of the architecture are not repeated here.

---

## Current System Overview (as-built v1.0)

```
┌─────────────────────────────────────────────────────────────────┐
│  GITHUB ACTIONS (scraping pipeline)                             │
│                                                                 │
│  run.ts → loadRegistry() → runScraper() → DB upsert (N+1)      │
│              scrapers.json    per-row insert loop               │
│              skips !static_verified                             │
└────────────────────────────────┬────────────────────────────────┘
                                 │ writes (service_role)
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  SUPABASE POSTGRESQL                                            │
│  universities | majors | tohop_codes | cutoff_scores            │
│  scrape_runs (audit log)                                        │
└────────────────────────────────┬────────────────────────────────┘
                                 │ reads (pooler port 6543)
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  VERCEL SERVERLESS API                                          │
│  /api/universities  /api/universities/[id]                      │
│  /api/recommend  /api/tohop                                     │
│  + static JSON fallback (generated at build time)              │
└────────────────────────────────┬────────────────────────────────┘
                                 │ fetches
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  NEXT.JS 16 FRONTEND PWA                                        │
│  components/ (flat), Tailwind v4, no design tokens             │
│  next-intl (vi/en cookie), nuqs (URL state)                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Integration Point 1: Auto-Discovery Crawler

### Where It Lives

The crawler is a new **pre-scrape discovery phase** that runs inside the same GitHub Actions job, before `run.ts` executes the adapter pipeline. It does NOT live in the Vercel API layer.

```
GitHub Actions job (modified)
  ├── [NEW] crawler/discover.ts
  │     ↓ reads scrapers.json (homepage URLs)
  │     ↓ spiders to find cutoff score pages
  │     ↓ writes discovered URLs back to scrapers.json or a separate discovered-urls.json
  │
  └── run.ts (existing — unchanged interface)
        ↓ loadRegistry() reads URLs (now potentially discovered URLs)
        ↓ runScraper() calls adapters as before
```

### What Changes vs. What Stays the Same

**Unchanged:**
- `ScraperAdapter` interface (`scrape(url): Promise<RawRow[]>`)
- `runScraper()` in runner.ts
- `loadRegistry()` in registry.ts
- `scrapers.json` entry format

**New:**
- `lib/scraper/crawler/discover.ts` — the discovery engine
- `lib/scraper/crawler/classifier.ts` — page classification (HTML table / JS-rendered / image / PDF)
- `lib/scraper/crawler/types.ts` — `DiscoveredPage` interface

### Data Flow

```
scrapers.json (homepage URL per university)
    ↓
discover.ts
    ├── fetchHTML(homepage)
    ├── extract all <a href> links
    ├── filter: href text or URL contains tuyen-sinh / diem-chuan / diem-trung-tuyen / year
    ├── for each candidate link:
    │     ├── fetchHTML(link)
    │     └── classify page:
    │           ├── has <table> with score headers → "html_table"
    │           ├── has <img> matching score image patterns → "image"
    │           ├── has <script> tags → "js_rendered"
    │           └── has .pdf link → "pdf"
    └── emit DiscoveredPage[] with confidence score
          ↓
run.ts reads discovered URLs and picks the adapter strategy based on page type
```

### `DiscoveredPage` Interface (new type)

```typescript
// lib/scraper/crawler/types.ts
export interface DiscoveredPage {
  university_id: string;
  url: string;
  page_type: 'html_table' | 'js_rendered' | 'image' | 'pdf' | 'unknown';
  confidence: number;      // 0.0–1.0 — how likely this is a cutoff score page
  discovered_at: Date;
  link_text: string;       // the anchor text that led here (for debugging)
}
```

### Registry Integration

Two options. **Use Option A.**

**Option A — scrapers.json stays the source of truth, discovered URLs injected at runtime:**
- `scrapers.json` keeps `"url": "https://homepage.edu.vn/"` (the homepage)
- `discover.ts` runs first and writes `public/discovered-urls.json` (or similar temp file)
- `loadRegistry()` is modified: if `discovered_urls.json` has a fresher URL for this university_id, use it instead of scrapers.json URL
- This means zero changes to scrapers.json format and the registry signature stays identical

**Option B — scrapers.json updated in-place:**
- Discovery run writes the found cutoff URL directly back into scrapers.json
- Triggers a git commit from Actions
- Messier (requires git push from Actions), but makes the discovered URL permanent

Option A is preferred: it decouples discovery from the registry file, avoids Actions needing write permissions to the repo, and keeps scrapers.json as human-edited truth.

### New scrapers.json field (optional enrichment)

```json
{
  "id": "BKA",
  "adapter": "bka",
  "url": "https://hust.edu.vn/",
  "homepage_url": "https://hust.edu.vn/",
  "static_verified": false,
  "discovery": {
    "enabled": true,
    "keywords": ["diem-chuan", "tuyen-sinh", "trung-tuyen"],
    "max_depth": 2
  }
}
```

The `discovery` block is opt-in per university (default enabled). Universities where auto-discovery is known to fail (PDF-only, Google Drive links) can set `"enabled": false`.

---

## Integration Point 2: Fake Test Websites

### Where They Live

Fake websites are **test fixtures served by a local HTTP server** during `vitest` integration tests. They do NOT affect the production pipeline.

```
tests/
├── fixtures/
│   ├── fake-sites/
│   │   ├── generic-html-table/       # Standard cheerio adapter case
│   │   │   └── index.html
│   │   ├── no-thead-headers/         # HTC-style: headers in first <tr>
│   │   │   └── index.html
│   │   ├── js-rendered-stub/         # Static HTML simulating post-JS content
│   │   │   └── index.html
│   │   ├── score-image/              # Page with <img> pointing to test JPEG
│   │   │   ├── index.html
│   │   │   └── sample_scores.jpg
│   │   ├── encoding-windows1252/     # Windows-1252 encoded page
│   │   │   └── index.html
│   │   ├── broken-table/             # Missing score column header
│   │   │   └── index.html
│   │   └── renamed-headers/          # "điểm trúng tuyển" renamed to "Cutoff"
│   │       └── index.html
│   └── server.ts                     # Starts http-server on a random port
│
└── scraper/
    └── adapters/
        ├── generic-factory.integration.test.ts
        └── crawler.integration.test.ts
```

### Server Setup Pattern

```typescript
// tests/fixtures/server.ts
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { resolve } from 'path';

export function startFixtureServer(port = 0): Promise<{ url: string; close: () => void }> {
  return new Promise((resolve_) => {
    const server = createServer((req, res) => {
      const filePath = resolve(__dirname, 'fake-sites', req.url!.slice(1), 'index.html');
      // serve file or 404
    });
    server.listen(port, () => {
      const addr = server.address() as { port: number };
      resolve_({ url: `http://localhost:${addr.port}`, close: () => server.close() });
    });
  });
}
```

### What This Enables

- Generic adapter factory tests can run against `http://localhost:PORT/generic-html-table` without mocking `fetchHTML`
- Crawler tests can discover links within fake-site HTML without hitting real university websites
- PaddleOCR integration test uses `tests/fixtures/fake-sites/score-image/sample_scores.jpg`

### Relationship to Existing Adapter Tests

Existing tests (`bvh.test.ts`, `dcn.test.ts`) mock `fetchHTML` at the module level — they stay unchanged. The new fixture-server tests are **additional** integration tests that complement the existing unit tests by testing the full HTTP fetch → parse path. No migration of existing tests needed.

---

## Integration Point 3: Generic Adapter Factory

### The Copy-Paste Problem (confirmed from code)

Comparing `htc.ts`, `bvh.ts`, and `sph.ts`: they share 85%+ identical code. The variation is:
1. The `university_id` string literal (`'HTC'`, `'BVH'`, `'SPH'`)
2. The score column keyword match (e.g., BVH matches `'thpt'` first; HTC matches `'điểm trúng tuyển'` first)
3. Whether to use a `defaultTohop` when no tohop column exists (HTC defaults to `'A00'`)

### Factory Approach: Config-Driven, Not Inheritance

Do not use class inheritance. Use a factory function that takes a config object and returns a `ScraperAdapter`.

```typescript
// lib/scraper/adapters/generic-cheerio-factory.ts

export interface GenericCheerioConfig {
  universityId: string;
  // Column detection: keywords to match in header text
  scoreKeywords: string[];          // e.g. ['điểm trúng tuyển', 'điểm chuẩn', 'thpt']
  majorCodeKeywords: string[];      // e.g. ['mã ngành', 'ma nganh']
  tohopKeywords?: string[];         // e.g. ['tổ hợp', 'khối'] — optional
  defaultTohop?: string;            // e.g. 'A00' if no tohop column
  // Row filtering
  requireNumericMajorCode?: boolean; // default true — skip rows where major code !~ /^\d/
  minCellCount?: number;            // default 3
}

export function createCheerioAdapter(config: GenericCheerioConfig): ScraperAdapter {
  return {
    id: config.universityId,
    async scrape(url: string): Promise<RawRow[]> {
      // ... shared cheerio logic using config ...
    },
  };
}
```

### Where Adapters Move

The 70+ copy-pasted adapters are refactored in two passes:

**Pass 1 — New adapters use the factory.** Any new adapter created for the 72 dormant universities uses `createCheerioAdapter(config)` instead of copy-pasting. These are trivial one-liners:

```typescript
// lib/scraper/adapters/fbu.ts (after refactor)
import { createCheerioAdapter } from './generic-cheerio-factory';
export const fbuAdapter = createCheerioAdapter({
  universityId: 'FBU',
  scoreKeywords: ['điểm chuẩn', 'điểm trúng tuyển'],
  majorCodeKeywords: ['mã ngành'],
  tohopKeywords: ['tổ hợp'],
});
```

**Pass 2 — Existing verified adapters migrated.** `htc.ts`, `bvh.ts`, `sph.ts`, `tla.ts` are migrated to factory configs. The adapter module still exports `htcAdapter` by name (so the registry import `mod[entry.adapter + 'Adapter']` continues to work unchanged). The complex cases (`dcn.ts` with Playwright, `gha.ts` with PaddleOCR) are NOT migrated — they remain custom adapters.

### Registry Compatibility: Zero Breaking Changes

The registry uses:
```typescript
const mod = await import(`./adapters/${entry.adapter}`);
const adapter = mod.default ?? mod[`${entry.adapter}Adapter`];
```

This continues to work after refactoring because each adapter file still exports `${id}Adapter`. The factory is an internal implementation detail — invisible to `loadRegistry()`.

**No changes needed in:**
- `scrapers.json`
- `registry.ts`
- `runner.ts`
- Any existing test

### Playwright and PaddleOCR Equivalents

For JS-rendered pages, a `createPlaywrightAdapter(config)` factory follows the same pattern but launches a Playwright browser instead of calling `fetchHTML`. For OCR pages, the custom adapter pattern stays (image extraction is too variable to generalize well in v2).

---

## Integration Point 4: Design Token Layer (Tailwind v4)

### Current State

`app/globals.css` contains only:
```css
@import "tailwindcss";
```

There are no design tokens. Components use hardcoded Tailwind class strings like `text-gray-900`, `bg-white`, `border-gray-200`.

### Tailwind v4 CSS-First Token Layer

Tailwind v4 uses CSS variables defined in the `@theme` block instead of `tailwind.config.js`. This is the correct integration point.

```css
/* app/globals.css — after v2 changes */
@import "tailwindcss";

@theme {
  /* Brand colors */
  --color-brand-50:  #eff6ff;
  --color-brand-500: #3b82f6;
  --color-brand-700: #1d4ed8;

  /* Semantic color aliases */
  --color-surface:        var(--color-white);
  --color-surface-muted:  var(--color-gray-50);
  --color-border:         var(--color-gray-200);
  --color-text-primary:   var(--color-gray-900);
  --color-text-secondary: var(--color-gray-600);
  --color-text-muted:     var(--color-gray-400);

  /* Tier colors (semantic) */
  --color-tier-dream:     var(--color-purple-600);
  --color-tier-practical: var(--color-brand-500);
  --color-tier-safe:      var(--color-green-600);

  /* Typography */
  --font-sans: 'Be Vietnam Pro', ui-sans-serif, system-ui;
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;

  /* Spacing scale supplement */
  --spacing-card: 1rem;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  @theme {
    --color-surface:        var(--color-gray-900);
    --color-surface-muted:  var(--color-gray-800);
    --color-border:         var(--color-gray-700);
    --color-text-primary:   var(--color-gray-100);
    --color-text-secondary: var(--color-gray-400);
    --color-text-muted:     var(--color-gray-500);
  }
}
```

With this in place, `--color-text-primary` becomes `text-text-primary` as a Tailwind utility class. Components then use `text-text-primary` instead of `text-gray-900`.

### Migration Strategy for Existing Components

Do NOT rename all classes in one pass — that is a large risky diff. The approach:

1. Add the `@theme` block to `globals.css` (adds tokens without breaking anything)
2. Fix the font bug first (`--font-sans` in `@theme` activates Be Vietnam Pro via `font-sans` class)
3. Migrate `TierBadge.tsx` first — it already uses tier colors in one place, making it a clean reference component
4. When touching a component for a feature change, migrate its raw color classes to semantic tokens at the same time
5. New components in v2 (drag-reorder list, onboarding) write semantic token classes from the start

### What Does NOT Change

- No `tailwind.config.js` needed — Tailwind v4 is purely CSS-first
- `@tailwindcss/postcss` in `devDependencies` stays (already present)
- Existing classes like `border`, `rounded-lg`, `shadow-sm`, `space-y-3` are layout/structural — they do not need tokens and stay as-is

---

## Integration Point 5: Batch DB Insertion in runner.ts

### Current Problem (confirmed from code)

`runner.ts` does two awaited inserts per scraped row:
1. `db.insert(majors).values(...).onConflictDoNothing()` — ensures major FK exists
2. `db.insert(cutoffScores).values(...).onConflictDoUpdate(...)` — writes the score

For a university with 50 majors × 3 tổ hợp = 150 rows, this is 300 sequential round-trips to Supabase over the Supavisor connection pooler. This is the N+1 write problem.

### Batch Insertion Pattern

Drizzle ORM supports passing an array to `.values()`. The fix involves collecting all rows for a university, then inserting in one statement per table.

**Key constraint:** Supabase Supavisor (transaction pool mode, `prepare: false`) does not support true multi-statement transactions across pool checkouts. However, a single `INSERT ... VALUES (row1), (row2), ...` is a single statement and works fine.

```typescript
// lib/scraper/runner.ts — modified inner loop

// Collect phase
const normalizedBatch: NormalizedRow[] = [];
for (const raw of rawRows) {
  const normalized = normalize(raw);
  if (!normalized) {
    rowsRejected++;
    rejectionLog.push(JSON.stringify(raw));
  } else {
    normalizedBatch.push(normalized);
  }
}

// Batch upsert phase — two round-trips total (down from 2N)

// 1. Ensure all majors exist
const uniqueMajorIds = [...new Set(normalizedBatch.map(r => r.major_id))];
if (uniqueMajorIds.length > 0) {
  await db.insert(majors)
    .values(uniqueMajorIds.map(id => ({ id, name_vi: id })))
    .onConflictDoNothing();
}

// 2. Batch upsert all cutoff scores
if (normalizedBatch.length > 0) {
  await db.insert(cutoffScores)
    .values(normalizedBatch.map(n => ({
      university_id: n.university_id,
      major_id: n.major_id,
      tohop_code: n.tohop_code,
      year: n.year,
      score: String(n.score),
      admission_method: n.admission_method,
      source_url: n.source_url,
      scraped_at: n.scraped_at,
    })))
    .onConflictDoUpdate({
      target: [
        cutoffScores.university_id,
        cutoffScores.major_id,
        cutoffScores.tohop_code,
        cutoffScores.year,
        cutoffScores.admission_method,
      ],
      set: {
        score: sql`excluded.score`,
        source_url: sql`excluded.source_url`,
        scraped_at: sql`excluded.scraped_at`,
      },
    });
}
rowsWritten = normalizedBatch.length;
```

### Impact on Tests

`tests/scraper/runner.test.ts` mocks `db.insert` at the module level. The mock returns a chainable object with `values()`, `onConflictDoUpdate()`, `onConflictDoNothing()`. The existing mock handles both the single-insert and batch-insert call patterns because it captures `.values()` arguments regardless of whether an array or single object is passed. The test's `getScrapeRunInserts()` helper looks for objects with a `status` field — that part is unchanged.

The `rows_written` count changes slightly: currently it increments per successful individual insert. After batching, it is set to `normalizedBatch.length` after the batch insert. The test assertion `expect(scrapeRuns[0].rows_written).toBe(3)` continues to pass.

### Chunk Size for Large Universities

A single INSERT with 500+ value tuples can approach Postgres parameter limits (65535 parameters). For safety, chunk at 200 rows:

```typescript
// lib/scraper/runner.ts — chunked batch insert
const BATCH_SIZE = 200;
for (let i = 0; i < normalizedBatch.length; i += BATCH_SIZE) {
  const chunk = normalizedBatch.slice(i, i + BATCH_SIZE);
  await db.insert(cutoffScores).values(chunk.map(...)).onConflictDoUpdate(...);
}
```

---

## Revised System Overview (v2.0)

```
┌─────────────────────────────────────────────────────────────────┐
│  GITHUB ACTIONS (scraping pipeline — modified)                  │
│                                                                 │
│  [NEW] crawler/discover.ts                                      │
│    scrapers.json (homepage URLs)                                │
│    → spider → classify → write discovered-urls.json            │
│         ↓                                                       │
│  run.ts (modified: reads discovered URLs if available)         │
│    → loadRegistry() → merge discovered URLs                    │
│    → runScraper() → [batch upsert — modified]                  │
│         ↓                                                       │
│  [NEW] PaddleOCR CI integration test (separate job)            │
└────────────────────────────────┬────────────────────────────────┘
                                 │ writes (batch, 2 round-trips/uni)
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  SUPABASE POSTGRESQL (unchanged)                                │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  VERCEL SERVERLESS API (unchanged)                              │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  NEXT.JS 16 FRONTEND PWA (modified)                             │
│                                                                 │
│  globals.css: @theme block (design tokens, dark mode)           │
│  [NEW] Drag-reorder NguyenVongList (dnd-kit or native)         │
│  [NEW] Onboarding overlay                                       │
│  components/ → semantic token classes                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## New File Locations

| New File | Purpose | Touches Existing? |
|----------|---------|-------------------|
| `lib/scraper/crawler/discover.ts` | Homepage spider, link extraction | Reads `scrapers.json` |
| `lib/scraper/crawler/classifier.ts` | Page type detection (html/JS/image/pdf) | No |
| `lib/scraper/crawler/types.ts` | `DiscoveredPage` interface | No |
| `lib/scraper/adapters/generic-cheerio-factory.ts` | Factory for static HTML adapters | No |
| `lib/scraper/adapters/generic-playwright-factory.ts` | Factory for JS-rendered adapters | No |
| `tests/fixtures/fake-sites/*/index.html` | HTML fixtures for integration tests | No |
| `tests/fixtures/server.ts` | Local HTTP server for integration tests | No |
| `tests/scraper/crawler/discover.integration.test.ts` | Crawler tests against fake sites | No |
| `tests/scraper/adapters/generic-factory.integration.test.ts` | Factory tests against fake sites | No |

## Modified Files

| Modified File | What Changes | Risk |
|--------------|-------------|------|
| `lib/scraper/runner.ts` | Collect-then-batch upsert instead of per-row insert | LOW — existing tests pass with batch |
| `lib/scraper/run.ts` | Optional pre-pass: run discovery, merge URLs | LOW — runs before existing logic |
| `lib/scraper/registry.ts` | Merge discovered-urls.json if present | LOW — additive |
| `app/globals.css` | Add `@theme` token block | LOW — additive only |
| `lib/scraper/adapters/htc.ts` | Replace implementation with `createCheerioAdapter(...)` | LOW — same export name |
| `lib/scraper/adapters/bvh.ts` | Replace implementation with `createCheerioAdapter(...)` | LOW — same export name |
| `lib/scraper/adapters/sph.ts` | Replace implementation with `createCheerioAdapter(...)` | LOW — same export name |
| `lib/scraper/adapters/tla.ts` | Replace implementation with `createCheerioAdapter(...)` | LOW — same export name |
| `components/NguyenVongList.tsx` | Add drag-reorder, manual add/remove | MEDIUM — behavior change |

---

## Build Order for v2.0

Dependencies flow left to right. Build in this order within each phase.

**Phase 1 — Scraper Foundation (unblocks everything)**
1. `generic-cheerio-factory.ts` + unit tests (no external deps)
2. Migrate verified adapters (htc, bvh, sph, tla) to factory — proves factory works on known-good cases
3. Batch insert in `runner.ts` — isolated change, existing tests cover it
4. `generic-playwright-factory.ts` — follows same pattern as cheerio factory

*Why first:* Factory and batch insert are purely internal refactors with no UI or DB dependency. They reduce surface area before adding new complexity.

**Phase 2 — Resilience Testing Infrastructure**
1. `tests/fixtures/server.ts` — the test server
2. HTML fixture files (one per edge case)
3. Integration tests for generic factory against fake sites
4. PaddleOCR CI job (separate GitHub Actions workflow step)

*Why second:* Fake site infrastructure gives a safety net before writing the crawler. Crawler tests need the fake sites to run against.

**Phase 3 — Auto-Discovery Crawler**
1. `crawler/types.ts` (DiscoveredPage interface)
2. `crawler/classifier.ts` (page type detection — pure function, unit testable)
3. `crawler/discover.ts` (spider + link extraction)
4. Integration tests against fake sites (built in Phase 2)
5. Modify `run.ts` and `registry.ts` to merge discovered URLs

*Why third:* Depends on fake sites for testing. Must come after factory work because discovered pages feed into adapters.

**Phase 4 — Bug Fixes**
1. Fix delta sign convention (ResultsList vs NguyenVongList)
2. Fix trend color semantics
3. Fix null score → NaN in engine
4. Fix withTimeout timer leak
5. Static fallback for /api/recommend
6. Error handling UI

*Why fourth:* These are isolated bug fixes. Doing them after scraper work avoids merge conflicts on files being changed for other reasons.

**Phase 5 — UI/UX Redesign**
1. Design token `@theme` block in `globals.css` + fix font
2. Migrate `TierBadge.tsx` (reference component)
3. Error boundaries (`error.tsx`, `not-found.tsx`)
4. Drag-reorder NguyenVongList
5. Onboarding overlay
6. Dark mode (activated via `@media prefers-color-scheme: dark` block in tokens)
7. Remaining component migrations to semantic tokens

*Why last:* No other phase depends on UI. UI changes are high-effort, low-breakage-risk for non-UI code. Doing tokens first (step 1) gives subsequent UI work a clean foundation.

---

## Patterns to Follow

### Pattern 1: Factory Adapter (new in v2)

**What:** A `createCheerioAdapter(config)` function returns a `ScraperAdapter`. Config object specifies column-matching keywords and defaults. No class inheritance.

**When to use:** Any new static HTML adapter where the page has a standard table structure. Use a custom adapter only when the page requires non-table parsing (PaddleOCR, special DOM structure).

**Trade-offs:** Pros — eliminates copy-paste, fixes in factory propagate to all universities. Cons — debugging requires understanding the shared code path; very unusual layouts may need escape hatches via `config.customParser`.

### Pattern 2: Discovery as Pre-Pass (new in v2)

**What:** `discover.ts` runs before `run.ts`, writes `discovered-urls.json` as ephemeral output. `loadRegistry()` merges this into adapter configs. Discovery failures are non-fatal — fall back to the URL in `scrapers.json`.

**When to use:** Always in production scrape runs. Skip with `SKIP_DISCOVERY=1` env var for fast local testing.

**Trade-offs:** Pros — eliminates manual URL maintenance. Cons — adds 1-3 minutes of HTTP crawl time per run; discovery may occasionally pick up wrong pages (mitigated by confidence score threshold).

### Pattern 3: Collect-then-Batch Write (modifying v1 pattern)

**What:** Normalize all rows for a university into an array first, then perform one batch `INSERT ... VALUES (...)` per table instead of one INSERT per row.

**When to use:** Always. The N+1 write is never preferable for batch jobs.

**Trade-offs:** Pros — reduces DB round-trips from 2N to 2 (or 2 * ceil(N/200) with chunking). Cons — if the batch INSERT fails, all rows for that university fail together (vs. partial success). This is acceptable — the scrape_runs log marks the university as errored, and the next run retries all rows.

---

## Anti-Patterns to Avoid (v2-specific)

### Anti-Pattern 1: Crawler Inside Vercel API

**What:** Triggering the homepage crawler from an API route (e.g., `/api/discover`) to avoid modifying GitHub Actions.

**Why bad:** Vercel functions have a maximum execution duration of 60 seconds (Pro) or 10 seconds (Hobby). Crawling a single university homepage (follow homepage → find cutoff page → classify) takes 3-10 seconds per university. 78 universities = way over limit.

**Instead:** Crawler runs in GitHub Actions only, same as the scraper.

### Anti-Pattern 2: Storing Discovered URLs in the Database

**What:** Saving `DiscoveredPage` records to Supabase so the frontend can show "last scraped from URL X."

**Why bad:** Turns a batch pipeline artifact into a long-lived DB concern. Discovered URLs change every July; stale DB entries would confuse rather than inform. The `source_url` column in `cutoff_scores` already captures the URL that was actually used.

**Instead:** `discovered-urls.json` is ephemeral. Only the scraped data (with `source_url`) persists to the DB.

### Anti-Pattern 3: Factory with Class Inheritance

**What:** A base class `BaseCheerioAdapter` with subclasses per university that override methods.

**Why bad:** TypeScript class inheritance for data-driven variation is awkward. Subclasses must be imported explicitly (defeats the dynamic registry import pattern). The factory function approach is simpler, testable, and works within the existing `mod[entry.adapter + 'Adapter']` registry lookup.

**Instead:** `createCheerioAdapter(config)` returns a plain object conforming to `ScraperAdapter`. No classes.

### Anti-Pattern 4: Tailwind v4 Config File for Tokens

**What:** Creating `tailwind.config.ts` with a `theme.extend.colors` block to add design tokens.

**Why bad:** Tailwind v4 is CSS-first. Using `tailwind.config.ts` for theme customization is the v3 pattern. In v4, the `@theme` block in CSS is the canonical approach; mixing both causes undefined behavior.

**Instead:** All tokens in `@theme` inside `app/globals.css`. No `tailwind.config.ts` for tokens.

---

## Integration Points Summary

| External Service | Integration Pattern | v2 Changes? |
|-----------------|---------------------|-------------|
| Supabase (read) | Drizzle ORM via pooler (port 6543) | None |
| Supabase (write) | Service role key, batch upsert | Batch size increases, still same Drizzle API |
| GitHub Actions | Cron + matrix shards | New discovery pre-step; new OCR CI job |
| Vercel | Next.js build + serverless functions | None (scraper stays out of Vercel) |

| Internal Boundary | Communication | v2 Notes |
|------------------|---------------|----------|
| Crawler → Runner | `discovered-urls.json` flat file | New in v2 |
| Factory → Registry | Named export `${id}Adapter` | Unchanged contract |
| Runner → DB | Drizzle ORM batch insert | Changed from per-row |
| Tokens → Components | Tailwind CSS variable utilities | New in v2; components migrate gradually |
| Fake sites → Tests | Local HTTP server (random port) | Test-only; no prod impact |

---

## Sources

- Existing codebase read directly: `lib/scraper/runner.ts`, `registry.ts`, `types.ts`, `normalizer.ts`, `run.ts`, `fetch.ts`, all adapters in `lib/scraper/adapters/`, `lib/db/schema.ts`, `lib/db/index.ts`, `app/globals.css`, `components/NguyenVongList.tsx`, `components/ResultsList.tsx`, `lib/recommend/engine.ts`, `tests/scraper/runner.test.ts`, `tests/scraper/adapters/bvh.test.ts`, `tests/scraper/adapters/adapter-contract.test.ts`, `.github/workflows/scrape-low.yml`, `scrapers.json`, `package.json`
- Memory files: `project_v2_auto_discovery.md`, `project_v2_scraper_resilience.md`, `project_scraper_limitations.md`
- Project context: `.planning/PROJECT.md`
- Tailwind v4 CSS-first configuration: `@theme` block is the documented v4 approach (HIGH confidence — confirmed by existing `@import "tailwindcss"` in globals.css indicating v4 is already in use)
- Drizzle ORM batch insert: `.values(array)` API is documented and supported in drizzle-orm 0.45.x (HIGH confidence)
- Supabase Supavisor parameter limits: single INSERT statement with array values works in transaction pool mode (HIGH confidence — `prepare: false` is already set correctly in `lib/db/index.ts`)

---

*Architecture research for: UniSelect v2.0 — auto-discovery, resilience testing, adapter factory, design tokens, batch writes*
*Researched: 2026-03-18*
