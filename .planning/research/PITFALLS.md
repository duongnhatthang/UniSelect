# Pitfalls Research

**Domain:** Web scraper scaling — Vietnamese university cutoff score pipeline (5 to 400+ sites)
**Researched:** 2026-03-19
**Confidence:** HIGH (issues derived directly from codebase inspection + verified infrastructure limits)

---

## Critical Pitfalls

### Pitfall 1: The `static_verified` Gate Is a Silent Data Blackout, Not a Safety Net

**What goes wrong:**
The registry gate at `lib/scraper/registry.ts:28` skips any entry where `static_verified !== true`. Of the 78 entries in `scrapers.json`, only 4 have `static_verified: true`. The daily cron runs, logs success, and produces data for 4 universities while silently discarding the other 74. Expanding to 400+ universities without fixing this gate first means the expansion achieves nothing — the cron remains green, the pipeline remains hollow.

**Why it happens:**
The gate was added as a temporary quality control measure during v2.0 to prevent untested adapters from writing garbage data. It was never meant to be permanent but became the default state. Every new entry in `scrapers.json` is added with `static_verified: false`, which means the gate grows more restrictive the more entries are added.

**How to avoid:**
Before adding new universities, redesign the gate. The binary `static_verified` flag must be replaced with a graduated approach: a `scraping_method` field (already partially present) should drive routing — `static_html` runs via the cheerio factory, `playwright` runs via the Playwright adapter, `ocr` runs via PaddleOCR, `manual` skips with an explicit log, `deferred` skips with an explicit log. Remove the blanket `static_verified` skip in favor of method-based routing. Only `manual` and `deferred` entries should be skipped.

**Warning signs:**
- `scrape-low.yml` logs show 0 errors and 0 rows for 95%+ of universities
- `scrape_runs` table has entries for only 4-6 distinct `university_id` values
- `npm run scrape` exits with "No adapters with static_verified=true" warning

**Phase to address:**
Phase 1 (Registry Gate Fix) — must be resolved before any university expansion. Adding 322 more entries to `scrapers.json` with `static_verified: false` while this gate exists makes the expansion purely cosmetic.

---

### Pitfall 2: Expanding scrapers.json Without a Real URL Audit Produces a Hollow Registry

**What goes wrong:**
74 of the 78 existing entries point to university homepages (e.g., `https://hust.edu.vn/`), not actual cutoff score pages. The factory adapter tries to parse the homepage for a data table, finds nothing, and logs a zero-rows error. Adding 322 more entries from a university name list with homepage URLs produces 400 registered universities and 0 additional data rows. The pipeline looks complete but is still hollow.

**Why it happens:**
It is far faster to compile a list of university codes and website root URLs than to manually visit each university's site and locate the specific `/diem-chuan/` or `/thong-bao/` subpage. The temptation is to add all 400 entries quickly and "fix URLs later." Later never comes.

**How to avoid:**
Treat URL sourcing and adapter creation as two distinct work items with separate done criteria. The university master list (Phase 1) should contain only: ministry code, Vietnamese name, and homepage URL. Adapter entries in `scrapers.json` should only be created once a human has visited the site, confirmed the cutoff page URL, confirmed the page format (static HTML, JS-rendered, image, PDF), and tested the selector. Use the auto-discovery crawler to accelerate URL finding, but require human confirmation before setting `scraping_method` to anything runnable.

**Warning signs:**
- All new `scrapers.json` entries have the pattern `"url": "https://[university].edu.vn/"` with no subpath
- Zero-rows error rate stays at 95%+ after adding new entries
- Discovery candidates output (`discovery-candidates.json`) is ignored in the workflow

**Phase to address:**
Phase 2 (URL Audit) — run auto-discovery against all 400 homepages first, review candidates, then populate scraper entries with real cutoff page URLs.

---

### Pitfall 3: GitHub Actions Shard Count Does Not Scale With University Count

