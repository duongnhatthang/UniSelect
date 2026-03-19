---
phase: 05-infrastructure-hardening
plan: "03"
subsystem: infra
tags: [autocannon, load-testing, cwv, next-font, next-dynamic, performance]

# Dependency graph
requires:
  - phase: 03-frontend-pwa
    provides: app/layout.tsx and app/page.tsx with Be_Vietnam_Pro font and component structure
  - phase: 02-core-api-and-algorithm
    provides: /api/universities and /api/recommend endpoints under load test
provides:
  - autocannon load test script targeting /api/universities and /api/recommend at 50 concurrent connections for 30s
  - explicit font-display:swap on Be_Vietnam_Pro next/font config
  - next/dynamic lazy loading for below-fold UniversitySearch component
affects: []

# Tech tracking
tech-stack:
  added: [autocannon ^8.0.0, "@types/autocannon ^7.12.7"]
  patterns:
    - "next/font/google with explicit display:'swap' for guaranteed font-display behavior"
    - "next/dynamic with loading fallback for below-fold client components to reduce initial TTI"
    - "autocannon HTTP load test with exit code based on 1% error rate threshold"

key-files:
  created:
    - scripts/load-test.ts
  modified:
    - app/layout.tsx
    - app/page.tsx
    - package.json

key-decisions:
  - "UniversitySearch lazy-loaded via next/dynamic — it's below-fold and fetches all universities on mount; deferring its JS bundle reduces TTI for the above-fold score form"
  - "ScoreForm kept as direct import — it's the primary above-fold interactive component; lazy loading would hurt LCP"
  - "Load test runs both endpoints in parallel (Promise.all) — realistic peak simulation, not sequential"
  - "next/font display:'swap' added explicitly even though next/font defaults to swap — makes intent clear and guards against future next/font default changes"

patterns-established:
  - "Load test pattern: autocannon with configurable CONNECTIONS/DURATION/TARGET_URL env vars, exit 1 on >1% error rate"
  - "CWV pattern: next/font for fonts, next/dynamic with animate-pulse fallback for below-fold heavy components"

requirements-completed: [INFRA-02]

# Metrics
duration: 8min
completed: 2026-03-18
---

# Phase 5 Plan 03: Load Testing and Core Web Vitals Optimization Summary

**autocannon load test script for /api/universities and /api/recommend at July-peak concurrency, plus next/font display:swap and next/dynamic lazy loading for below-fold UniversitySearch to reduce TTI**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-18T19:06:43Z
- **Completed:** 2026-03-18T19:14:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created `scripts/load-test.ts` using autocannon to benchmark /api/universities and /api/recommend at 50 concurrent connections for 30s; exits 1 if error rate exceeds 1%
- Added `npm run load-test` script entry and installed autocannon + @types/autocannon as devDependencies
- Added explicit `display: 'swap'` to Be_Vietnam_Pro next/font config ensuring guaranteed font-display swap behavior
- Wrapped below-fold `UniversitySearch` in `next/dynamic` with animate-pulse loading fallback, reducing initial JS bundle and improving TTI for the above-fold score form

## Task Commits

Each task was committed atomically:

1. **Task 1: Load test script with autocannon** - `d1f5268` (feat)
2. **Task 2: Core Web Vitals optimization** - `00bfd2e` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `scripts/load-test.ts` - autocannon benchmark script; tests /api/universities and /api/recommend, configurable via CONNECTIONS/DURATION/TARGET_URL env vars, exits 1 on >1% error rate
- `app/layout.tsx` - Added `display: 'swap'` to Be_Vietnam_Pro font options
- `app/page.tsx` - Replaced direct UniversitySearch import with next/dynamic lazy load and animate-pulse fallback
- `package.json` - Added load-test script and autocannon/types in devDependencies

## Decisions Made

- UniversitySearch lazy-loaded via next/dynamic — it's below-fold and fetches all universities on mount; deferring its JS bundle reduces TTI for the above-fold score form.
- ScoreForm kept as direct import — it's the primary above-fold interactive component; lazy loading would hurt LCP.
- Load test runs both endpoints in parallel (Promise.all) — realistic peak simulation, not sequential.
- next/font display:'swap' added explicitly even though next/font may default to swap — makes intent clear and guards against future default changes.

## Deviations from Plan

None — plan executed exactly as written. The layout already used next/font/google as noted in the plan's interface docs; the optimization was adding the explicit `display:'swap'` option. The page.tsx UniversitySearch was identified as the heavy below-fold component and wrapped with next/dynamic as specified.

## Issues Encountered

- `npm` not on default PATH in the shell environment; resolved by loading nvm via `source ~/.nvm/nvm.sh && nvm use --lts` before all npm/npx commands.

## User Setup Required

None — no external service configuration required. The load test script requires a running app instance; run `npm run dev` then `npm run load-test` or set `TARGET_URL` to a deployed URL.

## Next Phase Readiness

- Phase 5 infrastructure hardening is complete
- Load test script is ready to run against production or staging to validate July-peak capacity
- CWV optimizations improve perceived performance for students on mobile networks
- No blockers for v1.0 release

---
*Phase: 05-infrastructure-hardening*
*Completed: 2026-03-18*
