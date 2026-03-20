# Project Research Summary

**Project:** UniSelect v3.0 — Complete Data Pipeline
**Domain:** Vietnamese university admissions scraper scaling (78 to 400+ institutions)
**Researched:** 2026-03-19
**Confidence:** HIGH (architecture derived from direct codebase inspection; stack verified via npm registry and GitHub Actions docs)

## Executive Summary

UniSelect's scraper pipeline is architecturally correct but functionally hollow. The codebase ships a working factory-based scraper, auto-discovery crawler, audit logging, and sharded GitHub Actions cron — yet produces real cutoff data for only 4 of 78 registered universities. The root cause is a single registry gate (`static_verified: true` in `lib/scraper/registry.ts`) that silently skips 94 of 99 adapters on every daily run. v3.0's goal is not to rewrite the pipeline but to unblock it: fix the gate, source a 400+ university list from MOET, wire the existing `scripts/discover.ts` into CI, and add visibility into what is and isn't working.

The recommended approach is strictly sequential. University master list first (provides homepage URLs for discovery to crawl), registry gate fix second (replaces the binary boolean with a `scrape_url`-presence gate that grows naturally as discovery populates URLs), auto-discovery CI integration third (makes URL-finding repeatable and auditable), then shard scaling and monitoring. Nothing in this sequence requires a new framework or major architectural change. The only new npm dependency is `p-limit` for concurrency control during bulk adapter verification; all scraping, crawling, and database tooling is already installed and working.

The dominant risk is treating completeness of the university list as a proxy for pipeline completeness. Adding 400 entries to `scrapers.json` with homepage URLs produces zero additional data — the URLs must point to actual cutoff score pages, discovered by the crawler and reviewed by a human before being activated. A secondary risk is discovery false positives: the existing keyword scorer has a low confidence threshold (score >= 3) that surfaces general admissions pages alongside real cutoff pages. Automating discovery output directly into `scrapers.json` without a human review gate will corrupt the scraper config and serve wrong data to students.

## Key Findings

### Recommended Stack

The existing stack (Next.js 16, Supabase, Drizzle ORM, Crawlee 3.16, Cheerio, Playwright, PaddleOCR, Vitest, Serwist) requires no new additions for scraping or crawling. The only net-new dependency is `p-limit ^6.2.0` (ESM-native, no transitive dependencies) for capping concurrent HTTP requests when verifying 400+ adapter URLs in `verify-adapters.ts`. Everything else — the new `discover.yml` workflow, `seed-universities.ts` script, `apply-discovery.ts` patch script, and `/admin/scrape-status` monitoring page — is configuration and code built on already-installed tools.

**Core new additions:**
- `p-limit ^6.2.0`: Concurrent HTTP probe control — prevents OOM and rate-limiting when probing 400+ URLs; 300 bytes, ESM-only (use `import`, not `require`)
- `data/uni_list.json`: Static seed file (400+ MOET-authoritative entries) committed to the repo — eliminates runtime dependency on the MOET portal
- `scripts/seed-universities.ts`: One-time Drizzle upsert from `uni_list.json` into the Supabase `universities` table
- `scripts/apply-discovery.ts`: Merges `discovery-candidates.json` into `scrapers.json`; protects manually curated entries via `verified_at` field
- `.github/workflows/discover.yml`: Weekly cron + `workflow_dispatch`; 4-shard matrix to stay under 6-hour GHA job limit
- `app/admin/scrape-status/page.tsx`: Next.js Server Component querying `scrape_runs` via a `DISTINCT ON` Postgres view; protected by simple `ADMIN_SECRET` middleware

**What NOT to add:** LLM-based scraping (cost-prohibitive at $3,000-$30,000/year at scale), BullMQ/Redis (no Redis on free tier), Prometheus/Grafana (infrastructure overkill for a single-developer project), full Playwright for all universities by default (4,000+ seconds per shard).

### Expected Features

The FEATURES.md research identifies a strict dependency chain. Missing any link in the chain breaks everything downstream.

