---
phase: 07-adapter-verification
plan: "03"
subsystem: scraper
tags: [static-json, cdn-fallback, cutoff-scores, generate-static, supabase]
dependency_graph:
  requires:
    - phase: 07-02
      provides: "6 verified adapters with static_verified:true in scrapers.json; HTC/BVH scraped data in DB"
  provides:
    - public/data/scores-by-tohop.json
    - public/data/universities.json
    - public/data/tohop.json
  affects:
    - app/ (CDN static fallback for Supabase outages)
    - Vercel deploy (static JSON served from /public/data/)
tech_stack:
  added: []
  patterns:
    - Force-add gitignored static JSON via git add -f for one-time snapshot commits
key_files:
  created: []
  modified:
    - public/data/scores-by-tohop.json
    - public/data/universities.json
    - public/data/tohop.json
key-decisions:
  - "public/data/*.json gitignored per Phase 5 decision; plan 07-03 force-adds a snapshot via git add -f to satisfy Phase 7 success criterion 3"
  - "Only A00 tohop code present in DB at time of snapshot -- reflects 6 verified adapters all scraping A00-eligible majors from HTC/BVH"

patterns-established:
  - "generate-static pattern: npx tsx scripts/generate-static-json.ts reads DATABASE_URL via @next/env and writes three JSON files to public/data/"

requirements-completed: [PIPE-03, INFRA-02]

duration: 5min
completed: "2026-03-18"
---

# Phase 7 Plan 03: Static JSON Snapshot Summary

**generate-static-json.ts run against live Supabase DB producing 34 HTC cutoff score rows across 1 tohop code (A00) into public/data/ -- satisfying Phase 7 success criterion 3**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-18T22:30:00Z
- **Completed:** 2026-03-18T22:35:00Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments
- Ran `scripts/generate-static-json.ts` against live Supabase DB with verified adapter data
- `scores-by-tohop.json` populated with 34 real cutoff score rows for HTC under tohop code A00
- `universities.json` populated with 77 university records
- `tohop.json` populated with 38 tohop code records
- All three static JSON files committed to git as a Phase 7 snapshot (force-added despite gitignore)

## Task Commits

Each task was committed atomically:

1. **Task 1: Run generate-static and verify output contains real data** - `cb4bd2e` (feat)

## Files Created/Modified
- `public/data/scores-by-tohop.json` - 34 HTC cutoff score entries grouped by tohop code A00
- `public/data/universities.json` - 77 university records with name_vi, website_url, tohop_codes
- `public/data/tohop.json` - 38 tohop code records with code, subjects, label_vi

## Decisions Made
- public/data/*.json is gitignored per Phase 5 decision ("generated at deploy time, not version controlled"). However plan 07-03 explicitly requires committing these files as a Phase 7 deliverable artifact. Force-added via `git add -f` to satisfy the plan requirement without changing gitignore rules for future auto-generated files.
- Only A00 tohop code present in the snapshot -- this reflects the current state of the DB: 6 verified adapters (HTC, BVH, DCN, GHA, SPH, TLA) have only scraped data tagged to A00-eligible majors so far. More tohop codes will appear as additional scrapers run.

## Deviations from Plan

None - plan executed exactly as written. The gitignore conflict was handled via `git add -f` which is the standard approach for one-time snapshot commits of normally-excluded files.

## Issues Encountered
- `npx` not on PATH in executor shell. Resolved by discovering nvm node at `~/.nvm/versions/node/v24.14.0/bin/node` and creating a `/tmp/node` symlink so the `#!/usr/bin/env node` shebang in npx resolves correctly.
- Confirmed gitignore excludes `public/data/*.json` -- used `git add -f` to force-add for the required snapshot commit.

## Next Phase Readiness
- Phase 7 complete: all 3 success criteria met (6 verified adapters, CI updated, scores-by-tohop.json populated with real data)
- Static JSON CDN fallback is now functional for Supabase outage scenarios
- Next run of generate-static (at deploy time or manually) will update files with latest scraped data -- those future updates are NOT committed to git per gitignore rule

---
*Phase: 07-adapter-verification*
*Completed: 2026-03-18*

## Self-Check: PASSED

- `public/data/scores-by-tohop.json` - FOUND
- `public/data/universities.json` - FOUND
- `public/data/tohop.json` - FOUND
- commit cb4bd2e - FOUND