**What goes wrong:**
The current 6-shard matrix was designed for 78 universities (13 per shard). At 400 universities (67 per shard), each shard runs approximately 67 university scrapes. Per-shard fixed setup cost: npm ci (~3 min) + Playwright cache restore (~2 min) + PaddleOCR warmup (~2 min) = ~7 min overhead per shard. Scraping time at ~1-3 min per university for cheerio (static HTML) multiplied by 67 = 67-200 min per shard. Playwright and PaddleOCR jobs are significantly slower. Total per shard can reach 200+ min, approaching the 6-hour hard job timeout (360 min). Increasing shards reduces per-shard time but multiplies setup overhead: 24 shards × 7 min setup = 168 min of pure overhead per run.

This project uses a public repository. Public repos get unlimited GHA minutes (confirmed: GitHub Actions billing docs state standard GitHub-hosted runners are free and unlimited for public repos). The binding constraint is the per-job timeout (360 min max), not monthly minutes.

**Why it happens:**
Shard count is hardcoded at 6 in both `scrape-low.yml` and `scrape-peak.yml`. The matrix `shard: [0, 1, 2, 3, 4, 5]` must be manually updated. During July peak season, 4x daily runs mean 4 × (6 jobs × ~120 min) = ~2,880 job-minutes per day. With 400 universities and 6 shards, per-job time could exceed the 360-min limit for Playwright and OCR-heavy shards.

**How to avoid:**
Increase the shard count proportionally when expanding university coverage. At 400 universities: use 20-24 shards. Separate Playwright and PaddleOCR adapters into dedicated shards (they are slower and should not share shard slots with fast cheerio adapters). Add `timeout-minutes: 300` to each job to get an early warning before hitting the 360-min hard limit. Only install PaddleOCR on shards that contain OCR adapters.

**Warning signs:**
- GHA job durations approaching 120+ min on any shard
- Shard 5 (the tail shard, receives the largest remainder) consistently timing out
- Peak-season runs showing partial results where some shards complete and others are cancelled

**Phase to address:**
Phase 3 (CI Workflow Scaling) — recalculate shard count and job topology when university count is finalized.

---

### Pitfall 4: Auto-Discovery False Positives Write Bad URLs Into Production Scraper Config

**What goes wrong:**
The keyword scorer in `lib/scraper/discovery/keyword-scorer.ts` scores pages based on Vietnamese admission keywords in URL slugs, page titles, headings, and table headers. The `SCORE_THRESHOLD` is 3 — a single URL slug match (`tuyen-sinh` in the URL) qualifies. This means general admissions information pages, enrollment plan PDFs, and news articles about admissions will score above threshold even if they contain no actual cutoff score table. If discovery output is piped directly into `scrapers.json` without human review, the scraper will be pointed at wrong pages.

The keyword `tuyen-sinh` (admissions) is extremely broad. A university's homepage `/tuyen-sinh/` landing page (which lists available majors with no cutoff scores) scores 3 and is flagged as a candidate.

**Why it happens:**
The discovery system was built to suggest candidates, not to autonomously configure scrapers. The output (`discovery-candidates.json`) has never been connected to an automated update path — which is correct. The pitfall occurs if v3.0 adds automation that treats discovery output as a ready-to-use scraper config.

**How to avoid:**
Keep a mandatory human review step between discovery and scraper config update. The GHA discovery workflow should output candidates to an artifact or a PR comment, never directly patch `scrapers.json`. Add a separate `scraping_method: "candidate"` status for discovery hits that triggers a human review issue. Raise the threshold for auto-routing: require both a URL slug keyword AND a table header keyword (score >= 8) before treating a URL as a confirmed cutoff page.

**Warning signs:**
- Discovery candidates include pages with URLs matching `*/tuyen-sinh/*` but no data table
- Candidate pages return zero rows when scraped
- `scrape_runs` shows high `rows_rejected` rates for newly added adapters

