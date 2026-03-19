---
phase: 11-bug-fixes-data-correctness
plan: 03
subsystem: ui, api
tags: [react, next-intl, i18n, error-handling, async, fs-promises]

# Dependency graph
requires:
  - phase: 03-frontend-pwa
    provides: ScoreForm component, i18n message files
  - phase: 08-scraper-foundation
    provides: API routes for tohop and universities with static fallback
provides:
  - Visible error banner with retry button in ScoreForm on API failure
  - Async readFile in both tohop and universities API fallback paths
affects: [03-frontend-pwa, 11-bug-fixes-data-correctness]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "fetchRecommendations helper encapsulates loading/error state transitions"
    - "role=alert error banner pattern for accessible API error display"
    - "fs/promises readFile in Next.js API route fallback paths"

key-files:
  created: []
  modified:
    - components/ScoreForm.tsx
    - messages/en.json
    - messages/vi.json
    - app/api/tohop/route.ts
    - app/api/universities/route.ts

key-decisions:
  - "fetchRecommendations named function extracts shared fetch logic so both submit handler and auto-submit useEffect call the same code path"
  - "Tohop mount error uses setApiError (same banner) rather than a separate state for consistency and simplicity"
  - "Retry button recalculates totalScore from params at click time to handle mode switching"

patterns-established:
  - "Pattern: API errors surface via apiError state rendered as role=alert banner with retry button"
  - "Pattern: All async file reads in API routes use fs/promises readFile, never readFileSync"

requirements-completed: [FIX-07, FIX-08]

# Metrics
duration: 8min
completed: 2026-03-19
---

# Phase 11 Plan 03: Error Visibility and Async File I/O Summary

**Replaced 3 silent catch blocks in ScoreForm with a visible role=alert error banner and retry button, and converted readFileSync to async readFile in both tohop and universities API fallback paths.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-19T06:43:00Z
- **Completed:** 2026-03-19T06:51:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Added `apiError` state and `fetchRecommendations` helper to ScoreForm.tsx, eliminating all 3 silent `.catch(() => {})` patterns
- Added accessible `role="alert"` error banner with retry button that re-triggers the last failed fetch
- Added `apiError` and `retry` i18n keys to both `messages/en.json` and `messages/vi.json`
- Converted `readFileSync` from `'fs'` to `readFile` from `'fs/promises'` in `app/api/tohop/route.ts` and `app/api/universities/route.ts`

## Task Commits

Each task was committed atomically:

1. **Task 1: Add error state and retry UI to ScoreForm** - `7a14c8e` (feat)
2. **Task 2: Convert readFileSync to async readFile in API routes** - `5edfc5b` (fix)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `components/ScoreForm.tsx` - Added apiError state, fetchRecommendations helper, role=alert error banner with retry button; removed all silent catches
- `messages/en.json` - Added "apiError" and "retry" keys to common namespace
- `messages/vi.json` - Added "apiError" and "retry" keys with proper Vietnamese diacritics
- `app/api/tohop/route.ts` - Converted import to fs/promises, added await to readFile call
- `app/api/universities/route.ts` - Converted import to fs/promises, added await to readFile call

## Decisions Made
- `fetchRecommendations` named function extracts shared fetch logic so both the manual submit handler and auto-submit useEffect use the same code path — avoids duplicating error/loading state management
- Retry button recalculates totalScore from current `params` state at click time rather than closing over a stale value — handles mode switching correctly
- Tohop mount error (fetch on useEffect) uses the same `apiError` banner rather than a separate toast or state variable — one error surface for all API failures

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
Pre-existing TypeScript errors in `ResultsList.tsx`, `StalenessIndicator.tsx`, `scripts/discover.ts`, and test files were present before this plan and are unrelated to these changes. No new errors were introduced.

## Next Phase Readiness
- FIX-07 and FIX-08 complete
- Students now see explicit error messages and can retry failed API calls without refreshing the page
- No more silent failures hiding API outages or timeout fallbacks

---
*Phase: 11-bug-fixes-data-correctness*
*Completed: 2026-03-19*
