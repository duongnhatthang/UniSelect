# Phase 9: Scraper Resilience Testing - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Create HTML fixtures covering 7+ edge-case formats, a fake HTTP server for integration testing adapters without live network requests, and a PaddleOCR CI job in GitHub Actions with cached model downloads.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure/testing phase.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/scraper/factory.ts` — `createCheerioAdapter(config)` factory from Phase 8
- `lib/scraper/types.ts` — RawRow, NormalizedRow, ScraperAdapter interfaces
- `lib/scraper/fetch.ts` — fetchHTML utility (target for mock/intercept)
- `tests/scraper/` — existing adapter tests and runner tests
- `scrapers.json` — all 78 adapter configs with factory_config

### Established Patterns
- Vitest 4.1.0 test framework with vi.mock for dependency injection
- Adapter contract tests in `tests/scraper/adapters/adapter-contract.test.ts`
- Factory test in `tests/scraper/factory.test.ts` with HTML string fixtures

### Integration Points
- `.github/workflows/` — GitHub Actions workflows for scraping cron
- PaddleOCR adapter (GHA) uses separate scraping strategy
- Playwright adapters (DCN) use browser-based scraping

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase.

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.

</deferred>
