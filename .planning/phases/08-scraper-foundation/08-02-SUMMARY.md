---
phase: 08-scraper-foundation
plan: 02
subsystem: api
tags: [fallback, resilience, recommend, static-json]
dependency_graph:
  requires: []
  provides: [static-json-fallback-on-db-timeout]
  affects: [app/api/recommend/route.ts]
tech_stack:
  added: []
  patterns: [async-file-read-fallback, meta-fallback-flag]
key_files:
  created:
    - tests/api/recommend-fallback.test.ts
  modified:
    - app/api/recommend/route.ts
    - tests/api/recommend.test.ts
decisions:
  - "Use async readFile (not readFileSync) in catch block to stay non-blocking in the event loop"
  - "meta.fallback: true surfaces static-data state to frontend without breaking API contract"
  - "Validation runs before DB call so 400s work even during Supabase outage"
metrics:
  duration: ~8min
  completed: "2026-03-19"
  tasks_completed: 2
  files_changed: 3
---

# Phase 8 Plan 2: Recommend API Static JSON Fallback Summary

**One-liner:** Async `readFile` fallback from `scores-by-tohop.json` replaces 503 with 200+`meta.fallback: true` on DB_TIMEOUT.

## What Was Built

The `/api/recommend` route previously returned a 503 error whenever Supabase timed out. Students hitting the app during a database hiccup would see nothing. This plan makes the endpoint return 200 with data from the pre-generated `public/data/scores-by-tohop.json` file, keeping the app functional with slightly stale data.

### Changes

**`app/api/recommend/route.ts`** — The `DB_TIMEOUT` catch block now:
1. Reads `public/data/scores-by-tohop.json` via `async readFile` (never `readFileSync`)
2. Extracts rows for the requested `tohop` code (falls back to `[]` if code not in file)
3. Runs the same `recommend()` algorithm on the static rows
4. Returns `{ data, meta: { count, years_available, fallback: true } }` — identical shape to the normal path, plus `fallback: true`

Validation still runs before the DB call, so invalid params return 400 even during outage.

**`tests/api/recommend.test.ts`** — Updated the existing `DB_TIMEOUT` test (was asserting 503) to assert the new 200 + `fallback: true` behavior. Added `vi.mock('fs/promises')` so the fallback path doesn't read real files.

**`tests/api/recommend-fallback.test.ts`** (new) — Three isolated tests:
- Returns 200 with `meta.fallback: true` on DB_TIMEOUT
- Returns empty `data` array for a `tohop` code not in the static file
- Still returns 400 for invalid `tohop` format (validation is pre-DB)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `vi.mock` hoisting issue in test file**
- **Found during:** Task 2 — first test run
- **Issue:** The plan's suggested test code defined `mockFallbackData` as a `const` before `vi.mock('fs/promises')`, but `vi.mock` is hoisted to the top of the file by Vitest, causing `ReferenceError: Cannot access 'mockFallbackData' before initialization`
- **Fix:** Inlined the JSON data directly inside the `vi.mock('fs/promises')` factory function
- **Files modified:** `tests/api/recommend-fallback.test.ts`
- **Commit:** ebd6911

**2. [Rule 2 - Missing mock] Added db/schema/drizzle-orm mocks to fallback test**
- **Found during:** Task 2 — second test run after fixing hoisting
- **Issue:** The plan's test stub only mocked `lib/db` as `{ db: {} }`, but the route calls `db.select(...).from(...).where(...)` before the promise is passed to `withTimeout`. Since `db` was a bare `{}`, `db.select` was not a function.
- **Fix:** Added chainable mock for `db`, plus mocks for `lib/db/schema` and `drizzle-orm` (matching the pattern from `recommend.test.ts`)
- **Files modified:** `tests/api/recommend-fallback.test.ts`
- **Commit:** ebd6911

## Verification

```
npx vitest run tests/api/recommend-fallback.test.ts
  3 tests passed

npx vitest run tests/api/
  53 tests passed (6 test files) — no regressions
```

## Self-Check: PASSED

- `app/api/recommend/route.ts` — FOUND, contains `import { readFile } from 'fs/promises'`, `scores-by-tohop.json`, `fallback: true`, `await readFile(`, `throw err`
- `tests/api/recommend-fallback.test.ts` — FOUND, 3 tests all passing
- Task 1 commit b9c1944 — FOUND
- Task 2 commit ebd6911 — FOUND
