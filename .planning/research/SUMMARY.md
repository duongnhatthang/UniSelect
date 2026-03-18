# Project Research Summary

**Project:** UniSelect — Vietnamese University Admissions PWA
**Domain:** Education data aggregation / nguyện vọng strategy tool
**Researched:** 2026-03-17
**Confidence:** MEDIUM-HIGH

## Executive Summary

UniSelect is a mobile-first Progressive Web App that helps Vietnamese students build strategic nguyện vọng (university choice) lists based on scraped cutoff score (điểm chuẩn) data. The product sits in a clear gap: existing tools (diemchuan.com-class sites) display raw data, but none translate that data into a submission-ready 15-choice ranked list with safety tiering. Research confirms that the core technical challenge is not the frontend — it is building and maintaining a reliable, self-healing data pipeline that scrapes 78+ university websites plus the Ministry of Education portal on a scheduled basis and normalizes the data into a queryable, trustworthy database.

The recommended approach is Next.js 15 (App Router) on Vercel Hobby, Supabase Postgres as the database, GitHub Actions as the scraper scheduler (Vercel Hobby cron is capped at once/day — insufficient for the July admissions peak), and Cheerio for HTML parsing with a Playwright fallback for the small subset of JS-rendered university pages. The frontend is intentionally thin: stateless, no user accounts, URL-encoded session state via `nuqs`, and Tailwind + shadcn/ui for a dense, data-focused UI optimized for mid-range Android phones on 4G. The scraper pipeline is the long-tail complexity — not the UI.

The primary risks are data integrity failures that could cause students to make wrong nguyện vọng decisions, and scraper brittleness as 78+ university websites update their structure each year. Both risks are mitigatable with a strict validation layer (schema assertions before any DB write), semantic HTML parsing (targeting Vietnamese text anchors rather than CSS positions), multi-source fallbacks, and clear UI trust signals (source attribution, staleness timestamps, and explicit disclaimers). The July peak period — when tens of thousands of students use the tool simultaneously — is a secondary infrastructure risk requiring edge caching and Supabase connection pooling to avoid overwhelming the free tier.

---

## Key Findings

### Recommended Stack

The stack prioritizes zero-cost infrastructure, serverless operation, and a mobile-first experience. Next.js 15 is the clear framework choice: its App Router Server Components reduce JavaScript payload on slow devices, native `app/manifest.ts` handles PWA installability without libraries, and Serwist (the officially recommended Workbox successor to the abandoned `next-pwa`) handles offline service worker caching. Vercel Hobby deployment is free and native for Next.js with no configuration overhead.

The scraping pipeline runs entirely outside Vercel (in GitHub Actions) because Vercel Hobby serverless functions time out at 10 seconds — far too short for scraping 78 sites. GitHub Actions is free for public repos with no meaningful minute limits, supports arbitrary cron schedules, and can run Playwright for JS-rendered pages without bundle size constraints. The scraper writes directly to Supabase Postgres via the service-role key stored as a GitHub Actions secret.

**Core technologies:**
- **Next.js 15 + React 19:** Full-stack framework — Server Components reduce mobile JS payload; App Router native for PWA manifest and i18n
- **TypeScript 5:** Type safety across complex domain objects (tổ hợp codes, cutoff records, nguyện vọng slots)
- **Supabase (Postgres):** Primary data store — free tier, full relational queries for multi-axis filtering, RLS for security
- **Drizzle ORM:** Type-safe query builder — lightweight (~50KB), no cold-start issues unlike Prisma
- **Cheerio:** HTML scraping — pure Node.js, no binary dependencies, works in GitHub Actions and Vercel functions
- **Serwist (`@serwist/next`):** PWA service worker — officially recommended by Next.js docs; replaces abandoned `next-pwa`
- **GitHub Actions:** Scraper scheduler — daily off-season, multiple runs/day in July; free for public repos
- **next-intl:** i18n — purpose-built for App Router Server Components; `vi` default, `en` secondary
- **Tailwind CSS 4 + shadcn/ui:** Styling — minimal bundle, dense data layout, no upstream dependency lock-in
- **nuqs:** URL state — encodes nguyện vọng list in URL for Zalo-shareable links with no backend
- **Vitest + Playwright:** Testing — unit tests for pure matching logic; E2E for critical score-entry flow

