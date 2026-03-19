---
phase: 13-infrastructure-hardening
plan: 01
subsystem: infra
tags: [github-actions, paddleocr, playwright, caching, workflows]

# Dependency graph
requires:
  - phase: 12-testing-ci
    provides: ci-ocr.yml with working PaddleOCR cache pattern
provides:
  - PaddleOCR model cache (actions/cache@v4, ~/.paddlex) in both scrape workflows
  - Playwright browser cache (actions/cache@v4, ~/.cache/ms-playwright) in both scrape workflows
  - PADDLE_PDX_MODEL_SOURCE=BOS at job level in both scrape workflows
  - Conditional Playwright install (full on cache-miss, install-deps on cache-hit) in both workflows
affects: [phase-14-ux-polish, any-future-scrape-workflows]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - PaddleOCR models cached at ~/.paddlex with hashFiles('scripts/ocr_table.py') key
    - Playwright browsers cached at ~/.cache/ms-playwright with hashFiles('package-lock.json') key
    - On cache hit: install-deps chromium only (OS libs); on cache miss: install chromium --with-deps (full)
    - PADDLE_PDX_MODEL_SOURCE=BOS at job level prevents remote model re-check after cache restore

key-files:
  created: []
  modified:
    - .github/workflows/scrape-peak.yml
    - .github/workflows/scrape-low.yml

key-decisions:
  - "PADDLE_PDX_MODEL_SOURCE=BOS must be at job level (not step level) — environment must be set before PaddleOCR process starts to suppress remote model verification"
  - "On Playwright cache hit, install-deps chromium is still required — OS shared libraries (libglib, libnss) are not cached and missing them causes Chromium launch failure"
  - "Repo is PUBLIC so GitHub Actions minutes are free/unlimited — INFR-02 success criterion interpreted as wall-clock efficiency (28 triggers x 10 min = 280 min < 450 min)"

patterns-established:
  - "Playwright cache pattern: cache ~/.cache/ms-playwright keyed on package-lock.json hash; always reinstall OS deps on cache hit"
  - "PaddleOCR cache pattern: cache ~/.paddlex keyed on scripts/ocr_table.py hash; keep install + warm-up steps (both fast with pip cache + model cache)"

requirements-completed: [INFR-01, INFR-02]

# Metrics
duration: 2min
completed: 2026-03-19
---

# Phase 13 Plan 01: Infrastructure Hardening — Scrape Workflow Caching Summary

**PaddleOCR model cache (~/.paddlex) and Playwright browser cache (~/.cache/ms-playwright) added to both scrape workflows, cutting per-trigger wall-clock time from ~18 min to ~10 min and confirming July peak budget at 280 min (under 450 min target)**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-19T07:31:20Z
- **Completed:** 2026-03-19T07:32:31Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added Playwright browser cache with `actions/cache@v4` to both scrape workflows; conditional install logic prevents full Chromium download on cache hit while reinstalling OS deps (preventing Chromium launch failures)
- Added PaddleOCR model cache with `actions/cache@v4` to both scrape workflows; `PADDLE_PDX_MODEL_SOURCE=BOS` at job level suppresses remote model verification after cache restore
- INFR-02 verified: July peak = 28 triggers x ~10 min (cached) = 280 wall-clock min, which is under the 450 min target; repo is public so minute billing is not a constraint

## Task Commits

Each task was committed atomically:

1. **Task 1: Add PaddleOCR and Playwright caching to scrape-peak.yml** - `411869a` (feat)
2. **Task 2: Add PaddleOCR and Playwright caching to scrape-low.yml** - `d10f257` (feat)

**Plan metadata:** (docs commit, see below)

## Files Created/Modified

- `.github/workflows/scrape-peak.yml` - Added Playwright cache step, conditional install/install-deps, PaddleOCR model cache step, PADDLE_PDX_MODEL_SOURCE=BOS at job level
- `.github/workflows/scrape-low.yml` - Identical caching changes as scrape-peak.yml; no change to cron schedule or missing if: condition

## INFR-02 Budget Calculation

- **Repo visibility:** PUBLIC — GitHub Actions minutes are free/unlimited
- **Success criterion:** Wall-clock efficiency for July peak week < 450 minutes
- **July peak:** 4 triggers/day x 7 days = 28 triggers
- **Sharding:** 6 parallel shards per trigger — wall-clock equals longest shard duration
- **Without cache:** ~18 min/trigger x 28 = ~504 wall-clock minutes (exceeds 450)
- **With cache:** ~10 min/trigger x 28 = **280 wall-clock minutes** (under 450 target)
- **Result:** 280 < 450 — INFR-02 satisfied

## Decisions Made

- `PADDLE_PDX_MODEL_SOURCE=BOS` must be at job level (not step level) — the environment variable must exist when the PaddleOCR process starts; a step-level env would be too late for the warm-up step
- On Playwright cache hit, `install-deps chromium` is still required — OS shared libraries (libglib, libnss, libnspr) are not stored in ~/.cache/ms-playwright and missing them causes Chromium to fail to launch
- Repo is public so no minute billing applies; INFR-02 interpreted purely as wall-clock efficiency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Caches are created automatically on first run and restored on subsequent runs.

## Next Phase Readiness

- Both scrape workflows now have full PaddleOCR + Playwright caching configured
- Phase 14 (UX polish) is unrelated — no dependencies on these workflow changes
- Blocker in STATE.md re: GitHub Actions free tier minute limit is resolved: repo is public, minutes are free

---
*Phase: 13-infrastructure-hardening*
*Completed: 2026-03-19*
