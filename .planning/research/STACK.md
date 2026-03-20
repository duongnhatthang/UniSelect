# Stack Research

**Domain:** Vietnamese university admissions PWA — v3.0 data pipeline additions only
**Researched:** 2026-03-19
**Confidence:** MEDIUM-HIGH (versions verified via npm registry; GitHub Actions limits verified via official docs)

> This file documents ONLY the new libraries and patterns needed for v3.0 features.
> The existing stack (Next.js 16, Supabase, Drizzle ORM, Serwist, next-intl, nuqs,
> next-themes, MSW, Crawlee 3.16, Playwright, PaddleOCR, Cheerio, Tailwind v4, vitest,
> motion, sirv, @faker-js/faker) is unchanged and NOT re-researched.

---

## What v3.0 Needs (Problem Statement)

The scraper pipeline exists but is effectively hollow:
- Registry gate (`static_verified: true`) passes only 4/78 adapters — nearly zero data produced
- University master list caps at 78; Vietnam has 400+ institutions
- Auto-discovery crawler (`scripts/discover.ts`) exists but has no GitHub Actions workflow trigger
- No observable monitoring — impossible to tell which universities have data vs. never scraped

The v3.0 stack additions address four distinct gaps:

| Gap | Stack Answer |
|-----|--------------|
| Comprehensive university list sourcing | Curated seed JSON (no new library needed; process described below) |
| Bulk adapter verification at scale | `p-limit` for concurrency control; existing `verify-adapters.ts` extended |
| Auto-discovery in CI | New GitHub Actions workflow wrapping existing Crawlee crawler |
| Scrape status monitoring dashboard | Internal Next.js route + Drizzle query against existing `scrape_runs` table |

---

## Recommended Stack — New Additions

### Feature 1: Concurrency Control for Bulk Adapter Verification

**Goal:** When verifying 400+ university URLs in `verify-adapters.ts`, fire requests concurrently without hammering individual servers or exhausting GitHub Actions runner memory.

**Current problem:** `verify-adapters.ts` runs 9 hardcoded candidates sequentially. With 400+ entries it will either timeout (sequential) or OOM/get rate-limited (fully concurrent).

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `p-limit` | ^6.2.0 | Cap concurrent fetch requests to N simultaneous | Tiny (no dependencies), ESM-native, TypeScript types included. Adds one wrapper to the existing `for...of` loop: `const limit = pLimit(10); await Promise.all(candidates.map(c => limit(() => verifyCandidate(c))))`. Crawlee already handles its own concurrency internally via `maxConcurrency`; p-limit is only needed for the bare-fetch scripts that bypass Crawlee. |

**Installation:**
```bash
npm install -D p-limit
```

**Usage pattern in verify-adapters.ts:**
```typescript
import pLimit from 'p-limit';

const limit = pLimit(10); // 10 concurrent verification requests

await Promise.all(
  CANDIDATES.map(candidate =>
    limit(() => verifyCandidate(candidate))
  )
);
```

**Why not p-queue:** p-queue adds priority lanes, pause/resume, and event emitters — none of which are needed for a batch verification script. p-limit is 300 bytes vs. p-queue's larger footprint. Same author (sindresorhus).

**Why not Crawlee for verification:** `verify-adapters.ts` only needs to check HTTP status and presence of keywords in HTML — a single fetch per URL, not a crawl. Crawlee's request queue and retry logic add overhead for what is a simple probe.

**Why not raw `Promise.all`:** 400 simultaneous requests will trigger rate limiting from Vietnamese university servers and likely OOM the runner. p-limit gives explicit control.

**Concurrency recommendation:** 10 concurrent requests for the full 400-university scan. Each university is a different domain, so 10 concurrent is polite. GitHub Actions ubuntu-latest runners have 7 GB RAM — at ~50 KB average HTML page, 10 concurrent is negligible.

---

### Feature 2: Comprehensive University Seed Data

**Goal:** Expand the universities table from 78 to 400+ institutions with official mã trường codes.

**Finding:** There is no official MOET API for the complete university list. The `uni_list_examples.md` file already contains 78 institutions scraped from the official MOET registry. The complete list requires curation from the same source.

**No new library is needed.** The approach is:

1. **Source:** Vietnam's Ministry of Education publishes the official university registry (danh mục cơ sở đào tạo) at https://thisinh.thitotnghiepthpt.edu.vn — the same portal used by students to register. This page contains a dropdown/searchable list of all accredited institutions with their official mã trường codes.

2. **Method:** A one-time Crawlee-based scrape of the MOET portal (the existing `CheerioCrawler` pattern) to extract the complete university list. Output is a seed JSON file (`data/universities.json`) committed to the repository.

