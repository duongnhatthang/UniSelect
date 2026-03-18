# Phase 2: Core API and Algorithm - Research

**Researched:** 2026-03-18
**Domain:** Next.js 16 App Router route handlers, Drizzle ORM query patterns, edge caching via Vercel CDN, recommendation algorithm design, Vitest route handler testing
**Confidence:** HIGH (all critical stack decisions verified against official Next.js 16 docs, Vercel CDN docs, npm registry, and existing Phase 1 code; algorithm design is MEDIUM from first principles)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Recommendation Algorithm:**
- Use last 3 years of cutoff data for trend weighting (most recent year weighted highest)
- Tier margins: dream = student_score >= cutoff + 3, practical = cutoff - 1 to cutoff + 2, safe = cutoff - 5 to cutoff - 2 (relative to weighted average)
- If a program has fewer than 3 years of data, use all available years — flag as `data_years_limited: true` in response
- Minimum 1 year of data required to include a university-major pair in results; exclude entirely if no cutoff score exists

**API Contract:**
- Response envelope: `{ data: [...], meta: { count, years_available } }` for list endpoints
- Error format: `{ error: { code: string, message: string } }` with appropriate HTTP status
- Pagination on /api/universities and /api/scores: cursor-based with `limit` (default 50, max 200) and `cursor` params
- /api/recommend: return all qualifying results (dream + practical + safe), include `suggested_top_15: boolean` flag on each row marking the auto-selected nguyện vọng list

**Caching Strategy:**
- Static lookups (/api/universities, /api/tohop, /api/years): `Cache-Control: public, s-maxage=86400, stale-while-revalidate=3600` (24h edge cache, 1h SWR)
- /api/scores: `Cache-Control: public, s-maxage=300, stale-while-revalidate=60` (5 min cache)
- /api/recommend: no cache — personalized per score/tohop input
- Cache invalidation: time-based only in v1; no manual purge

**Connection Pooling & Error Handling:**
- Rely on Supabase PgBouncer limits (port 6543, transaction mode) — no explicit Drizzle pool sizing; prepare: false already set in Phase 1
- DB query timeout: 10 seconds via AbortSignal or postgres.js `timeout` option
- DB unavailable: return 503 with `Retry-After: 30` header and `{ error: { code: "DB_UNAVAILABLE", message: "Service temporarily unavailable" } }`
- API route tests: integration tests using vitest with mocked Drizzle (consistent with Phase 1 runner test pattern); no real DB calls in CI

### Claude's Discretion

- Internal implementation details of trend weighting formula (e.g. simple linear decay vs. exponential weights)
- SQL query optimization for /api/recommend (single join vs. multiple queries)
- Exact file structure within app/api/ routes

### Deferred Ideas (OUT OF SCOPE)

- Per-subject score input (SCOR-02) — deferred to Phase 3 frontend
- /api/universities/[id] full detail page data — noted but minimal in Phase 2; Phase 3 drives requirements
- Rate limiting on API routes — defer to Phase 5 infrastructure hardening
- Search endpoint (/api/search) — SRCH-01/SRCH-02 are Phase 3 concerns
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SCOR-01 (API layer) | API layer enabling user to select tổ hợp and enter total score for ranked university list | /api/recommend endpoint with tiered results; Drizzle join across cutoff_scores + universities + majors; tier classification logic |
| SCOR-02 (API layer) | API layer enabling per-subject score input (deferred to Phase 3 frontend; API layer is Phase 2) | /api/recommend accepts total_score + tohop_code; Phase 3 will calculate totals and call this endpoint |
| NGVG-01 (API layer) | API layer generating tiered 15-choice nguyện vọng list | /api/recommend response includes `suggested_top_15` flag; priority sort: practical first, then dream, then safe; sư phạm deprioritized |
| SRCH-01 (API layer) | API layer for university search (Phase 3 UI concern; /api/universities provides base data) | /api/universities endpoint with cursor pagination; name_vi field available for Phase 3 to filter client-side |
| SRCH-02 (API layer) | API layer for tổ hợp filter | /api/tohop endpoint returns all codes; /api/universities can filter by tohop_code in query params |
</phase_requirements>

---

## Summary

Phase 2 builds six Next.js App Router route handlers on top of the Drizzle schema established in Phase 1. The work decomposes into: (1) three static lookup endpoints that hit the DB once and serve cached responses for up to 24 hours, (2) a scored data endpoint with 5-minute cache, (3) a personalized recommendation endpoint with no caching, and (4) a university detail endpoint that is minimal in Phase 2. The recommendation algorithm is the most complex deliverable: it queries multi-year cutoff data, computes a weighted average cutoff per university-major-tohop triple, classifies results into dream/practical/safe tiers, then applies priority sorting to mark the auto-selected `suggested_top_15`.

