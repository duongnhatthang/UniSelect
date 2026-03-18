---
phase: 02-core-api-and-algorithm
plan: "02"
subsystem: api-routes
tags: [api, routing, pagination, caching, recommendation, drizzle, nextjs]
dependency_graph:
  requires: [lib/recommend/engine.ts, lib/recommend/types.ts, lib/api/helpers.ts, lib/db/timeout.ts, lib/db/schema.ts, lib/db/index.ts]
  provides: [app/api/tohop/route.ts, app/api/years/route.ts, app/api/universities/route.ts, app/api/universities/[id]/route.ts, app/api/scores/route.ts, app/api/recommend/route.ts, lib/api/universities.ts, lib/api/scores.ts]
  affects: [02-03, 02-04, 02-05, 02-06]
tech_stack:
  added: []
  patterns: [cursor-pagination, edge-cache-headers, db-timeout-wrapping, thin-route-handler, drizzle-join-query, anchor-year-max-query]
key_files:
  created:
    - app/api/tohop/route.ts
    - app/api/years/route.ts
    - app/api/universities/route.ts
    - app/api/universities/[id]/route.ts
    - app/api/scores/route.ts
    - app/api/recommend/route.ts
    - lib/api/universities.ts
    - lib/api/scores.ts
    - tests/api/tohop.test.ts
    - tests/api/years.test.ts
    - tests/api/universities.test.ts
    - tests/api/scores.test.ts
    - tests/api/recommend.test.ts
  modified: []
decisions:
  - "Relative imports used in route handlers instead of @/ alias — tsconfig paths map @/ to ./src/* which does not exist; phase 1 pattern of relative imports followed"
  - "withTimeout wraps all DB calls including the getUniversities/getScores helper calls — ensures timeout applies even when using extracted query functions"
  - "anchorYear derived from max(year) DB query per tohop code — avoids empty results when most recent scraped year is behind calendar year"
metrics:
  duration: "9min"
  completed_date: "2026-03-18"
  tasks_completed: 2
  files_created: 13
---

# Phase 2 Plan 2: API Route Handlers Summary

Six Next.js App Router route handlers wiring Drizzle queries to HTTP with cursor pagination, edge cache headers, per-query timeout wrapping, input validation, and the recommendation engine — all tested with mocked Drizzle following the vi.hoisted + vi.mock pattern from Phase 1.

## Tasks Completed

| # | Name | Commit | Status |
|---|------|--------|--------|
| 1 | Static lookup routes, university listing with pagination, and tests | 0c1e49f | Done |
| 2 | Scores endpoint, recommendation route handler, and remaining tests | 0c18907 | Done |

## What Was Built

### lib/api/universities.ts
`getUniversities(cursor?, limit?)` — cursor-paginated query on `universities` table. Fetches `safeLimit + 1` rows to detect `hasMore`; limit clamped to 1-200. Returns `{ data, meta: { count, next_cursor } }`.

### lib/api/scores.ts
`getScores({ cursor?, limit?, year?, tohop_code? })` — cursor-paginated join query across `cutoff_scores + universities + majors`. Builds dynamic WHERE conditions only when filters are provided. Limit clamped 1-200. Returns same paginated envelope.

### app/api/tohop/route.ts
GET /api/tohop — fetches all tổ hợp codes ordered by code. 24h edge cache (`s-maxage=86400, stale-while-revalidate=3600`). DB timeout → 503 with `Retry-After: 30`.

### app/api/years/route.ts
GET /api/years — `selectDistinct` on `cutoffScores.year`, ordered descending. Maps rows to plain year numbers in response. 24h edge cache.

### app/api/universities/route.ts
GET /api/universities — thin wrapper around `getUniversities`. Reads `cursor` and `limit` from query params. 24h edge cache.

### app/api/universities/[id]/route.ts
GET /api/universities/[id] — dynamic route with `await params` (Next.js 15+ requirement). Returns university or 404 with `NOT_FOUND` error code. Wrapped in `withTimeout`.

### app/api/scores/route.ts
GET /api/scores — accepts `cursor`, `limit`, `year`, `tohop_code` query params. 5-minute cache (`s-maxage=300, stale-while-revalidate=60`).

### app/api/recommend/route.ts
GET /api/recommend — personalized endpoint, NO cache header:
1. Validates `tohop` against `/^[A-D]\d{2}$/` (case-normalized)
2. Validates `score` as float in `[10.0, 30.0]`
3. Queries `max(year)` for the given tohop code as `anchorYear`
4. Fetches 3-year window (`anchorYear - 2` to `anchorYear`) with join across universities + majors
5. Calls `recommend(input, rows)` from Plan 01 engine
6. Returns `{ data: results, meta: { count, years_available: [...] } }`

### Test Files
5 test files, 27 tests total — all using `vi.hoisted + vi.mock` on `../../lib/db` (relative path). All 108 project tests pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Relative imports used instead of @/ alias**
- **Found during:** Task 1 test execution
- **Issue:** `tsconfig.json` maps `@/*` to `./src/*` but project has no `src/` directory. Phase 1 uses relative imports. Using `@/lib/db` in route files caused "Cannot find package" errors in Vitest.
- **Fix:** Rewrote all route files and lib files to use relative imports (e.g., `../../../lib/db`) matching the Phase 1 pattern established in `lib/scraper/runner.ts`.
- **Files modified:** All 6 route files, lib/api/universities.ts
- **Commit:** 0c1e49f

**2. [Rule 1 - Bug] Cache-Control test assertion on null header**
- **Found during:** Task 2 test run
- **Issue:** `expect(null).not.toContain('s-maxage')` throws — Vitest's `toContain` requires a non-null container when checking string membership.
- **Fix:** Wrapped assertion in null check; if header is `null`, that itself confirms no Cache-Control is set (correct behavior).
- **Files modified:** tests/api/recommend.test.ts
- **Commit:** 0c18907

## Verification

- `npx vitest run tests/api/` — 27/27 passing (5 new test files)
- `npx vitest run` — 108/108 passing (11 test files total)
- `npx tsc --noEmit` — 0 type errors
- `npx next build` — succeeded; all 6 routes detected as ƒ (Dynamic) server-rendered

## Self-Check: PASSED

All 13 created files exist on disk. Both task commits (0c1e49f, 0c18907) confirmed in git history.
