---
phase: 11-bug-fixes-data-correctness
plan: "02"
subsystem: recommend-engine, types, staleness-utils, timeout
tags: [bug-fix, nan-safety, type-correctness, timer-leak]
dependency_graph:
  requires: []
  provides: [NaN-safe-engine, correct-scraped_at-types, leak-free-withTimeout]
  affects: [lib/recommend/engine.ts, lib/recommend/types.ts, lib/utils/staleness.ts, components/StalenessIndicator.tsx, lib/db/timeout.ts]
tech_stack:
  added: []
  patterns: [validRows-filter-before-arithmetic, finally-clearTimeout-pattern]
key_files:
  created: []
  modified:
    - lib/recommend/engine.ts
    - lib/recommend/types.ts
    - lib/utils/staleness.ts
    - components/StalenessIndicator.tsx
    - lib/db/timeout.ts
    - tests/api/recommend-engine.test.ts
    - tests/api/helpers-timeout.test.ts
    - tests/components/StalenessIndicator.test.tsx
    - tests/utils/staleness.test.ts
decisions:
  - "validRows filter before weighted average — filter null/unparseable scores before any arithmetic; skip group with continue if no valid rows remain"
  - "scraped_at: Date | null throughout chain — Drizzle timestamp returns Date; CutoffDataRow, RecommendResult, StalenessIndicator props, and staleness utils all updated consistently"
  - "clearTimeout via .finally() — .finally() fires on both resolution and rejection, ensuring no timer handle is ever left dangling"
metrics:
  duration: "2 min"
  completed_date: "2026-03-18"
  tasks_completed: 2
  files_modified: 9
---

# Phase 11 Plan 02: NaN Fix + Type Corrections + Timer Leak Summary

**One-liner:** NaN-safe engine with validRows filter, Date-typed scraped_at across the full chain, and clearTimeout-on-finally for withTimeout.

## What Was Built

### FIX-03: NaN Filtering in Recommendation Engine

The engine previously called `parseFloat(r.score)` on every row including those with `null` scores. `parseFloat(null)` returns `NaN`, which then poisoned the entire weighted average computation.

Fix: introduced a `validRows` filter immediately after taking the last 3 rows. Any row where `parseFloat(r.score ?? '')` is NaN is excluded. If the entire group has no valid scores, the group is skipped with `continue`. All downstream computation (`yearsCount`, `weights`, `scores`, `representative`) now references `validRows` instead of `lastRows`.

### FIX-04: scraped_at Type Corrections

Drizzle ORM's timestamp columns return JavaScript `Date` objects, not strings. The `CutoffDataRow` and `RecommendResult` interfaces both declared `scraped_at: string | null` — wrong. Fixed to `Date | null` in:

- `lib/recommend/types.ts` — both CutoffDataRow and RecommendResult interfaces
- `lib/utils/staleness.ts` — `formatStaleness` and `isStale` now accept `Date` directly; `.getTime()` called directly instead of wrapping with `new Date()`
- `components/StalenessIndicator.tsx` — Props.scrapedAt changed to `Date | null`; `<time dateTime={...}>` updated to use `.toISOString()`

Downstream test files (`tests/utils/staleness.test.ts`, `tests/components/StalenessIndicator.test.tsx`) updated to construct `new Date(...)` instead of calling `.toISOString()` before passing to utilities.

### FIX-05: Timer Leak in withTimeout

The original `withTimeout` started a `setTimeout` but never cleared it when the main promise resolved first. In a long-running Next.js server this causes open handle accumulation.

Fix: captured `timerId` from `setTimeout`, then chained `.finally(() => clearTimeout(timerId!))` on `Promise.race(...)`. The `.finally()` fires on both resolution and rejection paths, guaranteeing the timer is always cleared.

## Tests Added

- `tests/api/recommend-engine.test.ts`: 3 new tests in `describe('recommend - NaN filtering (FIX-03)')`:
  - Excludes rows with null score from weighted average
  - Skips group entirely when all scores are null
  - Handles mix of valid and null scores correctly (2 valid rows, weights [1,2])

- `tests/api/helpers-timeout.test.ts`: 1 new test:
  - Verifies `clearTimeout` is called via spy after promise resolves

## Verification Results

- `npx vitest run tests/api/recommend-engine.test.ts` — 26/26 passed
- `npx vitest run tests/api/helpers-timeout.test.ts` — 8/8 passed
- `npx tsc --noEmit` — no new errors (pre-existing `scripts/discover.ts` Cheerio version conflict from Phase 10 unchanged)
- `grep validRows lib/recommend/engine.ts` — filter confirmed in place
- `grep clearTimeout lib/db/timeout.ts` — cleanup confirmed in place
- `grep "Date | null" lib/recommend/types.ts` — both interfaces updated

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated downstream test files to match new Date type**
- **Found during:** Task 1 — TypeScript type check after type change
- **Issue:** `tests/utils/staleness.test.ts` and `tests/components/StalenessIndicator.test.tsx` passed strings to `isStale`, `formatStaleness`, and `StalenessIndicator` props which now require `Date`
- **Fix:** Changed all test fixtures from `.toISOString()` strings to `new Date(...)` Date objects; updated `StalenessIndicator` test's `dateTime` assertion to use `.toISOString()`
- **Files modified:** `tests/utils/staleness.test.ts`, `tests/components/StalenessIndicator.test.tsx`
- **Commit:** 33cfb5e

## Commits

- `33cfb5e` — fix(11-02): NaN filtering in engine and scraped_at type corrections (FIX-03, FIX-04)
- `fd609da` — fix(11-02): fix timer leak in withTimeout utility (FIX-05)

## Self-Check: PASSED