The critical technical decisions from research are: (a) Next.js 15/16 changed the default for GET route handlers from cached to dynamic — you must explicitly set `Cache-Control` response headers to enable edge caching; setting `s-maxage` in the response header is the correct mechanism for Vercel CDN caching; (b) `SET LOCAL statement_timeout` does NOT work through Supabase's transaction-mode pooler (port 6543) — query timeout enforcement must be done at the JavaScript level using `Promise.race` with a `setTimeout`, not via postgres.js connection options; (c) the test pattern from Phase 1 (`vi.hoisted()` + `vi.mock('../../lib/db')`) works directly for route handler tests since handlers import `db` from the same path.

The recommendation algorithm should be implemented as a pure TypeScript function (`lib/recommend/engine.ts`) that takes `{ tohop_code, total_score }` and returns a typed result array. This decouples the algorithm from the HTTP layer, making it independently testable without mocking NextRequest.

**Primary recommendation:** Build route handlers in two layers: a thin HTTP handler in `app/api/*/route.ts` that reads params and sets headers, and a business logic layer in `lib/api/` that is independently testable. Implement the algorithm first as a pure function, verify it against known test cases, then wire it to the route.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.7 | App Router route handlers; `Response.json()` pattern | Already installed; verified npm registry March 2026 |
| TypeScript | 5.x | Typed request/response shapes; algorithm types | Already configured; strict mode |
| Drizzle ORM | 0.45.1 | All DB queries — joins, aggregations, cursor pagination | Already installed; `prepare: false` already set in lib/db/index.ts |
| postgres (postgres.js) | 3.4.8 | DB driver | Already installed; locked in Phase 1 |
| Vitest | 4.1.0 | Route handler unit tests with mocked Drizzle | Already installed; `vi.hoisted()` + `vi.mock()` pattern established |

No new dependencies required for Phase 2. The entire stack is already installed.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| next/server (NextRequest) | bundled | Typed route handler request object | Use `NextRequest` for all route handlers to access `request.nextUrl.searchParams` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pure TypeScript algorithm in `lib/` | SQL-only aggregation in DB | Pure TS is independently testable without DB; SQL aggregation is harder to test and may exceed Supabase free-tier function limits |
| `Promise.race` timeout | postgres.js `timeout` option | `timeout` option in postgres.js 3.x is an idle timeout alias, not a query timeout; `Promise.race` is the correct approach for per-query timeouts |
| Manual `Cache-Control` header | `export const revalidate = N` segment config | Segment config controls Next.js data cache; manual `Cache-Control` header controls Vercel CDN edge cache directly — both are needed |

**Installation:**
```bash
# No new dependencies needed — all packages are already in package.json
```

**Version verification (confirmed March 2026 via npm registry):**
- next: 16.1.7 (already in package.json)
- drizzle-orm: 0.45.1 (already in package.json)
- vitest: 4.1.0 (already in package.json)

---

## Architecture Patterns

### Recommended Project Structure

```
app/
└── api/
    ├── universities/
    │   ├── route.ts            # GET /api/universities (cursor-paginated)
    │   └── [id]/
    │       └── route.ts        # GET /api/universities/[id]
    ├── scores/
    │   └── route.ts            # GET /api/scores (cursor-paginated)
    ├── recommend/
    │   └── route.ts            # GET /api/recommend?tohop=A00&score=25.0
    ├── tohop/
    │   └── route.ts            # GET /api/tohop (static lookup)
    └── years/
        └── route.ts            # GET /api/years (static lookup)
lib/
├── db/
│   ├── schema.ts               # (Phase 1 — existing)
│   └── index.ts                # (Phase 1 — existing)
├── api/
│   ├── universities.ts         # DB query logic for /api/universities
│   ├── scores.ts               # DB query logic for /api/scores
│   └── years.ts                # DB query logic for /api/years
└── recommend/
    ├── engine.ts               # Pure TS recommendation algorithm
    └── types.ts                # RecommendInput, RecommendResult, Tier types
tests/
├── scraper/                    # (Phase 1 — existing)
├── db/                         # (Phase 1 — existing)
└── api/
    ├── universities.test.ts    # Route handler tests (mocked Drizzle)
    ├── scores.test.ts
    ├── recommend.test.ts
    └── recommend-engine.test.ts # Pure algorithm tests (no mocks)
```

