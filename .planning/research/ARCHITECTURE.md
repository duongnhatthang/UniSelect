# Architecture Research

**Domain:** Vietnamese university scraper pipeline — scaling from 78 to 400+ institutions
**Researched:** 2026-03-19
**Confidence:** HIGH (all findings derived from direct codebase inspection)

> This document supersedes the v2.0 architecture research (2026-03-18). It focuses exclusively on how the v3.0 features (400+ university list, auto-discovery integration, registry gate fix, scrape monitoring) integrate with the as-built v2.0 system.

---

## Current Architecture (v2.0 Baseline — as-built)

```
┌──────────────────────────────────────────────────────────────────────┐
│                        GitHub Actions (Cron)                          │
│  ┌────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │  scrape-low    │  │  scrape-peak     │  │  discover.ts         │  │
│  │  daily, 6     │  │  4x/day July,    │  │  ORPHANED — never    │  │
│  │  shards       │  │  6 shards        │  │  runs in CI today    │  │
│  └───────┬────────┘  └────────┬─────────┘  └──────────────────────┘  │
└──────────┼───────────────────┼────────────────────────────────────────┘
           │                   │
           ▼                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        lib/scraper/run.ts                             │
│   loadRegistry() → shard by SHARD_INDEX/SHARD_TOTAL                  │
└──────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       lib/scraper/registry.ts                         │
│   Reads scrapers.json                                                 │
│   GATE: if (!entry.static_verified) → SKIP (warn, continue)         │
│   Result: 4 of 78 adapters actually load                             │
└──────────────────────────────────────────────────────────────────────┘
           │ 4 adapters pass gate
           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       lib/scraper/runner.ts                           │
│   Per adapter: scrape() → normalize() → batch upsert (transaction)   │
│   Writes scrape_runs audit row: ok / zero_rows / flagged / error     │
└──────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌────────────────────────┐    ┌──────────────────────────────────────┐
│   Supabase / PostgreSQL │    │        scrapers.json (registry)       │
│   universities (78)     │    │        78 entries, 4 verified        │
│   cutoff_scores         │    │        74 gated by static_verified   │
│   scrape_runs (audit)   │    │        most urls point at homepages  │
│   majors                │    └──────────────────────────────────────┘
│   tohop_codes           │
└────────────────────────┘
```

### Component Responsibilities (v2.0 baseline)

| Component | File | Responsibility | v3.0 Status |
|-----------|------|----------------|-------------|
| Registry | `lib/scraper/registry.ts` | Loads scrapers.json, gates on `static_verified`, resolves adapters | CHANGE — gate logic |
| Runner | `lib/scraper/runner.ts` | Calls adapters, normalizes, batch-upserts, writes audit row | UNCHANGED |
| Factory | `lib/scraper/factory.ts` | Creates Cheerio adapters from JSON config | UNCHANGED |
| Normalizer | `lib/scraper/normalizer.ts` | Validates RawRow → NormalizedRow | UNCHANGED |
| Discovery module | `lib/scraper/discovery/` | Keyword scorer + DiscoveryCandidate types | UNCHANGED |
| Discovery script | `scripts/discover.ts` | Crawlee CheerioCrawler; orphaned, no CI trigger | CHANGE — add CI trigger + output path |
| Scrape workflows | `.github/workflows/scrape-*.yml` | Cron, 6-shard matrix, full toolchain setup | CHANGE — shard count |
| DB Schema | `lib/db/schema.ts` | universities, cutoff_scores, scrape_runs, majors, tohop_codes | UNCHANGED (schema is correct) |

---

## v3.0 Target Architecture

Four structural problems to resolve:

1. **Registry gate** — `static_verified: true` blocks 74/78 adapters
2. **URL problem** — most scrapers.json entries point to homepages, not cutoff pages; discovery must populate real URLs
3. **University list gap** — only 78 universities seeded; need 400+
4. **Discovery orphan** — `scripts/discover.ts` is implemented and correct but has no GHA workflow

