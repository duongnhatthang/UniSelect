# Phase 10: Auto-Discovery Crawler - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a Crawlee-based discovery crawler that scans university homepages, uses keyword scoring to identify cutoff-score pages, respects robots.txt and rate limits, and outputs ranked URL candidates to `discovery-candidates.json` for human review — without touching scrapers.json or the production database.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase.

Key constraints from STATE.md:
- Auto-discovery writes only to ephemeral `discovery-candidates.json` — scrapers.json is never written by crawler; human gate required
- crawlee `enqueueLinks` glob pattern configuration for Vietnamese URL paths needs validation
- Vietnamese keyword list must be checked against all 78 scrapers.json entries before implementation

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scrapers.json` — contains all 78 university homepages and URLs
- `lib/scraper/fetch.ts` — fetchHTML utility
- `tests/fixtures/` — HTML fixture library from Phase 9
- `tests/scraper/integration/msw-server.ts` — MSW server for testing

### Established Patterns
- Vitest for testing with MSW for HTTP interception
- Config-driven adapters via factory pattern

### Integration Points
- `scrapers.json` — read-only source of university homepage URLs
- Output: `discovery-candidates.json` — ephemeral review file, never committed

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase.

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.

</deferred>
