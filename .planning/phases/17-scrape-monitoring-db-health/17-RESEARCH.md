# Phase 17: Scrape Monitoring + DB Health - Research

**Researched:** 2026-03-20
**Domain:** Next.js API Routes, Drizzle ORM queries, Supabase free-tier storage, GHA workflow logging
**Confidence:** HIGH

## Summary

Phase 17 has three tightly scoped deliverables that work against an existing, well-understood codebase. The `scrape_runs` table already records every adapter run with `university_id`, `status`, `rows_written`, `rows_rejected`, `error_log`, and `run_at`. The query patterns for `check-staleness.ts` demonstrate exactly how to aggregate `scrape_runs` with Drizzle ORM — the scrape-status API endpoint is a straightforward extension of that pattern. The existing `keepalive.mjs` workflow is the natural home for a pruning step (adds one `DELETE WHERE run_at < NOW() - INTERVAL '90 days'` query). The GHA summary requires only collecting per-adapter results in `runner.ts` and printing a summary line in `run.ts` after `runScraper` returns.

The codebase already follows clear conventions: Drizzle ORM with postgres-js, Next.js App Router API routes at `app/api/`, `withTimeout` wrapper for DB calls, `errorResponse` helper for error responses. Phase 17 extends these patterns rather than introducing new infrastructure.

No new npm dependencies are needed for any of the three requirements.

**Primary recommendation:** Implement as three independent changes — (1) scrape-status API route mirroring existing api pattern, (2) prune query added to keepalive.mjs and supabase-keepalive.yml, (3) result accumulation + summary print in runner.ts/run.ts.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MON-01 | Scrape status queryable via API endpoint — per-university last scrape time, rows written, error status | `scrape_runs` table has all needed columns; Drizzle aggregation pattern established in `check-staleness.ts`; mirrors existing `app/api/universities/route.ts` pattern |
| MON-02 | `scrape_runs` table has 90-day retention pruning to stay within Supabase 500MB free-tier limit | `keepalive.mjs` is the correct vehicle — already uses raw postgres-js, runs every 5 days; pruning is one DELETE statement |
| MON-03 | GHA scrape workflow logs summary statistics (attempted/succeeded/failed/zero-rows) at end of each shard run | `runScraper` loops through adapters and already records status per run; returning a tally instead of `void` enables the summary print in `run.ts` |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | already installed | DB query builder for scrape-status query | Already used throughout codebase |
| postgres | already installed | Raw SQL in keepalive.mjs for prune query | Already used in keepalive.mjs |
| next.js App Router | already installed | API route handler for scrape-status endpoint | All existing API routes use this pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@next/env` loadEnvConfig | already installed | Load .env in script context | Already used in scraper scripts |
| `withTimeout` (lib/db/timeout.ts) | project util | Protect API route DB call from hanging | Used in all existing API routes |
| `errorResponse` (lib/api/helpers.ts) | project util | Consistent error response shape | Used in all existing API routes |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SQL DELETE in keepalive.mjs | Drizzle ORM delete | Drizzle requires tsx + loadEnvConfig; keepalive.mjs is plain .mjs and avoids that dependency chain. Raw postgres is simpler here. |
| Next.js API route for MON-01 | Standalone admin script | API route is queryable without Supabase dashboard login (MON-01 requirement) |
| runScraper returning RunSummary | separate tracking module | Return-value approach is minimal — no new files, no side-effect globals |

**Installation:** None required — all dependencies already present.

## Architecture Patterns

### Recommended Project Structure
No new directories needed. File additions:

```
app/api/admin/scrape-status/
└── route.ts            # MON-01: GET endpoint

lib/scraper/
└── runner.ts           # MON-03: change return type from void → RunSummary

lib/scraper/
└── run.ts              # MON-03: print summary after runScraper returns

scripts/
└── keepalive.mjs       # MON-02: add prune step

