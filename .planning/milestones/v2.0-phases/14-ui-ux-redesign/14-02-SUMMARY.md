---
phase: 14-ui-ux-redesign
plan: 02
subsystem: ui
tags: [next-intl, next.js, error-boundary, onboarding, localStorage, tailwindcss]

# Dependency graph
requires:
  - phase: 14-01
    provides: Semantic token design system and dark mode provider established in globals.css
provides:
  - app/error.tsx client-component error boundary with retry + home link
  - app/not-found.tsx 404 page with Vietnamese/English text
  - components/OnboardingBanner.tsx dismissible banner using localStorage
  - Pre-submission empty state in ResultsList (hasSubmitted guard)
  - ErrorPage, NotFoundPage, OnboardingBanner i18n namespaces in vi.json and en.json
affects: [14-03, testing, ui-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useEffect + mounted state guard for localStorage access (avoids SSR hydration mismatch)"
    - "hasSubmitted boolean prop to distinguish pre-submission from post-submission empty states"
    - "next-intl useTranslations in error.tsx requires 'use client' directive"

key-files:
  created:
    - app/error.tsx
    - app/not-found.tsx
    - components/OnboardingBanner.tsx
  modified:
    - components/ResultsList.tsx
    - components/ScoreForm.tsx
    - app/page.tsx
    - messages/vi.json
    - messages/en.json

key-decisions:
  - "OnboardingBanner uses useEffect + mounted flag pattern (not lazy useState) for localStorage — safer against SSR hydration mismatch per research recommendation"
  - "hasSubmitted state set in fetchRecommendations before fetch call — covers both quick mode submit and detailed mode auto-submit paths"

patterns-established:
  - "Pattern: localStorage access always wrapped in useEffect + mounted guard (see OnboardingBanner)"
  - "Pattern: pre-submission vs post-submission empty states distinguished via hasSubmitted prop, not results.length alone"

requirements-completed: [UI-03, UI-06, UI-09]

# Metrics
duration: 4min
completed: 2026-03-19
---

# Phase 14 Plan 02: Error Boundaries, Onboarding Banner, and Pre-submission Empty State Summary

**Next.js error boundary (error.tsx), 404 page (not-found.tsx), localStorage-dismissed onboarding banner, and pre-submission empty state replacing confusing "No results" message**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-19T13:31:03Z
- **Completed:** 2026-03-19T13:35:07Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created app/error.tsx as a Client Component with retry and home link using semantic token classes
- Created app/not-found.tsx with 404 display, Vietnamese/English text from next-intl messages
- Created OnboardingBanner with localStorage persistence (`onboarding-dismissed` key), SSR-safe via useEffect + mounted guard
- Added hasSubmitted prop to ResultsList to show guidance text before any submission instead of "No matching results"
- Added ErrorPage, NotFoundPage, OnboardingBanner namespaces and emptyStateBeforeSubmission key to both vi.json and en.json

## Task Commits

Each task was committed atomically:

1. **Task 1: Error boundaries and i18n messages** - `dda7b97` (feat)
2. **Task 2: Onboarding banner and pre-submission empty state** - `4e3523b` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `app/error.tsx` - Client Component error boundary; retry button calls reset(), home link uses next/link
- `app/not-found.tsx` - Server Component 404 page with large "404" text and home link
- `components/OnboardingBanner.tsx` - Dismissible info banner; hidden on SSR; persists dismissal to localStorage
- `components/ResultsList.tsx` - Added hasSubmitted prop; pre-submission guard shows emptyStateBeforeSubmission; updated hardcoded gray colors to semantic tokens
- `components/ScoreForm.tsx` - Added hasSubmitted state; sets true before fetch; passes to ResultsList; also wired NguyenVongList with required props (Rule 3 fix)
- `app/page.tsx` - Imports and renders OnboardingBanner above ScoreForm
- `messages/vi.json` - Added ErrorPage, NotFoundPage, OnboardingBanner namespaces + emptyStateBeforeSubmission key
- `messages/en.json` - Added ErrorPage, NotFoundPage, OnboardingBanner namespaces + emptyStateBeforeSubmission key

## Decisions Made
- OnboardingBanner uses `useEffect` + `mounted` flag rather than the lazy `useState` initializer with `typeof window` guard — more explicit and conventional; banner starts hidden on SSR and reveals on client after localStorage check
- `setHasSubmitted(true)` placed at top of `fetchRecommendations` before the fetch — ensures the flag is set even if the request fails, so error state also shows the "no results after search" message rather than the guidance text

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed missing NguyenVongList required props in ScoreForm**
- **Found during:** Task 2 (build verification)
- **Issue:** NguyenVongList was updated in 14-01 to require `nguyenVong` and `setNguyenVong` props, but ScoreForm's call site still used the old API (only `results` and `userScore`). Build was already failing before this plan started.
- **Fix:** ScoreForm's NguyenVongList call updated to pass `nguyenVong={nguyenVong}` and `setNguyenVong={setNguyenVongList}` (both already available in ScoreForm from 14-01's additions)
- **Files modified:** components/ScoreForm.tsx
- **Verification:** Build proceeds past ScoreForm TypeScript check
- **Committed in:** 4e3523b (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required fix for build to pass. No scope creep.

## Issues Encountered
- The `scripts/discover.ts` cheerio type conflict (pre-existing from Phase 10, documented in STATE.md as deferred) causes the TypeScript build step to fail. This is not caused by this plan's changes. Build compiles successfully; only the pre-existing scripts/discover.ts type error remains.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Error boundaries and onboarding UX complete (UI-03, UI-06, UI-09 done)
- Phase 14 plans 01-02 complete; all design token, dark mode, error boundary, onboarding, and empty state work is done
- Remaining Phase 14 work (if any): tier badge tooltips, further polish
- The pre-existing scripts/discover.ts build failure should be addressed before shipping

---
*Phase: 14-ui-ux-redesign*
*Completed: 2026-03-19*
