# Feature Research

**Domain:** Vietnamese university admissions data pipeline — v3.0 comprehensive scraping
**Researched:** 2026-03-19
**Confidence:** HIGH (existing codebase examined + web research on pipeline patterns)

---

## Context: Subsequent Milestone Scope

This research covers only the new capability areas for v3.0. v1.0 and v2.0 features are shipped and excluded from this analysis.

Existing infrastructure that new features build on:

- `lib/scraper/registry.ts` — loads `scrapers.json`; filters on `static_verified: true`; only ~5/99 entries pass the gate
- `lib/scraper/runner.ts` — batch DB inserts with upsert, `scrape_runs` logging (ok/flagged/error/zero_rows)
- `lib/scraper/factory.ts` — `createCheerioAdapter(config)` — JSON-config-driven; new adapters need only a JSON entry
- `scripts/discover.ts` — Crawlee-based homepage crawler; scores pages for cutoff content via keyword scoring; not wired to CI
- `scripts/check-staleness.ts` — checks `scrape_runs` table; flags universities with no recent successful run
- `.github/workflows/scrape-low.yml` — 6-shard matrix cron; requires `static_verified: true` to include a university
- `scrapers.json` — 99 entries; 78 have `factory_config`; most point to homepages, not actual cutoff pages
- `uni_list_examples.md` — seed list of ~78 Northern Vietnam universities with Ministry codes and `.edu.vn` URLs

**The core v3.0 problem:** The pipeline is architecturally sound but produces almost no data because:
1. The registry gate (`static_verified: true`) blocks 95% of adapters from running
2. Most adapter URLs point to university homepages, not actual cutoff score pages
3. The university list covers only 78 of ~400 institutions in Vietnam
4. Auto-discovery (the mechanism to find correct cutoff URLs) is standalone — never runs in CI

---

## Feature Landscape

### Table Stakes (Users Expect These)

For v3.0, table stakes means: these are the minimum required for the milestone goal of "pipeline that produces real data." Missing any one leaves the pipeline hollow.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Complete Vietnamese university master list (400+) | Only 78 of ~400 institutions seeded; students from all regions need coverage | MEDIUM | Vietnam has ~237-300 universities; MOET's vqa.moet.gov.vn publishes official lists; `uni_list_examples.md` has 78 Northern ones; need Central/Southern regions; `uni_list_examples.md` format (mã trường, tên trường, URL) already defines the schema |
| Registry gate removal or per-adapter override | `static_verified: true` flag silently skips 94/99 adapters; cron is green but produces no data | LOW | Change gate logic: run adapters regardless, surface verification failures as scrape_run status rather than gating CI; or add a `scraping_method: "skip"` for known-problem adapters (PDF, Google Drive) while allowing untested-but-plausible ones to run |
| Correct cutoff page URLs per university | Most scrapers.json entries point to homepages; cheerio scraper finds no score table at `https://hust.edu.vn/` | MEDIUM | The existing auto-discovery crawler outputs scored candidates; integrate its output into scrapers.json as the actual scrape URL |
| Auto-discovery integrated into GitHub Actions | `scripts/discover.ts` exists but no workflow; cutoff pages are found but never persisted | MEDIUM | New workflow: run discover against all 400+ homepages; output JSON of best-candidate URLs; commit or post as artifact for review; runs on workflow_dispatch + before scrape season starts (June) |
| All tổ hợp combinations captured | Current factory uses keyword matching that may extract only A00 entries; students on D01/B00/etc. need their scores | HIGH | Requires audit of factory's table-parsing logic against actual university pages; many tables have per-tổhợp rows; the normalizer must correctly associate tổhợp codes to score rows |
| Scrape status dashboard / observability | No way to know which 400+ universities have data and which don't; `scrape_runs` table exists but no UI or report | LOW | Existing `scrape_runs` schema already captures status, rows_written, error_log; need: (a) a CI summary step that prints per-university status table, (b) optionally a `/admin/scrape-status` Next.js page reading from Supabase |
| Audit trail in Supabase | Users and maintainers cannot verify data freshness or trace bugs | VERY LOW | `scrape_runs` table already exists with `github_run_id`; runner already inserts rows; the gap is that the registry gate means most universities never appear in scrape_runs at all |

