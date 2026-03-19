# Phase 8: Scraper Foundation - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace 70+ copy-pasted cheerio adapter files with a config-driven factory function, add batch DB inserts to the scraper runner, implement a zero-rows guard, and add a static JSON fallback to the /api/recommend endpoint.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase.

Key constraints from STATE.md:
- Zero-rows guard must be the first commit before any factory work — silent `rows_written: 0` as `'ok'` is an invisible regression
- Batch inserts must wrap chunks in a single `db.transaction()` — partial failure without transaction leaves inconsistent university data

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/scraper/types.ts` — RawRow, NormalizedRow, ScraperAdapter interfaces
- `lib/scraper/normalizer.ts` — normalize() function for raw→normalized conversion
- `lib/scraper/fetch.ts` — fetchHTML utility
- `lib/scraper/registry.ts` — adapter registry
- `lib/scraper/runner.ts` — current runner with row-by-row upserts
- `lib/scraper/run.ts` — scraper entry point
- `scrapers.json` — config file with university URLs and adapter mappings

### Established Patterns
- Adapters implement `ScraperAdapter` interface with `id` and `scrape(url)` method
- HTC adapter is the verified reference pattern: cheerio load → find table → extract headers → iterate rows → push RawRow[]
- Runner iterates configs, calls adapter.scrape(), normalizes, upserts row-by-row, logs to scrape_runs table
- DB uses Drizzle ORM with `onConflictDoUpdate` for upserts

### Integration Points
- `app/api/recommend/route.ts` — needs static fallback when Supabase is unreachable (currently throws DB_TIMEOUT)
- `lib/db/schema.ts` — cutoffScores, majors, scrapeRuns tables
- `.github/workflows/` — GitHub Actions scraping cron uses runner
- 78 adapter files in `lib/scraper/adapters/` — all follow similar cheerio pattern with copy-pasted boilerplate

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase.

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.

</deferred>
