# Phase 2: Core API and Algorithm - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 delivers all six Next.js API route handlers, the recommendation algorithm with multi-year cutoff trend weighting, edge caching for static lookups, and validated connection pooling via Supabase PgBouncer. No frontend — pure API layer consumed by Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Recommendation Algorithm
- Use last 3 years of cutoff data for trend weighting (most recent year weighted highest)
- Tier margins: dream = student_score ≥ cutoff + 3, practical = cutoff - 1 to cutoff + 2, safe = cutoff - 5 to cutoff - 2 (relative to weighted average)
- If a program has fewer than 3 years of data, use all available years — flag as `data_years_limited: true` in response
- Minimum 1 year of data required to include a university-major pair in results; exclude entirely if no cutoff score exists

### API Contract
- Response envelope: `{ data: [...], meta: { count, years_available } }` for list endpoints
- Error format: `{ error: { code: string, message: string } }` with appropriate HTTP status
- Pagination on /api/universities and /api/scores: cursor-based with `limit` (default 50, max 200) and `cursor` params
- /api/recommend: return all qualifying results (dream + practical + safe), include `suggested_top_15: boolean` flag on each row marking the auto-selected nguyện vọng list

### Caching Strategy
- Static lookups (/api/universities, /api/tohop, /api/years): `Cache-Control: public, s-maxage=86400, stale-while-revalidate=3600` (24h edge cache, 1h SWR)
- /api/scores: `Cache-Control: public, s-maxage=300, stale-while-revalidate=60` (5 min cache)
- /api/recommend: no cache — personalized per score/tohop input
- Cache invalidation: time-based only in v1; no manual purge

### Connection Pooling & Error Handling
- Rely on Supabase PgBouncer limits (port 6543, transaction mode) — no explicit Drizzle pool sizing; prepare: false already set in Phase 1
- DB query timeout: 10 seconds via AbortSignal or postgres.js `timeout` option
- DB unavailable: return 503 with `Retry-After: 30` header and `{ error: { code: "DB_UNAVAILABLE", message: "Service temporarily unavailable" } }`
- API route tests: integration tests using vitest with mocked Drizzle (consistent with Phase 1 runner test pattern); no real DB calls in CI

### Claude's Discretion
- Internal implementation details of trend weighting formula (e.g. simple linear decay vs. exponential weights)
- SQL query optimization for /api/recommend (single join vs. multiple queries)
- Exact file structure within app/api/ routes

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/db/schema.ts` — all 5 tables: universities, majors, tohop_codes, cutoff_scores, scrape_runs
- `lib/db/index.ts` — postgres.js + Drizzle DB connection, pooler URL, prepare: false
- `lib/scraper/types.ts` — NormalizedRow and ScraperAdapter interfaces (reference for data shape)
- `lib/scraper/normalizer.ts` — score/tohop validation patterns reusable in API input validation

### Established Patterns
- Drizzle ORM for all DB queries (no raw SQL)
- postgres.js driver with `prepare: false` for Supabase transaction-mode pooler
- Vitest for testing; `vi.hoisted()` + `vi.mock()` pattern for module mocks
- TypeScript strict mode; all files in `lib/` directory

### Integration Points
- API routes live in `app/api/` (Next.js 15 App Router convention)
- DB imported from `lib/db/index.ts`
- Phase 3 frontend will consume all endpoints defined here

</code_context>

<specifics>
## Specific Ideas

- /api/recommend should return enough data for Phase 3 to render both the ranked list AND pre-populate the nguyện vọng builder — include university name, major name, tohop, score, tier, and trend direction in each result row
- The `suggested_top_15` flag should apply priority rules: sort by tier (practical first, then dream, then safe), then by score proximity, then teacher training programs (sư phạm) deprioritized per 2026 rules

</specifics>

<deferred>
## Deferred Ideas

- Per-subject score input (SCOR-02) — deferred to Phase 3 frontend
- /api/universities/[id] full detail page data — noted but minimal in Phase 2; Phase 3 drives requirements
- Rate limiting on API routes — defer to Phase 5 infrastructure hardening
- Search endpoint (/api/search) — SRCH-01/SRCH-02 are Phase 3 concerns

</deferred>