**Must have (P1 — pipeline produces real data):**
- Complete Vietnamese university master list (400+) — only 78 of ~400 institutions seeded; all from Northern Vietnam
- Registry gate replacement (`static_verified: true` → `scrape_url` presence + `adapter_type != "skip"`) — unblocks 94 silently-skipped adapters
- Correct cutoff page URLs per university — most current entries point to homepages that return zero data rows
- Auto-discovery integrated into GitHub Actions — `scripts/discover.ts` is implemented but has no CI trigger
- Scrape status CI summary — maintainers have no visibility into which universities produce data

**Should have (P2 — architecture cleanliness, enables v4+):**
- Adapter health classification (`cheerio` | `playwright` | `paddleocr` | `skip` | `pending` enum)
- Automated URL re-validation workflow (monthly HTTP probe to detect URL rot)
- tổ hợp wide-table factory extension (large universities use wide-table format; current factory handles tall-table only)
- Soft-gate mode (`SOFT_GATE=true` env var for manual runs against unverified adapters)

**Defer (v4+):**
- Multi-year historical scraping (partially supported; not urgent)
- Admin dashboard UI (CI summary + direct Supabase query is sufficient for v3.0)
- Discovery output auto-proposal via PR (convenience feature)

### Architecture Approach

The architecture is a static-registry, batch-cron pipeline where `scrapers.json` is the single source of truth for adapter configuration. v3.0 adds a two-step URL-finding process: a weekly discovery crawl (finds cutoff page URLs from university homepages) followed by `apply-discovery.ts` which writes confirmed URLs back into `scrapers.json` after human review. The scrape cron reads only the static file — no live DB query at startup — which protects against Supabase free-tier cold-start failures. The key architectural change is replacing the binary `static_verified` gate with a `scrape_url`-presence gate: an adapter runs if and only if it has a target URL and is not explicitly marked `skip`. This allows the pipeline to grow organically as discovery populates URLs over time.

**Major components and their v3.0 status:**

1. `lib/scraper/registry.ts` — CHANGES: replaces `static_verified` boolean gate with `scrape_url` presence + `adapter_type` routing; new `RegistryEntry` interface adds `website_url`, `scrape_url`, `adapter_type`, `verified_at`
2. `scrapers.json` — CHANGES: `url` → `website_url` (homepage, discovery input) + new `scrape_url` field (cutoff page, discovery output, null initially); expands from 78 to 400+ entries; `static_verified` removed
3. `.github/workflows/discover.yml` — NEW: weekly 4-shard Crawlee discovery run; outputs `discovery-candidates.json` as GHA artifact; `apply-discovery.ts` patches `scrapers.json` after human review
4. `scripts/seed-universities.ts` — NEW: one-time seeder from `uni_list.json` to Supabase `universities` table
5. `scripts/apply-discovery.ts` — NEW: merges discovery candidates into `scrapers.json` with human review gate; never overwrites entries with `verified_at`
6. `lib/api/scrape-status.ts` + `app/admin/scrape-status/page.tsx` — NEW (optional within v3.0): read-only monitoring view of `scrape_runs`
7. All scraping components (`runner.ts`, `run.ts`, `factory.ts`, `normalizer.ts`, `discovery/`) — UNCHANGED

### Critical Pitfalls

1. **`static_verified` gate silently blocks 95% of adapters** — Fix the gate before adding any new university entries. Adding 322 new entries with `static_verified: false` while this gate exists is purely cosmetic — the cron stays green, the pipeline stays hollow. Prevention: address in Phase 1 before any expansion.

2. **Homepage URLs in `scrapers.json` produce zero data rows** — A registry of 400 universities with homepage URLs is a hollow registry. The temptation to add all entries quickly and "fix URLs later" means later never comes. Prevention: treat URL audit as a distinct done criterion separate from university list population; use discovery candidates but require human confirmation before promoting any URL to runnable.

3. **Auto-discovery false positives corrupt production scraper config** — The keyword scorer's default threshold (score >= 3) flags general admissions landing pages alongside real cutoff pages. `tuyen-sinh` in a URL slug alone is enough to score above threshold. Automating discovery-to-config without a human gate writes bad URLs into production. Prevention: discovery workflow outputs artifact only; `apply-discovery.ts` runs manually after human review; raise auto-routing threshold to score >= 8 requiring both URL slug AND table header keywords.

