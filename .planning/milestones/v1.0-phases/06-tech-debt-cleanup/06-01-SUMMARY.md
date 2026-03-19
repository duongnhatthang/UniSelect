---
phase: 06-tech-debt-cleanup
plan: "01"
subsystem: frontend, api, docs
tags: [tech-debt, ui-labels, route-cleanup, package-scripts, documentation]
dependency_graph:
  requires: []
  provides: [tohop-label-vi-display, orphaned-routes-removed, check-staleness-script-registered, pipe-04-documented]
  affects: [ScoreForm, package.json, phase-04-summaries]
tech_stack:
  added: []
  patterns: [label-vi-fallback-display, type-extension]
key_files:
  created: []
  modified:
    - lib/utils/tohop-subjects.ts
    - components/ScoreForm.tsx
    - package.json
    - .planning/phases/04-scraper-expansion/04-01-SUMMARY.md
    - .planning/phases/04-scraper-expansion/04-02-SUMMARY.md
  deleted:
    - app/api/scores/route.ts
    - app/api/years/route.ts
    - lib/api/scores.ts
    - tests/api/scores.test.ts
    - tests/api/years.test.ts
decisions:
  - "TohopCode interface extended with label_vi: string | null — DB column already existed, type was silently discarding it"
  - "Dropdown falls back to subjects list when label_vi is null — same pattern as UniversitySearch.tsx line 94"
  - ".next/ cleaned after route deletion — stale generated type files referenced deleted routes, blocking tsc"
metrics:
  duration: 2min
  completed_date: "2026-03-18"
  tasks_completed: 2
  files_modified: 5
  files_deleted: 5
requirements_completed: [SCOR-01, PIPE-04]
---

# Phase 6 Plan 01: Tech Debt Cleanup Summary

Four v1.0 audit gaps resolved: ScoreForm dropdown now shows Vietnamese labels via label_vi, five orphaned /api/scores and /api/years files deleted, check-staleness registered in package.json, and PIPE-04 added to Phase 4 SUMMARY frontmatter.

## What Was Built

### Task 1: TohopCode.label_vi and ScoreForm Dropdown Labels

**lib/utils/tohop-subjects.ts** — added `label_vi: string | null` to the `TohopCode` interface. The DB column and API response already included this field; the old type was silently discarding it.

**components/ScoreForm.tsx** — updated dropdown option rendering from:
```
{tc.code} ({tc.subjects.join(', ')})
```
to:
```
{tc.code}{tc.label_vi ? ` — ${tc.label_vi}` : ` (${tc.subjects.join(', ')})`}
```

This matches the pattern in `UniversitySearch.tsx` line 94. When `label_vi` is available (e.g., "Toan - Ly - Hoa"), users see "A00 — Toan - Ly - Hoa". When null, falls back to the raw subjects list.

### Task 2: Orphaned Routes, Script Registration, Documentation

**Deleted 5 orphaned files:**
- `app/api/scores/route.ts` — no frontend consumers
- `app/api/years/route.ts` — no frontend consumers
- `lib/api/scores.ts` — only imported by the deleted scores route
- `tests/api/scores.test.ts` — tests for deleted route
- `tests/api/years.test.ts` — tests for deleted route

**package.json** — added `"check-staleness": "tsx scripts/check-staleness.ts"` to scripts section. Script was written in Phase 5 but not registered.

**Phase 4 SUMMARY frontmatter** — added `requirements_completed: [PIPE-04]` to both `04-01-SUMMARY.md` and `04-02-SUMMARY.md`.

## Verification Results

| Check | Result |
|-------|--------|
| `label_vi` in lib/utils/tohop-subjects.ts | Present |
| `tc.label_vi` in components/ScoreForm.tsx | Present |
| app/api/scores/route.ts deleted | Confirmed |
| app/api/years/route.ts deleted | Confirmed |
| lib/api/scores.ts deleted | Confirmed |
| tests/api/scores.test.ts deleted | Confirmed |
| tests/api/years.test.ts deleted | Confirmed |
| check-staleness in package.json | Present |
| PIPE-04 in 04-01-SUMMARY.md | Present |
| PIPE-04 in 04-02-SUMMARY.md | Present |
| TypeScript compile (tsc --noEmit) | Clean |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Stale .next/ generated types blocked tsc after route deletion**
- **Found during:** Task 2 verification
- **Issue:** `.next/types/app/api/scores/route.ts` and `.next/types/app/api/years/route.ts` were generated type artifacts from a previous build. After deleting the source route files, tsc reported errors from these stale generated files.
- **Fix:** Removed the `.next/` directory entirely. This is a generated build artifact that Next.js regenerates on next build; it should not be checked into git.
- **Files modified:** (directory deleted, not tracked in git)
- **Commit:** 01f7d9a (included in Task 2 commit)

## Self-Check: PASSED

- lib/utils/tohop-subjects.ts: FOUND (label_vi present)
- components/ScoreForm.tsx: FOUND (tc.label_vi present)
- package.json check-staleness entry: FOUND
- 04-01-SUMMARY.md requirements_completed PIPE-04: FOUND
- 04-02-SUMMARY.md requirements_completed PIPE-04: FOUND
- Commit 4d62f9b (Task 1 - label_vi and dropdown): FOUND
- Commit 01f7d9a (Task 2 - deletions, script, docs): FOUND