3. **Integration:** The existing Drizzle migration system seeds the `universities` table from this JSON file. No runtime dependency on the MOET portal after initial seed — the data only changes when MOET accredits/removes institutions (~annually).

**Why not a third-party API:** The `university-domains-list` API (Hipo) does not include Vietnamese mã trường codes. The `humansofvothisau/university.api` project crawls MOET itself without a static dataset. The Wikipedia list of Vietnamese universities lacks mã trường codes. The only authoritative source with official codes is MOET directly.

**Seed data shape (matches existing schema):**
```typescript
// data/universities.json
[
  {
    "id": "BKA",          // Official mã trường from MOET
    "name_vi": "Đại học Bách khoa Hà Nội",
    "name_en": "Hanoi University of Science and Technology",
    "website_url": "https://hust.edu.vn/"
  },
  // ... 400+ entries
]
```

**Drizzle seed script pattern (extends existing `lib/db` pattern):**
```typescript
// scripts/seed-universities.ts
import universities from '../data/universities.json';
import { db } from '../lib/db';
import { universities as universitiesTable } from '../lib/db/schema';

await db.insert(universitiesTable)
  .values(universities)
  .onConflictDoNothing();
```

---

### Feature 3: Auto-Discovery Integrated into GitHub Actions

**Goal:** The existing `scripts/discover.ts` (Crawlee-based crawler) must run automatically in CI, not just manually.

**No new library is needed.** The gap is purely a missing GitHub Actions workflow file.

**New workflow: `.github/workflows/discover.yml`**

Key design decisions for the workflow:

- **Trigger:** Weekly schedule (`cron: '0 3 * * 0'`) + `workflow_dispatch`. Weekly is sufficient — university websites don't restructure daily.
- **Output:** Discovery results written to Supabase (`discovery_candidates` table, see Architecture) rather than a local file — persistent across runs and queryable.
- **Scope:** Run against ALL universities in `scrapers.json` whose `static_verified: false` — the ones that haven't been verified yet.
- **No sharding needed:** Discovery is lighter than scraping (no PaddleOCR, no Playwright for the crawler itself). 400 universities at `maxConcurrency: 1` and `maxRequestsPerCrawl: 50` per university is sequential-ish. Runtime estimate: 400 × ~30s average = ~3.3 hours. This needs sharding to fit in GitHub Actions' 6-hour job limit.

**Discovery sharding:** Split the `scrapers.json` entries into 4 shards, each running as a parallel matrix job. Each shard covers ~100 universities. At ~30s per university, each shard finishes in ~50 minutes — well within the 6-hour limit.

```yaml
# .github/workflows/discover.yml (key section)
strategy:
  matrix:
    shard: [0, 1, 2, 3]
  fail-fast: false
```

**Environment variables needed:**
- `DATABASE_URL` — already in GitHub Secrets (used by scraper)
- `SHARD_INDEX` and `SHARD_TOTAL` — same pattern as existing scrape workflow

---

### Feature 4: Scrape Status Monitoring Dashboard

**Goal:** An internal page showing per-university scrape health: last run status, rows written, error logs, coverage gaps.

**No new library is needed.** The `scrape_runs` table already captures everything needed. The gap is a UI to surface it.

**Implementation:** A protected internal route at `/admin/scrape-status` using Next.js App Router Server Components.

**Data access pattern — use Drizzle directly (already installed):**

```typescript
// app/admin/scrape-status/page.tsx (Server Component)
import { db } from '@/lib/db';
import { scrapeRuns, universities } from '@/lib/db/schema';
import { sql, desc, eq } from 'drizzle-orm';

// Latest run per university
const latestRuns = await db
  .select({
    university_id: scrapeRuns.university_id,
    status: scrapeRuns.status,
    rows_written: scrapeRuns.rows_written,
    run_at: scrapeRuns.run_at,
    error_log: scrapeRuns.error_log,
  })
  .from(scrapeRuns)
  .where(
    eq(
      scrapeRuns.id,
      db.select({ id: sql`max(${scrapeRuns.id})` })
        .from(scrapeRuns)
        .where(eq(scrapeRuns.university_id, scrapeRuns.university_id))
    )
  )
  .orderBy(desc(scrapeRuns.run_at));
```

A simpler approach using a Postgres `DISTINCT ON` view avoids the correlated subquery:

```sql
-- Run once via Drizzle migration or Supabase SQL editor
CREATE VIEW latest_scrape_runs AS
SELECT DISTINCT ON (university_id)
  university_id, status, rows_written, rows_rejected, error_log, run_at, github_run_id
FROM scrape_runs
ORDER BY university_id, run_at DESC;
```

