# Phase 4: Scraper Expansion - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 expands from the 5 pilot scrapers (Phase 1) to all 78+ universities in the seed list. Adds GitHub Actions matrix sharding for parallel execution, peak-frequency scheduling for July, and ensures the entire pipeline is fail-open.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase.

Key constraints from prior phases:
- Existing adapter pattern: `ScraperAdapter` interface from `lib/scraper/types.ts`
- Registry pattern: `scrapers.json` + `lib/scraper/registry.ts`
- Fail-open runner: `lib/scraper/runner.ts` already handles per-adapter failures
- All adapters default `static_verified: false` — safety gate prevents scraping until manually enabled
- GitHub Actions single-job pattern from Phase 1 (`scrape-low.yml`)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/scraper/types.ts` — ScraperAdapter interface
- `lib/scraper/registry.ts` — adapter registry reading from scrapers.json
- `lib/scraper/runner.ts` — fail-open runner with scrape_run logging
- `lib/scraper/fetch.ts` — encoding-safe HTML fetcher
- `lib/scraper/normalizer.ts` — score/tohop validation
- `lib/scraper/adapters/bka.ts` — reference adapter implementation
- `scrapers.json` — 6 entries (MINISTRY, BKA, KHA, NTH, GHA, DCN)
- `.github/workflows/scrape-low.yml` — daily cron workflow

### Established Patterns
- Each adapter: exports `ScraperAdapter` with `id` and `scrape(url)` method
- HTML parsing with cheerio
- Contract tests: `tests/scraper/adapters/adapter-contract.test.ts`
- Behavioral tests: `tests/scraper/adapters/bka.test.ts`

### Integration Points
- `scrapers.json` — central registry; add new entries here
- `lib/scraper/adapters/` — one file per adapter
- `.github/workflows/` — CI/CD workflows

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
