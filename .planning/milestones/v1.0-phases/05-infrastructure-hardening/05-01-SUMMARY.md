---
phase: 05-infrastructure-hardening
plan: "01"
subsystem: infra
tags: [static-json, cdn, fallback, vercel, supabase, fs]

requires:
  - phase: 02-core-api-and-algorithm
    provides: API route handlers for universities, scores, tohop with DB_TIMEOUT catch pattern

provides:
  - Build-time generator script (scripts/generate-static-json.ts) that writes three JSON snapshots to public/data/
  - Static fallback in universities, scores, and tohop route handlers — DB timeout returns CDN-cached JSON not 503
  - X-Served-By: static-fallback header for monitoring fallback activation

affects:
  - monitoring/alerting (X-Served-By header indicates fallback mode)
  - deploy pipeline (generate-static must run before Vercel deploy to populate public/data/)

tech-stack:
  added: []
  patterns:
    - Double-nested try/catch for static fallback: outer catches DB_TIMEOUT, inner catches missing static file
    - scores-by-tohop.json keyed by tohop_code for O(1) filter in fallback path
    - generate-static script uses same postgres pooler config (port 6543, prepare:false) as lib/db/index.ts

key-files:
  created:
    - scripts/generate-static-json.ts
    - public/data/.gitkeep
  modified:
    - app/api/universities/route.ts
    - app/api/scores/route.ts
    - app/api/tohop/route.ts
    - package.json
    - .gitignore

key-decisions:
  - "scores-by-tohop.json keyed by tohop_code (not flat array) — enables O(1) lookup without scanning entire file in fallback path"
  - "public/data/*.json excluded from git — generated at deploy time, not version controlled"
  - "Double-nested try/catch pattern: 503 only if static file is also missing, not just on DB timeout"
  - "recommend route deliberately excluded from static fallback — personalized results cannot be cached statically"

patterns-established:
  - "Static CDN fallback pattern: DB_TIMEOUT catch reads public/data/{endpoint}.json, falls back to 503 only if file missing"

requirements-completed:
  - INFRA-02

duration: 2min
completed: 2026-03-18
---

# Phase 5 Plan 01: Static JSON CDN Layer Summary

**Build-time generator + CDN fallback layer: Supabase cold starts serve cached JSON from Vercel edge instead of 503 errors**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-18T19:06:38Z
- **Completed:** 2026-03-18T19:08:39Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Created `scripts/generate-static-json.ts` that queries Supabase at build time and writes three JSON snapshots (universities, scores-by-tohop, tohop) to `public/data/`
- Updated three API route handlers (universities, scores, tohop) with double-nested try/catch: DB_TIMEOUT returns static JSON; 503 only if static file is also absent
- Added `npm run generate-static` script; `.gitignore` excludes generated JSON (rebuilt each deploy); `public/data/.gitkeep` tracks directory in git

## Task Commits

1. **Task 1: Build-time static JSON generator script** - `8dfc26f` (feat)
2. **Task 2: Static fallback in API route handlers** - `43f2278` (feat)

## Files Created/Modified

- `scripts/generate-static-json.ts` - Queries universities (with tohop_codes array), scores grouped by tohop_code for anchor year + 2 prior years, and tohop codes; writes three JSON files to public/data/
- `public/data/.gitkeep` - Placeholder ensuring public/data/ directory is tracked in git
- `app/api/universities/route.ts` - DB_TIMEOUT now reads public/data/universities.json; falls through to 503 only if file missing
- `app/api/scores/route.ts` - DB_TIMEOUT reads scores-by-tohop.json; filters by tohop_code param if present
- `app/api/tohop/route.ts` - DB_TIMEOUT reads public/data/tohop.json; falls through to 503 only if file missing
- `package.json` - Added generate-static script
- `.gitignore` - Added /public/data/*.json exclusion

## Decisions Made

- `scores-by-tohop.json` keyed by `tohop_code` (not a flat array) so the fallback can filter by param in O(1) without scanning the whole file.
- `public/data/*.json` excluded from git — files are ephemeral build outputs, regenerated on each Vercel deploy.
- Double-nested try/catch is intentional: the outer catch handles `DB_TIMEOUT`, the inner catch ensures the 503 path only fires when the static file is also absent (e.g., during a fresh deploy before `generate-static` runs).
- `/api/recommend` deliberately excluded — personalized recommendations cannot be served from static cache.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

Deploy pipeline change required: `npm run generate-static` must run before `next build` in Vercel build settings to populate `public/data/*.json`. Add to Vercel Build Command:

```
npm run generate-static && next build --webpack
```

Requires `DATABASE_URL` (pooler URL, port 6543) to be set in Vercel environment variables at build time.

## Next Phase Readiness

- Static CDN layer is in place; API routes are resilient to Supabase cold starts
- Plan 05-02 (load testing / staleness alerting) can reference X-Served-By header to detect fallback activation rate

---
*Phase: 05-infrastructure-hardening*
*Completed: 2026-03-18*