Then query the view via Supabase JS client or Drizzle raw SQL.

**Route protection:** A simple middleware-based password check using `ADMIN_SECRET` env var. No auth library needed — the admin page is internal tooling, not user-facing.

```typescript
// middleware.ts (extend existing if present, or create)
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/admin')) {
    const token = request.cookies.get('admin_token')?.value;
    if (token !== process.env.ADMIN_SECRET) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }
}
```

**Why not a full auth library (NextAuth/Clerk):** The monitoring page is developer-only tooling. A single shared secret is sufficient and avoids adding OAuth/session storage dependencies. No user accounts exist in this system.

**Why not a separate Grafana/Metabase dashboard:** Free-tier infrastructure constraint. Supabase's built-in table editor can view raw data but can't show computed summaries. The internal Next.js page renders from the same DB the app already uses — zero additional infrastructure.

**Why not Supabase Realtime for live updates:** The `scrape_runs` table is written to by GitHub Actions jobs (not the web app). Realtime subscriptions add websocket overhead. A simple "reload" button with Server Component re-fetch is sufficient — scrape jobs run at most once daily.

---

## Registry Gate Fix (No New Library)

The critical fix is removing the `static_verified: true` filter from `lib/scraper/registry.ts` and replacing it with a graduated verification approach:

**Current behavior:** `if (!entry.static_verified) continue;` — silently skips 96% of adapters.

**v3.0 behavior:** Run all adapters with `factory_config` present. Emit `zero_rows` status to `scrape_runs` when an adapter returns nothing (already implemented in `runner.ts`). This produces observable failure records instead of silent skips.

The `static_verified` field becomes a quality tier indicator rather than a run gate:
- `static_verified: true` — confirmed working, expected to produce data
- `static_verified: false` (with `factory_config`) — run but log `unverified` status
- `scraping_method: "deferred"` — skip (genuinely not ready)
- `scraping_method: "manual"` — skip (requires PDF parsing)

This requires no new library — only a change to the registry filtering logic.

---

## GitHub Actions Shard Scaling

**Current:** 6 shards × 78 universities = 13 adapters per shard
**v3.0 target:** 400 universities

**Option A (recommended): Increase shards to 20**
- 20 shards × 20 universities = 20 adapters per shard
- Estimated runtime per shard: ~15 min (Playwright/PaddleOCR adapters take ~2 min each)
- GitHub Actions limit: max 256 matrix jobs per workflow run — 20 is well within limit
- Free tier for public repos: unlimited minutes — confirmed by GitHub docs (March 2026)
- 20 concurrent jobs is the free plan concurrent job limit — exactly at the boundary

**Option B: Keep 6 shards, accept longer runtime**
- 6 shards × 67 universities = 67 adapters per shard
- Estimated runtime: ~45-90 min per shard for PaddleOCR-heavy shards
- Simpler, guaranteed within free tier concurrent job limit

**Recommendation:** Start with 10 shards for the initial 400-university rollout. 10 shards × 40 universities stays safely within the 20 concurrent job limit (leaving room for other concurrent workflows), and runtime per shard (~20-30 min) is comfortable.

No new library needed — update the `strategy.matrix.shard` array in `.github/workflows/scrape-low.yml` and `scrape-peak.yml`.

---

## Summary: What Gets Added

| Item | Type | New? | Notes |
|------|------|------|-------|
| `p-limit` ^6.2.0 | Dev dep (npm) | YES | Concurrency control for bulk verification |
| `data/universities.json` | Data file | YES | 400+ university seed data |
| `scripts/seed-universities.ts` | Script | YES | One-time DB seeder |
| `.github/workflows/discover.yml` | Workflow | YES | Auto-discovery CI trigger |
| `app/admin/scrape-status/page.tsx` | Route | YES | Monitoring dashboard (Server Component) |
| `middleware.ts` (admin protection) | Config | YES | Simple secret-based route guard |
| Postgres view `latest_scrape_runs` | DB migration | YES | Summary view for dashboard query |
| Shard count increase (6 → 10) | Workflow config | YES | Scale scrape matrix for 400 unis |
| Registry gate removal | Code change | YES | Allow unverified adapters to run + log |

**Nothing else is needed.** All scraping tools (Cheerio, Playwright, PaddleOCR, Crawlee) are already installed and working.

---

## Installation

```bash
# Dev dependency only — used in verify-adapters.ts
npm install -D p-limit
```