**Critical infrastructure constraint (verified):** Vercel Hobby cron runs at most once per day. GitHub Actions is mandatory for the July peak scraping schedule.

### Expected Features

**Must have (table stakes):**
- Cutoff score lookup by university + major + tổ hợp, with 2–3 years of historical data — core data product
- Filter by tổ hợp, major field, and region — without these, results are noise for any given student
- Per-subject score entry (Math, Physics, etc.) with tổ hợp auto-detection and total calculation
- Result list sorted by probability tier (safe / match / reach) with color-coded safety indicators
- Mobile-optimized Vietnamese-language UI — 70%+ of target users are on Android phones on 4G
- University information card — name, location, type, link to official site

**Should have (differentiators):**
- 15-choice nguyện vọng list builder with 5/5/5 dream/practical/safe tiering — the core differentiator; no existing free tool does this well
- Strategic ordering logic within tiers — the order within tiers matters; most students get this wrong
- Drag-and-drop list reordering with strategic ordering warnings
- Teacher training (sư phạm) top-5 rule guardrail — hard 2026 MOET regulation; students frequently unaware
- Score range simulation (slider across ±3 points) — highest-value feature during pre-exam prep season
- Year-over-year cutoff trend sparkline — differentiates from static data dumps
- Export/share list via URL encoding — Zalo-shareable, zero backend cost
- Offline access to last-fetched data via PWA service worker

**Defer (v2+):**
- University side-by-side comparison table — needs validated demand first
- Học bạ (GPA) and aptitude test pathways — per PROJECT.md explicit deferral; schema supports it
- Score benchmark / national distribution context — data only available post-July exam
- Push notifications for cutoff updates — requires opt-in infra beyond the scraping pipeline
- User accounts — no core value; session URL encoding solves sharing

### Architecture Approach

The system has four cleanly-bounded layers that must be built in strict dependency order. The Scraper Pipeline (GitHub Actions) writes to the Database (Supabase Postgres), which is read by the API Layer (Vercel serverless functions), which feeds the Frontend PWA (Next.js on Vercel). The scraper never touches the API layer; the frontend never touches the database directly. All business logic — scoring, filtering, ranking, tier classification — lives in the API layer, not the frontend. All student inputs stay in the browser (URL params, session state) and never touch the server.

**Major components:**
1. **Scraper Pipeline (GitHub Actions):** Adapter-per-university pattern with a central normalizer; fail-open design so one broken scraper doesn't block others; writes via Supabase service-role key
2. **Database (Supabase Postgres):** Five tables — `universities`, `majors`, `tohop_codes`, `cutoff_scores` (fact table, upsert-only), `scrape_runs` (audit log); RLS enforced; indexes on core query paths from day one
3. **API Layer (Vercel serverless):** Read-only, stateless, thin — six endpoints; edge caching for static lookups (universities, tổ hợp codes); `/api/recommend` is the core algorithm endpoint
4. **Frontend PWA (Next.js):** Stateless; URL state via `nuqs`; no user data stored server-side; score inputs ephemeral; PWA manifest + Serwist service worker for offline

### Critical Pitfalls

1. **Scraper CSS selector brittleness** — University sites redesign annually; selectors that target DOM positions silently return garbage. Prevent by targeting Vietnamese semantic text anchors ("Điểm chuẩn", "Tổ hợp"), adding schema-level score validation (must be float 10.0–30.0), and tracking staleness per university. This must be built into Phase 1 infrastructure, not patched later.

2. **Data accuracy failures causing student harm** — A wrong cutoff score can cause a student to miss their only acceptable university. Prevent by: attaching source URL and scraped timestamp to every displayed score; showing confidence tiers (Verified / Scraped / Historical); never showing a score without its year; using multi-year trend data (not just the latest year) in tier classification; and displaying an explicit disclaimer on every score.

