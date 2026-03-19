---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Scraper Expansion + Quality + UX
status: ready_to_plan
stopped_at: null
last_updated: "2026-03-18T12:00:00.000Z"
last_activity: 2026-03-18 — v2.0 roadmap created (7 phases, 32 requirements mapped)
progress:
  total_phases: 7
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-18)

**Core value:** Give every Vietnamese student the data and strategy to order their nguyện vọng list correctly — because getting the ranking wrong means being locked out of better options permanently.
**Current focus:** Phase 8 — Scraper Foundation (ready to plan)

## Current Position

Phase: 8 of 14 (Scraper Foundation)
Plan: — (not yet planned)
Status: Ready to plan
Last activity: 2026-03-18 — v2.0 roadmap created

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity (v1.0 history):**
- Total plans completed: 19
- Average duration: ~6 min
- Total execution time: ~2 hours

**v2.0 By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans (v1.0): 5min, 2min, 8min, 8min, 2min
- Trend: Stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Phase 8]: Zero-rows guard must be the first commit before any factory work — silent `rows_written: 0` as `'ok'` is an invisible regression
- [Phase 8]: Batch inserts must wrap chunks in a single `db.transaction()` — partial failure without transaction leaves inconsistent university data
- [Phase 10]: Auto-discovery writes only to ephemeral `discovery-candidates.json` — scrapers.json is never written by crawler; human gate required
- [Phase 11]: Delta sign fix must touch both ResultsList.tsx and NguyenVongList.tsx in a single PR with a shared `computeDelta()` utility
- [Phase 14]: Design tokens (`@theme` block) must be implemented before dark mode — scattered `dark:text-gray-100` classes create a maintenance trap

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 10 research flag]: crawlee `enqueueLinks` glob pattern configuration for Vietnamese URL paths needs validation; Vietnamese keyword list must be checked against all 78 scrapers.json entries before implementation
- [Phase 12]: Verify @faker-js/faker v10 Node.js 20+ requirement against GitHub Actions runner before Phase 12 — pin to v9 or upgrade runner if on Node 18
- [Phase 13]: Verify GitHub Actions free tier minute limit for this repo's visibility (public vs private) before designing caching strategy — limits differ
- [Phase 14 research flag]: motion Reorder Android touch behavior must be validated before committing to the library; dark mode selector inconsistency (.dark class vs [data-theme=dark]) must be resolved before writing any CSS

## Session Continuity

Last session: 2026-03-18
Stopped at: v2.0 roadmap created — all 32 requirements mapped to phases 8-14
Resume file: None