.github/workflows/
└── supabase-keepalive.yml  # MON-02: no change needed (keepalive.mjs already called)
└── scrape-low.yml      # MON-03: no change needed (run.ts already called)
```

### Pattern 1: Scrape Status API Route (MON-01)

**What:** Next.js App Router route at `app/api/admin/scrape-status/route.ts` that queries `scrape_runs` for the most recent run per university, aggregating status, rows_written, and run_at.

**When to use:** Any maintainer who needs to check per-university scrape health without a Supabase dashboard login.

**SQL shape (Drizzle):**
```typescript
// Source: check-staleness.ts pattern (already verified working)
const rows = await db
  .select({
    university_id: scrapeRuns.university_id,
    last_run_at: max(scrapeRuns.run_at),
    last_status: sql<string>`(array_agg(${scrapeRuns.status} ORDER BY ${scrapeRuns.run_at} DESC))[1]`,
    last_rows_written: sql<number>`(array_agg(${scrapeRuns.rows_written} ORDER BY ${scrapeRuns.run_at} DESC))[1]`,
  })
  .from(scrapeRuns)
  .groupBy(scrapeRuns.university_id);
```

**Route structure (follows existing API pattern):**
```typescript
// Source: app/api/universities/route.ts pattern
import { withTimeout } from '../../../../lib/db/timeout';
import { errorResponse } from '../../../../lib/api/helpers';

