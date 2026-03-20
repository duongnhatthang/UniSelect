# UniSelect

## What This Is

UniSelect is a Vietnamese-first PWA that helps high school students navigate Vietnam's university admissions system (nguyện vọng). Students enter their national exam score and subject combination (tổ hợp), and the app returns a ranked list of universities they qualify for — plus a strategically-ordered 15-choice nguyện vọng list. University cutoff data is collected via automated web scraping (static HTML, Playwright for JS-rendered pages, PaddleOCR for image-based pages) from 78 university websites.

## Core Value

Give every Vietnamese student the data and strategy to order their nguyện vọng list correctly — because getting the ranking wrong means being locked out of better options permanently.

## Requirements

### Validated

- ✓ Scrape and store university acceptance cutoff scores (điểm chuẩn) from official sources — v1.0
- ✓ Display historical and current cutoff data per university, per major, per tổ hợp — v1.0
- ✓ Student can enter estimated score and tổ hợp → see ranked list of achievable universities/majors — v1.0
- ✓ Student can enter per-subject scores → app calculates totals per combo for more precise matching — v1.0
- ✓ App generates a suggested 15-choice nguyện vọng list (tiered: dream / practical / safe) — v1.0
- ✓ Scraping runs at low frequency during the year, high frequency during peak period (July) — v1.0
- ✓ Vietnamese-first UI with English language toggle — v1.0
- ✓ Deployable on serverless/free-tier infrastructure (Vercel + Supabase or equivalent) — v1.0
- ✓ Config-driven adapter factory replaces 70+ copy-pasted adapters — v2.0
- ✓ Batch DB inserts with transaction (one round-trip per adapter) — v2.0
- ✓ Zero-rows guard with distinct `status: 'zero_rows'` logging — v2.0
- ✓ Static JSON fallback for /api/recommend on DB timeout — v2.0
- ✓ HTML fixture library (7 edge-case formats) with MSW fake server — v2.0
- ✓ PaddleOCR CI smoke test with cached model downloads — v2.0
- ✓ Auto-discovery crawler with keyword scoring and robots.txt compliance — v2.0
- ✓ Delta sign convention unified (userScore - cutoff everywhere) — v2.0
- ✓ Trend colors corrected (rising cutoff = amber/warning) — v2.0
- ✓ NaN score filtering in recommendation engine — v2.0
- ✓ Error banners with retry replacing silent catch blocks — v2.0
- ✓ Recommendation engine edge-case tests (13 cases) — v2.0
- ✓ GitHub Actions CI workflow on PRs — v2.0
- ✓ Actions cache for PaddleOCR + Playwright, shard optimization for July — v2.0
- ✓ Supabase keep-alive cron every 5 days — v2.0
- ✓ Design token system with oklch colors, dark mode, Be Vietnam Pro font fix — v2.0
- ✓ Editable nguyện vọng list (reorder, add, remove) with URL persistence — v2.0
- ✓ Onboarding banner, error boundaries, empty states — v2.0
- ✓ Tier classification corrected: dream = aspirational, safe = easy admission — v2.0

### Active

<!-- v3.0 scope -->
- [ ] Comprehensive Vietnamese university/college list (400+ institutions, not just 78)
- [ ] Working scraper pipeline that produces real cutoff data for all universities
- [ ] Auto-discovery crawler integrated into GitHub Actions (not standalone)
- [ ] Scrape status logging/dashboard to track pipeline health per university
- [ ] All tổ hợp combinations scraped (not just A00 defaults)
- [ ] Registry gate fix: scraper must not silently skip 95% of universities
- [ ] Scrape results visible in Supabase with audit trail

### Out of Scope

- Học bạ (GPA-based) admission pathway — defer to v3+
- Aptitude test pathways (VNU TSA, HUST TSA) — defer to v3+
- Direct admission (xét tuyển thẳng) — defer to v3+
- Native iOS/Android apps — PWA is sufficient
- Account/user profiles — no login required for core lookup flow
- Real-time seat availability tracking — cutoff scores are the core data
- LLM as primary scraping method — cost prohibitive for charity project
- Client-side offline recommendation engine — defer to v3+ (requires bundling engine + data in SW)
- Share card generation (visual screenshot for Zalo/Facebook) — defer to v3+
- Score scenario comparison mode ("what if I scored 24 vs 25") — defer to v3+

## Current Milestone: v3.0 Complete Data Pipeline

**Goal:** Make the scraper pipeline actually produce data — expand university coverage from 78 to 250+, fix the registry gate that silently skips 95% of adapters, integrate auto-discovery into CI, and ensure all cutoff scores are stored in Supabase with monitoring.

**Target features:**
- ✓ Comprehensive Vietnamese university/college master list (343 institutions) — Phase 15
- ✓ Registry gate fixed: scrape_url presence check replaces static_verified — Phase 15
- Working end-to-end scraper that produces real data in Supabase
- Auto-discovery integrated into GitHub Actions workflow
- Scrape status logging so progress is observable
- All tổ hợp combinations captured per university

