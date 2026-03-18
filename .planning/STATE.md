---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planning
stopped_at: Completed 04-scraper-expansion/04-02-PLAN.md
last_updated: "2026-03-18T18:59:27.048Z"
last_activity: 2026-03-17 — Roadmap created; all 14 v1 requirements mapped across 5 phases
progress:
  total_phases: 5
  completed_phases: 4
  total_plans: 12
  completed_plans: 12
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-17)

**Core value:** Give every Vietnamese student the data and strategy to order their nguyện vọng list correctly — because getting the ranking wrong means being locked out of better options permanently.
**Current focus:** Phase 1 — Data Foundation

## Current Position

Phase: 1 of 5 (Data Foundation)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-03-17 — Roadmap created; all 14 v1 requirements mapped across 5 phases

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 01-data-foundation P01 | 6min | 2 tasks | 12 files |
| Phase 01-data-foundation P02 | 6min | 2 tasks | 6 files |
| Phase 01-data-foundation P03 | 15min | 2 tasks | 14 files |
| Phase 01-data-foundation P03 | 15min | 3 tasks | 14 files |
| Phase 02-core-api-and-algorithm P01 | 4min | 2 tasks | 6 files |
| Phase 02-core-api-and-algorithm P02 | 9min | 2 tasks | 13 files |
| Phase 03-frontend-pwa P01 | 7min | 2 tasks | 18 files |
| Phase 03-frontend-pwa P03 | 5min | 2 tasks | 8 files |
| Phase 03-frontend-pwa P02 | 15min | 2 tasks | 10 files |
| Phase 03-frontend-pwa P04 | 3min | 1 tasks | 12 files |
| Phase 03-frontend-pwa P05 | 3min | 2 tasks | 5 files |
| Phase 04-scraper-expansion P01 | 3min | 2 tasks | 73 files |
| Phase 04-scraper-expansion P02 | 2min | 2 tasks | 4 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Init]: GitHub Actions is mandatory as scraper scheduler — Vercel Hobby cron is capped at once/day, insufficient for July peak
- [Init]: Supabase free tier row/connection limits are a schema constraint — design for ~50k rows, use PgBouncer from day one
- [Init]: Database schema must be stable before any adapters are written — retroactive schema changes invalidate all scrapers
- [Init]: Validation layer (score range, tổ hợp format, encoding) must ship before any data reaches production
- [Phase 01-data-foundation]: Use timestamp with withTimezone:true instead of timestamptz — drizzle-orm 0.45.x dropped the timestamptz alias
- [Phase 01-data-foundation]: DB connection always via Supabase pooler URL (port 6543) with prepare:false for serverless transaction-mode safety
- [Phase 01-data-foundation]: Use vi.hoisted() for Vitest mock references in vi.mock() factories — avoids ReferenceError from hoisting
- [Phase 01-data-foundation]: Mock drizzle-orm sql as tagged template function not Proxy — sql is called as a tag, must be callable
- [Phase 01-data-foundation]: scrapeRuns insert is plain insert (no upsert) — run records are append-only logs
- [Phase 01-data-foundation]: All adapter static_verified flags default to false — adapters will not run until manually audited and enabled
- [Phase 01-data-foundation]: tsx declared as devDependency so npm ci in GitHub Actions installs it for npx tsx lib/scraper/run.ts
- [Phase 01-data-foundation]: GitHub Actions uses single job for Phase 1 pilot; matrix sharding deferred to Phase 4
- [Phase 01-data-foundation]: All adapter static_verified flags default to false — adapters will not run until manually audited and enabled
- [Phase 01-data-foundation]: tsx declared as devDependency so npm ci in GitHub Actions installs it for npx tsx lib/scraper/run.ts
- [Phase 01-data-foundation]: GitHub Actions uses single job for Phase 1 pilot; matrix sharding deferred to Phase 4
- [Phase 02-core-api-and-algorithm]: CutoffDataRow.score typed as string matching Postgres numeric return; parseFloat called in engine before arithmetic
- [Phase 02-core-api-and-algorithm]: withTimeout uses Promise.race (not postgres.js timeout option) — required for Supabase transaction-mode pooler at port 6543
- [Phase 02-core-api-and-algorithm]: Relative imports used in route handlers instead of @/ alias — tsconfig paths map @/* to ./src/* which does not exist in this project
- [Phase 02-core-api-and-algorithm]: anchorYear derived from max(year) DB query per tohop code — ensures results include most recently scraped data regardless of calendar year
- [Phase 03-frontend-pwa]: Serwist sw.ts uses matcher property and NetworkOnly class instance — sw9.5.7 API change from urlPattern string approach in older docs
- [Phase 03-frontend-pwa]: Split dev/build scripts: dev=next dev --turbopack, build=next build --webpack — Serwist requires webpack for SW bundling
- [Phase 03-frontend-pwa]: next-intl without i18n routing: cookie-based locale with NEXT_LOCALE key, router.refresh() on toggle
- [Phase 03-frontend-pwa]: cleanup() + afterEach required for jsdom test isolation — screen.getByText finds elements from all renders without it
- [Phase 03-frontend-pwa]: tohop filter in UniversitySearch shows dropdown but does not filter university list — universities table has no tohop_codes column; applies at recommendation layer
- [Phase 03-frontend-pwa]: parseAsJson in nuqs 2.8.9 requires a validator argument: parseAsJson(validator) not parseAsJson()
- [Phase 03-frontend-pwa]: afterEach cleanup() required in jsdom component tests to prevent DOM accumulation across vitest test runs
- [Phase 03-frontend-pwa]: resolveLocale named export in i18n/request.ts: extracts pure locale logic from Next.js server context for unit testability without mocking cookies()
- [Phase 03-frontend-pwa]: TierBadge uses t(tier) — tier values exactly match translation keys so t('dream') returns Ước mơ in vi locale
- [Phase 03-frontend-pwa]: array_agg(distinct ...) via sql template tag in subquery — Drizzle has no built-in array aggregation; coalesce to empty array for universities with no cutoff scores
- [Phase 04-scraper-expansion]: Generator script approach for 72 adapter files — reduces error surface, re-runnable for future university additions
- [Phase 04-scraper-expansion]: UNIVERSITIES array embedded in generator (not read from DB) — keeps generator self-contained and executable without DB access
- [Phase 04-scraper-expansion]: 6-shard matrix chosen: 78 universities / 6 = 13 per shard, well within 30min per job
- [Phase 04-scraper-expansion]: PEAK_SCHEDULE_ENABLED repo variable toggle avoids code changes to switch peak mode on/off
- [Phase 04-scraper-expansion]: Contract test uses dynamic import loop over scrapers.json — zero test file changes needed for future adapters

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1 research flag]: Ministry portal URL and HTML structure must be verified manually before building the Ministry adapter — portal URLs change between cycles
- [Phase 1 research flag]: For each high-priority university, manually check whether cutoff pages are static HTML (Cheerio) or JS-rendered (Playwright) before writing adapters
- [Phase 3 research flag]: Serwist offline caching with Next.js App Router differs from Pages Router — worth a research pass before implementation
- [General]: Verify current library versions at npmjs.com before pinning (drizzle-orm, @serwist/next, next-intl, nuqs) — research used August 2025 training knowledge

## Session Continuity

Last session: 2026-03-18T18:56:17.740Z
Stopped at: Completed 04-scraper-expansion/04-02-PLAN.md
Resume file: None
