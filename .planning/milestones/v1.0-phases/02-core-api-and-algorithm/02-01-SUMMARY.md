---
phase: 02-core-api-and-algorithm
plan: "01"
subsystem: recommendation-engine
tags: [algorithm, types, tdd, utilities]
dependency_graph:
  requires: []
  provides: [lib/recommend/types.ts, lib/recommend/engine.ts, lib/api/helpers.ts, lib/db/timeout.ts]
  affects: [02-02, 02-03, 02-04, 02-05, 02-06]
tech_stack:
  added: []
  patterns: [tdd-red-green, pure-function-algorithm, promise-race-timeout]
key_files:
  created:
    - lib/recommend/types.ts
    - lib/recommend/engine.ts
    - lib/api/helpers.ts
    - lib/db/timeout.ts
    - tests/api/helpers-timeout.test.ts
    - tests/api/recommend-engine.test.ts
  modified: []
decisions:
  - "CutoffDataRow.score typed as string (not number) matching Postgres numeric return; parseFloat called in engine before arithmetic"
  - "Weights [1,2,3] for 3yr, [1,2] for 2yr, [1] for 1yr — linear decay with most recent year highest"
  - "Tier margins locked: dream >=+3, practical -1..+2, safe -5..-2 relative to weighted_cutoff"
  - "Su pham/Giao duc deprioritization matches Vietnamese diacritics via case-insensitive includes"
  - "withTimeout uses Promise.race (not postgres.js timeout option) — required for Supabase transaction-mode pooler"
metrics:
  duration: "4min"
  completed_date: "2026-03-18"
  tasks_completed: 2
  files_created: 6
---

# Phase 2 Plan 1: Recommendation Engine Core Summary

Pure TypeScript recommendation engine with weighted multi-year cutoff averaging, tier classification using locked margins, trend detection, and suggested_top_15 priority sorting — all independently testable with zero mocks.

## Tasks Completed

| # | Name | Commit | Status |
|---|------|--------|--------|
| 1 | Create shared types, API helpers, and DB timeout utility | 2ad050d | Done |
| 2 | Implement recommendation engine with TDD tests | 50da66d | Done |

## What Was Built

### lib/recommend/types.ts
Defines the four core types for the recommendation subsystem:
- `Tier` — `'dream' | 'practical' | 'safe'`
- `RecommendInput` — `{ tohop_code, total_score }`
- `CutoffDataRow` — row shape from DB join; `score` typed as `string` (Postgres numeric returns as string)
- `RecommendResult` — full result with `weighted_cutoff`, `tier`, `trend`, `data_years_limited`, `years_available`, `suggested_top_15`

### lib/api/helpers.ts
`errorResponse(code, message, status, extraHeaders?)` — builds `Response.json({ error: { code, message } })` with correct status and optional extra headers (e.g., `Retry-After`).

### lib/db/timeout.ts
`withTimeout<T>(promise, ms)` — `Promise.race` wrapper rejecting with `Error('DB_TIMEOUT')` after `ms` milliseconds. Required because `SET LOCAL statement_timeout` does not work through Supabase's Supavisor transaction-mode pooler (port 6543).

### lib/recommend/engine.ts
Pure `recommend(input: RecommendInput, rows: CutoffDataRow[]): RecommendResult[]` function:

1. Groups rows by `university_id|major_id` composite key
2. Sorts each group by year ascending, takes last 3 years
3. Computes weighted average: weights `[1,2,3]` / `[1,2]` / `[1]` depending on data availability
4. Classifies tier using locked margins (dream ≥+3, practical -1..+2, safe -5..-2); excludes below-safe
5. Computes trend from last 2 years (rising/falling/stable with ±0.5 threshold)
6. Sorts results: practical → dream → safe; within tier by score proximity/margin; su pham/giao duc deprioritized
7. Marks first 15 as `suggested_top_15=true`

### tests/api/recommend-engine.test.ts
23 test cases covering: 3-year weighted average, 2-year data, 1-year data, below-threshold exclusion, dream/practical/safe tier boundaries, suggested_top_15 marking, su pham deprioritization, trend calculation (rising/falling/stable/single-year), empty input, string score parsing.

### tests/api/helpers-timeout.test.ts
7 test cases covering: withTimeout resolve, withTimeout reject with DB_TIMEOUT, Error instance type, errorResponse status, response body shape, extra headers, headerless case.

## Deviations from Plan

None — plan executed exactly as written. TDD red/green flow followed for both tasks. All acceptance criteria met.

## Verification

- `npx tsc --noEmit` — passes (0 errors)
- `npx vitest run tests/api/recommend-engine.test.ts` — 23/23 passing
- `npx vitest run` — 81/81 passing (6 test files)
- No `next/server` imports in any utility file

## Self-Check: PASSED
