# Phase 5: Infrastructure Hardening - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 hardens the system for July peak traffic: static JSON CDN layer for common queries, Core Web Vitals optimization, scrape failure alerting, Supabase resilience, and load testing. No new features — pure infrastructure and observability.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase.

Key constraints from prior phases:
- Vercel Edge Cache headers already set in Phase 2 API routes
- Supabase PgBouncer (port 6543, prepare:false) configured in Phase 1
- Serwist service worker caches static endpoints (Phase 3)
- GitHub Actions workflows for scraping (Phase 4)
- Free-tier only: no paid monitoring services; use GitHub Actions + built-in Vercel analytics

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- All API routes with Cache-Control headers (`app/api/`)
- Serwist service worker with runtime caching (`app/sw.ts`)
- scrape_runs table for monitoring scrape health (`lib/db/schema.ts`)
- Fail-open runner with error logging (`lib/scraper/runner.ts`)

### Established Patterns
- Next.js 16 App Router; Vercel deployment
- Vitest for testing
- GitHub Actions for CI/CD

### Integration Points
- Vercel deployment config
- GitHub Actions workflows
- Supabase database

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
