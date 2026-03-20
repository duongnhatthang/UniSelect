---
phase: 16-auto-discovery-ci-integration
plan: "01"
subsystem: discovery
tags: [schema-migration, ci, github-actions, crawler]
dependency_graph:
  requires: []
  provides: [DISC-01, DISC-02]
  affects: [scripts/discover.ts, .github/workflows/discover.yml]
tech_stack:
  added: []
  patterns: [GHA weekly cron artifact upload]
key_files:
  modified: [scripts/discover.ts]
  created: [.github/workflows/discover.yml]
decisions:
  - "Skip entries with non-null scrape_url to avoid re-crawling already-discovered universities"
  - "Skip entries with adapter_type=skip to respect explicit exclusions"
  - "No DATABASE_URL required in discover.yml — crawler is read-only (cheerio only)"
  - "Use if-no-files-found: warn not error — crawler may legitimately find zero candidates"
metrics:
  duration_seconds: 99
  completed_date: "2026-03-20T07:55:52Z"
  tasks_completed: 2
  files_modified: 2
---

# Phase 16 Plan 01: Schema Migration and Discovery CI Workflow Summary

**One-liner:** Migrated discover.ts from removed Phase 14 schema fields (entry.url, static_verified) to Phase 15 schema (website_url, scrape_url, adapter_type) and wired it into a weekly GHA workflow with artifact upload.

## What Was Built

**scripts/discover.ts** — Schema migration:
- Replaced stale `ScraperEntry` interface: removed `url` and `static_verified`, added `website_url`, `scrape_url`, and `adapter_type`
- Updated `buildStartUrlsFromScrapers()` to read `entry.website_url` instead of `entry.url`
- Added skip guard: `if (entry.scrape_url !== null) continue` — avoids re-crawling already-discovered universities
- Added skip guard: `if (entry.adapter_type === 'skip') continue` — respects explicit exclusions
- Updated console.warn message to reference `entry.website_url`

**.github/workflows/discover.yml** — New weekly GHA workflow:
- Triggers weekly (Sundays 02:00 UTC) via cron and on-demand via workflow_dispatch
- Runs `npx tsx scripts/discover.ts` using Node 24 with npm cache
- Uploads `discovery-candidates.json` as a 30-day artifact (if-no-files-found: warn)
- No secrets needed — crawler is read-only, uses cheerio only

## Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Migrate discover.ts schema + create discover.yml | e1a7ffd |
| 2 | Verified all 5 existing discovery tests pass (no changes needed) | — |

## Test Results

- Discovery integration tests: 5/5 pass
- Full test suite: 593/593 pass across 33 test files
- No regressions introduced by the schema migration

## Verification Results

| Check | Result |
|-------|--------|
| `entry.url` occurrences in discover.ts | 0 (fully removed) |
| `static_verified` occurrences in discover.ts | 0 (fully removed) |
| `entry.website_url` occurrences in discover.ts | 2 (interface + usage) |
| discover.yml exists | YES |
| discover.yml has cron | YES |
| discover.yml has workflow_dispatch | YES |
| discover.yml has upload-artifact@v4 | YES |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

All files verified present. All commits verified in git log.
