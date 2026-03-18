---
phase: 01-data-foundation
plan: 02
subsystem: scraper
tags: [typescript, vitest, drizzle-orm, chardet, iconv-lite, normalization, tdd]

# Dependency graph
requires:
  - phase: 01-data-foundation/01-01
    provides: Drizzle schema (cutoffScores, scrapeRuns tables) and db client export
provides:
  - RawRow, NormalizedRow, ScraperAdapter TypeScript interfaces
  - normalize() function with cosmetic fixes and hard validation
  - fetchHTML() encoding-safe HTML fetcher with chardet + iconv-lite
  - runScraper() fail-open runner with upsert and scrape_run logging
  - 16 unit tests (12 normalizer + 4 runner) fully passing
affects:
  - 01-data-foundation/01-03 (adapter implementations plug into ScraperAdapter interface and runScraper)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "normalize-then-reject: cosmetic normalization first (comma-decimal, uppercase, trim), then hard validation returning null on failure"
    - "fail-open runner: each adapter in try/catch, failure logs to scrape_runs and continues to next"
    - "upsert pattern: Drizzle onConflictDoUpdate on UNIQUE(university_id, major_id, tohop_code, year, admission_method)"
    - "TDD with vi.hoisted: use vi.hoisted() to create mock references accessible in vi.mock() factories"
    - "sql tagged template mock: mock drizzle-orm sql as (strings, ...values) => strings.join('') for unit tests"

key-files:
  created:
    - lib/scraper/types.ts
    - lib/scraper/normalizer.ts
    - lib/scraper/fetch.ts
    - lib/scraper/runner.ts
    - tests/scraper/normalizer.test.ts
    - tests/scraper/runner.test.ts
  modified: []

key-decisions:
  - "Use vi.hoisted() for mock references in vi.mock() factories — avoids ReferenceError from hoisting order"
  - "Mock drizzle-orm sql as a tagged template function returning joined strings — Proxy approach fails (sql is a tag function, not an object accessor)"
  - "scrapeRuns insert does NOT use onConflictDoUpdate — plain insert with no conflict target; cutoffScores uses upsert"

patterns-established:
  - "Adapter interface: ScraperAdapter.scrape(url) returns Promise<RawRow[]> — adapters are stateless URL scrapers"
  - "Rejection logging: rejected rows serialized as JSON strings in rejectionLog array, stored as JSON in error_log text column"
  - "Status semantics: ok=0 rejections, flagged=>0 rejections but partial success, error=adapter threw"

requirements-completed: [PIPE-02, PIPE-03]

# Metrics
duration: 6min
completed: 2026-03-18
---

# Phase 01 Plan 02: Scraper Framework Summary

**TypeScript scraper framework with normalize-then-reject pipeline, encoding-safe fetch, and fail-open runner — 16 TDD tests passing**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-18T06:57:46Z
- **Completed:** 2026-03-18T07:03:48Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Implemented `normalize()` with two-step pipeline: cosmetic fixes (comma-decimal, uppercase, whitespace strip) then hard validation (score [10.0, 30.0], tohop `[A-D]\d{2}`, non-empty major)
- Implemented `fetchHTML()` with Content-Type charset detection falling back to chardet buffer scan, decoded via iconv-lite for Vietnamese university portals using non-UTF-8 encodings
- Implemented `runScraper()` with try/catch per adapter (fail-open), Drizzle upsert, and scrape_run logging for every outcome (ok/flagged/error)
- 16 unit tests passing: 12 normalizer cases covering all normalization and rejection paths, 4 runner cases covering all status outcomes and fail-open continuation

## Task Commits

Each task was committed atomically:

1. **Task 1: Scraper types, encoding-safe fetch, and normalizer with TDD tests** - `3d98444` (feat)
2. **Task 2: Fail-open scraper runner with scrape_run logging and tests** - `af94408` (feat)

## Files Created/Modified
- `lib/scraper/types.ts` - RawRow, NormalizedRow, ScraperAdapter interfaces
- `lib/scraper/normalizer.ts` - normalize() with cosmetic fixes then hard validation
- `lib/scraper/fetch.ts` - fetchHTML() with chardet + iconv-lite encoding detection
- `lib/scraper/runner.ts` - runScraper() fail-open pattern with upsert and scrape_run logging
- `tests/scraper/normalizer.test.ts` - 12 unit tests for normalization and rejection logic
- `tests/scraper/runner.test.ts` - 4 unit tests for ok/flagged/error/fail-open scenarios

## Decisions Made
- Used `vi.hoisted()` for creating mock references accessible within `vi.mock()` factory callbacks — the standard Vitest pattern for mocks that need to be referenced in factory scope
- Mocked `drizzle-orm sql` as a tagged template function `(strings, ...values) => strings.join('')` rather than a Proxy — sql is used as a tagged template literal in runner.ts so the mock must be callable
- `scrapeRuns` insert is a plain `db.insert().values()` with no `onConflictDoUpdate` — scrape run records are append-only logs, not upserts

## Deviations from Plan

None — plan executed exactly as written. The TDD mock debugging (vi.hoisted, sql tag function) was implementation-level problem-solving within Task 2, not a deviation from the plan's requirements.

## Issues Encountered
- Vitest mock hoisting: `vi.mock()` factories are hoisted to top of file before variable declarations, causing `ReferenceError: Cannot access 'mockInsert' before initialization`. Resolved using `vi.hoisted()` to define mocks before hoisting occurs.
- `sql` tagged template mock: initial Proxy approach failed with `TypeError: sql is not a function` since `sql\`...\`` calls the value as a function. Fixed by mocking as an arrow function accepting template strings.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Scraper framework complete — Plan 03 can implement concrete adapters by implementing the `ScraperAdapter` interface and passing them to `runScraper()`
- `fetchHTML` ready for adapters that need encoding-safe HTML fetching (particularly Ministry portal and older university sites)
- All data quality invariants enforced at the normalizer layer — Plan 03 adapters only need to produce `RawRow[]`, normalization and rejection are handled automatically

## Self-Check: PASSED

All 6 files confirmed present. All 2 task commits verified in git log.

---
*Phase: 01-data-foundation*
*Completed: 2026-03-18*