Everything else is configuration, data files, or code changes — no additional `npm install` required.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `p-limit` for verification concurrency | Crawlee for verification | If verification needs retry logic, redirect following, or robots.txt compliance — not needed for simple HTTP probes |
| Internal Next.js admin route | Separate Metabase/Grafana | If team needs rich analytics, multiple charts, or non-developer users — overkill for a charity project's CI health dashboard |
| Postgres view for latest runs | Drizzle correlated subquery | If view creation via migration is undesirable — correlated subquery works but is slower at 400+ universities |
| Simple secret middleware | NextAuth credentials | If multiple admin users with individual accounts needed — unnecessary for a single-developer internal tool |
| JSON seed file committed to repo | Runtime MOET scrape on startup | If MOET updates codes mid-year (they don't) — static JSON is more reliable than depending on MOET portal availability |
| 10 shards for 400 universities | 20 shards | If hitting the 20 concurrent job limit with other workflows — 10 shards is safer headroom |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Third-party university list APIs (Hipo, FreeAPIHub) | Don't include Vietnamese mã trường codes; not authoritative for Vietnamese institutions | Curate directly from MOET portal |
| BullMQ / Redis-backed job queue | Free-tier constraint: no Redis. GitHub Actions IS the job queue — schedule and matrix strategy provide parallelism | GitHub Actions matrix sharding |
| Prometheus + Grafana | Infrastructure complexity and cost for a single-developer charity project | Internal Next.js Server Component page querying existing Supabase tables |
| PM2 | Designed for long-running servers; scraper runs are finite GitHub Actions jobs | GitHub Actions workflow + scrape_runs audit table |
| `p-queue` | Overkill feature set (priority, pause/resume) for a simple batch probe script | `p-limit` |
| LLM-based scrape classification | Explicitly out of scope per PROJECT.md; cost prohibitive | Existing keyword-scoring in `lib/scraper/discovery/keyword-scorer.ts` |

---

## Version Compatibility

| Package | Requires | Notes |
|---------|----------|-------|
| `p-limit` ^6.2.0 | Node.js ≥18 | GitHub Actions runner uses Node 24 — fine. ESM-only: use `import` not `require`. |
| Crawlee @3.16.0 | Node.js ≥16 | Already installed and working |
| `@faker-js/faker` ^10.3.0 | Node.js ≥20 | Already installed from v2.0 |

**ESM note for p-limit:** p-limit v6+ is ESM-only. `verify-adapters.ts` runs via `tsx` which handles ESM imports. If any script uses `require()` instead of `import`, it will fail — check all scripts that use p-limit use `import` syntax.

---

## Stack Patterns by Variant

**If a university's homepage requires JavaScript rendering for navigation:**
- Switch that university's entry in `scrapers.json` from `CheerioCrawler`-based discovery to `PlaywrightCrawler`
- Crawlee supports both with the same `enqueueLinks` API
- Add a `discovery_method: "playwright"` field to `scrapers.json` entry

**If the MOET portal's university list is behind JS rendering:**
- Use Playwright (already installed) to scrape the dropdown/list
- This is a one-time operation, not part of the regular scraping cron

**If the admin monitoring page needs to be publicly visible (not protected):**
- Remove the middleware password check
- The `scrape_runs` data contains no PII — it's pipeline metadata, safe to expose
- Visibility would allow external contributors to see which universities need adapters

---

## Sources

- p-limit npm current version 7.3.0 (general use) / 6.2.0 minimum ESM: https://www.npmjs.com/package/p-limit — MEDIUM confidence (version confirmed via WebSearch; pinning to ^6 for Node 18+ ESM compatibility)
- GitHub Actions public repo unlimited minutes: https://github.blog/changelog/2025-12-16-coming-soon-simpler-pricing-and-a-better-experience-for-github-actions/ — HIGH confidence
- GitHub Actions matrix max 256 jobs, 20 concurrent free plan: https://docs.github.com/en/actions/reference/limits — HIGH confidence (verified via WebFetch)
- MOET official university portal (university list source): https://thisinh.thitotnghiepthpt.edu.vn — MEDIUM confidence (no JSON API; web scrape required)
- humansofvothisau/university.api — crawls MOET, no static dataset: https://github.com/humansofvothisau/university.api — MEDIUM confidence
- Crawlee @crawlee/cheerio 3.16.0 (latest): https://www.npmjs.com/package/@crawlee/cheerio — HIGH confidence
- Next.js middleware for route protection: https://nextjs.org/docs/app/building-your-application/routing/middleware — HIGH confidence
- Supabase Postgres views: https://supabase.com/blog/postgresql-views — HIGH confidence

---
*Stack research for: UniSelect v3.0 complete data pipeline*
*Researched: 2026-03-19*