4. **GHA shard count does not scale with university count** — At 400 universities on 6 shards, per-shard runtime approaches the 360-minute hard job timeout during July peak (4x/day × 6 shards × potentially 200+ min). Prevention: increase to 10 shards when runnable adapter count exceeds 100; PaddleOCR/Playwright adapters should be isolated to dedicated shards to avoid setup overhead multiplication.

5. **Supabase 500 MB free tier exhausted by unbounded `scrape_runs` logs** — At 400 universities, verbose `error_log` JSON fields can consume 200-400 MB within 6-12 months. Prevention: add 90-day pruning to keepalive cron; truncate `error_log` to 2 KB at insert time in `runner.ts`; add storage monitoring.

6. **tổ hợp coverage collapses on wide-table pages** — Large universities publish one score column per tổ hợp (wide format). The current factory handles tall-table only. Scraping wide-table pages with the current factory produces one row per major using only the last tổ hợp column. Prevention: classify table format during URL audit; extend factory before mass adapter creation.

## Implications for Roadmap

Based on the strict dependency chain established across all four research files, a 5-phase structure is recommended. Phases 1-3 are on the critical path and must ship in order. Phases 4 and 5 are independent of each other and can proceed in parallel or either order after Phase 3 completes.

### Phase 1: University Master List + Registry Gate Fix

**Rationale:** Both items have no upstream dependencies and together unlock everything else. The registry gate fix must precede any university expansion — adding entries while the gate exists achieves nothing. The university list provides the homepage URLs that discovery will crawl in Phase 2.

**Delivers:**
- `uni_list.json` (400+ MOET-authoritative entries with mã trường codes sourced from MOET portal)
- `scripts/seed-universities.ts` — Supabase `universities` table expanded to 400+ rows
- `scrapers.json` schema migration: `url` → `website_url`, add `scrape_url` (null initially), add `adapter_type` enum, remove `static_verified`; 4 already-verified adapters have their existing `url` promoted to `scrape_url`
- `lib/scraper/registry.ts` gate rewritten: `if (!entry.scrape_url || entry.adapter_type === 'skip') continue;`
- `is_active` boolean added to `universities` schema for tracking institution lifecycle

**Addresses:** Complete university master list (P1), registry gate removal (P1)

**Avoids:** Hollow registry from homepage URLs (Pitfall 2), MOET institution list drift (Pitfall 7), `static_verified` silent blackout (Pitfall 1)

**Research flag:** No additional research needed. Changes are well-scoped: a data sourcing task (MOET portal scrape via existing CheerioCrawler) and a targeted code change to `registry.ts`.

### Phase 2: Auto-Discovery Integration + URL Audit

**Rationale:** Depends on Phase 1 having populated `website_url` for 400+ entries. Converts the existing orphaned `scripts/discover.ts` into an automated CI workflow and establishes the human-gated pipeline from discovery output to `scrapers.json` update. The URL audit is the most labor-intensive part of v3.0 — it determines how many of the 400 universities produce actual data.

**Delivers:**
- `.github/workflows/discover.yml` — weekly 4-shard cron + `workflow_dispatch`; shards keep each shard under 60 min; outputs `discovery-candidates.json` as GHA artifact
- `scripts/apply-discovery.ts` — human-reviewed merge of candidates into `scrapers.json`; protects `verified_at` entries
- Keyword scorer threshold raised: score >= 8 requiring both URL slug AND table header keywords for auto-routing
- First manual discovery run via `workflow_dispatch` against all 400 homepages
- Initial batch of `scrape_url` values populated in `scrapers.json` after human review

**Addresses:** Auto-discovery in CI (P1), correct cutoff page URLs (P1)

**Avoids:** Discovery false positives in production config (Pitfall 4)

**Research flag:** No additional research needed. `discover.ts` implementation is correct; the work is wiring into GHA, defining the human review gate, and running it.

### Phase 3: CI Workflow Scaling + Scrape Status Monitoring

**Rationale:** Once Phase 2 populates URLs for a meaningful number of adapters (50+), the daily scrape cron produces real data and the 6-shard setup may approach its runtime limits. Monitoring is only meaningful after real scrape runs are happening at scale. `scrape_runs` pruning must be in place before storage grows unchecked.