export async function GET(_req: NextRequest) {
  try {
    const data = await withTimeout(getScrapeStatus(), 10_000);
    return Response.json({ data });
  } catch (err) {
    if (err instanceof Error && err.message === 'DB_TIMEOUT') {
      return errorResponse('DB_TIMEOUT', 'Database query timed out', 503);
    }
    throw err;
  }
}
```

**No auth guard for v3.0:** REQUIREMENTS.md FUTURE-07 explicitly defers admin dashboard UI. The endpoint exists for maintainer convenience and the project has no user auth system. This is consistent with "API/logs only" for v3.0.

### Pattern 2: scrape_runs 90-day Pruning (MON-02)

**What:** Add a DELETE step to `scripts/keepalive.mjs` executed by `supabase-keepalive.yml` every 5 days.

**Why keepalive.mjs, not a separate script:** keepalive.mjs already runs every 5 days via supabase-keepalive.yml, uses raw postgres-js (no tsx/esbuild), and is the natural "DB maintenance" home. Adding a prune step here avoids a new workflow and a new script with their own overhead.

**Implementation:**
```javascript
// Add after the SELECT 1 ping — Source: keepalive.mjs pattern
const pruned = await sql`
  DELETE FROM scrape_runs
  WHERE run_at < NOW() - INTERVAL '90 days'
  RETURNING id
`;
console.log(`keep-alive: pruned ${pruned.length} scrape_run rows older than 90 days`);
```

**Verification signal:** The keepalive workflow log will show the pruned count. This is observable — satisfies MON-02 success criterion "confirmed by the keepalive workflow log showing a pruning step."

### Pattern 3: GHA Scrape Run Summary (MON-03)

**What:** Change `runScraper` return type from `Promise<void>` to `Promise<RunSummary>`, accumulate counters inside the loop, then print a summary line in `run.ts`.

**RunSummary shape:**
```typescript
// Add to lib/scraper/runner.ts
export interface RunSummary {
  attempted: number;
  succeeded: number;   // status === 'ok' || 'flagged'
  failed: number;      // status === 'error'
  zero_rows: number;   // status === 'zero_rows'
}
```

**Summary log in run.ts:**
```typescript
// After await runScraper(shard, githubRunId) returns summary
const summary = await runScraper(shard, githubRunId);
console.log(
  `[scraper] Summary — shard ${shardIndex}/${shardTotal}: ` +
  `${summary.attempted} attempted, ${summary.succeeded} succeeded, ` +
  `${summary.failed} failed, ${summary.zero_rows} zero-rows`
);
```

This prints to stdout which GHA captures in the workflow run log — visible per-shard.

### Anti-Patterns to Avoid

- **Writing a separate `prune-scrape-runs.ts` script:** Unnecessary new file + workflow step. keepalive.mjs already handles DB maintenance cadence.
- **Auth-guarding the scrape-status endpoint:** v3.0 explicitly defers admin UI and auth (FUTURE-07). Adding JWT guard now adds complexity with no stated requirement.
- **Using Drizzle ORM in keepalive.mjs:** keepalive.mjs is plain ESM (.mjs) deliberately — no tsx, no loadEnvConfig. Introducing Drizzle would require switching to .ts or adding a compile step. Use raw postgres-js to match existing pattern.
- **Emitting a GHA step summary file (GITHUB_STEP_SUMMARY):** Stdout `console.log` is sufficient and simpler. The success criterion says "visible in the workflow run log" — stdout achieves this without additional GHA API usage.
- **Using DISTINCT ON for the status query:** Postgres `DISTINCT ON` is not supported by Drizzle ORM's query builder. Use `array_agg(...ORDER BY...)[1]` instead, as shown in the pattern above.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DB connection in keepalive.mjs | New postgres client | Reuse existing `postgres(url)` pattern in keepalive.mjs | Already established; same env var |
| Timeout protection | Custom Promise.race | `withTimeout` from lib/db/timeout.ts | Already covers this edge case |
| Error response formatting | Custom error object | `errorResponse` from lib/api/helpers.ts | Consistent response shape across all API routes |
| Per-adapter status tracking | Global variable / side channel | Return `RunSummary` from `runScraper` | Clean, testable, no shared state |

**Key insight:** This phase is pure extension of existing patterns. No new abstractions needed.

## Common Pitfalls

### Pitfall 1: scrape_runs has no index on run_at
**What goes wrong:** The scrape-status query aggregates by university_id and orders by run_at. Without an index on `run_at`, a full table scan happens on every API request. With 90-day pruning the table stays small (400 universities × 4 runs/day × 90 days = ~144,000 rows max), so this is not catastrophic, but it degrades over time.
**Why it happens:** Schema was defined without anticipated aggregation queries.
**How to avoid:** Add a Drizzle migration adding `index('scrape_runs_run_at_idx').on(table.run_at)` and `index('scrape_runs_university_id_idx').on(table.university_id)` before or alongside the API route.
**Warning signs:** Slow `/admin/scrape-status` response time as `scrape_runs` grows.

### Pitfall 2: keepalive.mjs ESM compatibility
**What goes wrong:** Adding `import` from a TypeScript module (e.g., importing schema) would require tsx or a build step, breaking the .mjs pure-ESM design.
**Why it happens:** Temptation to reuse Drizzle schema types.
**How to avoid:** Write the DELETE as a raw SQL template literal via postgres-js, as shown in Pattern 2. No imports beyond what's already in keepalive.mjs.

### Pitfall 3: RunSummary breaks existing runner tests
**What goes wrong:** `runner.test.ts` currently calls `await runScraper([...])` and ignores the return value (void). Changing the return type to `RunSummary` is backward-compatible — callers that ignore the return value still work. However, tests that mock the return should be updated to verify summary fields.
**Why it happens:** Signature change without updating tests.
**How to avoid:** The existing tests don't assert on return value, so they stay green. Add new test cases that verify the returned `RunSummary` counts are correct.

### Pitfall 4: Supabase transaction pool mode with raw postgres-js DELETE
**What goes wrong:** keepalive.mjs uses `prepare: false` for Supabase Supavisor (transaction pool mode). A plain DELETE works fine without prepared statements. Risk is if someone adds `prepare: true` thinking it's a performance improvement.
**Why it happens:** Misunderstanding Supabase pooler requirements.
**How to avoid:** Keep `prepare: false` in keepalive.mjs. The existing comment in `lib/db/index.ts` documents this: "Set prepare: false for transaction pool mode (Supabase Supavisor)".

### Pitfall 5: INTERVAL syntax varies between SQL dialects
**What goes wrong:** Using `INTERVAL 90 DAY` (MySQL syntax) instead of `INTERVAL '90 days'` (PostgreSQL syntax) causes a syntax error.
**Why it happens:** Mixing up SQL dialects.
**How to avoid:** Use PostgreSQL INTERVAL syntax: `NOW() - INTERVAL '90 days'`.

## Code Examples

Verified patterns from project source:

### Drizzle aggregation query (from check-staleness.ts)
```typescript
// Source: scripts/check-staleness.ts (existing, working)
const recentRuns = await db
  .select({
    university_id: scrapeRuns.university_id,
    last_ok: max(scrapeRuns.run_at),
  })
  .from(scrapeRuns)
  .where(inArray(scrapeRuns.status, ['ok', 'flagged']))
  .groupBy(scrapeRuns.university_id);