## Current State

**Shipped:** v2.0 (2026-03-19)
**In progress:** v3.0 — Phase 15 complete (registry gate fixed, 343 universities seeded)
**Codebase:** ~14,500 LOC TypeScript + Python (PaddleOCR helper)
**Tech stack:** Next.js 16, Supabase (PostgreSQL), Drizzle ORM, Serwist (PWA), next-intl, nuqs, next-themes, MSW, Crawlee, Playwright, PaddleOCR
**Universities:** 343 in master list (up from 78), 4 with verified scrape URLs
**Tests:** 578 passing (vitest)
**Infrastructure:** Vercel (frontend/API), Supabase (DB), GitHub Actions (scraping cron + CI + PaddleOCR smoke + keepalive)

### Critical Problem (v3.0 Focus)
- **Scraper is hollow:** Registry filters `static_verified: true` — only 5/99 adapters run. The daily cron is green but produces almost no data.
- **Only 78 universities seeded** — Vietnam has 400+ universities and colleges
- **Auto-discovery crawler exists** (`scripts/discover.ts`) but has NO GitHub Actions workflow — never runs automatically
- **Most adapter URLs** point to homepages, not actual cutoff score pages
- **No scrape monitoring** — impossible to tell which universities have data and which don't

### Remaining Tech Debt
- TierBadge and StalenessIndicator use hardcoded colors without dark mode variants
- `scoreMargin` i18n key defined but unreferenced (tooltip removed per user feedback)
- Ministry portal adapter is a stub — URL changes yearly

## Context

- Vietnam's nguyện vọng system is a centralized matching algorithm: students rank up to 15 university-major choices, and the system locks them into the highest-ranked match. Getting order wrong is permanently costly.
- 2026 rules: max 15 nguyện vọng; teacher training programs only considered within top 5.
- Data sources: 78 university websites with 3 scraping strategies (cheerio for static HTML, Playwright for JS-rendered, PaddleOCR for image-based).
- Traffic pattern: very low most of the year, large spike in July. Serverless auto-scaling with static JSON fallback.
- Open source / charity project — all infrastructure must be free-tier.

## Constraints

- **Cost**: Free-tier hosting only (Vercel, Supabase free plan, GitHub Actions)
- **Admission method**: National exam (THPT) scores only; architecture allows extending to học bạ / aptitude test pathways later
- **Scraping**: Three strategies (cheerio/Playwright/PaddleOCR); no LLM as primary method
- **Language**: Vietnamese default, English toggle; development codebase in English
- **Scale**: Must handle July traffic spike — serverless + static fallback
- **Tech stack**: Next.js PWA, Supabase, GitHub Actions cron

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| PWA over native app | Single codebase, zero app store friction, lowest maintenance cost | ✓ Good |
| THPT-only for v1 | Covers ~80%+ of student use cases; other pathways add significant data complexity | ✓ Good |
| Both quick and detailed score input | Accommodates different stages of exam prep | ✓ Good |
| Tiered 5+5+5 suggestion algorithm | Mirrors expert advice from Ministry and counselors | ✓ Good |
| Serverless-first infrastructure | Handles extreme seasonality cheaply; scales to zero | ✓ Good |
| Static JSON fallback for DB timeouts | Double-nested try/catch serves CDN-cached data during Supabase outages | ✓ Good |
| Three scraping strategies (cheerio/Playwright/PaddleOCR) | Covers static HTML, JS-rendered, and image-based university pages | ✓ Good — PaddleOCR needs CI testing |
| Drizzle ORM with Supabase pooler (port 6543, prepare:false) | Transaction-mode pooling required for serverless; drizzle 0.45.x API | ✓ Good |
| 6-shard matrix for GitHub Actions scraping | 78 universities / 6 = 13 per shard, within 30min per job | ✓ Good |
| next-intl cookie-based locale (no i18n routing) | Simpler deployment, avoids URL rewriting complexity | ✓ Good |

| 7-agent audit before v2.0 | Independent specialist review catches issues self-review misses | ✓ Good — caught 14 tech debt items |
| Config-driven adapter factory | Single `createCheerioAdapter(config)` replaces 78 copy-paste files | ✓ Good — new adapters need only JSON config |
| Tier classification inversion | Dream = aspirational (cutoff above score), Safe = easy (cutoff below) | ✓ Good — matches Vietnamese admissions convention |
| MSW over nock for testing | nock doesn't intercept native Node 18+ fetch; project uses Node 24 | ✓ Good |
| Crawlee for auto-discovery | Built-in robots.txt, rate limiting, storage management | ✓ Good |
| next-themes for dark mode | class strategy with oklch semantic tokens | ✓ Good |
| Score range 0-30 | User feedback: 10-30 was too restrictive | ✓ Good |

---
*Last updated: 2026-03-20 after Phase 15 complete*