3. **Ministry portal single point of failure** — The MOET portal covers many universities at once. If it changes structure, adds CAPTCHA, or goes down in July, the entire pipeline fails. Prevent by maintaining per-university direct-scrape fallback URLs for every university covered by the portal, archiving snapshots to object storage after each run, and keeping a manually-curated prior-year CSV as emergency fallback.

4. **Vercel Hobby cron being insufficient for July peak** — Verified: once-per-day maximum on Hobby plan. This is not a risk to mitigate — it is a design constraint that makes GitHub Actions mandatory as the scheduler. Trying to work around it with Vercel cron will fail.

5. **Vietnamese string normalization failures** — Vietnamese diacritics in NFC vs NFD normalization cause search mismatches and broken joins. Prevent by normalizing all stored strings to NFC at write time and implementing a diacritic-folding search slug for each name. The Postgres `unaccent` extension alone is insufficient.

---

## Implications for Roadmap

Based on the research, the dependency graph is clear: data pipeline before API before frontend. The scraper architecture decisions (adapter pattern, sharding, validation layer) must be made before writing any individual adapter, because retrofitting them across 78+ adapters is extremely expensive.

### Phase 1: Data Foundation and Scraper Infrastructure

**Rationale:** Everything depends on this. The database schema, scraper adapter pattern, validation layer, and encoding handling must all be correct before any data is written to production. Schema changes after 78 adapters are built are catastrophic.

**Delivers:** Stable Supabase schema with indexes; scraper runner with the adapter-registry pattern; central normalizer; schema validation layer (score range, tổ hợp format, encoding sanity checks); 3–5 high-value university adapters plus the Ministry portal adapter; GitHub Actions low-frequency (daily) workflow; `scrape_runs` audit table; canonical `universities`, `majors`, and `tohop_codes` seed data.

**Addresses:** Cutoff score data (table stakes foundation); historical data storage (3+ years)

**Avoids:** CSS selector brittleness (P1), encoding mismatch (P2), JS-rendered page silent failure (P3), Ministry portal single point of failure (P4), mã ngành join failures (P11), tổ hợp code proliferation (P12), GitHub Actions sharding timeout (P10), anti-scraping blocks (P14)

**Research flag:** NEEDS research-phase — scraper adapter patterns for specific Vietnamese university HTML structures, Ministry portal endpoint behavior, and Playwright GitHub Actions setup for JS-rendered sites are niche enough to warrant deeper investigation before building.

---

### Phase 2: Core API and Recommendation Algorithm

**Rationale:** Once test data exists in the database (from Phase 1 adapters), the API layer and recommendation algorithm can be built and verified against real data. The algorithm design — especially multi-year trend weighting and tier threshold tuning — must be done here, not as a v2 afterthought.

**Delivers:** All six API endpoints (`/api/universities`, `/api/universities/[id]`, `/api/scores`, `/api/recommend`, `/api/tohop`, `/api/years`); the core recommendation algorithm with multi-year trend weighting and configurable delta thresholds; teacher training top-5 rule enforcement as a hard constraint; edge caching configuration (s-maxage=86400 for static lookups, s-maxage=3600 for score queries); Supabase connection pooling (PgBouncer endpoint) configured from day one.

**Addresses:** Score-based matching, probability tiering, strategic ordering logic

**Avoids:** Score volatility misclassification (P9) — multi-year trend must be in the algorithm spec from the start, not v2

**Uses:** Drizzle ORM, Supabase Postgres, Vercel serverless functions, Next.js API routes

**Research flag:** Standard patterns — REST API design and Next.js Route Handlers are well-documented; skip research-phase for this phase.

---

### Phase 3: Frontend PWA (Core User Flows)

**Rationale:** With API endpoints live and returning real data, the highest-value frontend flows can be built: score entry, recommendation display, and the nguyện vọng list builder. The mobile-first constraint and dense Vietnamese data layout requirements make this non-trivial UX work.

**Delivers:** Landing page with score input and quick recommendation; per-subject score entry with tổ hợp auto-detection; tiered result list (safe/match/reach) with color-coded indicators; 15-choice nguyện vọng list builder with drag-to-reorder; teacher training guardrail warning; score range simulation slider; export/share via URL encoding; university browse and detail pages; historical cutoff trend sparklines; Vietnamese-language UI (vi default, en toggle); PWA manifest + Serwist service worker for offline.