### Pattern 1: Route Handler with Explicit Cache-Control

**What:** Next.js 16 GET route handlers are dynamic (uncached) by default. To enable Vercel edge caching, set `Cache-Control` with `s-maxage` explicitly in the Response headers.

**Critical detail:** Setting `Cache-Control` without `CDN-Cache-Control` causes Vercel to strip `s-maxage` and `stale-while-revalidate` before forwarding to the browser — this is intentional. The browser receives `Cache-Control: public` (or similar) while the CDN caches for `s-maxage` seconds.

**When to use:** Static lookups (/api/universities, /api/tohop, /api/years) and semi-static data (/api/scores).

```typescript
// Source: https://vercel.com/docs/edge-network/caching (verified March 2026)
// app/api/tohop/route.ts

import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { tohopCodes } from '@/lib/db/schema';

export async function GET(_req: NextRequest) {
  const rows = await db.select().from(tohopCodes).orderBy(tohopCodes.code);

  return Response.json(
    { data: rows, meta: { count: rows.length } },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600',
      },
    }
  );
}
```

### Pattern 2: Cursor-Based Pagination

**What:** Cursor pagination avoids the performance degradation of OFFSET at large page numbers. Encode the last-seen row's `id` as the cursor; on the next request, filter for rows with `id > cursor`.

**When to use:** /api/universities and /api/scores.

```typescript
// Source: https://orm.drizzle.team/docs/select (cursor pagination section, verified March 2026)
// lib/api/universities.ts

import { db } from '@/lib/db';
import { universities } from '@/lib/db/schema';
import { gt, asc } from 'drizzle-orm';

export async function getUniversities(cursor?: string, limit = 50) {
  const safeLimit = Math.min(Math.max(1, limit), 200);

  const rows = await db
    .select()
    .from(universities)
    .where(cursor ? gt(universities.id, cursor) : undefined)
    .orderBy(asc(universities.id))
    .limit(safeLimit + 1); // fetch one extra to detect hasMore

  const hasMore = rows.length > safeLimit;
  const data = hasMore ? rows.slice(0, safeLimit) : rows;
  const nextCursor = hasMore ? data[data.length - 1].id : null;

  return { data, meta: { count: data.length, next_cursor: nextCursor } };
}
```

```typescript
// app/api/universities/route.ts — HTTP layer (thin wrapper)
import type { NextRequest } from 'next/server';
import { getUniversities } from '@/lib/api/universities';

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const cursor = params.get('cursor') ?? undefined;
  const limit = parseInt(params.get('limit') ?? '50', 10);

  const result = await getUniversities(cursor, limit);

  return Response.json(result, {
    headers: {
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600',
    },
  });
}
```

### Pattern 3: Dynamic Route Parameters (Async params in Next.js 15+)

**What:** In Next.js 15+, `params` in route handlers is a Promise, not a plain object. Always `await params`.

**Source:** Official Next.js 16 route docs — `v15.0.0-RC: context.params is now a promise`.

```typescript
// app/api/universities/[id]/route.ts
import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { universities } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;  // MUST await in Next.js 15+

  const [uni] = await db
    .select()
    .from(universities)
    .where(eq(universities.id, id))
    .limit(1);

  if (!uni) {
    return Response.json(
      { error: { code: 'NOT_FOUND', message: 'University not found' } },
      { status: 404 }
    );
  }

  return Response.json({ data: uni });
}
```

### Pattern 4: Query Timeout via Promise.race

**What:** The `timeout` option in postgres.js 3.x is an idle connection timeout alias, not a per-query timeout. `SET LOCAL statement_timeout` does not work through Supabase's transaction-mode pooler (port 6543). The correct approach for per-query timeout is `Promise.race` at the JavaScript level.

**Source:** Supabase Timeouts docs (verified March 2026): "session-level timeout settings can only be used with connections through Supavisor in session mode (port 5432)... It cannot be used with Supavisor in Transaction mode (port 6543)."

```typescript
// lib/db/timeout.ts
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('DB_TIMEOUT')), ms)
  );
  return Promise.race([promise, timeout]);
}

// Usage in route handler:
try {
  const results = await withTimeout(
    db.select().from(cutoffScores).where(...),
    10_000  // 10 seconds per locked decision
  );
} catch (err) {
  if (err instanceof Error && err.message === 'DB_TIMEOUT') {
    return Response.json(
      { error: { code: 'DB_UNAVAILABLE', message: 'Service temporarily unavailable' } },
      { status: 503, headers: { 'Retry-After': '30' } }
    );
  }
  throw err;
}
```

