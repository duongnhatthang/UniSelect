---
phase: 04-scraper-expansion
plan: "02"
subsystem: scraper
tags: [github-actions, matrix-sharding, peak-frequency, contract-tests]
dependency_graph:
  requires: [adapter-files-all-78, scrapers-registry-complete]
  provides: [sharded-scrape-workflow, peak-scrape-workflow, contract-tests-all-78]
  affects: [scraper-execution, ci-pipeline]
tech_stack:
  added: []
  patterns: [github-actions-matrix, repository-variable-toggle, dynamic-vitest-import]
key_files:
  created:
    - .github/workflows/scrape-peak.yml
  modified:
    - .github/workflows/scrape-low.yml
    - lib/scraper/run.ts
    - tests/scraper/adapters/adapter-contract.test.ts
decisions:
  - "6-shard matrix chosen: 78 universities / 6 = 13 per shard, well within 30min per job"
  - "PEAK_SCHEDULE_ENABLED repo variable toggle avoids code changes to switch peak mode on/off"
  - "workflow_dispatch always bypasses PEAK_SCHEDULE_ENABLED gate so manual runs work anytime"
  - "Contract test uses dynamic import loop over scrapers.json — zero test file changes needed for future adapters"
  - "Shard defaults (SHARD_INDEX=0, SHARD_TOTAL=1) preserve full-registry behavior for local runs"
metrics:
  duration: 2min
  completed_date: "2026-03-18"
  tasks_completed: 2
  files_created: 1
  files_modified: 3
requirements_completed: [PIPE-04]
---

# Phase 4 Plan 02: Matrix Sharding and Peak Workflow Summary

6-shard GitHub Actions matrix for parallel scraper execution with a PEAK_SCHEDULE_ENABLED-gated 4x-daily workflow for July season and a dynamically-generated contract test suite covering all 78 adapters.

## What Was Built

### Task 1: Matrix Sharding (scrape-low.yml + run.ts)

**scrape-low.yml** replaced the single-job workflow with a 6-shard matrix:
- `strategy.matrix.shard: [0, 1, 2, 3, 4, 5]` with `fail-fast: false`
- Each shard job receives `SHARD_INDEX: ${{ matrix.shard }}` and `SHARD_TOTAL: 6`
- 78 universities / 6 shards = ~13 universities per shard, each job completes well within 30 minutes

**lib/scraper/run.ts** gained shard-aware slicing after `loadRegistry()`:
- `registry.filter((_, i) => i % shardTotal === shardIndex)` — modulo distribution
- Defaults: `SHARD_INDEX=0`, `SHARD_TOTAL=1` → full registry (no regression for local runs)
- `shard` passed to `runScraper` instead of `registry`

### Task 2: Peak Workflow (scrape-peak.yml) and Contract Tests

**scrape-peak.yml** — peak-frequency scraper:
- Cron: `0 1,7,13,19 * * *` — 01:00, 07:00, 13:00, 19:00 UTC (4x per day)
- Job condition: `if: github.event_name == 'workflow_dispatch' || vars.PEAK_SCHEDULE_ENABLED == 'true'`
- Toggle: set repository variable `PEAK_SCHEDULE_ENABLED=true` in GitHub Settings > Variables to enable, no code changes required
- Identical 6-shard matrix structure as scrape-low.yml

**adapter-contract.test.ts** expanded from 6 static imports to dynamic coverage:
- Reads `scrapers.json` at test time via `readFileSync`
- Dynamically imports each adapter module via `await import(adapterFile)`
- 4 assertions per adapter: object existence, id is string, id value matches registry, scrape is function
- **312 tests passing** (78 adapters × 4 assertions)
- Adding a new adapter to scrapers.json automatically includes it in the contract test — zero test file changes

## Verification Results

| Check | Result |
|-------|--------|
| `scrape-low.yml` matrix shard: [0,1,2,3,4,5] | Present |
| `scrape-low.yml` fail-fast: false | Present |
| `scrape-peak.yml` cron `0 1,7,13,19 * * *` | Present |
| `scrape-peak.yml` PEAK_SCHEDULE_ENABLED gate | Present |
| `scrape-peak.yml` workflow_dispatch bypass | Present |
| `adapter-contract.test.ts` tests | 312 passed |
| TypeScript compile (`tsc --noEmit`) | Clean |

## Universities per Shard

With 78 universities distributed via `i % 6 === shardIndex`:
- Shard 0: indices 0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72 (13 universities)
- Shard 1: indices 1, 7, 13, 19, 25, 31, 37, 43, 49, 55, 61, 67, 73 (13 universities)
- Shard 2: indices 2, 8, 14, 20, 26, 32, 38, 44, 50, 56, 62, 68, 74 (13 universities)
- Shard 3: indices 3, 9, 15, 21, 27, 33, 39, 45, 51, 57, 63, 69, 75 (13 universities)
- Shard 4: indices 4, 10, 16, 22, 28, 34, 40, 46, 52, 58, 64, 70, 76 (12 universities)
- Shard 5: indices 5, 11, 17, 23, 29, 35, 41, 47, 53, 59, 65, 71, 77 (12 universities)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

## Self-Check: PASSED

- .github/workflows/scrape-low.yml: FOUND
- .github/workflows/scrape-peak.yml: FOUND
- lib/scraper/run.ts (shard slicing): FOUND
- tests/scraper/adapters/adapter-contract.test.ts: FOUND
- Commit 4a13aa5 (task 1 - matrix sharding): FOUND
- Commit 3c8449d (task 2 - peak workflow + contract tests): FOUND