```
┌───────────────────────────────────────────────────────────────────────┐
│                       Data Sources (one-time seed)                     │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  uni_list.json (400+ entries: id, name_vi, website_url)          │  │
│  │  compiled from uni_list_examples.md + central/southern regions   │  │
│  └──────────────────────────┬─────────────────────────────────────────┘
└───────────────────────────────────────────────────────────────────────┘
                              │ seed via scripts/seed-universities.ts
                              ▼
              Supabase universities table (400+ rows)
              scrapers.json expanded to 400+ entries
                   (website_url field, scrape_url = null initially)

┌───────────────────────────────────────────────────────────────────────┐
│             GitHub Actions: discover.yml (NEW, weekly)                 │
│  Input:  scrapers.json (website_url fields, 400+ entries)             │
│  Runs:   scripts/discover.ts (Crawlee — already implemented)          │
│  Output: discovery-candidates.json (GHA artifact)                     │
│          → scripts/apply-discovery.ts patches scrapers.json           │
│            with scrape_url values                                      │
└───────────────────────┬───────────────────────────────────────────────┘
                        │ scrapers.json updated with scrape_url values
                        ▼
┌───────────────────────────────────────────────────────────────────────┐
│              scrapers.json — Registry Gate Fix (CHANGED)              │
│                                                                        │
│  Old fields:  url (homepage), static_verified (boolean gate)          │
│  New fields:  website_url (homepage, discovery input)                 │
│               scrape_url (actual cutoff page, discovery output)       │
│               adapter_type: "cheerio"|"playwright"|"paddleocr"|"skip" │
│               verified_at (optional ISO date, informational only)     │
│                                                                        │
│  Gate rule in registry.ts:                                            │
│    RUN if  scrape_url present AND adapter_type != "skip"              │
│    SKIP if scrape_url missing OR adapter_type == "skip"               │
└───────────────────────┬───────────────────────────────────────────────┘
                        │ resolved adapters (grows as discovery populates URLs)
                        ▼
┌───────────────────────────────────────────────────────────────────────┐
│              lib/scraper/run.ts (UNCHANGED logic)                      │
│  Reads SHARD_INDEX / SHARD_TOTAL                                      │
│  Sharding: i % shardTotal === shardIndex                              │
│  Shard count increases as adapter count grows (GHA matrix config)    │
└───────────────────────┬───────────────────────────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────────────────────────┐
│              lib/scraper/runner.ts (UNCHANGED)                        │
│  Per adapter: scrape() → normalize() → batch upsert → audit row      │
└───────────────────────┬───────────────────────────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────────────────────────┐
│                       Supabase / PostgreSQL                            │
│  universities (400+ rows, seeded from uni_list.json)                  │
│  cutoff_scores (populated by runner as adapters run)                  │
│  scrape_runs (audit — powers monitoring; meaningful now at scale)     │
│  majors / tohop_codes (unchanged)                                     │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Component Change Map

### Components That Do NOT Change

| Component | Why Unchanged |
|-----------|---------------|
| `lib/scraper/runner.ts` | Batch upsert + audit trail already works correctly |
| `lib/scraper/run.ts` | Shard logic is correct; shard count is a GHA matrix config number |
| `lib/scraper/factory.ts` | Cheerio adapter factory is correct |
| `lib/scraper/normalizer.ts` | Validation logic is correct |
| `lib/scraper/discovery/` | Keyword scorer + candidate types are correct |
| `scripts/discover.ts` | Script logic is correct (reads website_url origins, outputs candidates) |
| DB schema (all tables) | `universities`, `cutoff_scores`, `scrape_runs`, `majors`, `tohop_codes` |

### Components That Change

#### 1. `lib/scraper/registry.ts` — Gate Logic Replacement

**Current behavior:** Hard gate on `static_verified: true`. 74/78 entries skip with a console.warn.

**New gate model:**
- Remove `static_verified` gate entirely
- Run entry if `scrape_url` is populated AND `adapter_type !== "skip"`
- `scrape_url` is populated by `apply-discovery.ts` or manual edit
- `adapter_type` explicitly controls which code path runs

```typescript
// New RegistryEntry shape
interface RegistryEntry {
  id: string;
  name_vi?: string;
  website_url: string;           // Homepage — fed to discover.ts
  scrape_url?: string;           // Actual cutoff page URL — gate trigger
  adapter?: string;              // Custom adapter filename (playwright/paddleocr)
  adapter_type: 'cheerio' | 'playwright' | 'paddleocr' | 'skip';
  factory_config?: Omit<CheerioAdapterConfig, 'id'>;
  verified_at?: string;          // ISO date — informational, never gates
  note?: string;
}