**Addresses:** All table stakes features + all differentiators from FEATURES.md

**Avoids:** PWA offline stale data confusion (P13) — staleness banner required; Vietnamese search normalization (P6) — diacritic-folding must be built before search launches

**Uses:** Next.js 15 App Router, nuqs, Tailwind CSS 4, shadcn/ui, next-intl, Serwist

**Research flag:** Partially needs research-phase — the nguyện vọng list drag-and-drop UX and Serwist offline caching configuration for Next.js App Router are worth a focused research pass before implementation.

---

### Phase 4: Scraper Expansion and Hardening

**Rationale:** With the adapter pattern validated on 3–5 universities in Phase 1, scaling to 78+ universities is mostly mechanical but requires reliability engineering: parallel sharding, retry logic, and the July peak-frequency workflow.

**Delivers:** Scrapers for all remaining 70+ universities; sharded GitHub Actions matrix jobs (5–10 parallel shards, each completing in under 30 minutes); exponential backoff and politeness delays in the base scraper class; peak-frequency workflow (`scrape-peak.yml`, hourly, enabled for July); Playwright-based adapter for any JS-rendered university sites; `data_overrides` table for manual corrections that survive scraper runs; snapshot archiving to Supabase Storage.

**Addresses:** Data freshness during July peak; coverage of all 78+ universities

**Avoids:** GitHub Actions timeout from sequential scraping (P10), anti-scraping blocks (P14), manual correction overwritten by scraper (P15)

**Research flag:** Standard patterns for the sharding strategy — skip research-phase. Playwright GitHub Actions setup is already addressed in Phase 1 research.

---

### Phase 5: Infrastructure Hardening and Launch Readiness

**Rationale:** Before the July peak, the system must be load-tested and the remaining production concerns addressed. This phase converts an MVP into a trustworthy public tool.

**Delivers:** Load testing against Supabase connection limits (target: handle July spike with PgBouncer); static JSON pre-generation for core score data served via Vercel CDN (eliminates cold-start latency for the most common queries); skeleton loading states for all API-backed pages; pre-warming cron for API routes during July; SEO (Next.js metadata API, sitemap); Core Web Vitals audit (target <3s TTI on 4G); Vietnamese score source attribution and disclaimer copy finalized; Supabase pause-prevention configured; monitoring for scrape failures and staleness alerts.

**Addresses:** Infrastructure reliability, trust signals, SEO discoverability

**Avoids:** Cold start latency (P8), Supabase connection exhaustion (P7), data accuracy harm to students (P5)

**Research flag:** Standard patterns — CDN static file strategy and Core Web Vitals optimization are well-documented; skip research-phase.

---

### Phase Ordering Rationale

- **Database schema must be stable before adapters are written** — retroactively changing the schema invalidates all existing scrapers
- **Validation layer must ship before any data reaches production** — wrong data written once is hard to identify and remove
- **API must exist before frontend** — building UI against mocked data creates integration risk; real data reveals edge cases (null scores, missing tổ hợp codes, special characters) that mocks miss
- **Core UI flows before scraper expansion** — validate the end-to-end product with 5 universities before scaling the pipeline; avoids building 78 adapters for a product whose UX is still being validated
- **Hardening before July** — the July admissions peak is the make-or-break traffic event; the system must be proven before it arrives, not during it

### Research Flags

Phases needing deeper research during planning:
- **Phase 1:** Ministry portal endpoint structure, per-university HTML patterns, Playwright GitHub Actions setup for JS-rendered pages — niche Vietnamese web ecosystem details
- **Phase 3:** Serwist offline caching with Next.js App Router (App Router-specific service worker patterns differ from Pages Router); drag-and-drop nguyện vọng builder UX library choice

