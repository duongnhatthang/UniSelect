---
phase: 17-scrape-monitoring-db-health
plan: 01
subsystem: infra
tags: [scraper, monitoring, postgres, drizzle, vitest, keepalive]

# Dependency graph
requires:
  - phase: 16-discovery-pipeline
    provides: runScraper function and scrape_runs schema used by this plan

provides:
  - RunSummary interface exported from runner.ts with attempted/succeeded/failed/zero_rows counts
  - runScraper returns Promise<RunSummary> enabling callers to inspect per-shard outcomes
  - run.ts prints human-readable shard summary line in GHA logs
  - keepalive.mjs prunes scrape_runs rows older than 90 days on every cron invocation

affects:
  - GHA scrape workflow logs (MON-03 actionable summary)
  - Supabase free tier disk usage (MON-02 prevention)
  - Any future code that calls runScraper (now must handle RunSummary return)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Accumulate-and-return summary pattern: initialize summary at function start, increment counters per outcome branch, return at end"
    - "keepalive double duty: DB ping + periodic table pruning in single cron invocation"

key-files:
  created:
    - tests/scraper/runner.test.ts (RunSummary counts describe block — 4 new tests)
  modified:
    - lib/scraper/runner.ts (RunSummary interface + return type change)
    - lib/scraper/run.ts (capture return value, print summary line)
    - scripts/keepalive.mjs (90-day prune DELETE query)

key-decisions:
  - "flagged status counts as succeeded in RunSummary — data was written, just with rejected rows logged"
  - "zero_rows does NOT count as succeeded — no data written, warrants visibility as separate counter"
  - "keepalive.mjs uses RETURNING id to get pruned row count without a separate SELECT COUNT(*)"

patterns-established:
  - "RunSummary pattern: return structured count object from long-running loops for observability"

requirements-completed: [MON-02, MON-03]

# Metrics
duration: 4min
completed: 2026-03-20
---

# Phase 17 Plan 01: RunSummary + 90-day scrape_runs pruning Summary

**runScraper now returns a RunSummary with attempted/succeeded/failed/zero_rows counts printed per GHA shard, and keepalive.mjs deletes scrape_runs rows older than 90 days to protect Supabase free tier**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-20T08:14:13Z
- **Completed:** 2026-03-20T08:18:17Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- RunSummary interface added to runner.ts; runScraper return type changed from void to Promise<RunSummary>
- Each GHA shard prints one actionable summary line (attempted/succeeded/failed/zero-rows) visible in CI logs
- keepalive.mjs prunes scrape_runs rows older than 90 days on every scheduled invocation, using RETURNING id for count logging
- 4 new TDD tests covering all RunSummary count scenarios; all 602 tests pass

## Task Commits

Each task was committed atomically:

1. **RED (TDD): Add failing RunSummary count tests** - `e93824c` (test)
2. **Task 1: RunSummary return type + GHA summary log** - `24c52f9` (feat)
3. **Task 2: scrape_runs 90-day pruning in keepalive.mjs** - `bc1f85c` (feat)

_Note: TDD tasks have separate test commit (RED) then implementation commit (GREEN)_

## Files Created/Modified

- `lib/scraper/runner.ts` - Added RunSummary interface, changed return to Promise<RunSummary>, counters per branch
- `lib/scraper/run.ts` - Captures summary return value, prints shard summary log line
- `scripts/keepalive.mjs` - Added DELETE FROM scrape_runs WHERE run_at < NOW() - INTERVAL '90 days'
- `tests/scraper/runner.test.ts` - Added RunSummary import and 4 new tests in 'RunSummary counts' describe block

## Decisions Made

- flagged counts as succeeded in RunSummary because data was written successfully to cutoff_scores; the rejection log is an observability concern, not a data-loss concern
- zero_rows is its own counter (not failed) because the adapter did not error — it returned empty, which is a distinct signal (possible JS rendering or layout change)
- keepalive.mjs stays pure ESM with only the existing postgres import; no Drizzle or additional deps

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- runScraper now returns structured RunSummary; run.ts prints shard summary per GHA job
- keepalive.mjs prunes scrape_runs on each scheduled cron, preventing table growth
- Ready for Plan 17-02 (remaining monitoring/DB health tasks in this phase)

## Self-Check: PASSED

- runner.ts: FOUND
- run.ts: FOUND
- keepalive.mjs: FOUND
- runner.test.ts: FOUND
- 17-01-SUMMARY.md: FOUND
- Commits e93824c, 24c52f9, bc1f85c: all present in git log

---
*Phase: 17-scrape-monitoring-db-health*
*Completed: 2026-03-20*