### Differentiators (Competitive Advantage)

Features that make the pipeline more robust than a naive cron-scraper and reduce ongoing maintenance burden.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Automated URL re-validation workflow | University pages change structure annually; a scheduled "verify-adapters" job prevents silent data rot | MEDIUM | Extend `scripts/verify-adapters.ts` into a GHA workflow; run HTTP probe on all scrapers.json URLs; output report of 404s, zero-table responses, and JS-rendered detections; runs monthly during off-season |
| Adapter health classification (static/dynamic/broken/skip) | Surfaces which universities need manual attention vs. which can auto-run | LOW | Extend RegistryEntry type with `scraping_method` enum: `cheerio` (runs), `playwright` (runs with Playwright), `ocr` (runs via PaddleOCR), `skip` (known non-scrapable — PDF/Drive), `pending` (unverified, runs experimentally); log each class separately |
| Soft-gate mode for unverified adapters | Run unverified adapters on workflow_dispatch manually before promoting to cron; reduces risk of bad data flooding Supabase | LOW | Add `SOFT_GATE=true` env var to run all adapters regardless of `static_verified`; used in manual runs; cron keeps gate; allows progressive verification without code changes |
| Discovery output auto-proposal | After discovery run, auto-open a PR or write to a file proposing new URLs for maintainer review | MEDIUM | Prevents discovery output from being silently dropped; creates an explicit review step before URLs become active; fits the existing GitHub Actions / commit-back pattern |
| Multi-year historical data from static pages | Many universities publish cutoff tables spanning 3-5 years on a single page; scraping all years at once gives trend data without needing re-scrapes | MEDIUM | Factory config needs a `yearRange` option or the normalizer must extract year column from the table; already partially supported — `year` field exists in `cutoff_scores` schema |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| LLM-based adaptive scraping ("AI reads any page") | Seems like it would handle all page structures automatically | Token cost per page is $0.01-0.10; at 400 universities scraping 2x/week in July = $3,000-$30,000/year; explicitly out-of-scope per PROJECT.md constraints | Use LLM only as a one-time offline tool during adapter authoring, not at runtime; store resulting CSS selectors in factory config |
| Full-coverage Playwright for all universities | Would handle JS-rendered pages universally | Each Playwright page costs 10-30s vs 0.5s for cheerio; at 400 universities = 4,000s+ per shard; exceeds GitHub Actions 6h limit with free tier | Default to cheerio; add Playwright only for universities that return empty tables under cheerio (detected by zero_rows status) |
| Storing raw HTML in Supabase | Enables re-parsing without re-scraping | At 400 universities × 10KB avg = 4MB per run × 730 runs/year = 2.9GB/year; Supabase free plan is 500MB | Store only extracted rows; keep raw HTML as ephemeral GitHub Actions artifact (1-90 day retention) when debugging |
| Real-time per-request scraping for the user-facing app | Users always see freshest data | Scraping is slow (0.5-30s per university) and violates universities' bandwidth; would require proxy infrastructure | Keep batch cron as data collection; serve from Supabase with static JSON fallback; this pattern is already implemented and working |
| PDF parsing for all universities | NEU and FTU publish scores as PDFs | PDF table extraction is highly error-prone; requires formatting-specific rules per university; maintenance cost is high for charity project | Manually import NEU/FTU PDFs once per year; mark those adapters as `scraping_method: "manual"` in scrapers.json |
| Scrapy or Scrapling migration | More powerful crawling frameworks | Project already has Crawlee working; Cheerio/Playwright/PaddleOCR adapters are tested; migration has no ROI | Stick with Crawlee for discovery; keep existing adapter architecture |
| Ministry portal adapter | Single source with all data | Ministry portal URL changes every admission cycle (confirmed in scrapers.json); no stable API; scraping requires authenticated session during registration window | Use individual university pages as primary sources; monitor Ministry portal URL once per year for supplementary data |

---

## Feature Dependencies

