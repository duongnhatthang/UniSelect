# Phase 13: Infrastructure Hardening - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Optimize GitHub Actions to fit within free-tier budget for July peak scraping, cache PaddleOCR models and Playwright browsers, and add a Supabase keep-alive cron workflow.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase.

Key constraints from STATE.md:
- Verify GitHub Actions free tier minute limit for this repo's visibility (public vs private) before designing caching strategy — limits differ
- GitHub Actions July budget: 4x/day × 6 shards exceeds free tier by 3.7x (per audit)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.github/workflows/` — existing scraping, OCR, and CI workflows
- `scrapers.json` — 78 university configs with shard assignments
- `lib/db/index.ts` — Drizzle DB connection

### Established Patterns
- 6-shard matrix for scraping (78 universities / 6 = 13 per shard)
- actions/cache@v4 already used in ci-ocr.yml for PaddleOCR models
- Supabase connection via Drizzle ORM

### Integration Points
- Scraping cron workflow needs shard optimization
- PaddleOCR and Playwright need cache across workflow runs
- Supabase keep-alive needs separate cron workflow

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase.

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.

</deferred>
