---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planning
stopped_at: "Checkpoint 01-data-foundation/01-03: awaiting human verify (pipeline + Vercel deploy)"
last_updated: "2026-03-18T13:02:17.177Z"
last_activity: 2026-03-17 — Roadmap created; all 14 v1 requirements mapped across 5 phases
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 3
  completed_plans: 3
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

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1 research flag]: Ministry portal URL and HTML structure must be verified manually before building the Ministry adapter — portal URLs change between cycles
- [Phase 1 research flag]: For each high-priority university, manually check whether cutoff pages are static HTML (Cheerio) or JS-rendered (Playwright) before writing adapters
- [Phase 3 research flag]: Serwist offline caching with Next.js App Router differs from Pages Router — worth a research pass before implementation
- [General]: Verify current library versions at npmjs.com before pinning (drizzle-orm, @serwist/next, next-intl, nuqs) — research used August 2025 training knowledge

## Session Continuity

Last session: 2026-03-18T13:02:17.175Z
Stopped at: Checkpoint 01-data-foundation/01-03: awaiting human verify (pipeline + Vercel deploy)
Resume file: None