**Phase to address:**
Phase 2 (Auto-Discovery Integration) — define the discovery-to-config pipeline with an explicit human gating step before enabling.

---

### Pitfall 5: Supabase 500 MB Free Tier Exhausted by Unbounded Scrape Monitoring Logs

**What goes wrong:**
The `cutoff_scores` table stores approximately 200-300 bytes per row including index overhead. At 400 universities × 50 majors avg × 5 tổ hợp avg × 3 years of history = 300,000 rows = ~75 MB for cutoff data alone. This is safe. The risk is `scrape_runs`: one row per university per run. At 400 universities × 365 daily runs = 146,000 rows/year. The `error_log` text field stores verbose JSON arrays of rejected rows — a field that can be multi-KB on failure. At 400 universities with frequent adapter errors, `scrape_runs` can reach 200-400 MB within 6-12 months, exhausting the 500 MB free tier and forcing Supabase into read-only mode.

The Supabase free tier also pauses after one week of inactivity. The 5-day keep-alive cron (`supabase-keepalive.yml`) prevents pausing, but is a single point of failure that must not be accidentally disabled.

**Why it happens:**
The `scrape_runs` table was designed for debugging, not long-term retention. No TTL or archival strategy was defined in v2.0. The `error_log` field has no size cap.

**How to avoid:**
Add a `scrape_runs` retention policy: delete rows older than 90 days as part of the weekly keepalive cron. Cap `error_log` text to 2KB at insert time (truncate in `runner.ts` before writing). Add a `verify-db.ts` step that reports storage usage and warns when approaching 400 MB. Never store raw HTML or page snapshots in the database.

**Warning signs:**
- `scrape_runs` row count exceeds 100,000
- Supabase dashboard reports database size above 300 MB
- Any GHA step logs or writes raw HTML to the database as debug output

**Phase to address:**
Phase 3 (Monitoring) — add storage monitoring and pruning to the keepalive workflow.

---

### Pitfall 6: tổ hợp Coverage Collapses on Wide-Table Pages Without Factory Extension

**What goes wrong:**
The cheerio factory adapter has two modes: single-tổ hợp (uses `defaultTohop`) and multi-tổ hợp (reads from a column). Most factory configs in `scrapers.json` use `tohopKeywords: ["To hop", "Khoi", "to hop", "Tổ hợp"]`. In practice, Vietnamese university cutoff pages use three structural patterns:

1. **Wide table**: One row per major, one column per tổ hợp — factory cannot handle this; it finds one tổ hợp column index and misses all others.
2. **Tall table**: One row per (major, tổ hợp) pair — factory handles correctly.
3. **Grouped sections**: Separate HTML tables per tổ hợp block — factory may scrape only the first table.

Pattern 1 (wide table) is common at larger universities with many tổ hợp. The factory's column-finder returns one column index — it cannot handle multi-column layouts where each tổ hợp is a separate score column. Scraping a wide-table page with the current factory produces one row per major (using the last tổ hợp column's value) or fails entirely.

**Why it happens:**
The factory was designed for the tall format. The fixture library covers 7 edge-case HTML formats but the wide-table-per-tổ hợp pattern may not be among them. This is only discovered during URL audit when actual page HTML is examined.

**How to avoid:**
During the URL audit phase, classify each page's table structure. Add a `table_format: "tall" | "wide" | "sectioned"` field to `scrapers.json`. Extend the factory to handle wide-table extraction (detect multiple score columns, one per tổ hợp). Add a wide-table fixture to the test suite before building the factory extension.

**Warning signs:**
- Pages that visually show 5+ tổ hợp per major produce only 1 tổ hợp per major in the database
- `rows_written` for universities with many tổ hợp is suspiciously low compared to their published count
- Student-visible data shows gaps for B-block and D-block combinations at well-known universities

**Phase to address:**
Phase 2 (Adapter Development) — identify wide-table universities during URL audit and add factory support before mass adapter creation.

