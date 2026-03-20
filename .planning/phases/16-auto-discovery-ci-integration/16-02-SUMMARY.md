---
phase: 16-auto-discovery-ci-integration
plan: 02
subsystem: scraper
tags: [discovery, scrapers-json, tdd, vitest, typescript, human-gated]

requires:
  - phase: 16-auto-discovery-ci-integration
    provides: Plan 16-01 (discover.ts and CI workflow for discovery run)

provides:
  - "Human-gated apply-discovery.ts script that patches scrapers.json from discovery-candidates.json"
  - "Pure applyDiscovery() function with testable guard logic (no FS I/O)"
  - "7 unit tests covering all guard conditions and edge cases"

affects:
  - scrapers.json
  - lib/scraper/registry.ts (downstream consumer of patched entries)

tech-stack:
  added: []
  patterns:
    - "Pure function extraction: core patch logic separated from FS I/O for testability"
    - "First-occurrence-wins: pre-sorted candidates; Map.set skips duplicates"

key-files:
  created:
    - scripts/apply-discovery.ts
    - tests/scripts/apply-discovery.test.ts
  modified: []

key-decisions:
  - "Export pure applyDiscovery(entries, candidates) function for testability — main block handles FS I/O"
  - "adapter_type set to 'cheerio' when patching so registry gate actually runs the adapted scraper"
  - "First-occurrence-wins for duplicate universityId candidates (pre-sorted descending by score)"

patterns-established:
  - "Human-gated scripts: main block checks import.meta.url vs process.argv[1] to avoid running on import"
  - "Guard ordering: check scrape_url !== null before adapter_type === 'skip' to short-circuit early"

requirements-completed: [DISC-03]

duration: 2min
completed: 2026-03-20
---

# Phase 16 Plan 02: Apply-Discovery Script Summary

**Human-gated apply-discovery.ts that patches scrapers.json entries using pure guard logic: never overwrites existing scrape_url, never touches skip entries, sets adapter_type to cheerio on patch**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-20T07:54:28Z
- **Completed:** 2026-03-20T07:56:38Z
- **Tasks:** 1 (TDD with 2 commits: test then feat)
- **Files modified:** 2

## Accomplishments
- TDD implementation: tests written first (RED), then implementation (GREEN), all 7 tests pass
- Guard 1: entries with non-null scrape_url are never overwritten even at higher candidate scores
- Guard 2: entries with adapter_type "skip" are never touched regardless of candidate existence
- Sets adapter_type to "cheerio" on patch so registry gate (registry.ts line 29) runs the adapter
- Human-gated only: no GHA workflow references to apply-discovery.ts confirmed
- Full test suite remains green (593 tests across 33 files)

## Task Commits

Each task was committed atomically with TDD separation:

1. **RED - Failing tests** - `acb51ee` (test)
2. **GREEN - apply-discovery.ts implementation** - `7e74070` (feat)

_Note: TDD task split into test commit then feat commit as required by TDD flow_

## Files Created/Modified
- `scripts/apply-discovery.ts` - Human-gated script; exports pure applyDiscovery() function with guard logic
- `tests/scripts/apply-discovery.test.ts` - 7 unit tests covering all guards, patching, and edge cases

## Decisions Made
- Used `import.meta.url.endsWith(process.argv[1])` pattern for main-block guard (consistent with discover.ts pattern)
- Pure function returns `{ entries, patched }` — caller decides what to write
- First-occurrence-wins for bestByUni Map avoids sorting within the function (plan specifies pre-sorted input)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- apply-discovery.ts is ready for local use: download discovery-candidates.json artifact from GHA Actions tab, run `npx tsx scripts/apply-discovery.ts [path]`
- scrapers.json patching is human-gated and safe for re-runs (guards prevent double-patching)
- Phase 16 complete: both 16-01 (CI discovery workflow) and 16-02 (apply script) are done

---
*Phase: 16-auto-discovery-ci-integration*
*Completed: 2026-03-20*
