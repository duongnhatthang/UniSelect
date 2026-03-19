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

### Active

<!-- v2.0 scope — priority: scraper expansion > bug fixes/testing > UI/UX -->

**Scraper Expansion (P1)**
- [ ] Auto-discovery crawler: scan university homepages to find newly published cutoff score pages without manual URL maintenance
- [ ] Scraper resilience testing: fake local university websites to test against irregular formats and layout changes
- [ ] PaddleOCR CI integration test: verify full OCR pipeline in GitHub Actions
- [ ] More university data: expand beyond 6 verified adapters to broader coverage
- [ ] Batch database inserts in scraper runner (replace N+1 row-by-row upserts)
- [ ] Extract generic adapter factory (replace 70+ copy-pasted cheerio adapters)

**Bug Fixes & Testing (P2)**
- [ ] Fix inverted delta sign convention between ResultsList and NguyenVongList
- [ ] Fix misleading trend colors (rising cutoff = bad for student, should not be green)
- [ ] Fix null score → NaN propagation in recommendation engine
- [ ] Fix unsafe `as CutoffDataRow[]` cast (scraped_at Date vs string mismatch)
- [ ] Fix withTimeout timer leak (clearTimeout on resolution)
- [ ] Add static fallback for /api/recommend endpoint
- [ ] Add error handling UI for failed API calls (replace silent .catch(() => {}))
- [ ] Recommendation engine tests with synthetic/fake data (edge cases, tiers, boundaries)
- [ ] Add CI workflow for build/test verification on PRs

**UI/UX Redesign (P3)**
- [ ] Editable nguyện vọng list (drag-to-reorder, add, remove)
- [ ] Brand identity and design token system
- [ ] Onboarding/context for first-time users
- [ ] Tier label explanations with concrete numbers
- [ ] Dark mode support
- [ ] Error boundaries (error.tsx, not-found.tsx)
- [ ] Improved result card information hierarchy
- [ ] Fix font configuration (Be Vietnam Pro not actually applied)

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

## Current Milestone: v2.0 Scraper Expansion + Quality + UX

**Goal:** Make the scraping pipeline self-sustaining (auto-discovery, resilience testing), fix data correctness bugs found in 7-agent audit, and redesign the UI/UX for trust and usability.

**Target features:**
- Auto-discovery crawler for newly published cutoff pages
- Scraper resilience testing with fake university websites
- PaddleOCR CI integration
- Generic adapter factory (replace 70+ copy-pasted files)
- Fix critical data correctness bugs (delta signs, trend colors, NaN scores)
- Recommendation engine tests with synthetic data
- Editable nguyện vọng list
- Brand identity, design tokens, onboarding, dark mode

## Current State

**Shipped:** v1.0 (2026-03-18)
**Codebase:** 11,162 LOC TypeScript + Python (PaddleOCR helper)
**Tech stack:** Next.js 16, Supabase (PostgreSQL), Drizzle ORM, Serwist (PWA), next-intl, nuqs, Playwright, PaddleOCR
**Verified adapters:** 6 of 78 (HTC, BVH, DCN, GHA, SPH*, TLA* — *URLs need re-verification)
**Tests:** 349 passing (vitest)
**Infrastructure:** Vercel (frontend/API), Supabase (DB), GitHub Actions (scraping cron)

### Known Tech Debt (from 7-agent audit, 2026-03-18)
- 72/78 adapters dormant (static_verified: false) — v2 auto-discovery will address
- 70+ adapter files are copy-pasted — extract generic factory
- Ministry portal adapter is a stub — URL changes yearly
- SPH/TLA URLs broke after Phase 7 verification — need re-audit
- PaddleOCR tested locally but not in CI
- generate-static chained into build script but Vercel may need manual config
- withTimeout timer leak (setTimeout not cleared)
- Null score → NaN propagation in recommend engine
- readFileSync in API fallback paths (blocks event loop)
- No error.tsx boundaries, no CI workflow
- Dead src/ directory (unused Next.js scaffold)
- Font loaded but not applied (font-sans doesn't reference Be Vietnam Pro)
- Delta sign convention inverted between ResultsList and NguyenVongList
- Trend colors misleading (green = rising cutoff = bad for student)
- GitHub Actions July budget: 4x/day × 6 shards exceeds free tier by 3.7x

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

| 7-agent audit before v2.0 | Independent specialist review catches issues self-review misses | — Pending |

---
*Last updated: 2026-03-18 after v2.0 milestone kickoff (7-agent audit)*