---

### Pitfall 7: Expanding to 400 Universities Without a Ministry-Authoritative Source Creates an Unmaintainable Institution List

**What goes wrong:**
Vietnam's Ministry of Education and Training (MOET) publishes an official list of licensed higher education institutions. This list changes yearly: new institutions are licensed, others merge or lose accreditation. If the v3.0 university master list is compiled manually from `uni_list_examples.md` or similar one-time sources without a link back to MOET data, the list will drift. Closed or merged institutions remain in the database. New private colleges are never added. Cutoff score data for closed institutions is served to students as current.

**Why it happens:**
There is no official machine-readable API for the MOET institution list. The data exists as PDFs and HTML tables on MOET's portal. Scrapers and aggregators compile their own copies. Without a periodic re-sync against an authoritative source, any compiled list becomes stale.

**How to avoid:**
Identify and bookmark the MOET institution list URL. Add a yearly manual audit task: download the current MOET list in July (before admissions season), diff against the local `universities` table, add new entries, flag removed institutions as `is_active: false`. Do not delete institutions from the database — preserve historical cutoff data. Add an `is_active` boolean to the `universities` table schema.

**Warning signs:**
- A university in the database has no cutoff data for 2+ consecutive years
- Students report looking for an institution that does not appear in results
- MOET public announcements mention institution mergers not reflected in the database