Phases with standard patterns (skip research-phase):
- **Phase 2:** REST API design with Next.js Route Handlers and Drizzle — well-documented
- **Phase 4:** GitHub Actions matrix sharding — established pattern with clear documentation
- **Phase 5:** Core Web Vitals optimization, CDN static file strategy — standard Next.js performance patterns

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Core choices (Next.js 15, Serwist, GitHub Actions cron constraint) verified via official docs March 2026. Library versions (Drizzle, next-intl, nuqs, Serwist) from training knowledge — verify at npmjs.com before pinning. |
| Features | MEDIUM | Grounded in PROJECT.md requirements and domain knowledge; competitor feature audit not performed (web search unavailable during research). Table stakes are well-reasoned; validate differentiators with real student feedback post-launch. |
| Architecture | HIGH | Four-layer architecture (scraper → DB → API → frontend) is a well-established ETL + serverless pattern. Component boundaries, adapter pattern, upsert strategy, and RLS model are all standard engineering patterns applied correctly to this domain. |
| Pitfalls | MEDIUM-HIGH | Scraping brittleness, encoding issues, and data accuracy concerns are HIGH confidence (established engineering patterns). Supabase connection limits and Vercel function constraints are MEDIUM (training knowledge — verify current limits). |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Verify current library versions before pinning:** Run `npm info drizzle-orm version`, `npm info @serwist/next version`, `npm info next-intl version`, `npm info nuqs version` before starting. Research used training knowledge (August 2025 cutoff) for these.
- **Verify Supabase free tier current limits:** Confirm 500MB storage, 2GB egress, 60 connection pool, and pause-after-7-days-inactivity are still accurate at supabase.com/pricing.
- **Audit Vietnamese university target pages before writing scrapers:** For each of the ~20 highest-priority universities, manually check whether the cutoff score table is static HTML (Cheerio) or JS-rendered (Playwright needed). This determines Tier 1 vs Tier 2 scraper allocation and must be done before Phase 1 adapter work begins.
- **Confirm Ministry portal URL and structure:** The MOET admissions portal URL and data structure must be verified manually before the Ministry adapter is built. Portal URLs change between cycles.
- **Confirm Supabase "pause prevention" toggle availability:** Verify the dashboard toggle to prevent free-tier project pausing exists in the current Supabase UI.
- **Competitor feature audit gap:** No live audit of diemchuan.com or similar tools was performed. Before finalizing the differentiator features, manually review the top 2–3 existing tools to confirm the nguyện vọng list builder is truly absent from the market.

---

## Sources

### Primary (HIGH confidence)
- Next.js 15 release blog and official docs (nextjs.org) — verified March 2026; framework choice, PWA manifest approach, Serwist recommendation
- Vercel cron usage and pricing (vercel.com/docs/cron-jobs/usage-and-pricing) — verified March 2026; once-per-day Hobby cron limit
- Vercel function duration limits (vercel.com/docs/functions/configuring-functions/duration) — verified March 2026; 300s max with Fluid Compute
- Vercel limits overview (vercel.com/docs/limits/overview) — verified March 2026
- `/Users/thangduong/Desktop/UniSelect/.planning/PROJECT.md` — primary requirements source
- `/Users/thangduong/Desktop/UniSelect/highschool.md` — Vietnamese nguyện vọng system mechanics
- `/Users/thangduong/Desktop/UniSelect/uni_list_examples.md` — Vietnamese university list and URLs

### Secondary (MEDIUM confidence)
- Training knowledge (August 2025 cutoff): Supabase free tier limits (500MB DB, 60 connections, 7-day pause), library versions (Drizzle ~0.30, next-intl ~3.x, Serwist ~9.x, nuqs ~1.x, Cheerio ~1.0, Tailwind 4.x)
- Training knowledge: Vietnamese mobile usage patterns, Zalo as primary sharing channel, Vietnamese Unicode (NFC/NFD) handling
- Training knowledge: GitHub Actions public repo free tier (2,000 min/month), 6-hour job timeout
- Training knowledge: Vietnamese THPT score structure, tổ hợp code system, MOET nguyện vọng rules including 2026 teacher training top-5 rule

### Tertiary (LOW confidence — needs validation)
- Competitor tool feature analysis (diemchuan.com-class products) — inferred from domain knowledge, not live audit
- Vietnamese government website scraping legal context — general legal principles applied; Vietnamese-specific law requires review

---
*Research completed: 2026-03-17*
*Ready for roadmap: yes*