**Delivers:**
- Shard count increase from 6 to 10 in `scrape-low.yml` and `scrape-peak.yml` (triggered when runnable adapter count exceeds 100)
- `scrape_runs` 90-day row pruning added to `supabase-keepalive.yml`
- `error_log` field capped to 2 KB at insert time in `runner.ts`
- `latest_scrape_runs` Postgres `DISTINCT ON` view for efficient monitoring queries
- Scrape status CI summary step printed at end of each shard run
- Optional: `app/admin/scrape-status/page.tsx` Server Component + simple `ADMIN_SECRET` middleware
- Storage monitoring step in keepalive that warns when Supabase reports > 300 MB

**Addresses:** Scrape status dashboard/observability (P1), audit trail in Supabase (P1)

**Avoids:** GHA shard timeout at 400 universities (Pitfall 3), Supabase storage exhaustion (Pitfall 5)

**Research flag:** No additional research needed. Standard Postgres view + Next.js Server Component + GHA job configuration — all fully documented patterns.

### Phase 4: tổ Hợp Wide-Table Factory Extension

**Rationale:** Can only proceed after Phase 2 has populated enough `scrape_url` values to audit actual page structures. Wide-table detection is meaningless until real cutoff pages are being scraped and their structure can be classified.

**Delivers:**
- Table format classification field in `scrapers.json` (`table_format: "tall" | "wide" | "sectioned"`)
- Factory extension in `lib/scraper/factory.ts` for wide-table extraction (multiple score columns per tổ hợp)
- Wide-table fixture added to test suite before factory extension is built
- Audit of top 50 universities by enrollment to classify their table structure

**Addresses:** All tổ hợp combinations captured (P2)

**Avoids:** Silent tổ hợp coverage gaps for major universities (Pitfall 6)

**Research flag:** Needs targeted research during planning — page-by-page audit of top 50 universities to quantify how many use wide-table format and which specific column patterns are used. This determines whether the factory extension is a small patch or a significant refactor.

### Phase 5: Adapter Health Classification + URL Re-validation

**Rationale:** Clean architecture improvements that reduce ongoing maintenance burden. Independent of Phase 4; can be done in parallel or after.

**Delivers:**
- `adapter_type` enum fully operationalized across all 400+ `scrapers.json` entries
- `SOFT_GATE=true` env var mode for manual verification runs against unverified adapters
- Monthly URL re-validation GHA workflow — HTTP probe on all `scrape_url` entries; flags 404s and zero-table responses
- `verify-adapters.ts` extended with `p-limit` concurrency control (install `p-limit ^6.2.0` as dev dependency)
- `UniSelectBot/1.0` User-Agent set in all scraper HTTP requests (ethical compliance + avoids IP blocks)

**Addresses:** Adapter health classification (P2), URL re-validation workflow (P2), soft-gate mode (P2)

**Avoids:** Silent URL rot, OOM from unconcurrency-controlled 400+ URL probes (Pitfall integration gotchas)

**Research flag:** No additional research needed. Standard patterns — HTTP probe loop with p-limit, env var feature flag, GHA monthly cron.

### Phase Ordering Rationale

- **Phase 1 before Phase 2:** Discovery needs `website_url` populated in `scrapers.json`; the gate must be fixed so discovered `scrape_url` values actually trigger scrape runs.
- **Phase 2 before Phase 3:** Monitoring is only meaningful when real scrape runs are happening; shard scaling is only needed when runnable adapter count grows.
- **Phase 2 before Phase 4:** tổ hợp format audit requires real cutoff pages to examine, not homepages.
- **Phases 4 and 5 are parallelizable:** No dependency between them; both require Phase 2 to have completed.
- **Critical path:** Phase 1 → Phase 2 → Phase 3. These three must ship in order; Phases 4 and 5 are improvements on a working pipeline.

### Research Flags

Phases needing deeper research during planning:
- **Phase 4:** Requires a targeted audit of the top 50 universities by enrollment to classify their HTML table structure (tall, wide, sectioned). The prevalence of wide-table format determines the scope of the factory extension. This audit should happen during Phase 2 (while running the first discovery batch) to inform Phase 4 planning.

