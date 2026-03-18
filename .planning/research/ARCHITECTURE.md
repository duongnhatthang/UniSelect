# Architecture Patterns

**Domain:** Vietnamese university admissions data aggregation PWA
**Researched:** 2026-03-17
**Confidence:** HIGH (based on well-established patterns for scraper pipelines, serverless APIs, and PWA frontends)

---

## Recommended Architecture

The system decomposes into four cleanly-bounded components:

```
┌─────────────────────────────────────────────────────────────┐
│  SCRAPER PIPELINE (GitHub Actions)                          │
│                                                             │
│  Scheduler → Scraper Workers → Normalizer → DB Writer       │
│  (cron)      (per-university)   (canonical  (upsert to      │
│                                  schema)     Supabase)       │
└──────────────────────────────┬──────────────────────────────┘
                               │ writes
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  DATABASE (Supabase / PostgreSQL)                           │
│                                                             │
│  universities | majors | tohop | cutoff_scores             │
│                       (central truth store)                 │
└──────────────────────────────┬──────────────────────────────┘
                               │ reads
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  API LAYER (Vercel Serverless Functions)                     │
│                                                             │
│  /api/scores  /api/universities  /api/recommend            │
│               (stateless, read-mostly)                      │
└──────────────────────────────┬──────────────────────────────┘
                               │ fetches
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND PWA (Next.js on Vercel)                           │
│                                                             │
│  Score Input → Eligibility Filter → Ranked List →          │
│  Nguyện Vọng Builder → PDF/Share                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Boundaries

### 1. Scraper Pipeline

| Sub-component | Responsibility | Does NOT do |
|---------------|---------------|-------------|
| Scheduler | Triggers scraper runs via GitHub Actions cron | Data transformation |
| Scraper Workers | Fetches raw HTML/JSON from one university URL; extracts raw rows | Normalization, DB writes |
| Normalizer | Maps raw rows to canonical schema (score, year, major_code, tohop, method) | Fetching, storing |
| DB Writer | Upserts normalized records into Supabase via REST or pg driver | Scraping logic |
| Scrape Registry | Config file (`scrapers.json`) listing each university: URL, scraper adapter name, schedule tier | Runtime execution |

The Scraper Pipeline runs entirely inside GitHub Actions. It does not talk to the Vercel API layer. It writes directly to Supabase.

**Scraper adapter pattern:** Each university gets a named adapter module (`bka.ts`, `qht.ts`, etc.) that exports a single `scrape(url): RawRow[]` function. The runner iterates the registry, calls the adapter, passes output through the normalizer, then writes. Adapters that share the same HTML structure (e.g., all universities using the same CMS) can share a generic adapter.

**Ministry portal adapter:** Treated as a special first-class adapter. It covers structured data for many universities at once. Run it first; university-level adapters only fill gaps.

---

### 2. Database (Supabase / PostgreSQL)

Single source of truth. Scraper writes; API reads; no direct DB access from the frontend.

**Schema sketch:**

```sql
-- Lookup tables (rarely change)
CREATE TABLE universities (
  id          TEXT PRIMARY KEY,          -- Ministry code e.g. "BKA"
  name_vi     TEXT NOT NULL,             -- Full Vietnamese name
  name_short  TEXT,                      -- Common abbreviation
  website_url TEXT,
  region      TEXT,                      -- HN / HCM / Other
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE majors (
  id           TEXT PRIMARY KEY,         -- Ministry major code e.g. "7480201"
  name_vi      TEXT NOT NULL,
  field_group  TEXT,                     -- Broad field e.g. "CNTT", "Y Duoc"
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tohop_codes (
  code        TEXT PRIMARY KEY,          -- e.g. "A00", "D01"
  subjects    TEXT[] NOT NULL,           -- e.g. ["Toan","LyHoa","HoaHoc"]
  label_vi    TEXT
);

-- Core fact table (append-mostly, upsert on conflict)
CREATE TABLE cutoff_scores (
  id                BIGSERIAL PRIMARY KEY,
  university_id     TEXT NOT NULL REFERENCES universities(id),
  major_id          TEXT NOT NULL REFERENCES majors(id),
  tohop_code        TEXT NOT NULL REFERENCES tohop_codes(code),
  year              SMALLINT NOT NULL,    -- e.g. 2023
  score             NUMERIC(5,2),         -- e.g. 28.50; NULL if not published
  admission_method  TEXT NOT NULL         -- "THPT" | "hoc_ba" | "aptitude" | "direct"
                    DEFAULT 'THPT',
  seats             SMALLINT,             -- quota for this combination; often unpublished
  note              TEXT,                 -- e.g. "includes bonus points"
  source_url        TEXT,                 -- URL scraped from
  scraped_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (university_id, major_id, tohop_code, year, admission_method)
);

-- Scrape audit log (debugging, freshness checks)
CREATE TABLE scrape_runs (
  id             BIGSERIAL PRIMARY KEY,
  run_at         TIMESTAMPTZ DEFAULT NOW(),
  university_id  TEXT REFERENCES universities(id),
  status         TEXT,                   -- "ok" | "error" | "no_data"
  rows_written   INT,
  error_msg      TEXT,
  github_run_id  TEXT                    -- traceability back to Actions run
);
```

**Indexes needed from day one:**
```sql
CREATE INDEX ON cutoff_scores (university_id, year);
CREATE INDEX ON cutoff_scores (tohop_code, year);
CREATE INDEX ON cutoff_scores (score, year, tohop_code);  -- core query path
```

**Row-Level Security:** Enable RLS on all tables. API reads use anon key (SELECT only). Scraper uses service_role key (INSERT/UPDATE). No direct client → DB writes ever.

---

### 3. API Layer (Vercel Serverless Functions)

Thin, stateless, read-mostly. All business logic (scoring, filtering, ranking, nguyện vọng generation) lives here — NOT in the frontend.

**Endpoints:**

| Route | Method | Description |
|-------|--------|-------------|
| `/api/universities` | GET | List all universities with metadata |
| `/api/universities/[id]` | GET | Single university with all majors and scores |
| `/api/scores` | GET | Query cutoff scores: `?tohop=A00&year=2024&min=25&max=30` |
| `/api/recommend` | POST | Core: takes `{ scores: {toan, ly, hoa}, tohop, year_range }` → returns ranked nguyện vọng candidates |
| `/api/tohop` | GET | List all valid tổ hợp codes with subject definitions |
| `/api/years` | GET | Available data years |

**No mutation endpoints in v1.** The scraper writes to Supabase directly; the API is read-only from Supabase.

**Caching strategy:**
- University list and tổ hợp codes: cache at edge (Vercel CDN), `Cache-Control: s-maxage=86400`
- Score queries: `s-maxage=3600` (1 hour) — data only changes when scraper runs
- Recommend endpoint: no caching (user-specific inputs), but fast because it's pure DB read + in-memory sort

---

### 4. Frontend PWA (Next.js)

Stateless: no user accounts, no session state. All state lives in URL params or local component state.

**Pages / Routes:**

| Route | Purpose |
|-------|---------|
| `/` | Landing: score input, tổ hợp selector, quick recommendation |
| `/universities` | Browse all universities |
| `/universities/[id]` | University detail: all majors, historical cutoffs chart |
| `/recommend` | Full recommendation flow: per-subject input → tiered nguyện vọng list |
| `/compare` | Compare two university-major combinations side-by-side |

**PWA requirements:**
- Service worker via `next-pwa` (Workbox under the hood): cache static assets + API responses
- `manifest.json`: Vietnamese app name, icon set
- Offline: show cached recommendation results; show "data may be outdated" banner

**i18n:** `next-i18next` with `vi` (default) and `en` locales. Translation keys in `public/locales/`.

**No authentication.** No user data stored server-side. Score inputs are ephemeral (session only, never sent to analytics).

---

## Data Flow

### Scrape → Store path (async, scheduled)

```
GitHub Actions cron (daily low / hourly July)
  → checkout repo
  → node scripts/scrape.ts [--university BKA | --all]
      → for each university in scrapers.json:
          → adapter.scrape(url) → RawRow[]
          → normalizer.normalize(raw) → NormalizedRow[]
          → db.upsert(cutoff_scores, normalized)
          → db.insert(scrape_runs, audit)
  → exit (Actions job completes)
```

### User request → Recommendation path (real-time)

```
User inputs: { toan: 9.0, ly: 8.5, hoa: 8.0 } + tohop: "A00"
  → Frontend computes: total = toan + ly + hoa = 25.5
  → POST /api/recommend { tohop: "A00", total_score: 25.5, year_range: [2022, 2024] }
      → Query cutoff_scores WHERE tohop_code = 'A00' AND year IN (2022,2023,2024)
      → For each (university, major): compute avg cutoff, delta from student score
      → Classify: delta > +1.5 = "dream", -1.5..+1.5 = "practical", < -1.5 = "safe"
      → Sort within each tier: by avg cutoff DESC (most selective first = highest prestige)
      → Return top N per tier (configurable, default 5 per tier = 15 total)
  → Frontend renders tiered list
  → User can drag-reorder within tiers → generates final ranked nguyện vọng list
```

### Historical data display path

```
User visits /universities/BKA
  → GET /api/universities/BKA
      → Query: universities JOIN cutoff_scores WHERE university_id = 'BKA' AND year >= 2019
      → Group by: major_id, tohop_code, year
      → Return: { university, majors: [{ major, tohop_scores_by_year: [...] }] }
  → Frontend renders trend chart per major (Recharts/Chart.js)
```

---

## Scraper Scheduling: GitHub Actions vs Alternatives

**Decision: GitHub Actions. No alternatives needed for v1.**

Rationale:

| Concern | GitHub Actions Answer |
|---------|----------------------|
| Free tier limits | 2,000 min/month free for public repos; scraping 78 sites ≈ 10-20 min/run → 600+ runs/month free |
| High-frequency July period | Multiple workflow files with different schedules: `low-freq.yml` (daily) and `peak-freq.yml` (hourly, manually enabled July 1-20) |
| Failure visibility | Actions UI shows per-run logs; scrape_runs audit table captures errors |
| No always-on server needed | Actions is ephemeral — exactly right for scheduled batch jobs |
| Secret management | GitHub Secrets for SUPABASE_SERVICE_ROLE_KEY |

**Two-schedule pattern:**

```yaml
# .github/workflows/scrape-low.yml
on:
  schedule:
    - cron: '0 2 * * *'   # 2 AM UTC daily (outside July)
  workflow_dispatch:       # manual trigger always available

# .github/workflows/scrape-peak.yml
on:
  schedule:
    - cron: '0 * * * *'   # Every hour (enable manually in July)
  workflow_dispatch:
```

The peak workflow is kept in the repo year-round but only enabled (via `if: github.event_name == 'workflow_dispatch'` or branch protection) during July. This avoids paying for hourly runs 11 months of the year.

**Scraper is NOT a Vercel serverless function** — Vercel functions have a 10-second execution limit (Hobby plan); scraping 78 sites in one run will exceed this. GitHub Actions has no such limit.

---

## Suggested Build Order

Dependencies dictate this order. Each layer must exist before the one above it can be tested end-to-end.

```
Phase 1: Database foundation
  → Define schema, run migrations on Supabase
  → Seed reference data: universities, majors, tohop_codes tables
  Dependency: nothing upstream; everything else depends on this

Phase 2: Scraper pipeline (core)
  → Build scraper runner + normalizer
  → Write 3-5 university adapters (BKA, KHA, NTH — high-value, well-structured)
  → Write Ministry portal adapter (covers many universities at once)
  → Set up GitHub Actions low-freq workflow
  Dependency: Phase 1 (DB schema must be stable)

Phase 3: API layer
  → /api/universities, /api/scores, /api/tohop, /api/years
  → /api/recommend (core algorithm)
  Dependency: Phase 1 (DB), some Phase 2 data to test against

Phase 4: Frontend PWA
  → Score input + recommend flow (highest value)
  → University browse + detail pages
  → Historical chart components
  → PWA manifest + service worker
  Dependency: Phase 3 (API endpoints must exist)

Phase 5: Scraper expansion + hardening
  → Add remaining 70+ university adapters
  → Error recovery, retry logic
  → Peak-frequency workflow for July
  Dependency: Phase 2 architecture must be proven

Phase 6: Polish + launch
  → i18n completion (vi/en)
  → SEO (Next.js metadata, sitemap)
  → Performance audit (Core Web Vitals)
  → Ad placement (non-intrusive)
```

---

## Patterns to Follow

### Pattern 1: Adapter Registry (Scraper)

Register adapters in a static config file, not in code. The runner is generic; only adapters are university-specific.

```typescript
// scrapers.json (excerpt)
[
  { "id": "BKA", "adapter": "generic-table", "url": "https://hust.edu.vn/diem-chuan" },
  { "id": "QHT", "adapter": "qht-custom",   "url": "https://hus.edu.vn/tuyen-sinh" },
  { "id": "PORTAL", "adapter": "ministry",  "url": "https://thisinh.thitotnghiepthpt.edu.vn/..." }
]

// Adapter interface
interface ScraperAdapter {
  scrape(url: string): Promise<RawRow[]>;
}

// RawRow — before normalization
interface RawRow {
  university_id: string;
  major_raw: string;        // raw text, may need lookup
  tohop_raw: string;        // raw text, may be "A00" or "Toán - Lý - Hóa"
  year: number;
  score_raw: string;        // raw text, may need parsing ("28.50" or "28,50")
  admission_method_raw: string;
}
```

### Pattern 2: Upsert, Never Replace (Database)

Scraper always uses `INSERT ... ON CONFLICT DO UPDATE` — never DELETE + re-insert. This preserves historical records and audit timestamps.

```typescript
await supabase
  .from('cutoff_scores')
  .upsert(normalizedRows, {
    onConflict: 'university_id,major_id,tohop_code,year,admission_method'
  });
```

### Pattern 3: Delta Classification (Recommendation)

The tiering logic must be tunable without redeployment. Store thresholds in a config table or environment variable, not hardcoded.

```typescript
const DELTA_THRESHOLDS = {
  dream:     { min: 1.5  },   // score needed > student's score + 1.5
  practical: { min: -1.5, max: 1.5 },
  safe:      { max: -1.5 }    // student's score > score needed + 1.5
};
```

### Pattern 4: Fail-Open Scraping

A scraper failure for one university must never block the run for other universities. Each adapter is wrapped in try/catch; failures are logged to `scrape_runs` and the run continues.

```typescript
for (const config of scraperRegistry) {
  try {
    const raw = await adapter.scrape(config.url);
    const normalized = normalizer.normalize(raw, config.id);
    await db.upsert(normalized);
    await db.logRun(config.id, 'ok', normalized.length);
  } catch (err) {
    await db.logRun(config.id, 'error', 0, err.message);
    // continue to next university
  }
}
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Scraper Inside Vercel Functions

**What:** Triggering scraper via a Vercel API route (e.g., `/api/scrape/run`) with a cron trigger.

**Why bad:** Vercel Hobby plan has 10-second function timeout. Scraping 78 sites takes minutes. This will time out on any non-trivial run. Vercel Pro has 60s limit — still not enough.

**Instead:** GitHub Actions for all scraping. Vercel functions are read-only API handlers only.

### Anti-Pattern 2: Storing Per-Student Data

**What:** Saving a user's score input or nguyện vọng list to the database for "persistence."

**Why bad:** Requires auth, GDPR/privacy concerns, increases infrastructure cost, violates the no-login design. Offers no meaningful value since the nguyện vọng deadline is a one-time annual event.

**Instead:** All student inputs stay in browser state (URL params, sessionStorage). The share feature generates a URL with encoded inputs. No server-side user data ever.

### Anti-Pattern 3: Normalizing in the Scraper Adapter

**What:** Each adapter does its own normalization to canonical schema.

**Why bad:** When schema evolves (e.g., adding `seats` column), all 78 adapters need updating. Normalization bugs are inconsistent across adapters.

**Instead:** Adapters return dumb `RawRow` objects with raw text. One central normalizer owns canonical mapping. Schema changes touch one file.

### Anti-Pattern 4: Direct Frontend → Supabase Queries

**What:** Using the Supabase JS client directly in the Next.js frontend to query the database.

**Why bad:** Exposes the anon key in client bundle (acceptable for SELECT-only, but tight RLS required). More critically: bypasses the API layer where business logic lives. Recommendation algorithm cannot be tested in isolation. Future migrations become coupled to frontend code.

**Instead:** All DB access goes through `/api/*` routes. The Supabase client lives only in the API layer (server-side) and the scraper. Frontend only calls internal Next.js API routes.

---

## Scalability Considerations

| Concern | At 100 users/day | At 10K users/day (July peak) | At 100K+ users/day |
|---------|-----------------|------------------------------|---------------------|
| API latency | Supabase free tier adequate | Add Vercel Edge caching; score queries served from CDN | Upgrade Supabase plan; consider Redis cache layer |
| DB connections | Free tier (direct conn) fine | Use Supabase connection pooling (pgBouncer) | Pooler + read replica |
| Scraper load on universities | Low; daily runs, polite delays | Same; scraping doesn't scale with user traffic | Same; scraper is decoupled |
| Frontend | Vercel CDN; no scaling concern | Same | Same |
| Recommend endpoint | Fast (pure SQL read + in-memory sort) | Cache common tohop+year combinations at edge | Pre-compute recommendations nightly |

The architecture is intentionally serverless/stateless. There is no component that needs to "scale up" — Vercel auto-scales functions, Supabase connection pooler handles bursts. The July spike is a frontend/API concern, not a scraper concern (scraper rate stays the same).

---

## Extension Points for v2

The schema and component design must not close off these future pathways:

| v2 Feature | What v1 Must Not Break |
|------------|------------------------|
| Học bạ pathway | `admission_method` column already in schema as free text; add `'hoc_ba'` rows when ready |
| Aptitude test pathway | Same: `admission_method = 'aptitude'`; adapter for VNU/HUST test result pages |
| User accounts / saved lists | API is already stateless; add auth layer in front of new `/api/user/*` routes without touching existing routes |
| Mobile app | API is plain HTTP JSON; React Native client can consume same endpoints |
| More universities / colleges | Scraper registry is additive; add new adapter, add registry entry |

---

## Sources

- Project requirements: `/Users/thangduong/Desktop/UniSelect/.planning/PROJECT.md`
- Vietnamese university list and URLs: `/Users/thangduong/Desktop/UniSelect/uni_list_examples.md`
- Vietnam nguyện vọng system mechanics: `/Users/thangduong/Desktop/UniSelect/highschool.md`
- Vercel serverless function limits: Vercel documentation (10s Hobby, 60s Pro execution timeout) — HIGH confidence (well-known constraint)
- GitHub Actions free tier: 2,000 minutes/month for public repositories — HIGH confidence (documented by GitHub)
- Supabase RLS and anon key model: standard Supabase security pattern — HIGH confidence
- Scraper adapter pattern: standard ETL pipeline pattern — HIGH confidence
- Next.js PWA with next-pwa (Workbox): established pattern — HIGH confidence