### Pattern 5: Recommendation Algorithm Architecture

**What:** The algorithm is a pure TypeScript function — no HTTP, no DB calls inside it. The route handler fetches data from DB, passes it to the algorithm, and the algorithm returns typed results. This makes the algorithm fully testable with zero mocks.

**Two-phase design:**
1. **Data fetch phase** (in route): Query `cutoff_scores` for all rows matching `tohop_code`, grouped by `(university_id, major_id)`, limited to last 3 years.
2. **Algorithm phase** (pure function): For each `(university_id, major_id)` group, compute weighted average cutoff → classify tier → apply `suggested_top_15` priority sort.

**Weighted average formula (Claude's Discretion — linear decay):**
Given years `[y-2, y-1, y]` with scores `[s1, s2, s3]`, weights `[1, 2, 3]` (most recent year weight = 3):
```
weighted_cutoff = (s1 * 1 + s2 * 2 + s3 * 3) / (1 + 2 + 3)
```
If only 2 years available, weights `[1, 2]`, sum = 3. If only 1 year, weight `[1]`, sum = 1.

**Tier classification:**
```
dream     = student_score >= weighted_cutoff + 3
practical = weighted_cutoff - 1 <= student_score <= weighted_cutoff + 2
safe      = weighted_cutoff - 5 <= student_score <= weighted_cutoff - 2
(below safe = excluded from results)
```

**Trend direction** (for Phase 3 display): compare last 2 available years — `rising` / `falling` / `stable` (within 0.5 points).

**suggested_top_15 priority sort:**
1. Sort by tier: practical first, then dream, then safe
2. Within each tier, sort by score proximity (practical: closest to cutoff; dream: highest margin; safe: highest score)
3. Deprioritize sư phạm programs (name_vi contains "Sư phạm" or "Giáo dục") — move to end of their tier
4. Take top 15

```typescript
// lib/recommend/types.ts
export type Tier = 'dream' | 'practical' | 'safe';

export interface RecommendInput {
  tohop_code: string;
  total_score: number;
}

export interface CutoffDataRow {
  university_id: string;
  university_name_vi: string;
  major_id: string;
  major_name_vi: string;
  tohop_code: string;
  year: number;
  score: number;  // numeric from DB — parse as float
}

export interface RecommendResult {
  university_id: string;
  university_name_vi: string;
  major_id: string;
  major_name_vi: string;
  tohop_code: string;
  weighted_cutoff: number;
  tier: Tier;
  trend: 'rising' | 'falling' | 'stable';
  data_years_limited: boolean;  // true if fewer than 3 years available
  years_available: number;
  suggested_top_15: boolean;
}
```

### Pattern 6: Drizzle Join for Recommendation Data Fetch

**What:** Single query joining cutoff_scores + universities + majors filtered by tohop_code and last 3 years. Returns raw rows; algorithm groups and processes in memory.

```typescript
// lib/recommend/engine.ts (data fetch portion — called from route)
// Source: https://orm.drizzle.team/docs/select (joins section, verified March 2026)

import { db } from '@/lib/db';
import { cutoffScores, universities, majors } from '@/lib/db/schema';
import { eq, and, gte, desc } from 'drizzle-orm';

export async function fetchCutoffData(
  tohop_code: string,
  currentYear: number
): Promise<CutoffDataRow[]> {
  const minYear = currentYear - 3;  // last 3 years

  return db
    .select({
      university_id: universities.id,
      university_name_vi: universities.name_vi,
      major_id: majors.id,
      major_name_vi: majors.name_vi,
      tohop_code: cutoffScores.tohop_code,
      year: cutoffScores.year,
      score: cutoffScores.score,
    })
    .from(cutoffScores)
    .innerJoin(universities, eq(cutoffScores.university_id, universities.id))
    .innerJoin(majors, eq(cutoffScores.major_id, majors.id))
    .where(
      and(
        eq(cutoffScores.tohop_code, tohop_code),
        gte(cutoffScores.year, minYear),
      )
    )
    .orderBy(desc(cutoffScores.year));
}
```

### Pattern 7: Route Handler Testing (Vitest + Mocked Drizzle)

**What:** Consistent with Phase 1 `runner.test.ts` pattern. Mock `lib/db` at the module level with `vi.hoisted()` + `vi.mock()`. Call the route handler function directly with a constructed `NextRequest`.

**Key insight:** Route handler functions are just async functions that receive a `Request` and return a `Response`. You can instantiate `NextRequest` directly in tests without any special test utility.

```typescript
// tests/api/recommend.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the lib/db module (consistent with Phase 1 pattern)
const { mockDb } = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const mockDb = { select: mockSelect };
  return { mockDb };
});

vi.mock('../../lib/db', () => ({ db: mockDb }));
vi.mock('../../lib/db/schema', () => ({
  cutoffScores: { _tag: 'cutoffScores' },
  universities: { _tag: 'universities' },
  majors: { _tag: 'majors' },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn(), and: vi.fn(), gte: vi.fn(), desc: vi.fn(),
  sql: (strings: TemplateStringsArray) => strings.join(''),
}));

import { GET } from '../../app/api/recommend/route';

describe('GET /api/recommend', () => {
  it('returns 400 when tohop param is missing', async () => {
    const req = new NextRequest('http://localhost/api/recommend?score=25.0');
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_PARAMS');
  });

  it('returns tiered results with suggested_top_15 flags', async () => {
    // Configure mock to return known data...
    const req = new NextRequest(
      'http://localhost/api/recommend?tohop=A00&score=25.0'
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeInstanceOf(Array);
    expect(body.data.every((r: { tier: string }) =>
      ['dream', 'practical', 'safe'].includes(r.tier)
    )).toBe(true);
  });
});
```

### Anti-Patterns to Avoid

- **Not awaiting params in dynamic routes:** In Next.js 15+, `params` is a Promise. Accessing `params.id` directly (without `await`) returns `undefined` silently. Always `await params`.
- **Setting `dynamic = 'force-static'` on /api/recommend:** This would cache personalized results. Never set static mode on the recommendation endpoint.
- **Returning `new Response(JSON.stringify(data))` without `Content-Type`:** Always use `Response.json()` which sets `Content-Type: application/json` automatically.
- **Applying `Cache-Control` only via `next.config.ts` headers:** Config-level headers work, but route-level `Cache-Control` in the Response overrides them. For this project, set headers in the Response directly for explicitness.
- **Using `.offset()` for pagination:** OFFSET performance degrades at large page numbers. Always use cursor-based pagination for /api/universities and /api/scores.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Edge caching | Custom in-memory cache or Redis | `Cache-Control: s-maxage=N` response header | Vercel CDN handles regional distribution, invalidation timing, and cache stampede protection; free on all Vercel plans |
| DB connection pooling | Application-level pool logic | Supabase Supavisor (port 6543) already configured | PgBouncer transaction mode handles serverless connection burst; already configured in lib/db/index.ts |
| Cursor encoding | Base64 encoding cursor values | Plain string ID as cursor | Opaque cursors add complexity with no benefit in this schema — the university_id is already an opaque ministry code string |
| Input validation schema | Custom regex validators | Inline checks + existing normalizer patterns | Score and tohop validation patterns already exist in `lib/scraper/normalizer.ts`; reuse those |
| Weighted average calculation | Database window functions or CTEs | Pure TypeScript in `lib/recommend/engine.ts` | DB-side aggregation is harder to test, harder to tune weights in, and may hit Supabase free-tier function complexity limits |

**Key insight:** The recommendation engine is simple enough that a 60-line TypeScript function outperforms any database-side approach in terms of testability, debuggability, and flexibility to tune the weighting formula.

---

## Common Pitfalls

### Pitfall 1: Next.js 15+ params is a Promise

**What goes wrong:** The developer writes `const { id } = params` in a dynamic route handler. In Next.js 14 this worked synchronously. Since Next.js 15.0.0-RC, `params` is a Promise. The result is `id = undefined` and a 404 for all requests, with no error thrown.

**Why it happens:** Breaking change in Next.js 15 — version history in the official route.js docs clearly states "v15.0.0-RC: context.params is now a promise."

**How to avoid:** Always write `const { id } = await params`.

**Warning signs:** All requests to `/api/universities/[id]` return 404; `id` is `undefined` in logs.

### Pitfall 2: s-maxage Stripped When CDN-Cache-Control is Absent

**What goes wrong:** Developer sets `Cache-Control: public, s-maxage=86400` in the route handler response. Vercel strips `s-maxage` and `stale-while-revalidate` before forwarding the response to the browser — this is intentional Vercel behavior. However, if the developer expects the browser to also cache for 86400 seconds, they will be confused when `Cache-Control` in the browser dev tools shows only `public`.

**Why it happens:** Vercel documents this: "If you set Cache-Control without a CDN-Cache-Control, the Vercel CDN strips s-maxage and stale-while-revalidate from the response before sending it to the browser."

**How to avoid:** This behavior is actually correct for our use case — the edge CDN caches for 24h and the browser gets a public header without the CDN-specific directives. The endpoints work as intended. Just verify caching behavior using the `x-vercel-cache: HIT` response header on repeated requests, not by inspecting browser Cache-Control.

**Warning signs:** Incorrect assumption: "caching is broken because browser doesn't show s-maxage."

### Pitfall 3: GET Route Handlers Not Cached by Default in Next.js 15+

**What goes wrong:** Developer writes a GET route handler expecting it to be cached at the Next.js data layer (as it was in Next.js 14). In Next.js 15+, `GET` route handlers are **dynamic by default** — they execute on every request. Without the `Cache-Control` header, Vercel will not cache the response at the CDN layer either.

**Source:** Next.js 15 changelog: "The default caching for GET handlers was changed from static to dynamic."

**How to avoid:** Always explicitly set `Cache-Control` response headers for routes that should be cached. Do not rely on default caching behavior.

**Warning signs:** Static endpoints (universities, tohop, years) with unexpectedly high DB query counts.

### Pitfall 4: Query Timeout Approach Incompatible with Transaction-Mode Pooler

**What goes wrong:** Developer attempts to set `statement_timeout` per session using `SET statement_timeout = '10s'` or uses `SET LOCAL` in a transaction, expecting it to limit runaway queries. This silently has no effect through Supabase's Supavisor transaction-mode pooler (port 6543).

**Source:** Supabase Timeouts docs (verified March 2026): "Session-level timeout settings can only be used with connections through Supavisor in session mode (port 5432). It cannot be used with Supavisor in Transaction mode (port 6543)."

**How to avoid:** Use `Promise.race` with a `setTimeout` at the JavaScript level (see Pattern 4 above). This enforces the timeout regardless of the database connection mode.

**Warning signs:** `SET statement_timeout` commands in code that runs through port 6543 — they will not error, they will simply be ignored.

### Pitfall 5: Algorithm Returns Incorrect Results When Score Column is Numeric String

**What goes wrong:** The `score` column in `cutoff_scores` is defined as `numeric(5,2)` in Postgres. When Drizzle returns rows, the `score` field arrives as a **string** (e.g., `"25.50"`) not a JavaScript number. Arithmetic operations like `weighted_cutoff = score * weight` silently produce `NaN`.

**Why it happens:** Drizzle returns Postgres `numeric`/`decimal` types as strings to preserve precision. This is documented behavior.

**How to avoid:** In the algorithm's data-processing step, always parse `score` with `parseFloat(row.score)` before arithmetic. Add a type assertion in `CutoffDataRow` that `score` is `string` (not `number`) and convert explicitly.

**Warning signs:** Algorithm returns all results as `undefined` tier; weighted cutoffs are `NaN`.

### Pitfall 6: Forgetting to Handle Missing cursor Param Gracefully

**What goes wrong:** Route handler calls `db.select().where(gt(universities.id, cursor))` where `cursor` is `null` (first page). Drizzle generates `WHERE id > null` which returns no rows.

**How to avoid:** Use the pattern `cursor ? gt(universities.id, cursor) : undefined` — passing `undefined` to `.where()` omits the WHERE clause entirely.

**Warning signs:** First-page requests return 0 results even though the table has data.

---

## Code Examples

Verified patterns from official sources:

### Standard Error Response

```typescript
// Consistent error format across all routes
// Locked decision from CONTEXT.md

function errorResponse(code: string, message: string, status: number, extra?: Record<string, string>) {
  return Response.json(
    { error: { code, message } },
    { status, headers: extra }
  );
}

// Usage:
return errorResponse('INVALID_PARAMS', 'tohop and score are required', 400);
return errorResponse('DB_UNAVAILABLE', 'Service temporarily unavailable', 503, { 'Retry-After': '30' });
```

### Input Validation for /api/recommend

```typescript
// app/api/recommend/route.ts
import type { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const tohop = params.get('tohop')?.trim().toUpperCase();
  const scoreStr = params.get('score');

  // Validate — reuse patterns from lib/scraper/normalizer.ts
  if (!tohop || !/^[A-D]\d{2}$/.test(tohop)) {
    return Response.json(
      { error: { code: 'INVALID_PARAMS', message: 'Valid tohop code required (e.g. A00, D01)' } },
      { status: 400 }
    );
  }

  const totalScore = parseFloat(scoreStr ?? '');
  if (isNaN(totalScore) || totalScore < 10.0 || totalScore > 30.0) {
    return Response.json(
      { error: { code: 'INVALID_PARAMS', message: 'Score must be between 10.0 and 30.0' } },
      { status: 400 }
    );
  }

  // ... proceed to fetch and recommend
}
```

### /api/years Endpoint

```typescript
// app/api/years/route.ts — simplest endpoint: distinct years from cutoff_scores
import { db } from '@/lib/db';
import { cutoffScores } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

export async function GET() {
  const rows = await db
    .selectDistinct({ year: cutoffScores.year })
    .from(cutoffScores)
    .orderBy(sql`${cutoffScores.year} desc`);

  const years = rows.map(r => r.year);

  return Response.json(
    { data: years, meta: { count: years.length } },
    { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600' } }
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Next.js 14 GET route handlers cached by default | Next.js 15+ GET route handlers dynamic by default | v15.0.0-RC | Must explicitly set Cache-Control to enable edge caching |
| Pages Router `params` as plain object | App Router `params` as Promise | v15.0.0-RC | Must `await params` in dynamic routes |
| `s-maxage` passed through to browser | Vercel strips `s-maxage` before forwarding to browser (if no CDN-Cache-Control) | Ongoing Vercel behavior | Verify caching with `x-vercel-cache` header, not browser devtools |
| SET statement_timeout for DB timeouts | Promise.race for per-query timeout (transaction mode pooler doesn't support session settings) | Supabase Supavisor transaction mode | JavaScript-level timeout required |

**Deprecated/outdated in this context:**
- `next.config.ts` headers as the primary caching mechanism: Works, but Route-level `Cache-Control` headers in the Response are more explicit and override config-level headers anyway.
- `export const revalidate = N` segment config for API routes: This controls Next.js data cache (ISR), not Vercel CDN edge cache. For pure API route handler caching, use `Cache-Control` headers directly.

---

## Open Questions

1. **Score column returns as string from Drizzle/Postgres numeric type**
   - What we know: Postgres `numeric(5,2)` columns are returned as strings by Drizzle/postgres.js to preserve precision. This is documented driver behavior.
   - What's unclear: Whether the Phase 1 schema's `score: numeric('score', { precision: 5, scale: 2 })` definition changed this — it does not. Strings will arrive.
   - Recommendation: In `CutoffDataRow` type, declare `score` as `string`. In algorithm, always call `parseFloat(row.score)` before arithmetic. Add a test case that verifies `parseFloat("25.50") === 25.5`.

2. **Year parameter for "current year" in recommendation algorithm**
   - What we know: The algorithm queries last 3 years relative to "current year." Using the actual current year (`new Date().getFullYear()`) is correct for production, but may return no data if the year's scrape hasn't happened yet.
   - What's unclear: Should the algorithm use `current_year - 1` as the anchor (so the most recent complete cycle is always included)?
   - Recommendation: Use the maximum year present in the `cutoff_scores` table for the given tổ hợp code as the anchor, not `new Date().getFullYear()`. This ensures results always include the most recently scraped data regardless of what calendar year it is.

3. **Empty result handling for /api/recommend**
   - What we know: If no qualifying results exist (student score below all safe thresholds), the endpoint should return `{ data: [], meta: { count: 0, years_available: [...] } }` with HTTP 200 — not a 404.
   - What's unclear: Should "no results" be a distinct error code or just an empty array?
   - Recommendation: Return 200 with empty `data` array. Phase 3 UI handles the empty state display.

---

## Validation Architecture

> nyquist_validation is enabled (confirmed in .planning/config.json).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vitest.config.mts` (exists — Phase 1 created it) |
| Quick run command | `npx vitest run tests/api/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCOR-01 (API) | /api/recommend returns tiered results for valid tohop + score | unit (mock DB) | `npx vitest run tests/api/recommend.test.ts` | Wave 0 |
| SCOR-01 (API) | /api/recommend returns 400 for invalid/missing params | unit | `npx vitest run tests/api/recommend.test.ts` | Wave 0 |
| NGVG-01 (API) | suggested_top_15 flag marks exactly 15 rows (or fewer if <15 results) | unit (pure algo) | `npx vitest run tests/api/recommend-engine.test.ts` | Wave 0 |
| NGVG-01 (API) | Algorithm tiers correctly classify dream/practical/safe by margin | unit (pure algo) | `npx vitest run tests/api/recommend-engine.test.ts` | Wave 0 |
| NGVG-01 (API) | data_years_limited flag is true when fewer than 3 years available | unit (pure algo) | `npx vitest run tests/api/recommend-engine.test.ts` | Wave 0 |
| SRCH-01 (API) | /api/universities returns paginated results with next_cursor | unit (mock DB) | `npx vitest run tests/api/universities.test.ts` | Wave 0 |
| SRCH-01 (API) | /api/universities first page (no cursor) returns data | unit (mock DB) | `npx vitest run tests/api/universities.test.ts` | Wave 0 |
| SRCH-02 (API) | /api/tohop returns all tổ hợp codes | unit (mock DB) | `npx vitest run tests/api/tohop.test.ts` | Wave 0 |
| (all) | Static lookup routes set s-maxage=86400 Cache-Control header | unit | `npx vitest run tests/api/` | Wave 0 |
| (all) | DB unavailable returns 503 with Retry-After header | unit (mock DB throws) | `npx vitest run tests/api/recommend.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/api/recommend-engine.test.ts` (pure algorithm, fastest)
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green + `npx next build` passes before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/api/recommend-engine.test.ts` — covers tier classification, weighting formula, suggested_top_15 sort, data_years_limited flag (pure function, no mocks)
- [ ] `tests/api/recommend.test.ts` — covers route handler: param validation, DB timeout → 503, mock DB result → correct response shape
- [ ] `tests/api/universities.test.ts` — covers cursor pagination: first page (no cursor), subsequent page (with cursor), limit clamping, Cache-Control header
- [ ] `tests/api/tohop.test.ts` — covers static lookup response shape and Cache-Control header
- [ ] `tests/api/scores.test.ts` — covers /api/scores pagination and 5-min cache header

*(If no gaps: "None — existing test infrastructure covers all phase requirements")*

---

## Sources

### Primary (HIGH confidence)

- [Next.js 16 route.js API reference](https://nextjs.org/docs/app/api-reference/file-conventions/route) — route handler patterns, params Promise change in v15.0.0-RC, HTTP methods, query params via `request.nextUrl.searchParams`; verified March 2026
- [Vercel CDN Caching docs](https://vercel.com/docs/edge-network/caching) — `Cache-Control: s-maxage=N` triggers edge caching, `s-maxage` stripped before browser without `CDN-Cache-Control`, cacheable response criteria; verified March 2026
- [Supabase Timeouts docs](https://supabase.com/docs/guides/database/postgres/timeouts) — confirmed SET LOCAL / session-level statement_timeout does NOT work with Supavisor transaction mode (port 6543); verified March 2026
- [Drizzle ORM select docs](https://orm.drizzle.team/docs/select) — cursor pagination pattern, joins, aggregation helpers; verified March 2026
- `lib/db/schema.ts` (Phase 1 deliverable) — confirmed actual column types including `numeric` for score and `timestamp with timezone` pattern
- `lib/db/index.ts` (Phase 1 deliverable) — confirmed `prepare: false`, pooler URL setup
- `tests/scraper/runner.test.ts` (Phase 1 deliverable) — established `vi.hoisted()` + `vi.mock()` pattern used as template for Phase 2 tests
- npm registry: next@16.1.7, drizzle-orm@0.45.1, vitest@4.1.0; verified March 2026

### Secondary (MEDIUM confidence)

- [postgres.js type definitions v3.0.0](https://raw.githubusercontent.com/porsager/postgres/v3.0.0/types/index.d.ts) — confirmed `timeout` option in postgres.js 3.x is idle timeout alias, not query timeout; no per-query timeout API exists in the type definitions
- [Next.js 15 changelog](https://nextjs.org/blog/next-15) — GET route handler caching changed from static to dynamic; verified via WebSearch cross-reference

### Tertiary (LOW confidence)

- Optimal weights for linear decay formula (1/2/3 for 3 years) — design decision based on domain reasoning, not an external standard; subject to tuning after real data testing
- Behavior of `suggested_top_15` priority sort with equal-score ties — tie-breaking behavior is not tested by any external authority; define a stable sort rule in implementation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions confirmed against npm registry; no new dependencies; existing code verified
- Architecture patterns: HIGH — route handler patterns from official Next.js 16 docs; cursor pagination from official Drizzle docs
- Caching: HIGH — Vercel CDN caching behavior verified from official Vercel docs; breaking change (s-maxage stripping) documented
- Query timeout: HIGH — Supabase docs explicitly state SET LOCAL/session timeout does not work with port 6543; Promise.race approach is the correct fallback
- Algorithm design: MEDIUM — tier margins and weights are locked by CONTEXT.md; weighting formula (1/2/3 linear decay) is Claude's discretion and based on domain reasoning
- Pitfalls: HIGH for params/caching/score-as-string; MEDIUM for algorithm edge cases

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable libraries; re-verify if drizzle-orm releases v1.0.0 stable or Next.js releases 17.x)
