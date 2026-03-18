---
phase: 05-infrastructure-hardening
plan: "02"
subsystem: monitoring
tags: [github-actions, staleness, alerting, scraper, drizzle-orm]
dependency_graph:
  requires:
    - scrape_runs table (Phase 01)
    - universities table (Phase 01)
  provides:
    - Automated staleness detection for university cutoff data
    - Daily GitHub Actions alert workflow
  affects:
    - Operator visibility into scrape health
tech_stack:
  added: []
  patterns:
    - tsx standalone script with drizzle-orm query
    - process.exit(1) for GitHub Actions failure propagation
    - max() aggregate groupBy subquery pattern for latest-per-group
key_files:
  created:
    - scripts/check-staleness.ts
    - .github/workflows/staleness-alert.yml
  modified: []
decisions:
  - "STALENESS_DAYS defaults to 7 in script; workflow hardcodes 3 for tighter production alerting window"
  - "process.exit(1) on stale detection uses GitHub's built-in failure notification — no external alerting service needed"
  - "max(run_at) grouped by university_id in JS comparison avoids sql interval arithmetic across DB drivers"
metrics:
  duration: 8min
  completed_date: "2026-03-18"
  tasks_completed: 2
  files_created: 2
---

# Phase 05 Plan 02: Staleness Alerting System Summary

**One-liner:** Daily GitHub Actions workflow with tsx staleness script that exits non-zero when any university's last ok scrape_run exceeds the 3-day window, triggering email alerts to repo watchers.

## What Was Built

A two-file automated staleness detection system:

1. `scripts/check-staleness.ts` — standalone tsx script that queries the `scrape_runs` table for the most recent `ok` or `flagged` run per university, compares against a configurable staleness window (`STALENESS_DAYS` env var, default 7), prints `[STALE]` lines for each stale university, and exits with code 1 if any are found.

2. `.github/workflows/staleness-alert.yml` — GitHub Actions workflow that runs the script daily at 08:00 UTC (after overnight scrapes complete) and on manual dispatch. Sets `STALENESS_DAYS=3` for a tight production window. Failure propagates to GitHub's notification system — no external alerting service required.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Staleness check script | 14a88c2 | scripts/check-staleness.ts |
| 2 | Staleness alert GitHub Actions workflow | dc534ba | .github/workflows/staleness-alert.yml |

## Verification Results

- `npx tsc --noEmit`: PASS — zero TypeScript errors
- YAML parse check: PASS — valid workflow YAML
- Code review: exits 1 on stale, 0 on fresh; STALENESS_DAYS env var with default 7; DATABASE_URL secret used

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `scripts/check-staleness.ts` exists: FOUND
- `.github/workflows/staleness-alert.yml` exists: FOUND
- Commit 14a88c2 exists: FOUND
- Commit dc534ba exists: FOUND
