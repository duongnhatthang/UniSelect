---
phase: 18-tohop-coverage-infrastructure-scale
plan: 01
subsystem: testing
tags: [cheerio, scraper, wide-table, vitest, typescript]

# Dependency graph
requires:
  - phase: 17-scrape-monitoring-db-health
    provides: createCheerioAdapter factory with narrow-table parsing
provides:
  - Wide-table parsing path in createCheerioAdapter (one column per to hop code)
  - HTML fixture for wide-table unit testing (2 majors x 3 to hop columns)
  - wideTable?: boolean field on CheerioAdapterConfig interface
affects:
  - 18-02
  - Any future phase adding universities with wide-table cutoff pages

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "wideTable opt-in flag on CheerioAdapterConfig — existing narrow-table adapters unaffected"
    - "TDD: RED commit (test) then GREEN commit (feat) for each feature block"

key-files:
  created:
    - tests/scraper/fixtures/wide-table.html
  modified:
    - lib/scraper/factory.ts
    - tests/scraper/factory.test.ts

key-decisions:
  - "wideTable is opt-in via CheerioAdapterConfig boolean — default false preserves existing narrow-table behavior"
  - "To hop column detection uses /^[A-D]\\d{2}$/ regex on header text — no scoreKeywords match required for wide-table tables"
  - "Empty to hop cells (no digit) are silently skipped with continue — no rows with missing score_raw produced"

patterns-established:
  - "Wide-table guard returns early from .each() callback after processing — narrow-table path never reached"
  - "tohopCols length === 0 means no [A-D]\\d{2} headers found — table skipped, 0-rows error still fires"

requirements-completed: [SCRP-11, SCRP-12]

# Metrics
duration: 3min
completed: 2026-03-20
---

# Phase 18 Plan 01: Wide-Table To Hop Parsing Summary

**Wide-table parsing added to createCheerioAdapter: one column per to hop code (A00/A01/D01) produces one RawRow per major per non-empty cell, skipping empty cells silently.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-20T08:36:43Z
- **Completed:** 2026-03-20T08:39:26Z
- **Tasks:** 2 (TDD: 1 RED + 1 GREEN)
- **Files modified:** 3

## Accomplishments
- Added `wideTable?: boolean` to `CheerioAdapterConfig` interface
- Implemented wide-table guard block before narrow-table path in `createCheerioAdapter`
- Created HTML fixture with 2 majors x 3 to hop columns including empty cells (D01 for 7480201, A01 for 7520201)
- 10 tests all pass: 6 original + 4 new wide-table tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Create wide-table fixture and test cases** - `46f7119` (test)
2. **Task 2: Implement wide-table parsing in factory.ts** - `1d44cf2` (feat)

_Note: TDD tasks have two commits — test (RED phase) then feat (GREEN phase)_

## Files Created/Modified
- `lib/scraper/factory.ts` - Added `wideTable?: boolean` to interface; wide-table guard block with to hop column detection
- `tests/scraper/fixtures/wide-table.html` - Synthetic fixture: 2 majors, 3 to hop columns (A00/A01/D01), 2 empty cells
- `tests/scraper/factory.test.ts` - Added `wideTableFixture` readFileSync import and 4-test `wide-table` describe block

## Decisions Made
- `wideTable` is opt-in: existing narrow-table adapters pass no flag and get unchanged behavior
- To hop column detection regex `/^[A-D]\d{2}$/` matches standard Vietnamese to hop codes — avoids misidentifying other numeric columns
- Empty cells filtered via `!/\d/.test(scoreRaw)` — covers both empty strings and whitespace-only cells

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `wideTable: true` flag ready for use in scrapers.json adapter configs
- Phase 18-02 can now reference wideTable support for university adapters that publish one-column-per-to-hop tables
- No blockers

---
*Phase: 18-tohop-coverage-infrastructure-scale*
*Completed: 2026-03-20*