```
Comprehensive uni master list (400+)
    └──required-by──> Auto-discovery integrated into CI
                          └──required-by──> Correct cutoff page URLs
                                                └──required-by──> Registry gate removal/soft-gate
                                                                       └──required-by──> All tổ hợp captured
                                                                                             └──required-by──> Scrape status dashboard

Multi-year data extraction ──enhances──> All tổ hợp captured (both require table-parsing depth)

URL re-validation workflow ──enhances──> Correct cutoff page URLs (catches URL rot proactively)

Adapter health classification ──enables──> Registry gate removal (provides the replacement signal)

PDF adapters (NEU, FTU) ──conflicts-with──> Automated pipeline (manual import instead)
```

### Dependency Notes

- **Comprehensive list requires correct URLs:** Seeding 400 universities with homepage URLs produces no data; the auto-discovery crawler must run against those homepages to surface actual cutoff pages before adapters can be enabled.
- **Registry gate removal requires health classification:** Removing the gate without a replacement signal would run broken adapters on every cron tick, flooding scrape_runs with errors. The adapter health classification (`skip` vs. `pending` vs. `verified`) is the replacement signal.
- **All tổ hợp capture requires correct URLs first:** Cannot audit tổ hợp extraction accuracy until the scraper is actually fetching cutoff pages (not homepages). This is the last dependency in the chain.
- **Auto-discovery integration requires the university list:** The discover script currently reads from scrapers.json (78 entries); it needs to be seeded with 400+ homepage URLs to discover cutoff pages at full coverage.

---

## MVP Definition

### Launch With (v3.0 milestone)

The minimum needed to have a pipeline that "actually produces real cutoff data."

- [ ] **Complete Vietnamese university master list (400+)** — Without this, the pipeline scope cannot expand from 78 universities
- [ ] **Registry gate replaced with adapter health classification** — Without this, new entries never run; the cron stays hollow
- [ ] **Correct cutoff page URLs for as many universities as possible** — This is the deliverable that proves the pipeline works; even 100/400 with verified URLs is a massive improvement over 5/99
- [ ] **Auto-discovery integrated into GitHub Actions** — Makes URL discovery repeatable and auditable; enables ongoing expansion
- [ ] **Scrape status CI summary** — Makes pipeline health observable; required to know what's working

### Add After Validation (v3.x)

- [ ] **All tổ hợp combinations captured** — Add once basic pipeline is producing data; requires parsing audit against real pages
- [ ] **Automated URL re-validation workflow** — Add once initial URL set is established; runs monthly to detect URL rot
- [ ] **Discovery output auto-proposal via PR/artifact** — Convenience; reduces time from discovery run to URL being active

### Future Consideration (v4+)

- [ ] **Multi-year historical scraping** — Nice to have for trend analysis; defer until pipeline is stable
- [ ] **Admin dashboard UI for scrape status** — Useful for maintainers; the CI summary + Supabase direct query is sufficient for v3.0

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Complete uni master list | HIGH (more data = better recommendations) | MEDIUM (research + data entry) | P1 |
| Registry gate removal | HIGH (unblocks everything) | LOW (change one condition + enum) | P1 |
| Correct cutoff page URLs | HIGH (actual data in DB) | MEDIUM (run discovery + manual review) | P1 |
| Auto-discovery in CI | HIGH (makes URL finding repeatable) | MEDIUM (new GHA workflow) | P1 |
| Scrape status CI summary | MEDIUM (maintainer visibility) | LOW (add step to scrape workflow) | P1 |
| All tổ hợp captured | HIGH (students on non-A00 combos) | HIGH (parsing audit + factory changes) | P2 |
| Adapter health classification | MEDIUM (clean architecture) | LOW (extend RegistryEntry type) | P2 |
| URL re-validation workflow | MEDIUM (prevents silent data rot) | MEDIUM (new GHA workflow) | P2 |
| Soft-gate mode | LOW (developer UX) | VERY LOW (env var check) | P2 |
| Discovery output auto-proposal | LOW (convenience) | MEDIUM (PR creation logic) | P3 |
| Multi-year historical scraping | LOW (trend data, already partially supported) | MEDIUM (factory config change) | P3 |

**Priority key:**
- P1: Must have for v3.0 milestone goal ("pipeline produces real data")
- P2: Should add in v3.0 if time permits; unblocks v4+ work
- P3: Nice to have; defer to v4+

---