// New gate
if (!entry.scrape_url || entry.adapter_type === 'skip') {
  console.warn(`[registry] Skipping ${entry.id} — no scrape_url yet`);
  continue;
}
```

**Migration for existing 4 verified adapters:** Their current `url` field (which already points to a real cutoff page) is renamed to `scrape_url`. `website_url` is set to the homepage origin. `adapter_type` is set based on what they currently use (`static_verified: true` + no playwright → `"cheerio"`).

#### 2. `scrapers.json` — Registry Data Model Expansion

**Current state:** 78 entries, schema: `{ id, adapter, url, static_verified, factory_config, note }`.

**Changes:**
- Rename `url` → `website_url` (homepage, input to discovery)
- Add `scrape_url` (actual cutoff page, output from discovery — null initially for most entries)
- Add `adapter_type` (replaces the implicit `static_verified` + `scraping_method` pattern)
- Remove `static_verified`
- Expand from 78 to 400+ entries (sourced from `uni_list.json`)
- `factory_config` and `adapter` fields stay unchanged

#### 3. `.github/workflows/` — New Workflow, Updated Shard Count

**Add:** `discover.yml` — weekly cron (`0 3 * * 0`) + `workflow_dispatch`. Runs `scripts/discover.ts` against all `website_url` entries. Outputs `discovery-candidates.json` as a GHA artifact. A separate step runs `scripts/apply-discovery.ts` to patch `scrapers.json` and open a PR (or commit directly to a `discovery/auto` branch for review).

**Change:** `scrape-low.yml` and `scrape-peak.yml` — increase shard count from 6 to 10+ once `scrape_url`-populated entries exceed ~100. The shard count is just a number in the `strategy.matrix.shard` array; all other job logic stays the same.

### New Components

#### 4. `uni_list.json` (NEW — static asset)

Master list of all Vietnamese universities and colleges. Compiled from `uni_list_examples.md` (78 northern universities already documented) plus equivalent lists for central and southern Vietnam.

```json
[
  { "id": "BKA", "name_vi": "Đại học Bách Khoa Hà Nội", "website_url": "https://hust.edu.vn/" },
  { "id": "QHT", "name_vi": "Trường ĐH Khoa học Tự nhiên - ĐHQG Hà Nội", "website_url": "https://hus.edu.vn/" }
]
```

The file already has a working source: `uni_list_examples.md` contains 78 tab-separated rows with ministry code, name, and URL ready to parse.

#### 5. `scripts/seed-universities.ts` (NEW)

One-time script to seed the `universities` Supabase table from `uni_list.json`. Uses the same `db` connection and Drizzle ORM already in the project. Runs via `npx tsx scripts/seed-universities.ts`. Safe to re-run (upsert on conflict).

Also generates the 400+ skeleton entries in `scrapers.json` (with `website_url` populated, `scrape_url` null, `adapter_type: "cheerio"` as default).

#### 6. `scripts/apply-discovery.ts` (NEW)

Merges `discovery-candidates.json` (output of `discover.ts`) back into `scrapers.json`. For each candidate above the confidence threshold, if `scrape_url` is not already set, writes the discovered URL.

Design constraint: does not overwrite entries that already have `verified_at` set, to protect manually curated entries. Logs a diff for those.

#### 7. `lib/api/scrape-status.ts` (NEW — optional within v3.0 scope)

API route querying `scrape_runs` for a per-university health summary: last run timestamp, status, rows written. Powers a simple monitoring view or admin page.

---

## Data Flow Changes

### Flow 1: University List Expansion (one-time, manual)

```
uni_list_examples.md + central/southern sources
    → compile into uni_list.json (400+ entries)
    → scripts/seed-universities.ts
    → Supabase: universities table (400+ rows)
    → scrapers.json (400+ entries, website_url set, scrape_url = null)
