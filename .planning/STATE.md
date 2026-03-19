---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Scraper Expansion + Quality + UX
status: planning
stopped_at: Completed 10-01-PLAN.md
last_updated: "2026-03-19T06:31:44.286Z"
last_activity: 2026-03-18 — v2.0 roadmap created
progress:
  total_phases: 7
  completed_phases: 2
  total_plans: 7
  completed_plans: 6
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
| Phase 08-scraper-foundation P01 | 2 | 2 tasks | 2 files |
| Phase 08 P02 | 8 | 2 tasks | 3 files |
| Phase 08-scraper-foundation P03 | 297 | 2 tasks | 4 files |
| Phase 09-scraper-resilience-testing P02 | 1 | 1 tasks | 2 files |
| Phase 09-scraper-resilience-testing P01 | 2 | 2 tasks | 10 files |
| Phase 10-auto-discovery-crawler P01 | 4 | 2 tasks | 7 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Phase 8]: Zero-rows guard must be the first commit before any factory work — silent `rows_written: 0` as `'ok'` is an invisible regression
- [Phase 8]: Batch inserts must wrap chunks in a single `db.transaction()` — partial failure without transaction leaves inconsistent university data
- [Phase 10]: Auto-discovery writes only to ephemeral `discovery-candidates.json` — scrapers.json is never written by crawler; human gate required
- [Phase 11]: Delta sign fix must touch both ResultsList.tsx and NguyenVongList.tsx in a single PR with a shared `computeDelta()` utility
- [Phase 14]: Design tokens (`@theme` block) must be implemented before dark mode — scattered `dark:text-gray-100` classes create a maintenance trap
- [Phase 08-scraper-foundation]: scrapeRuns audit insert stays OUTSIDE transaction to record even when transaction fails
- [Phase 08-scraper-foundation]: CHUNK_SIZE=500 for batch inserts to stay under Postgres 65535 parameter limit
- [Phase 08]: async readFile in DB_TIMEOUT catch block keeps recommend API available with stale data instead of returning 503
- [Phase 08]: meta.fallback: true in response body surfaces static-data state to frontend without breaking API contract
- [Phase 08-scraper-foundation]: Factory uses Array.some() over config keyword arrays for flexible config-driven column detection
- [Phase 08-scraper-foundation]: scrapers.json factory_config added to all cheerio adapters including static_verified:false — registry skips them but configs are ready for when URLs are verified
- [Phase 09-scraper-resilience-testing]: PaddleOCR 3.x models cached at ~/.paddlex (not ~/.paddleocr) with hashFiles key; PADDLE_PDX_MODEL_SOURCE=BOS at job level prevents remote re-check after cache restore
- [Phase 09]: Synthetic CI test images generated via Pillow script at runtime — no binary fixtures committed to git
- [Phase 09-scraper-resilience-testing]: Windows-1252 fixture uses iconv.encode() Buffer (not string) to exercise the non-UTF-8 chardet detection branch in fetchHTML
- [Phase 09-scraper-resilience-testing]: MSW onUnhandledRequest: 'error' enforces zero live network requests during scraper integration test runs
- [Phase 10-auto-discovery-crawler]: scorePageForCutoffs accepts CheerioAPI instance (not HTML string) — caller controls parsing, scorer stays pure
- [Phase 10-auto-discovery-crawler]: Body text excluded from scoring — only URL slugs, page titles, h1/h2/h3, and table headers checked to avoid news article false positives
- [Phase 10-auto-discovery-crawler]: TABLE_HEADER_KEYWORDS reuses HEADING_KEYWORDS — same Vietnamese terms appear in both headings and table columns across all 78 scrapers.json entries

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 10 research flag]: crawlee `enqueueLinks` glob pattern configuration for Vietnamese URL paths needs validation; Vietnamese keyword list must be checked against all 78 scrapers.json entries before implementation
- [Phase 12]: Verify @faker-js/faker v10 Node.js 20+ requirement against GitHub Actions runner before Phase 12 — pin to v9 or upgrade runner if on Node 18
- [Phase 13]: Verify GitHub Actions free tier minute limit for this repo's visibility (public vs private) before designing caching strategy — limits differ
- [Phase 14 research flag]: motion Reorder Android touch behavior must be validated before committing to the library; dark mode selector inconsistency (.dark class vs [data-theme=dark]) must be resolved before writing any CSS

## Session Continuity

Last session: 2026-03-19T06:31:44.283Z
Stopped at: Completed 10-01-PLAN.md
Resume file: None