**Phase to address:**
Phase 1 (University Master List) — source the initial 400+ list from MOET data, not from ad hoc web research.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Adding all 400 universities with homepage URLs as placeholders | Fast registry population | Zero additional data rows; hollow pipeline appears complete | Never — URL audit must happen before or immediately after entry creation |
| Keeping `static_verified` boolean as the gate after expanding | No code change required | 95%+ of adapters silently skipped; scraper produces nothing | Never — must be replaced with method-based routing |
| Reusing 6 shards for 400 universities | No workflow file change | Per-shard runtime approaches 6-hour GHA job timeout | Never — shard count must scale with university count |
| Storing full verbose `error_log` for every failed scrape | Easy debugging | `scrape_runs` table fills Supabase 500 MB in months | Only acceptable in dev/staging with an automated cleanup policy |
| Discovery candidates auto-patched into scrapers.json | Faster URL population | Bad URLs in production; zero-rows errors; wrong data served to students | Never — human review gate is mandatory |
| Single factory_config covers all page formats without format classification | One config pattern | Wide-table tổ hợp pages produce wrong data silently | Acceptable only for confirmed tall-table pages with explicit `table_format` annotation |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase free tier | Assuming rows are unlimited; only storage is capped | Budget 200-300 bytes/row including indexes; monitor dashboard proactively; prune `scrape_runs` after 90 days |
| Supabase keep-alive | Assuming the cron runs forever after setup | Verify `supabase-keepalive.yml` is enabled after any repo settings change; include a DB health check in the keepalive response |
| GitHub Actions public repo | Assuming unlimited means no constraints | Per-job timeout is 360 min (hard limit); each new shard multiplies setup overhead (~7 min per shard); cache keys must be invalidated when dependencies change |
| PaddleOCR in GHA | Installing PaddleOCR on every shard even when shard has no OCR adapters | Separate OCR adapters into dedicated shard(s); only those shards run the Python setup steps |
| Playwright cache in GHA | Cache miss on every run because `hashFiles('package-lock.json')` changes with any dep update | Use a cache key that only invalidates on Playwright version changes |
| Auto-discovery Crawlee storage | Default storage writes to filesystem; concurrent discover runs in the same GHA workspace corrupt each other | Confirm `CRAWLEE_STORAGE_DIR` is set to a unique temp path per job, or use `MemoryStorage` mode |
| scrapers.json at 400+ entries | Manually editing 400 JSON entries for URL updates is error-prone | Add a validation step (`scripts/verify-adapters.ts`) in CI that fails if any runnable adapter has a homepage-only URL (no subpath) |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Sequential scraping within a shard | Shard runtime scales linearly with university count | Scraping within a shard is sequential (one university at a time) to avoid IP-blocking; scale by adding shards, not parallelism within a shard | At ~80 universities/shard with 1-min avg per site |
| Playwright cold start per page | Each Playwright adapter launches a new browser instance | Reuse a single browser instance across all Playwright adapters in a shard; close only after all adapters finish | At 10+ Playwright adapters in a single shard |
| PaddleOCR model reload per image | Python subprocess spawned per OCR page; model reloads each time | Batch all OCR pages in one Python process invocation | At 20+ OCR adapters |
| Cheerio parsing homepage HTML | Homepage fetches 500KB+ HTML; fetch is slow and returns no data | URL audit ensures scrapers point to lightweight cutoff subpages | Immediately — every homepage-pointed adapter wastes 2-5 sec fetch time |
| Full table scan on `cutoff_scores` for recommendation queries | Query time grows as cutoff data accumulates over years | Ensure composite index on `(university_id, tohop_code, year)` exists; `scraped_at` should not be in the recommendation query path | At 500,000+ rows (~year 3 of operation) |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Scraping Vietnamese university sites without identifying the bot | IP block after aggressive crawling; ethical violation | Use `UniSelectBot/1.0 (https://github.com/[repo]; open source, educational use)` as User-Agent in all scrapers |
| Storing `DATABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in workflow env unmasked | Accidental leak if workflow YAML is edited to echo env | Both are already in GHA secrets; never echo or log these values in workflow steps |
| Auto-discovery crawler with per-domain rate limiting removed | Hammering a single university's web server | `sameDomainDelaySecs: 2` and `maxConcurrency: 1` in `discover.ts` must not be removed when integrating into CI |
| Treating PaddleOCR model cache as an unverified artifact | Corrupted or tampered model weights produce silently wrong OCR output | Pin PaddleOCR and PaddlePaddle versions in `requirements.txt`; verify cache key includes the script hash |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing universities with no cutoff data for the current year | Students see universities in the ranked list with no score to compare; confusion about eligibility | Filter results to universities with cutoff data for the most recent available year; show a "data not yet available" state for newly added institutions |
| No regional filter at 400 institutions | Northern students receive results for Southern universities they cannot attend; list feels overwhelming | Add province/region filter once coverage reaches all regions |
| Staleness indicator not updated when scraper silently fails | Student sees data labeled "last updated 1 year ago" without understanding why | Ensure `staleness-alert.yml` covers all 400 universities, not just the 78 currently seeded |
| Adding 400 universities without proportional UX improvements | Ranked list of 400+ results is unusable without filtering | Ensure filtering by tổ hợp, score delta sorting, and institution type filter all work at scale before expanding the database |

---

## "Looks Done But Isn't" Checklist

- [ ] **University Master List:** 400 entries in `universities` table does not mean 400 scrapers are working — verify `scrape_runs` has `status: 'ok'` entries for each university within the last 30 days
- [ ] **Registry Gate Fix:** Removing `static_verified` check from registry does not mean all adapters run — verify `scraping_method` routing is tested with each format type (static, playwright, ocr)
- [ ] **Auto-Discovery Integration:** Auto-discovery workflow running in GHA does not mean discovered URLs are being used — verify the candidate-to-config pipeline has a human review step and candidates are being acted on
- [ ] **Shard Scaling:** Adding shards to the matrix does not prevent timeout — verify actual per-shard runtime is under 240 min (with 120 min safety margin before the 360-min hard limit)
- [ ] **tổ hợp Coverage:** Scraper producing rows does not mean all tổ hợp are captured — verify row count per university matches the published count on the university's website
- [ ] **Supabase Storage:** Rows exist in the database does not mean storage is healthy — verify Supabase dashboard shows under 300 MB and `scrape_runs` pruning is confirmed in keepalive logs
- [ ] **Keep-alive Active:** Keepalive workflow exists does not mean Supabase is not paused — verify the workflow last ran within 5 days by checking the Actions run history

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Hollow registry (static_verified gate never removed) | MEDIUM | Redesign registry routing, re-test all adapters, re-run scraper against all verified URLs |
| 400 homepage URLs with no cutoff data | HIGH | Manual audit of 400 sites; use discovery output to accelerate but each site still requires human review |
| Supabase storage full (read-only mode triggered) | MEDIUM | Prune `scrape_runs` (DELETE WHERE run_at < NOW() - INTERVAL '90 days'); truncate `error_log` on old rows; upgrade to Pro ($25/mo) if data volume structurally requires it |
| GHA shard timeout during July peak | LOW | Increase `SHARD_TOTAL` and update matrix immediately; no data loss since the scraper uses upsert |
| Auto-discovery false positives written to production config | MEDIUM | Revert `scrapers.json` changes via git; add human review gate; re-run discovery with higher threshold |
| tổ hợp data missing for wide-table universities | MEDIUM | Extend factory with wide-table mode; re-scrape affected universities; upsert makes re-runs safe |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| `static_verified` gate silently skips 95% | Phase 1: Registry Gate Fix | `scrape_runs` has `status: 'ok'` for over 50% of registered universities after first full run |
| Hollow registry (homepage URLs, no cutoff pages) | Phase 2: URL Audit + Auto-Discovery | Under 10% zero-rows error rate across all registered adapters |
| GHA shard timeout at 400 universities | Phase 3: CI Workflow Scaling | No shard exceeds 240 min runtime in 3 consecutive daily runs |
| Discovery false positives in production config | Phase 2: Auto-Discovery Integration | Human review issue created for every batch of discovery candidates before any `scrapers.json` patch |
| Supabase storage exhaustion | Phase 3: Monitoring + Pruning | Supabase dashboard shows under 300 MB; `scrape_runs` pruning confirmed in keepalive logs |
| tổ hợp wide-table coverage gaps | Phase 2: Adapter Development | Row count per university matches the published count from the university website |
| MOET institution list drift | Phase 1: University Master List | `is_active` field exists in schema; annual diff process documented |

---

## Sources

- Codebase inspection: `lib/scraper/registry.ts`, `scrapers.json` (78 entries, 4 verified), `lib/scraper/factory.ts`, `lib/scraper/runner.ts`, `scripts/discover.ts`, `lib/scraper/discovery/constants.ts`, `lib/db/schema.ts`
- GitHub Actions limits: [Actions limits — GitHub Docs](https://docs.github.com/en/actions/reference/limits) — public repos: unlimited minutes, 360 min per-job hard timeout
- GitHub Actions 2026 pricing: [Pricing changes for GitHub Actions](https://resources.github.com/actions/2026-pricing-changes-for-github-actions/) — standard hosted runners free and unlimited for public repos
- Supabase free tier: [Pricing — Supabase](https://supabase.com/pricing) — 500 MB database storage, no explicit row limit, pauses after 1 week inactivity
- Supabase limits detail: [Supabase Pricing 2026 — UI Bakery](https://uibakery.io/blog/supabase-pricing)
- Playwright GHA setup overhead: [Playwright CI/CD Integration 2026](https://www.techlistic.com/2026/02/playwright-cicd-integration-with-github.html) — per-job setup ~3-10 min; cache reduces to ~2 min
- GHA per-job overhead: [On Playwright in GitHub Actions](https://radekmie.dev/blog/on-playwright-in-github-actions/) — "even if setup takes 2 min, multiplying by 12 jobs = 24 min overhead"
- Vietnamese university admissions structure: `highschool.md` and `uni_list_examples.md` in project root

---
*Pitfalls research for: UniSelect v3.0 — scaling web scraper to 400+ Vietnamese universities*
*Researched: 2026-03-19*