```

### Flow 2: Auto-Discovery (weekly, automated)

```
scrapers.json (website_url per entry)
    → scripts/discover.ts
        CheerioCrawler crawls homepage → keyword-scores pages
        outputs discovery-candidates.json
    → scripts/apply-discovery.ts
        patches scrapers.json with scrape_url values
    → commit/PR to repo
```

### Flow 3: Scrape Run (daily, existing cadence + expanded scope)

```
scrapers.json (entries with scrape_url populated)
    → lib/scraper/registry.ts
        new gate: scrape_url present + adapter_type != "skip"
    → lib/scraper/run.ts (shard by index)
    → lib/scraper/runner.ts
        scrape() → normalize() → batch upsert → scrape_runs row
    → Supabase: cutoff_scores updated, scrape_runs logged
```

### Flow 4: Monitoring (read-only query)

```
Supabase: scrape_runs table
    → lib/api/scrape-status.ts
        GROUP BY university_id, get latest status + rows_written
    → Admin view showing pipeline health per university
```

---

## Build Order and Dependencies

Dependencies flow strictly. Each phase unlocks the next.

```
Phase 1: University Master List
    Deliverables: uni_list.json, seed-universities.ts, scrapers.json expanded
    Dependencies: none (pure data work + one script)
    UNLOCKS → Phase 2 has something to discover against

Phase 2: Registry Gate Fix
    Deliverables: registry.ts gate change, scrapers.json schema migration
    Dependencies: Phase 1 (scrapers.json must have website_url field)
    UNLOCKS → Phase 3 (scraper can now run adapters as URLs populate)
              Scrape runs immediately improve for the 4 already-verified adapters

Phase 3: Discovery Integration
    Deliverables: discover.yml workflow, apply-discovery.ts, first discovery run
    Dependencies: Phase 1 (website_url in scrapers.json), Phase 2 (gate reads scrape_url)
    UNLOCKS → scrapers.json gets real scrape_url values for many universities

Phase 4: Shard Scaling
    Deliverables: update shard count in scrape-*.yml
    Dependencies: Phase 3 (need to know how many adapters now have scrape_url)
    NOTE: Only needed when runnable adapter count exceeds ~100

Phase 5: Monitoring
    Deliverables: scrape-status API route, admin view
    Dependencies: Phases 1-3 (need meaningful data in scrape_runs to monitor)
    NOTE: scrape_runs table already captures all needed data; this is just a query layer
