---
phase: 03-frontend-pwa
plan: 05
subsystem: frontend-filter
tags: [gap-closure, filter, i18n, tdd]
dependency_graph:
  requires: [03-04]
  provides: [functional-tohop-filter, i18n-share-link]
  affects: [components/UniversitySearch.tsx, lib/api/universities.ts, components/NguyenVongList.tsx]
tech_stack:
  added: []
  patterns: [drizzle-leftjoin-subquery, array_agg-coalesce, matchesTohop-predicate]
key_files:
  created: []
  modified:
    - lib/api/universities.ts
    - components/UniversitySearch.tsx
    - tests/api/universities.test.ts
    - tests/components/UniversitySearch.test.tsx
    - components/NguyenVongList.tsx
decisions:
  - "array_agg(distinct ...) via sql template tag in subquery joined left to universities — Drizzle ORM has no built-in array aggregation"
  - "coalesce(tohop_codes, '{}') in outer select — universities with no cutoff scores return empty array not null"
  - "sql mock updated to return object with .as() method — tagged template mock must support chained .as() call for subquery alias"
metrics:
  duration: 3min
  completed_date: "2026-03-18"
  tasks: 2
  files_modified: 5
---

# Phase 3 Plan 5: Gap Closure (SRCH-02 + I18N) Summary

**One-liner:** Functional tohop filter via array_agg subquery on cutoff_scores with matchesTohop predicate, plus t('shareLink') replacing hardcoded English string in NguyenVongList.

## What Was Built

Two gaps identified in the Phase 3 verification report were closed:

**Gap 1 — SRCH-02 (blocker):** The tohop dropdown was cosmetically wired but had no functional effect. `selectedTohop` was never referenced in the filter predicate. Fixed by:
- Enriching `getUniversities` in `lib/api/universities.ts` with a `tohop_codes: string[]` field per university, populated via a Drizzle left join against an `array_agg(distinct ...)` subquery on `cutoff_scores`
- Adding `tohop_codes: string[]` to the `University` interface in `UniversitySearch.tsx`
- Adding a `matchesTohop` predicate: `!selectedTohop || u.tohop_codes.includes(selectedTohop)` composed with `matchesName`

**Gap 2 — I18N warning:** Line 89 of `NguyenVongList.tsx` hardcoded the English string `"— URL encoded for sharing"`. Replaced with `{t('shareLink')}` which renders "Chia sẻ liên kết" in Vietnamese and "Share link" in English using the existing translation key.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Enrich university API with tohop_codes and fix filter predicate | 24952ae | lib/api/universities.ts, components/UniversitySearch.tsx, tests/api/universities.test.ts, tests/components/UniversitySearch.test.tsx |
| 2 | Replace hardcoded English string in NguyenVongList share-link hint | 41bb7dc | components/NguyenVongList.tsx |

## Verification Results

Full test suite: **154 tests across 21 files — all pass, 0 failures.**

Spot checks:
- `matchesTohop` appears at line 70-71 of `components/UniversitySearch.tsx`
- `t('shareLink')` appears at line 89 of `components/NguyenVongList.tsx`
- `URL encoded for sharing` count is 0 in `NguyenVongList.tsx`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed sql mock to support .as() chaining**
- **Found during:** Task 1, GREEN phase
- **Issue:** The existing `sql` mock returned a plain string from the tagged template; the new `getUniversities` calls `.as('tohop_sub')` on the sql result for the subquery alias, causing `TypeError: sql(...).as is not a function`
- **Fix:** Updated the `sql` mock to return `{ as: (_alias) => result }` instead of a bare string
- **Files modified:** `tests/api/universities.test.ts`
- **Commit:** 24952ae (included in Task 1 commit)

## Decisions Made

1. `array_agg(distinct ...)` via `sql` template tag in a subquery joined left to universities — Drizzle ORM has no built-in array aggregation function; `sql` tagged template is the correct escape hatch
2. `coalesce(tohop_codes, '{}')` in the outer select — universities with no cutoff scores would return null from the left join; coalesce converts null to an empty PostgreSQL array
3. The sql mock needed to return an object with `.as()` to support subquery aliasing — tagged template function mock must be callable and return a chainable result

## Self-Check: PASSED

All created/modified files confirmed on disk. All task commits confirmed in git log.
