---
phase: 15-university-master-list-registry-gate-fix
plan: 02
subsystem: database
tags: [json, vitest, drizzle, supabase, seed-script, university-data]

# Dependency graph
requires:
  - phase: 15-university-master-list-registry-gate-fix/15-01
    provides: "scrapers.json schema migration + registry gate fix"
provides:
  - "data/uni_list.json with 343 Vietnamese university entries covering all regions"
  - "scripts/seed-universities.ts to populate Supabase universities table"
  - "tests/scraper/uni-list.test.ts validating uni_list.json structure"
affects: ["16-auto-discovery", "phase-16-scraper-activation", "FK-pre-condition-cutoff_scores"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "JSON data files in data/ directory as version-controlled seed sources"
    - "Seed scripts follow verify-db.ts pattern: loadEnvConfig + dynamic db import + process.exit"
    - "onConflictDoNothing for safe idempotent re-runs without overwriting manual edits"

key-files:
  created:
    - data/uni_list.json
    - scripts/seed-universities.ts
    - tests/scraper/uni-list.test.ts
  modified: []

key-decisions:
  - "343 entries (exceeds 250+ target) — included Northern, Central, Southern, Mekong Delta, Highland regions"
  - "Used onConflictDoNothing (not onConflictDoUpdate) to preserve manually-edited Supabase rows"
  - "Sort by id alphabetically for human readability and grep-ability"
  - "Vietnamese diacritics preserved in name_vi (from uni_list_examples.md source)"
  - "seed-universities.ts must run before Phase 16 scraper activation to satisfy FK on cutoff_scores"

patterns-established:
  - "Seed data pattern: JSON file in data/ + seed script in scripts/ + vitest validation in tests/scraper/"

requirements-completed: [UNIC-01, UNIC-02, UNIC-03]

# Metrics
duration: 15min
completed: 2026-03-20
---

# Phase 15 Plan 02: University Master List Summary

**343-entry Vietnamese university JSON master list (all regions) with Drizzle-based seed script using onConflictDoNothing for safe Supabase population**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-20T00:18:00Z
- **Completed:** 2026-03-20T00:33:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created data/uni_list.json with 343 institutions covering Northern (78 original), Central (Da Nang group, Hue group), Southern (HCMC DHQG, major publics), Mekong Delta (Can Tho, Tra Vinh, etc.), and Highland universities
- Created scripts/seed-universities.ts following verify-db.ts pattern with onConflictDoNothing for idempotent re-runs
- Created tests/scraper/uni-list.test.ts with 6 vitest validations (count, required fields, no duplicates, regional coverage)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create data/uni_list.json with 250+ universities and validation tests** - `be53af4` (feat)
2. **Task 2: Create seed-universities.ts script** - `1512fd3` (feat)

**Plan metadata:** (pending)

## Files Created/Modified
- `data/uni_list.json` - 343 Vietnamese university entries (id, name_vi, website_url), sorted alphabetically by id
- `scripts/seed-universities.ts` - Drizzle insert script for Supabase universities table using onConflictDoNothing
- `tests/scraper/uni-list.test.ts` - Vitest validation: 250+ count, required fields, no duplicates, Southern/Central/Northern coverage

## Decisions Made
- 343 entries chosen to maximize regional coverage — significantly exceeds 250 target, reducing risk of FK failures in Phase 16
- `onConflictDoNothing` over `onConflictDoUpdate`: preserves any manually-edited records in Supabase; re-runs are safe
- Sort by id alphabetically: improves grep/diff readability for future maintenance
- Included military/police academies and international branches as they accept THPT admissions
- Kept duplicate institution data (e.g., MDA vs MBS both mapping to humg.edu.vn) removed to maintain ID uniqueness — each ID maps to one entry

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The inline `npx tsx --eval` verification command from the plan failed due to `!` character escaping in the shell — verified using `node -e` instead. No impact on output.

## User Setup Required
- **Run before Phase 16 activation:** `npx tsx scripts/seed-universities.ts` must be run once to populate Supabase universities table, satisfying FK constraints on the cutoff_scores table

## Next Phase Readiness
- Phase 16 auto-discovery crawler can now reference 343 homepage URLs for all regions
- FK pre-condition satisfied: scrapers writing to cutoff_scores will find matching university rows
- Seed script is idempotent — safe to re-run if more universities are added later

---
*Phase: 15-university-master-list-registry-gate-fix*
*Completed: 2026-03-20*
