---
phase: 09-scraper-resilience-testing
plan: 01
subsystem: testing
tags: [msw, vitest, cheerio, iconv-lite, chardet, fixtures, integration-tests]

# Dependency graph
requires:
  - phase: 08-scraper-foundation
    provides: "createCheerioAdapter factory and fetchHTML with chardet/iconv pipeline"
provides:
  - "7 HTML fixture files covering edge-case table formats"
  - "MSW server singleton at tests/scraper/integration/msw-server.ts"
  - "Integration test suite exercising real fetchHTML -> chardet -> iconv -> cheerio pipeline"
affects: [09-scraper-resilience-testing, 10-auto-discovery]

# Tech tracking
tech-stack:
  added: [msw@2.12.13]
  patterns:
    - "MSW node-level fetch interception for integration tests without live network"
    - "Buffer fixtures for encoding path testing (windows-1252 via iconv.encode)"
    - "Fixture files as TypeScript exported constants for type-safe test data"

key-files:
  created:
    - tests/fixtures/generic-table.ts
    - tests/fixtures/no-thead-headers.ts
    - tests/fixtures/comma-decimal.ts
    - tests/fixtures/windows-1252.ts
    - tests/fixtures/broken-table.ts
    - tests/fixtures/renamed-headers.ts
    - tests/fixtures/js-stub.ts
    - tests/scraper/integration/msw-server.ts
    - tests/scraper/integration/cheerio-integration.test.ts
  modified:
    - package.json

key-decisions:
  - "Windows-1252 fixture uses iconv.encode() Buffer (not string) to exercise the non-UTF-8 chardet detection branch in fetchHTML"
  - "MSW onUnhandledRequest: 'error' ensures zero live network requests during test runs"
  - "Fixture keyword match uses lowercase ASCII-safe text for windows-1252 fixture to avoid encoding round-trip issues with Vietnamese diacritics"

patterns-established:
  - "Integration tests: use server.use() per-test handler with resetHandlers() in afterEach for isolation"
  - "Fixture library: one file per edge case, single exported constant per file"

requirements-completed: [SCRP-06, SCRP-07]

# Metrics
duration: 2min
completed: 2026-03-19
---

# Phase 9 Plan 01: Scraper Resilience Testing — Fixture Library Summary

**MSW-intercepted integration test suite with 7 HTML fixture formats covering generic table, no-thead headers, comma-decimal scores, windows-1252 iconv decode path, broken table 0-rows error, renamed keyword headers, and JS-stub empty page**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-19T04:52:00Z
- **Completed:** 2026-03-19T04:54:35Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Installed MSW 2.x and created 7 HTML fixture files as TypeScript exported constants
- Created MSW server singleton with `onUnhandledRequest: 'error'` enforcing no live requests
- Wrote 7 integration tests that call real `fetchHTML` (no `vi.mock`) with MSW intercepting native fetch
- All 7 integration tests pass; full suite of 479 tests remains green

## Task Commits

Each task was committed atomically:

1. **Task 1: Install MSW and create HTML fixture library + MSW server singleton** - `b368009` (feat)
2. **Task 2: Write MSW-based cheerio integration tests for all 7 fixture formats** - `554fcc7` (feat)

## Files Created/Modified
- `tests/fixtures/generic-table.ts` - Standard thead/th table with tohop column
- `tests/fixtures/no-thead-headers.ts` - HTC-style first-row td headers with section header rows
- `tests/fixtures/comma-decimal.ts` - Scores using comma instead of dot (24,50 format)
- `tests/fixtures/windows-1252.ts` - iconv.encode() Buffer for non-UTF-8 charset path
- `tests/fixtures/broken-table.ts` - Table with no score keyword match (triggers 0-rows error)
- `tests/fixtures/renamed-headers.ts` - Variant keyword headers (Mã xét tuyển, Điểm trúng tuyển)
- `tests/fixtures/js-stub.ts` - Empty JS-rendered page with no table (triggers 0-rows error)
- `tests/scraper/integration/msw-server.ts` - MSW setupServer singleton
- `tests/scraper/integration/cheerio-integration.test.ts` - 7 integration test cases
- `package.json` - Added msw@^2.12.13 devDependency

## Decisions Made
- Windows-1252 fixture uses ASCII-safe column headers (no Vietnamese diacritics in header text) to avoid iconv round-trip encoding issues that would prevent chardet from detecting the encoding correctly
- MSW 2.x `HttpResponse` API used (not `new Response`) for consistent headers and binary body handling

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Fixture library and MSW server singleton are ready for Plan 09-02
- All 7 edge-case formats are tested and confirmed working
- No blockers

---
*Phase: 09-scraper-resilience-testing*
*Completed: 2026-03-19*
