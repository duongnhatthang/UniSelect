---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: Complete Data Pipeline
status: unknown
stopped_at: Completed 16-02-PLAN.md
last_updated: "2026-03-20T08:01:37.065Z"
progress:
  total_phases: 4
  completed_phases: 2
  total_plans: 4
  completed_plans: 4
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-19)

**Core value:** Give every Vietnamese student the data and strategy to order their nguyện vọng list correctly — because getting the ranking wrong means being locked out of better options permanently.
**Current focus:** Phase 16 — Auto-Discovery CI Integration

## Current Position

Phase: 16 (Auto-Discovery CI Integration) — COMPLETE
Plan: 2 of 2

## Performance Metrics

**Velocity (v1.0 + v2.0 history):**

- Total plans completed: 37
- Total phases: 14 (across v1.0 and v2.0)

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

Key v3.0 decisions:

- Phase 15 before Phase 16: registry gate fix must precede adding new universities (hollow registry risk)
- Discovery is human-gated: apply-discovery.ts never auto-promotes URLs; prevents config corruption
- scrapers.json schema migration: static_verified removed, scrape_url added (null = not yet discovered)
- [Phase 15]: onConflictDoNothing preserves manually-edited Supabase rows; seed script safe for re-runs
- [Phase 15]: data/uni_list.json sorted by id alphabetically for grep-ability and future maintenance
- [Phase 16]: Skip entries with non-null scrape_url in buildStartUrlsFromScrapers to avoid re-crawling already-discovered universities
- [Phase 16]: discover.yml uses if-no-files-found: warn not error — crawler may legitimately find zero candidates
- [Phase 16]: apply-discovery.ts exports pure applyDiscovery() with FS-free core for testability; adapter_type set to 'cheerio' on patch so registry gate runs the scraper

### Pending Todos

None yet.

### Blockers/Concerns

- MOET portal scrapeability unconfirmed: may need Playwright if institution dropdown is JS-rendered
- Wide-table prevalence unknown until Phase 16 discovery run audits real cutoff pages
- p-limit ESM compatibility: verify-adapters.ts must use import syntax before installing p-limit

## Session Continuity

Last session: 2026-03-20T07:57:30.000Z
Stopped at: Completed 16-02-PLAN.md
Resume file: None
