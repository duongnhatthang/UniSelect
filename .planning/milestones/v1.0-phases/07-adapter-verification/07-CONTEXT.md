# Phase 7: Adapter Verification & Data Population - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Verify university adapter URLs for 5-7 priority universities, enable scraping for verified adapters, populate static fallback data, and establish handling strategies for JS-rendered and image-based pages (with working prototypes for each).

</domain>

<decisions>
## Implementation Decisions

### University Selection Priority
- Target HTC (confirmed working static HTML) first, then top-tier demand: BKA, KHA (NEU), NTH (FTU), BVH (PTIT), GHA (UTC)
- Aim for 5-7 verified adapters (meets success criterion "at least 5")

### JS-Rendered Page Strategy
- Add Playwright as optional dependency for JS-rendered page scraping
- Create 1 working Playwright adapter (e.g. NEU or FTU) as a reference pattern
- Document the Playwright adapter approach for future adapters
- Adds ~30s per adapter in CI when using Playwright

### Image-Based Page Strategy
- Add PaddleOCR (Python, free) as a prototype for 1 image-based university (e.g. BKA)
- This requires Python in CI alongside Node — document the setup
- Prototype proves the pattern; full rollout deferred to future work

### Data Population & Verification
- Web fetch each target URL, check HTTP status + HTML content for score table markers
- Log results to a verification report
- Run generate-static after verified adapters scrape successfully
- Commit updated JSON to public/data/

### Claude's Discretion
- Specific URL paths for each university's cutoff score page (discovered during verification)
- Playwright dependency version and configuration
- PaddleOCR setup specifics and Python version requirements
- Verification report format and location

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/scraper/adapters/*.ts` — 78 adapter files with consistent structure (cheerio-based)
- `lib/scraper/fetch.ts` — HTML fetch utility
- `lib/scraper/types.ts` — ScraperAdapter interface, RawRow type
- `lib/scraper/runner.ts` — scraper execution runner
- `lib/scraper/registry.ts` — adapter registry
- `scrapers.json` — adapter configuration with static_verified flags
- `scripts/generate-static-json.ts` — static JSON generator (universities, scores-by-tohop, tohop)

### Established Patterns
- Adapters export a `ScraperAdapter` with `id` and `scrape(url)` method
- Semantic text anchors for table parsing (not CSS selectors)
- Minimum-rows assertion throws on 0 rows (catches JS rendering or layout changes)
- `static_verified: false` prevents adapters from running in CI

### Integration Points
- `scrapers.json` — flip `static_verified` to true and update `url` to specific cutoff page
- GitHub Actions workflow uses scrapers.json to determine which adapters run
- `generate-static-json.ts` reads from DB and writes to `public/data/`

</code_context>

<specifics>
## Specific Ideas

- HTC adapter already confirmed working (from project memory)
- BKA publishes scores as JPEG/PNG images — good candidate for PaddleOCR prototype
- NEU/FTU use JS rendering — good candidates for Playwright prototype
- All 78 adapters currently have `static_verified: false`

</specifics>

<deferred>
## Deferred Ideas

- Full rollout of Playwright to all JS-rendered universities (beyond 1 prototype)
- Full rollout of PaddleOCR to all image-based universities (beyond 1 prototype)
- Ministry portal adapter verification (URL changes between cycles)

</deferred>

---
*Phase: 07-adapter-verification*
*Context gathered: 2026-03-18 via Smart Discuss*
