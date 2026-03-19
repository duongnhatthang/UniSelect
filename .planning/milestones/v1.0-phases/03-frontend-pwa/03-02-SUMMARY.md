---
phase: 03-frontend-pwa
plan: "02"
subsystem: ui
tags: [nuqs, next-intl, react, tailwind, vitest, jsdom, testing-library, score-form, nguyen-vong]

# Dependency graph
requires:
  - phase: 03-frontend-pwa
    provides: NuqsAdapter + NextIntlClientProvider root layout, RecommendResult type with tier/suggested_top_15/scraped_at, /api/recommend + /api/tohop endpoints
  - phase: 02-core-api-and-algorithm
    provides: RecommendResult interface, recommend engine, all /api/* routes

provides:
  - ScoreForm with quick mode (tohop + total score) and detailed mode (per-subject inputs) using nuqs URL state
  - ResultsList with TierBadge color-coded cards (dream=blue, practical=green, safe=amber), trend indicators, score delta
  - NguyenVongList with top-15 filtering, numbered ranks, tier badges, nuqs parseAsJson URL encoding as ?nv=[...]
  - TierBadge component: reusable tier-colored badge for all tier displays
  - calculateTotal utility: pure function summing subject scores with null for missing subjects
  - TohopCode interface in lib/utils/tohop-subjects.ts
  - Home page (app/page.tsx) with header (appName + LocaleToggle) and ScoreForm as main content
  - 15 new tests: calculateTotal (6), ScoreForm (4), NguyenVongList (5)

affects: [03-frontend-pwa plans 03-07, any component rendering RecommendResult or tier data]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "parseAsJson(validator) requires a validator function arg in nuqs 2.8.9 — not a zero-arg call"
    - "afterEach cleanup() required to prevent jsdom DOM accumulation across vitest tests"
    - "data-testid attributes on rank spans to disambiguate from tier badge spans in DOM queries"

key-files:
  created:
    - lib/utils/calculate-total.ts
    - lib/utils/tohop-subjects.ts
    - components/TierBadge.tsx
    - components/ScoreForm.tsx
    - components/ResultsList.tsx
    - components/NguyenVongList.tsx
    - tests/utils/calculateTotal.test.ts
    - tests/components/ScoreForm.test.tsx
    - tests/components/NguyenVongList.test.tsx
  modified:
    - app/page.tsx

key-decisions:
  - "parseAsJson in nuqs 2.8.9 requires a validator argument: parseAsJson(validator) not parseAsJson() — plan showed no-arg form which does not match actual API"
  - "afterEach cleanup() added to NguyenVongList tests — vitest jsdom does not auto-cleanup between tests, causing DOM accumulation"
  - "ResultsList and NguyenVongList created in Task 1 (alongside ScoreForm) to satisfy TypeScript imports before tests"

patterns-established:
  - "Pattern: ScoreForm uses useQueryStates for tohop/score/mode URL state; subject scores are local useState (too granular for URL)"
  - "Pattern: NguyenVongList syncs top15 to URL via useEffect on results change"
  - "Pattern: data-testid on rank number spans to allow specific DOM querying alongside TierBadge spans"

requirements-completed: [SCOR-01, SCOR-02, NGVG-01]

# Metrics
duration: 15min
completed: 2026-03-18
---

# Phase 3 Plan 02: Score Form, Results List, and Nguyen Vong Builder Summary

**nuqs URL-encoded score entry form (quick + detailed mode), tier-colored results cards, and 15-choice nguyen vong list with ?nv=[] URL encoding for shareable links**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-18T11:10:00Z
- **Completed:** 2026-03-18T11:15:30Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- ScoreForm with quick mode (tohop dropdown + total score, validated 10.0-30.0) and detailed mode (per-subject inputs, auto-submit on calculated total >= 10); both modes call /api/recommend and URL-encode state via nuqs useQueryStates
- ResultsList rendering RecommendResult cards with TierBadge (blue/green/amber), trend arrow indicators (up/down/dash), and score delta (+/- from user score)
- NguyenVongList filtering suggested_top_15 results, numbering 1-15 with rank badges, URL-encoding as ?nv=[{u,m}...] via parseAsJson nuqs
- Home page updated: sticky header with appName and LocaleToggle; ScoreForm as main content in max-w-2xl container
- 142 total tests pass (33 new component/utils tests, 109 existing API tests)

## Task Commits

1. **Task 1: Score calculation utility + ScoreForm component (quick + detailed mode)** - `920a106` (feat)
2. **Task 2: ResultsList + NguyenVongList components, wire to home page** - `34fe166` (feat)

## Files Created/Modified

- `lib/utils/calculate-total.ts` — Pure function: sum subject scores by name, return null for missing subjects
- `lib/utils/tohop-subjects.ts` — TohopCode interface for /api/tohop response shape
- `components/TierBadge.tsx` — Reusable tier badge with dream=blue-500, practical=green-500, safe=amber-500
- `components/ScoreForm.tsx` — 'use client'; useQueryStates(tohop/score/mode); quick+detailed mode tabs; fetch /api/tohop on mount; /api/recommend on submit
- `components/ResultsList.tsx` — 'use client'; loading skeleton; tier-colored cards with TierBadge, trend arrows, score delta
- `components/NguyenVongList.tsx` — 'use client'; parseAsJson validator URL encoding; filter suggested_top_15; numbered 1-15 list
- `app/page.tsx` — Async server component; sticky header with appName + LocaleToggle; ScoreForm main content
- `tests/utils/calculateTotal.test.ts` — 6 pure function tests (sum, null for missing, empty, single, float precision)
- `tests/components/ScoreForm.test.tsx` — 4 jsdom tests (tabs render, dropdown present, number input, no crash)
- `tests/components/NguyenVongList.test.tsx` — 5 jsdom tests (empty results, filter, ranks, tier badges, 15 limit)

## Decisions Made

- **parseAsJson requires validator:** nuqs 2.8.9 `parseAsJson<T>()` signature requires a validator `(value: unknown) => T | null` argument — plan showed zero-arg form which doesn't match the actual TypeScript API. Fixed to `parseAsJson<NvItem[]>((v) => Array.isArray(v) ? v as NvItem[] : null)`.
- **ResultsList and NguyenVongList created in Task 1:** ScoreForm imports both components; TypeScript would fail if they didn't exist. Created all components together in Task 1 commit.
- **afterEach cleanup() in jsdom tests:** Vitest doesn't auto-cleanup jsdom between tests. Without `cleanup()`, DOM elements accumulate across test runs, causing `getByText` to find multiple elements.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed parseAsJson zero-arg call — nuqs 2.8.9 requires validator argument**
- **Found during:** Task 2 (`npx tsc --noEmit`)
- **Issue:** `parseAsJson<NvItem[]>()` produces TypeScript error "Expected 1 arguments, but got 0" — nuqs 2.8.9 changed API to require a validator function
- **Fix:** Changed to `parseAsJson<NvItem[]>((value): NvItem[] | null => Array.isArray(value) ? value as NvItem[] : null)`
- **Files modified:** `components/NguyenVongList.tsx`
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** 34fe166 (Task 2 commit)

**2. [Rule 1 - Bug] Added afterEach cleanup() to NguyenVongList tests**
- **Found during:** Task 2 test run
- **Issue:** `data-testid="nv-rank"` query returned 25 elements (accumulated from previous tests) when expecting 15 — jsdom DOM not cleared between tests
- **Fix:** Added `afterEach(() => cleanup())` from @testing-library/react
- **Files modified:** `tests/components/NguyenVongList.test.tsx`
- **Verification:** All 5 NguyenVongList tests pass with correct DOM counts
- **Committed in:** 34fe166 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 - bugs)
**Impact on plan:** Both fixes necessary for TypeScript correctness and test isolation. No scope creep.

## Issues Encountered

- nuqs 2.8.9 `parseAsJson` API differs from the plan's example code (which showed zero-arg form). The actual nuqs API requires a validator function for type safety. This is a nuqs v2 design change from older versions that accepted bare generics.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Score form, results list, and nguyen vong builder are working and tested
- nuqs URL encoding active for tohop/score/mode params and ?nv=[...] list
- TierBadge reusable component ready for any result display in Plans 03-07
- calculateTotal utility available for any other score computation needs
- 142 tests pass; tsc exits 0; next build exits 0
- Ready for Plan 03: search and staleness features (SRCH-01, SRCH-02, PIPE-05)

---
*Phase: 03-frontend-pwa*
*Completed: 2026-03-18*