Phases with standard patterns (no research-phase needed):
- **Phase 1:** Data sourcing from MOET portal (existing CheerioCrawler pattern) + targeted code change to `registry.ts`. No ambiguity.
- **Phase 2:** `discover.ts` is already implemented and correct; work is wiring into GHA and defining the human review gate.
- **Phase 3:** Standard Postgres view + Next.js Server Component + GHA job configuration.
- **Phase 5:** Standard HTTP probe loop, env var feature flag, monthly cron — all documented patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | p-limit version confirmed via npm registry; GHA limits confirmed via official docs (March 2026); all other dependencies already in production and working |
| Features | HIGH | Derived from direct codebase inspection of `scrapers.json` (78 entries, 4 verified), `registry.ts` (gate condition at line 28), `runner.ts`, `discover.ts`; dependency chain is code-verifiable |
| Architecture | HIGH | All component behavior derived from reading actual source files; proposed changes are surgical (gate logic change, JSON schema migration, new workflow file); no speculative patterns |
| Pitfalls | HIGH | All 7 pitfalls are directly observable in the existing codebase; no theoretical risks — the `static_verified` gate, homepage URLs, 6-shard count, and unbounded `error_log` field are present facts |

**Overall confidence:** HIGH

### Gaps to Address

- **MOET portal scrapeability:** The official university list at `thisinh.thitotnghiepthpt.edu.vn` may require Playwright if the institution dropdown is JS-rendered. Confirm before building the seed scrape — if JS-rendered, use the existing Playwright adapter pattern already in the project.
- **Discovery run duration at 400 universities:** Estimated 30-60 minutes for a full discovery run (400 universities × up to 50 pages × 2 seconds per page at `sameDomainDelaySecs: 2`, single concurrency per domain). The first run should be a `workflow_dispatch` to validate actual timing before committing to a weekly cron schedule and finalizing shard configuration.
- **tổ hợp wide-table prevalence:** Unknown what fraction of the 400 universities use wide-table vs. tall-table format. This determines whether Phase 4 is a small patch or a significant factory rewrite. Needs a targeted page audit during Phase 2 to quantify.
- **p-limit ESM compatibility:** `p-limit ^6.2.0` is ESM-only. All scripts that import it must use `import` syntax. Verify `verify-adapters.ts` uses ESM imports (it runs via `tsx`) before installing.
- **Supabase keepalive single point of failure:** The `supabase-keepalive.yml` workflow prevents free-tier pause. If accidentally disabled (e.g., after a repo visibility change), the database pauses within 7 days. Add a health-check verification step to the keepalive response to make failures observable.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `lib/scraper/registry.ts`, `runner.ts`, `run.ts`, `factory.ts`, `scripts/discover.ts`, `lib/scraper/discovery/` (keyword-scorer, constants, candidate types), `scrapers.json`, `lib/db/schema.ts`, `.github/workflows/scrape-low.yml`, `scrape-peak.yml`
- GitHub Actions official limits: 360 min per-job hard timeout, 256 matrix jobs max, 20 concurrent jobs on free plan, unlimited minutes for public repos
- Supabase pricing (official): 500 MB database storage cap; 1-week inactivity pause policy
- p-limit npm registry: current version 7.3.0 (general); v6.2.0 minimum ESM-compatible; Node >= 18 required
- Next.js middleware documentation: route protection patterns

### Secondary (MEDIUM confidence)
- MOET official university portal (`thisinh.thitotnghiepthpt.edu.vn`): source for mã trường codes; no JSON API; requires one-time scrape
- MOET quality management portal (`vqa.moet.gov.vn`): accredited institution list updated through 2025
- `uni_list_examples.md` in project root: 78 Northern Vietnamese universities already documented with ministry codes and homepage URLs — the verified base for Phase 1

### Tertiary (MEDIUM-LOW confidence)
- Vietnam university count (~237-400): Wikipedia and MOET sources give varying counts depending on whether vocational colleges are included; 400 is a safe upper bound for licensed degree-granting institutions
- Discovery run duration estimate (30-60 min for 400 universities): calculated from `sameDomainDelaySecs: 2` × up to 50 pages × 400 sites; actual duration depends on server response times and how many universities have easily-discoverable cutoff pages

---
*Research completed: 2026-03-19*
*Ready for roadmap: yes*
