---
phase: 03-frontend-pwa
plan: "03"
subsystem: ui
tags: [vitest, testing-library, vietnamese-i18n, search, staleness, tdd, typescript]

# Dependency graph
requires:
  - phase: 03-frontend-pwa
    plan: "01"
    provides: next-intl configured, messages/vi.json + en.json, lib/recommend/types.ts with scraped_at/source_url
provides:
  - lib/utils/normalize-vi.ts exporting normalizeVi (NFD + d-bar + lowercase)
  - lib/utils/staleness.ts exporting formatStaleness (Intl.RelativeTimeFormat) and isStale (90-day threshold)
  - components/UniversitySearch.tsx — fetch-all client-side search with diacritic-aware matching and tohop dropdown
  - components/StalenessIndicator.tsx — relative time + source link + 90-day amber badge
  - tests/utils/normalize.test.ts — 4 cases covering diacritic strip, lowercase, empty, ASCII
  - tests/utils/staleness.test.ts — 4 cases covering isStale boundaries + formatStaleness string output
  - tests/components/UniversitySearch.test.tsx — 5 cases (render, load, filter, clear, dropdown)
  - tests/components/StalenessIndicator.test.tsx — 5 cases (null, relative time, source link, stale badge, non-stale)
affects: [03-frontend-pwa plans 04+, ResultsList/NguyenVongList components that display scraped_at/source_url]

# Tech tracking
tech-stack:
  added: ["@testing-library/user-event@14.6.1"]
  patterns:
    - "TDD: tests written first, confirmed failing, then implementation added"
    - "cleanup() + afterEach pattern for jsdom test isolation (prevents cross-test DOM leakage)"
    - "Scoped queries from render() destructuring ({getByText}) — avoids screen.getByText multi-match across tests"
    - "normalizeVi: NFD + /[\\u0300-\\u036f]/ strip + explicit d-bar replacement (\\u0110/\\u0111)"

key-files:
  created:
    - lib/utils/normalize-vi.ts
    - lib/utils/staleness.ts
    - tests/utils/normalize.test.ts
    - tests/utils/staleness.test.ts
    - components/UniversitySearch.tsx
    - components/StalenessIndicator.tsx
    - tests/components/UniversitySearch.test.tsx
    - tests/components/StalenessIndicator.test.tsx
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "cleanup() + afterEach required for jsdom test isolation — without it, screen.getByText finds elements from previous renders causing false positives/multi-match errors"
  - "Scoped render destructuring ({getByText, getByRole}) used instead of global screen.* — prevents cross-test contamination even before cleanup runs"
  - "tohop filter in UniversitySearch shows dropdown from /api/tohop but does NOT filter university list — universities table has no tohop_codes column; filter applies at recommendation layer per data model"
  - "UniversitySearch uses cancelled flag in useEffect to prevent setState after unmount"

patterns-established:
  - "Pattern: jsdom component tests use cleanup() in afterEach + scoped queries from render()"
  - "Pattern: TDD with explicit RED confirmation before GREEN implementation"
  - "Pattern: mock next-intl with vi.mock returning (key) => key for translation identity"

requirements-completed: [SRCH-01, SRCH-02, PIPE-05]

# Metrics
duration: 5min
completed: 2026-03-18
---

# Phase 3 Plan 03: Search + Staleness Components Summary

**Vietnamese diacritic-aware university search (normalizeVi + UniversitySearch) and data staleness indicator (StalenessIndicator with Intl.RelativeTimeFormat + 90-day amber badge) with full TDD test coverage**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-18T18:08:28Z
- **Completed:** 2026-03-18T18:13:13Z
- **Tasks:** 2
- **Files modified:** 8 new files + package.json

## Accomplishments

- Task 1 (TDD): Wrote failing tests first for `normalizeVi` and staleness utilities, then implemented both — all 8 utility tests pass
- `normalizeVi`: NFD decomposition + combining char strip + explicit d-bar (U+0110/U+0111) handling + lowercase
- `formatStaleness`: Intl.RelativeTimeFormat locale-aware (day/month/year buckets), `isStale` 90-day threshold
- Task 2: `StalenessIndicator` component renders relative time, source link, amber badge for stale data
- Task 2: `UniversitySearch` component fetches all universities with cursor pagination, filters with diacritic-aware search, shows tohop dropdown
- All 18 tests (8 utility + 10 component) pass