```

### postgres-js raw SQL (from keepalive.mjs)
```javascript
// Source: scripts/keepalive.mjs (existing, working)
const sql = postgres(url, { prepare: false });
const result = await sql`SELECT 1 as ok`;
```

### Next.js API route with timeout (from app/api/universities/route.ts)
```typescript
// Source: app/api/universities/route.ts (existing, working)
const result = await withTimeout(getUniversities(cursor, limit), 10_000);
return Response.json(result, {
  headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600' },
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Supabase dashboard for scrape visibility | Programmatic API query | Phase 17 (new) | No dashboard login needed |
| No pruning (table grows unbounded) | 90-day DELETE in keepalive cycle | Phase 17 (new) | Stays within 500MB free tier |
| `console.log('[scraper] Scrape run complete.')` only | Structured summary line with counts | Phase 17 (new) | CI logs are actionable |

**Deprecated/outdated:**
- `runScraper` returning `void`: will return `RunSummary` after Phase 17

## Open Questions

1. **Index migration for scrape_runs**
   - What we know: Drizzle schema in `lib/db/schema.ts` has no indexes on `scrape_runs`; Supabase free tier supports creating indexes
   - What's unclear: Whether a separate Drizzle migration file is needed or if the planner should include a raw SQL migration step
   - Recommendation: Include index creation as a Wave 0 setup task (one-time Supabase migration via `drizzle-kit push` or manual SQL). At 144,000 max rows it is low urgency but correct practice.

2. **Cache-Control for scrape-status endpoint**
   - What we know: `/api/universities` uses `s-maxage=86400` (24h cache); scrape runs every 24h via cron
   - What's unclear: Whether a short cache (5 min) or no cache is more appropriate for a status endpoint
   - Recommendation: Use `Cache-Control: no-store` or a very short `s-maxage=300`. Status data should be fresh.

3. **Whether to expose error_log in the API response**
   - What we know: `error_log` is stored as raw JSON text containing rejection details; it may contain internal URLs or scraping artifacts
   - What's unclear: Whether maintainer-facing API should include raw error_log text
   - Recommendation: Include a truncated `has_error: boolean` field and omit raw error_log text from the API response for cleanliness. Full error_log remains queryable directly in Supabase.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | none — vitest picks up from package.json |
| Quick run command | `npx vitest run tests/scraper/runner.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MON-01 | GET /admin/scrape-status returns array of per-university status | unit | `npx vitest run tests/api/scrape-status.test.ts` | ❌ Wave 0 |
| MON-02 | prune step in keepalive.mjs deletes rows older than 90 days | unit | `npx vitest run tests/scripts/keepalive.test.ts` | ❌ Wave 0 |
| MON-03 | runScraper returns RunSummary with correct counts | unit | `npx vitest run tests/scraper/runner.test.ts` | ✅ (existing, extend) |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/scraper/runner.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/api/scrape-status.test.ts` — covers MON-01 (mock Drizzle db, verify response shape)
- [ ] `tests/scripts/keepalive.test.ts` — covers MON-02 (mock postgres-js, verify DELETE was called with 90-day interval)

*(Existing `tests/scraper/runner.test.ts` covers MON-03 behavior after extending with RunSummary assertions)*

## Sources

### Primary (HIGH confidence)
- Project source: `lib/scraper/runner.ts` — adapter loop, scrape_run insert logic, status values
- Project source: `lib/db/schema.ts` — scrape_runs table columns confirmed
- Project source: `scripts/check-staleness.ts` — Drizzle aggregation query pattern confirmed working
- Project source: `scripts/keepalive.mjs` — postgres-js raw SQL pattern, ESM constraints
- Project source: `app/api/universities/route.ts` — Next.js App Router pattern, withTimeout, errorResponse
- Project source: `.github/workflows/supabase-keepalive.yml` — keepalive cron schedule (every 5 days)
- Project source: `.github/workflows/scrape-low.yml` — scrape shard invocation pattern
- Project source: `lib/scraper/run.ts` — where summary print must be added, SHARD_INDEX/SHARD_TOTAL already available

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` — MON-01/MON-02/MON-03 definitions and FUTURE-07 deferral confirm no auth guard needed, no UI needed
- `.planning/ROADMAP.md` — Phase 17 success criteria confirm exact deliverables

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are already installed and in use
- Architecture: HIGH — all three patterns are direct extensions of existing code verified by reading source
- Pitfalls: HIGH — derived from actual code constraints (ESM, Drizzle limitations, Supabase pooler)

**Research date:** 2026-03-20
**Valid until:** 2026-06-20 (stable domain — Drizzle ORM, Next.js App Router patterns are stable)
