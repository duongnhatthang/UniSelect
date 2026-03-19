---
phase: 11-bug-fixes-data-correctness
plan: "01"
subsystem: frontend-recommendation
tags: [bug-fix, delta, trend-colors, tdd, shared-utility]
dependency_graph:
  requires: []
  provides: [computeDelta-utility, corrected-delta-display, corrected-trend-colors]
  affects: [components/ResultsList.tsx, components/NguyenVongList.tsx]
tech_stack:
  added: []
  patterns: [shared-utility-extraction, TDD-red-green]
key_files:
  created:
    - lib/recommend/delta.ts
    - tests/recommend/delta.test.ts
  modified:
    - components/ResultsList.tsx
    - components/NguyenVongList.tsx
decisions:
  - "computeDelta uses userScore - cutoff (positive = above = favorable) per locked STATE.md decision"
  - "TREND_DISPLAY.rising uses text-amber-600 (warning) and falling uses text-green-600 (favorable) per student perspective"
  - "Pre-existing TypeScript errors in unrelated files (tohop/route.ts, universities/route.ts, scripts/discover.ts) deferred as out-of-scope"
metrics:
  duration: "7 minutes"
  completed: "2026-03-19"
  tasks_completed: 2
  files_modified: 4
---

# Phase 11 Plan 01: Delta Sign Fix and Trend Color Correction Summary

Shared `computeDelta()` utility extracted with TDD; both ResultsList and NguyenVongList now use `userScore - cutoff` (positive = above = good), and trend colors swapped to amber for rising (harder cutoff) and green for falling (easier cutoff).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create shared computeDelta utility with tests (TDD) | 53868ed, c1d1463 | tests/recommend/delta.test.ts, lib/recommend/delta.ts |
| 2 | Fix ResultsList delta + trend colors, fix NguyenVongList delta | 241bc74 | components/ResultsList.tsx, components/NguyenVongList.tsx |

## What Was Built

**lib/recommend/delta.ts:** Single pure function `computeDelta(userScore, cutoff)` implementing `userScore - cutoff`. Returns a signed string with 1 decimal place (e.g., '+1.0', '-1.0', '+0.0'). Positive means student is above cutoff (favorable).

**tests/recommend/delta.test.ts:** 4 unit tests covering: above cutoff, below cutoff, exactly at cutoff (+0.0), and rounding behavior (1 decimal).

**components/ResultsList.tsx:** Fixed two bugs:
1. Removed inverted `(result.weighted_cutoff - userScore)` formula; now uses `computeDelta()`
2. Fixed TREND_DISPLAY colors: rising = `text-amber-600` (warning, cutoff going up = harder), falling = `text-green-600` (favorable, cutoff going down = easier)

**components/NguyenVongList.tsx:** Removed inline delta computation; now uses shared `computeDelta()`. The formula was already correct (`userScore - weighted_cutoff`) but extracted to shared utility for consistency.

## Verification Results

```
npx vitest run tests/recommend/delta.test.ts
  Test Files  1 passed (1)
  Tests       4 passed (4)

grep -n "text-amber-600" components/ResultsList.tsx
  16: rising: { icon: '↑', color: 'text-amber-600' }

grep -c "weighted_cutoff - userScore" components/ResultsList.tsx
  0

grep -n "computeDelta" components/ResultsList.tsx components/NguyenVongList.tsx
  Both files import and use computeDelta
```

## Deviations from Plan

### Out-of-Scope Pre-existing Issues (Deferred)

Pre-existing TypeScript errors found in files unrelated to this plan:
- `app/api/tohop/route.ts` — `readFileSync` not in scope
- `app/api/universities/route.ts` — same
- `scripts/discover.ts` — cheerio version mismatch
- `tests/components/StalenessIndicator.test.tsx` — string vs Date type
- `tests/utils/staleness.test.ts` — string vs Date type

These were deferred as out-of-scope per deviation rules. Target files (ResultsList.tsx, NguyenVongList.tsx, delta.ts) compile cleanly with no errors.

## Self-Check: PASSED

- [x] lib/recommend/delta.ts exists: FOUND
- [x] tests/recommend/delta.test.ts exists: FOUND
- [x] components/ResultsList.tsx modified: FOUND
- [x] components/NguyenVongList.tsx modified: FOUND
- [x] Commit 53868ed (RED test): FOUND
- [x] Commit c1d1463 (GREEN implementation): FOUND
- [x] Commit 241bc74 (component fixes): FOUND
- [x] All 4 tests pass: CONFIRMED