## Task Commits

1. **Task 1: Vietnamese normalization + staleness utilities (TDD)** — `a73edf0` (feat)
2. **Task 2: UniversitySearch + StalenessIndicator components with tests** — `b801a67` (feat)

## Files Created/Modified

- `lib/utils/normalize-vi.ts` — normalizeVi: NFD normalize + strip U+0300-U+036F + d-bar + toLowerCase
- `lib/utils/staleness.ts` — formatStaleness (Intl.RelativeTimeFormat) + isStale (90-day threshold)
- `tests/utils/normalize.test.ts` — 4 test cases: diacritic strip, lowercase, empty, ASCII
- `tests/utils/staleness.test.ts` — 4 test cases: isStale >90 days, <90 days, now; formatStaleness string
- `components/StalenessIndicator.tsx` — 'use client', useLocale + useTranslations, time/source-link/amber-badge
- `components/UniversitySearch.tsx` — 'use client', fetch-all /api/universities with cursor, normalizeVi filter, /api/tohop dropdown
- `tests/components/StalenessIndicator.test.tsx` — 5 tests: null, relative time, source link, stale badge, non-stale
- `tests/components/UniversitySearch.test.tsx` — 5 tests: render, load all, filter diacritics, clear, tohop dropdown
- `package.json` — added @testing-library/user-event@14.6.1

## Decisions Made

- **cleanup() in afterEach for jsdom isolation:** Without explicit cleanup, jsdom accumulates rendered components across tests. `screen.getByText` matches elements from all renders in the same document, causing "Found multiple elements" errors and false positives. Fixed by importing cleanup and calling in afterEach.
- **Scoped render queries instead of screen.*:** Destructuring `{getByText, getByRole}` from `render()` returns queries scoped to that specific render container, avoiding cross-test contamination even in edge cases.
- **tohop filter shows dropdown but does not filter university list:** The `/api/universities` response (from the `universities` table) does not include `tohop_codes` per university — that data exists only in `cutoff_scores`. The tohop filter applies at the recommendation layer. The dropdown is populated and the state is tracked; filtering by tohop on universities requires a future API extension or client-side join with cutoff data.
- **UniversitySearch cancelled flag:** useEffect cleanup sets `cancelled = true` to prevent setState calls after component unmount, avoiding React memory leak warnings in tests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing @testing-library/user-event**
- **Found during:** Task 2 test run
- **Issue:** `UniversitySearch.test.tsx` imports `@testing-library/user-event` for typed interaction testing; package not installed
- **Fix:** `npm install --save-dev @testing-library/user-event` (installed 14.6.1)
- **Files modified:** `package.json`, `package-lock.json`
- **Commit:** b801a67 (Task 2 commit)

**2. [Rule 1 - Bug] Added cleanup() + afterEach for jsdom test isolation**
- **Found during:** Task 2 first test run
- **Issue:** Without cleanup, jsdom accumulates rendered components; `screen.queryByText` found stale badge from a previous test render; "Found multiple elements" errors in UniversitySearch tests
- **Fix:** Added `cleanup` import and `afterEach(() => cleanup())` to both component test files; switched from global `screen.*` to scoped render destructuring
- **Files modified:** `tests/components/StalenessIndicator.test.tsx`, `tests/components/UniversitySearch.test.tsx`
- **Commit:** b801a67 (Task 2 commit)

### Out-of-Scope Issues Noted

- `components/NguyenVongList.tsx` (pre-existing, untracked) has TS2554 type error — logged to deferred items. Not caused by this plan.

---

**Total deviations:** 2 auto-fixed (1 Rule 3 - blocking dependency, 1 Rule 1 - test isolation bug)
**Impact on plan:** Both fixes were necessary for test correctness. No scope creep.

## Self-Check: PASSED

All created files verified on disk. Both commits (a73edf0, b801a67) confirmed in git log.
