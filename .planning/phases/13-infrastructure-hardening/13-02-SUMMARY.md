---
phase: 13-infrastructure-hardening
plan: "02"
subsystem: infra
tags: [github-actions, cron, supabase, postgres, keepalive]

# Dependency graph
requires:
  - phase: 12-testing-ci
    provides: CI workflow patterns (checkout@v4, setup-node@v4, npm ci, npx tsx)
provides:
  - GitHub Actions cron workflow preventing Supabase free-tier auto-pause
  - Manual trigger (workflow_dispatch) for on-demand database ping
affects: [13-infrastructure-hardening, supabase, database-availability]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - npx tsx -e with inline TypeScript for one-off DB scripts in CI
    - postgres.js with prepare:false for Supabase Supavisor transaction pool mode

key-files:
  created:
    - .github/workflows/supabase-keepalive.yml
  modified: []

key-decisions:
  - "Cron */5 day-of-month keeps max gap to 6 days (day 26 -> day 1 in Feb) — safely inside 7-day Supabase pause window"
  - "postgres.js (postgres npm package) used instead of pg — consistency with lib/db/index.ts; pg is not installed"
  - "npx tsx -e inline script avoids creating a separate keepalive.ts file that would need maintenance"

patterns-established:
  - "Pattern: Inline npx tsx -e for short one-off DB scripts in CI rather than committing a separate script file"

requirements-completed: [INFR-03]

# Metrics
duration: 1min
completed: 2026-03-19
---

# Phase 13 Plan 02: Supabase Keep-Alive Cron Workflow Summary

**GitHub Actions cron workflow pings Supabase every 5 days via postgres.js SELECT 1 using DATABASE_URL secret, preventing free-tier auto-pause with a 2-day safety margin**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-19T07:31:23Z
- **Completed:** 2026-03-19T07:32:09Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created `.github/workflows/supabase-keepalive.yml` with cron schedule `0 10 */5 * *` (every 5 days)
- Uses `postgres` npm package (postgres.js) with `prepare: false` — consistent with `lib/db/index.ts`
- `workflow_dispatch` allows manual trigger if a scheduled run fails
- All 513 existing tests continue to pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Supabase keep-alive cron workflow** - `eaff415` (chore)

**Plan metadata:** (pending final commit)

## Files Created/Modified
- `.github/workflows/supabase-keepalive.yml` - Cron workflow that pings Supabase every 5 days via SELECT 1

## Decisions Made
- `*/5` day-of-month cron: maximum gap is 6 days (day 26 to day 1 in February) — safely within the 7-day Supabase auto-pause threshold
- Used `npx tsx -e` with inline TypeScript to avoid creating a separate keepalive script file; consistent with the project's existing `npx tsx` CI pattern
- Used `postgres` package (postgres.js) not `pg` — the project only has postgres.js installed; `prepare: false` matches Supabase Supavisor transaction pool requirement

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**ACTION REQUIRED:** Ensure the `DATABASE_URL` secret is set in the GitHub repository secrets (Settings > Secrets and variables > Actions). This secret is already required by the scrape workflows; if those are working, no new action is needed.

None - no new external service configuration required beyond existing `DATABASE_URL` secret.

## Next Phase Readiness
- Supabase keep-alive is in place; database will not auto-pause during development quiet periods
- Phase 13 infrastructure hardening complete; ready for Phase 14 (UI polish / dark mode)

---
*Phase: 13-infrastructure-hardening*
*Completed: 2026-03-19*
