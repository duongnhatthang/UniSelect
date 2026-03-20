---
phase: 17-scrape-monitoring-db-health
plan: 02
subsystem: api
tags: [drizzle-orm, nextjs, api-route, monitoring, scrape-health]

# Dependency graph
requires:
  - phase: 17-01
    provides: scrape_runs table migration in Supabase schema
provides:
  - GET /api/admin/scrape-status endpoint returning per-university scrape health
  - getScrapeStatus() exported query function for testability
affects: [admin-ui, monitoring, ci-alerting]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Admin status endpoints use withTimeout + errorResponse + Cache-Control: no-store"
    - "Export query functions from route files for unit testability without HTTP"

key-files:
  created:
    - app/api/admin/scrape-status/route.ts
    - tests/api/scrape-status.test.ts
  modified: []

key-decisions:
  - "Cache-Control: no-store on status endpoint — scrape health must always be fresh, never cached"
  - "has_error boolean not raw error_log text — avoids exposing internal details per research recommendation"
  - "No auth guard — FUTURE-07 defers admin UI/auth to v4+"
  - "getScrapeStatus exported as named function for pure unit testability (same pattern as getUniversities)"

patterns-established:
  - "Mock pattern: vi.mock path in tests is relative to project root, not route file (../../lib/db not ../../../../lib/db)"

requirements-completed: [MON-01]

# Metrics
duration: 15min
completed: 2026-03-20
---

# Phase 17 Plan 02: Scrape Status API Summary

**GET /api/admin/scrape-status endpoint using Drizzle array_agg aggregation returning per-university last_run_at, last_status, last_rows_written, and has_error without Supabase dashboard login**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-20T01:15:00Z
- **Completed:** 2026-03-20T01:30:00Z
- **Tasks:** 1 (TDD: RED commit + GREEN commit)
- **Files modified:** 2

## Accomplishments

- Created `GET /api/admin/scrape-status` route returning JSON `{ data: [...] }` with per-university scrape health
- Drizzle `array_agg(...ORDER BY run_at DESC)[1]` pattern captures the most recent run's status and rows_written within a single aggregation query
- Exported `getScrapeStatus()` function allows pure unit testing without starting HTTP server
- 5 unit tests covering shape, empty result, multiple universities, error status, and db.select call verification — all pass

## Task Commits

Each task was committed atomically:

1. **RED: Failing tests** - `92e6daa` (test)
2. **GREEN + updated tests: Implementation** - `9988636` (feat)

## Files Created/Modified

- `app/api/admin/scrape-status/route.ts` - GET handler + exported getScrapeStatus() query function
- `tests/api/scrape-status.test.ts` - 5 unit tests verifying getScrapeStatus() behavior

## Decisions Made

- Cache-Control: no-store — scrape status must never be served stale from a CDN or browser cache
- has_error boolean instead of raw error_log text — research recommendation to avoid leaking internal rejection details
- No auth guard per FUTURE-07 (deferred to v4+)
- getScrapeStatus() exported separately so tests can call it directly without HTTP context

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed incorrect vi.mock path for lib/db in test file**
- **Found during:** Task 1 (TDD GREEN phase)
- **Issue:** Test was mocking `'../../../../lib/db'` (path relative to route file) but vi.mock paths in Vitest are relative to the test file. The mock was not intercepting Drizzle's real `db.select`, causing stack overflow in Drizzle internals (`orderSelectedFields`)
- **Fix:** Changed mock path to `'../../lib/db'` (correct path from `tests/api/` to `lib/db`)
- **Files modified:** tests/api/scrape-status.test.ts
- **Verification:** All 5 tests pass, no stack overflow
- **Committed in:** 9988636 (Task 1 feat commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in test mock path)
**Impact on plan:** Required for tests to work correctly. No scope creep.

## Issues Encountered

- Vitest mock path confusion: `vi.mock()` paths must be relative to the test file, not to the file being tested. The plan's comment "Mock `../../../../lib/db`" referred to the route's import path, but the test file needs `'../../lib/db'`. Fixed immediately as part of TDD GREEN phase.

## Next Phase Readiness

- GET /api/admin/scrape-status is ready for consumption by any monitoring dashboard or health-check script
- No auth guard means it's open — admin UI/auth deferral (FUTURE-07) applies for v4+
- Full test suite (602 tests) passes with no regressions

---
*Phase: 17-scrape-monitoring-db-health*
*Completed: 2026-03-20*
