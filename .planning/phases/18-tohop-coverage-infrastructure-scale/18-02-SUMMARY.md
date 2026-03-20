---
phase: 18-tohop-coverage-infrastructure-scale
plan: 02
subsystem: infra
tags: [github-actions, vitest, sharding, shard-type, registry, cheerio, playwright, paddleocr]

# Dependency graph
requires:
  - phase: 18-tohop-coverage-infrastructure-scale
    provides: registry.ts with adapter_type field and scrape-low/peak workflow files
provides:
  - ResolvedEntry interface exported from registry.ts with adapterType field
  - filterAndShard exported function in run.ts with SHARD_TYPE env var filtering
  - 24-job type-aware GHA matrix (20 cheerio + 2 playwright + 2 paddleocr)
  - Playwright and PaddleOCR setup steps gated to their respective shard types
affects:
  - Any future plan adding new adapter types to scrapers.json
  - GHA workflow maintenance (scrape-low.yml, scrape-peak.yml)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - SHARD_TYPE env var filtering in run.ts before modulo sharding
    - GHA matrix.include with explicit shard_type + shard_total per job object
    - Conditional if guards on expensive setup steps (playwright, paddleocr)
    - Exported pure function filterAndShard for unit-testable shard logic

key-files:
  created:
    - tests/scraper/run.test.ts
  modified:
    - lib/scraper/registry.ts
    - lib/scraper/run.ts
    - .github/workflows/scrape-low.yml
    - .github/workflows/scrape-peak.yml

key-decisions:
  - "Export ResolvedEntry from registry.ts so run.ts and tests can import the type without circular deps"
  - "filterAndShard extracted as exported pure function — avoids mocking main() complexity in tests"
  - "adapterType defaults to 'cheerio' when adapter_type is absent from scrapers.json entry"
  - "shard_total embedded in matrix include object per job — avoids conditional YAML expression complexity"
  - "PADDLE_PDX_MODEL_SOURCE and PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK kept at job-level env (harmless for cheerio shards)"
  - "Pre-existing wide-table factory.test.ts failures (from 18-01 RED) treated as out-of-scope — not from 18-02 changes"

patterns-established:
  - "Pattern: SHARD_TYPE filter before modulo — type isolation first, then distribution"
  - "Pattern: GHA matrix.include with per-job shard_type + shard_total for mixed-type sharding"

requirements-completed: [INFR-04, INFR-05]

# Metrics
duration: 4min
completed: 2026-03-20
---

# Phase 18 Plan 02: Type-Isolated 24-Job Shard Matrix Summary

**Scrape workflow scaled from 6 mixed shards to 24 type-isolated shards (20 cheerio + 2 playwright + 2 paddleocr) with SHARD_TYPE env var filtering in run.ts and conditional GHA setup steps per adapter type**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-20T08:36:56Z
- **Completed:** 2026-03-20T08:40:15Z
- **Tasks:** 2 (Task 1 TDD: RED+GREEN, Task 2: workflow update)
- **Files modified:** 5

## Accomplishments
- ResolvedEntry interface exported from registry.ts with adapterType field populated from adapter_type (defaulting to 'cheerio')
- filterAndShard pure function added to run.ts, exported for unit testing, SHARD_TYPE env var drives type-aware filtering before modulo distribution
- Both scrape-low.yml and scrape-peak.yml updated with 24-job explicit include matrix (20 cheerio + 2 playwright + 2 paddleocr), each job carrying shard_total for correct modulo distribution
- Playwright and PaddleOCR setup steps gated by shard_type == 'playwright'/'paddleocr' — cheerio shards skip all browser and OCR setup

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests for filterAndShard** - `071b847` (test)
2. **Task 1 GREEN: adapterType + filterAndShard implementation** - `0cabfa6` (feat)
3. **Task 2: Type-aware 24-job workflow matrices** - `37dd550` (feat)

**Plan metadata:** (docs commit follows)

_Note: Task 1 used TDD — RED commit (failing tests) then GREEN commit (passing implementation)_

## Files Created/Modified
- `tests/scraper/run.test.ts` - 5 unit tests for filterAndShard covering all SHARD_TYPE values and modulo-after-filter behavior
- `lib/scraper/registry.ts` - ResolvedEntry exported with adapterType field; loadRegistry populates adapterType from adapter_type (default 'cheerio')
- `lib/scraper/run.ts` - filterAndShard exported pure function; SHARD_TYPE env var read; main() uses filterAndShard; summary log includes shard type
- `.github/workflows/scrape-low.yml` - 24-job type-aware matrix with conditional Playwright/PaddleOCR setup steps
- `.github/workflows/scrape-peak.yml` - Same 24-job matrix; PEAK_SCHEDULE_ENABLED job-level if condition preserved

## Decisions Made
- Exported filterAndShard as pure function to avoid mocking main()'s dynamic imports in tests — cleaner and more maintainable
- Used matrix.include with explicit objects (shard, shard_type, shard_total) rather than YAML conditional expressions for SHARD_TOTAL — GHA expressions don't support ternary
- adapterType defaults to 'cheerio' to preserve backward compatibility with existing scrapers.json entries missing adapter_type
- Pre-existing factory.test.ts wide-table failures (added as RED in plan 18-01) are out of scope for this plan — only run.test.ts is tested here

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- factory.test.ts has 2 pre-existing failures from plan 18-01 RED phase (wide-table tests added intentionally as failing, pending plan 18-01 GREEN implementation). These are out-of-scope for 18-02 and do not indicate regressions from this plan's changes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- INFR-04 and INFR-05 complete: shard matrix scales to 400+ universities with type isolation
- Plan 18-01 wide-table factory implementation (SCRP-11, SCRP-12) is the remaining open item in phase 18
- registry.test.ts and runner.test.ts should still pass (only ResolvedEntry shape changed by adding adapterType field)

---
*Phase: 18-tohop-coverage-infrastructure-scale*
*Completed: 2026-03-20*
