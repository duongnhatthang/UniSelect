---
phase: 08-scraper-foundation
plan: "01"
subsystem: scraper
tags: [scraper, runner, zero-rows-guard, batch-insert, transaction, testing]
dependency_graph:
  requires: []
  provides: [zero-rows-guard, batch-transaction-inserts]
  affects: [lib/scraper/runner.ts, tests/scraper/runner.test.ts]
tech_stack:
  added: []
  patterns: [db.transaction with tx.insert, chunked batch upsert, two-phase normalize-then-write]
key_files:
  modified:
    - lib/scraper/runner.ts
    - tests/scraper/runner.test.ts
decisions:
  - "scrapeRuns audit insert stays OUTSIDE transaction — it is audit logging, not data, and must record even when the transaction fails"
  - "CHUNK_SIZE=500 chosen to stay under Postgres 65535 parameter limit for rows with 8 columns each (~8192 max rows per batch)"
  - "Phase A (normalize all) then Phase B (single transaction) ensures rowsRejected count is accurate before writes begin"
metrics:
  duration: "~2 minutes"
  completed_date: "2026-03-18"
  tasks_completed: 2
  files_modified: 2
requirements_fulfilled:
  - SCRP-02
  - SCRP-03
---

# Phase 8 Plan 01: Zero-rows Guard and Batch Transaction Inserts Summary

Zero-rows guard + batch transaction inserts using two-phase normalize-then-write pattern with chunked upserts inside a single db.transaction() call.

## What Was Built

The scraper runner had two silent failure modes:
1. An adapter returning `[]` without throwing was logged as `status: 'ok'` with `rows_written: 0` — an invisible data hole.
2. Row-by-row `db.insert()` calls created N*2 DB round-trips with no transactional protection — partial failures left inconsistent university data.

Both are now fixed:

**Zero-rows guard:** Added immediately after `rawRows` assignment, before normalization. If `rawRows.length === 0`, logs `status: 'zero_rows'` with an error message (`"Adapter returned 0 rows — possible JS rendering or layout change"`) and `continue`s to the next adapter. The existing `catch` block handles adapter throws as `status: 'error'` — no double-logging.

**Batch transaction inserts:** Replaced the row-by-row loop with a two-phase approach:
- Phase A: Normalize all rows, collect valid `NormalizedRow[]`, count rejections
- Phase B: Single `db.transaction()` containing chunked `tx.insert(majors)` (FK dependency first) then chunked `tx.insert(cutoffScores)` with `onConflictDoUpdate` targeting all 5 unique constraint columns

Chunking at `CHUNK_SIZE = 500` prevents hitting the Postgres 65535-parameter limit.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add zero-rows guard and batch transaction inserts to runner.ts | 4447758 | lib/scraper/runner.ts |
| 2 | Update runner tests for zero-rows guard and batch transaction mock | 2e4f33b | tests/scraper/runner.test.ts |

## Verification

- `npx vitest run tests/scraper/runner.test.ts` — 8 tests pass (4 existing + 4 new)
- `npx vitest run tests/scraper/` — 369 tests pass across 7 test files

## New Test Coverage

4 new tests added:
1. `logs status "zero_rows" when adapter returns empty array without throwing`
2. `does not call db.transaction when adapter returns empty array`
3. `calls db.transaction for batch insert when adapter returns valid rows`
4. `continues to next adapter after zero_rows (fail-open preserved)`

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] `lib/scraper/runner.ts` exists and contains all required patterns
- [x] `tests/scraper/runner.test.ts` exists with transaction mock and 4 new tests
- [x] Commits `4447758` and `2e4f33b` verified in git log