## Domain-Specific Patterns Observed

### How Vietnamese University Cutoff Data is Typically Published

Based on research into university websites and the existing codebase:

**HTML table format (most common, ~60-70% of institutions):**
- Static HTML table on a dedicated page under `/tuyen-sinh/` or `/diem-chuan/`
- Rows contain: major name, mã ngành (major code), tổ hợp, điểm chuẩn, seats
- Multi-year tables are common — one table spanning 2021-2025 columns
- URL path patterns: `**/diem-chuan*`, `**/diem-trung-tuyen*`, `**/ket-qua-trung-tuyen*`

**JS-rendered format (~20-25%):**
- Content loaded via AJAX or React/Vue; cheerio returns empty or nav-only HTML
- Detection heuristic: `table` present in HTML but `tr_count < 5` after fetch
- Requires Playwright adapter

**Image/PDF format (~10-15%):**
- Score table published as image (PaddleOCR) or PDF download link
- Known examples in scrapers.json: NEU (PDF), FTU (Google Drive)
- PaddleOCR smoke test already in CI; adapter pattern established

**Google Drive/external link (~5%):**
- University posts a Google Sheets or Google Drive PDF link
- Not automatable without authentication; mark as `scraping_method: "manual"`

### How Comprehensive University Sourcing Works

Vietnam's official source is MOET (Bộ Giáo dục và Đào tạo). The quality management portal at `vqa.moet.gov.vn` publishes lists of accredited institutions updated through 2025. The university list in `uni_list_examples.md` follows the Ministry's coding system (mã trường). Coverage approach for v3.0:

1. Use `uni_list_examples.md` (78 Northern universities) as the verified base
2. Source Central Vietnam (Huế, Đà Nẵng) and Southern Vietnam (HCMC, Cần Thơ) institutions from MOET lists
3. Seed all homepages into the database; mark `scraping_method: "pending"`
4. Run auto-discovery against all 400 homepages to find actual cutoff pages
5. Promote URLs that score above threshold to `scraping_method: "cheerio"` (or `playwright`)

### Monitoring Pattern for Scraper Health

The existing `scrape_runs` table (status: ok/flagged/error/zero_rows) plus `github_run_id` provides the foundation. Standard scraper pipeline monitoring practices recommend:

- **Alert threshold:** Flag universities with `status = 'zero_rows'` for 3+ consecutive runs (likely page structure changed)
- **Change detection:** If `rows_written` drops by >50% vs. prior run for the same university, flag as structural change
- **Health rollup:** Post-scrape summary step in GHA that counts ok/flagged/error/zero_rows across all universities; exit 1 only if >20% error rate (not on individual failures, to avoid alert fatigue)

---

## Sources

- Project codebase: `lib/scraper/registry.ts`, `lib/scraper/runner.ts`, `scripts/discover.ts`, `scrapers.json`, `uni_list_examples.md`
- PROJECT.md v3.0 milestone scope and constraints
- [Wikipedia: List of universities in Vietnam](https://en.wikipedia.org/wiki/List_of_universities_in_Vietnam)
- [MOET Quality Management Portal (vqa.moet.gov.vn)](https://vqa.moet.gov.vn/) — official list of accredited institutions updated to 2025
- [Vietnam Ministry portal (thisinh.thitotnghiepthpt.edu.vn)](https://thisinh.thitotnghiepthpt.edu.vn/) — centralized admissions system; URL changes each cycle
- [Top 5 Approaches to Let Scrapers Adapt to Website Changes (The Web Scraping Club)](https://substack.thewebscraping.club/p/5-approaches-make-scrapers-more-reliable) — fallback selector patterns, self-healing scrapers
- [Crawler APIs for Monitoring Website Changes (Scrapfly)](https://scrapfly.io/blog/posts/crawler-apis-for-monitoring-website-changes-maintaining-ai-chatbots) — change detection heuristics
- [Web Scraping Challenges & Compliance 2025 (GroupBWT)](https://groupbwt.com/blog/challenges-in-web-scraping/) — alert thresholds, verification layers, pipeline resilience

---

*Feature research for: Vietnamese university admissions data pipeline (v3.0 comprehensive scraping)*
*Researched: 2026-03-19*