```

**Critical path:** Phase 1 → Phase 2 → Phase 3. These three must ship in order. Phases 4 and 5 are independent of each other and can be done in either order after Phase 3.

---

## Architectural Patterns

### Pattern 1: Static Registry with Discovery Patch

**What:** `scrapers.json` stays a static, version-controlled file. Discovery writes a patch file; a script applies it back into `scrapers.json`. The registry at scrape-run time reads only the static file — no live DB query, no live crawler.

**When to use:** Always for this project. Scrape jobs are stateless GHA runners that start cold. A static file loads in milliseconds; a DB query at startup adds latency and a cold-start failure mode (Supabase free tier pauses after inactivity).

**Trade-offs:** Discovery results require a commit before taking effect. This is acceptable — it adds auditability and prevents a bad discovery run from silently redirecting all scrapers.

### Pattern 2: scrape_url Presence as Gate (Graduated Trust)

**What:** Replace the `static_verified: true` hard gate with "has a target URL and is not explicitly skipped." Any entry with a `scrape_url` will be attempted. The `scrape_runs` audit table captures the outcome. Failures (zero_rows, error) are visible and fixable; they are not silent.

**When to use:** This is the v3.0 gate model. The old boolean gate was appropriate when the project was small and required manual verification before any adapter ran. At 400+ universities, manual pre-verification of every URL is not feasible.

**Trade-offs:** Some adapters will return `zero_rows` or `error` on first run because their `factory_config` keywords don't match the page's actual column headers. This is expected and fixable iteratively using `scrape_runs` data. Zero-rows is not a crash — it logs cleanly.

### Pattern 3: Discovery as URL Resolver Only

**What:** The discovery crawler's sole job is to find the URL of the cutoff page. It does NOT extract score data. Score extraction happens in the main scrape run using the adapter's configured parser.

**When to use:** Always. Combining URL discovery with data extraction in a single pass would make each discovery crawl as expensive as a full scrape run, and would need to run daily instead of weekly.

**Trade-offs:** Two-pass pipeline adds complexity. But discovery only needs to run weekly (URLs don't change often); the scrape runs daily. The cadence difference makes the separation natural.

---

## Anti-Patterns

### Anti-Pattern 1: Running Discovery Before Every Scrape Shard

**What people do:** Add a discovery step inside `scrape-low.yml` that runs before each shard's `run.ts` call.

**Why it's wrong:** Discovery crawls 400+ university homepages with up to 50 page requests each (Crawlee `maxRequestsPerCrawl: 50`). That's potentially 20,000 HTTP requests per discovery run. Running it before every shard (6 shards × daily) means 6 discovery runs per day — hammering university servers, burning GHA minutes, and defeating the point of sharding.

**Do this instead:** Separate `discover.yml` workflow, weekly cadence. Scrape workflows read only from `scrapers.json` (no live crawling at scrape time).

### Anti-Pattern 2: Storing Discovered URLs Only in the Database

**What people do:** Write discovered URLs directly to a Supabase table. Have `registry.ts` query that table at startup to get scrape URLs.

**Why it's wrong:** Scrape jobs become dependent on DB availability at startup. Supabase free tier pauses after inactivity; cold-start can take 5-10 seconds or fail. Also loses the git-diffable audit trail of which URLs are in use.

**Do this instead:** `apply-discovery.ts` writes discovered URLs back into `scrapers.json`. The static file is always available. Optionally also insert into a `discovery_candidates` DB table for historical audit, but the gate reads from the file.

### Anti-Pattern 3: Expanding Shard Count Before Adapters Are Populated

**What people do:** Immediately change shard count from 6 to 20 "for 400 universities."

**Why it's wrong:** Each GHA shard spins up a fresh runner: checkout, npm ci, Playwright install, Python + PaddleOCR install, model warm-up — roughly 3-4 minutes of overhead per shard before any scraping happens. With only 10 adapters having `scrape_url` populated, 20 shards means most shards do 0-1 adapters with 4 minutes of wasted setup time.

**Do this instead:** Keep 6 shards until `scrape_url`-populated entries exceed ~100. At that point, run time will approach 30 minutes per shard and increasing to 10-12 shards becomes worthwhile.

### Anti-Pattern 4: Treating factory_config Tuning as a Pre-Launch Blocker

**What people do:** Refuse to ship until every one of the 400 university adapters has been manually verified and `factory_config` keywords confirmed against the actual page.

**Why it's wrong:** Manual verification of 400 university pages is months of work. The `scrape_runs` audit table already captures which adapters return `zero_rows` or `error`. The correct approach is: ship with best-effort configs, let the pipeline run, read the `scrape_runs` data to find failures, fix iteratively.

**Do this instead:** Ship with discovery populating URLs and factory_config using broad keyword defaults. Use `scrape_runs` as the feedback loop for tuning.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase | Drizzle ORM via pooler (port 6543, `prepare: false`) | Keep-alive cron every 5 days prevents free-tier pause. Unchanged. |
| GitHub Actions | Cron + matrix sharding + new discover.yml | Static `scrapers.json` keeps jobs fast to start (no DB at startup) |
| University websites | CheerioCrawler (discovery), then Cheerio/Playwright/PaddleOCR (scraping) | Rate-limit: `sameDomainDelaySecs: 2`, `maxConcurrency: 1` in discover.ts |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `discover.ts` → `scrapers.json` | `apply-discovery.ts` file write (JSON patch) | Not a live DB query — static file stays the single source of truth |
| `registry.ts` → `scrapers.json` | `readFileSync` at job startup | Synchronous, no network call — fast cold start |
| `runner.ts` → Supabase | Drizzle batch upsert in transaction | CHUNK_SIZE=500 already set; unchanged |
| `scrape_runs` → monitoring | SQL query via API route | `scrape_runs` captures status, rows_written, error_log per university per run |

---

## Scaling Considerations

| Adapters with scrape_url | Architecture Adjustment |
|--------------------------|-------------------------|
| 4 (current) | 6 shards — wasteful but fine; each shard does ~1 adapter |
| 30-100 | 6 shards appropriate; pipeline starts producing real data |
| 100-200 | Increase shards to 8-10; watch per-shard runtime |
| 200-400 | 12 shards; optionally split cheerio-only vs playwright+OCR workflows (setup cost differs by ~3 minutes) |
| 400+ | Consider a "fast" workflow (cheerio only, no Python startup) separate from "slow" (playwright + OCR); reduces wasted setup time |

### First Bottleneck: URL Population

The pipeline cannot scale until `scrape_url` is populated for more adapters. The first discovery run against 400 homepages will take 30-60 minutes (50 pages × 400 universities at 2 seconds per page, single concurrency per `sameDomainDelaySecs: 2`). Run as a `workflow_dispatch` manually first to batch-populate initial URLs before relying on weekly cron.

### Second Bottleneck: factory_config Keyword Gaps

Universities with `scrape_url` but wrong `factory_config` keywords return `zero_rows`. The `scrape_runs` table surfaces these: `WHERE status = 'zero_rows'` ordered by `run_at`. Fixing each requires reading the page and confirming column header text, then updating `factory_config` in `scrapers.json`. Iterative; no architectural change needed.

---

## Sources

- Direct inspection of `lib/scraper/registry.ts`, `runner.ts`, `run.ts`, `factory.ts`, `types.ts`, `normalizer.ts`
- Direct inspection of `scripts/discover.ts`, `lib/scraper/discovery/` (candidate.ts, constants.ts, keyword-scorer.ts)
- Direct inspection of `scrapers.json` — 78 entries confirmed: 4 with `static_verified: true`, 74 false, 2 with `scraping_method: "manual"`, 1 `"deferred"`, 1 `"playwright"`
- Direct inspection of `.github/workflows/scrape-low.yml`, `scrape-peak.yml` — shard matrix confirmed as `[0,1,2,3,4,5]`
- Direct inspection of `lib/db/schema.ts` — scrape_runs table already has status, rows_written, error_log, github_run_id
- `uni_list_examples.md` — 78 northern Vietnamese universities with mã trường and homepage URLs
- `.planning/PROJECT.md` — v3.0 goals and current state confirmed

---

*Architecture research for: UniSelect v3.0 — complete data pipeline, 400+ university coverage*
*Researched: 2026-03-19*
