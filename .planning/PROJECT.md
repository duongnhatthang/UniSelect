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

- [ ] Auto-discovery crawler: scan university homepages to find newly published cutoff score pages without manual URL maintenance
- [ ] Scraper resilience testing: fake local university websites to test against irregular formats and layout changes
- [ ] PaddleOCR CI integration test: verify full OCR pipeline in GitHub Actions
- [ ] More university data: expand beyond 6 verified adapters to broader coverage

### Out of Scope

- Học bạ (GPA-based) admission pathway — defer to v2+
- Aptitude test pathways (VNU TSA, HUST TSA) — defer to v2+
- Direct admission (xét tuyển thẳng) — defer to v2+
- Native iOS/Android apps — PWA is sufficient
- Account/user profiles — no login required for core lookup flow
- Real-time seat availability tracking — cutoff scores are the core data
- LLM as primary scraping method — cost prohibitive for charity project

## Current State

**Shipped:** v1.0 (2026-03-18)
**Codebase:** 11,162 LOC TypeScript + Python (PaddleOCR helper)
**Tech stack:** Next.js 16, Supabase (PostgreSQL), Drizzle ORM, Serwist (PWA), next-intl, nuqs, Playwright, PaddleOCR
**Verified adapters:** 6 of 78 (HTC, BVH, DCN, GHA, SPH*, TLA* — *URLs need re-verification)
**Tests:** 349 passing (vitest)
**Infrastructure:** Vercel (frontend/API), Supabase (DB), GitHub Actions (scraping cron)

### Known Tech Debt
- 72/78 adapters dormant (static_verified: false) — v2 auto-discovery will address
- Ministry portal adapter is a stub — URL changes yearly
- SPH/TLA URLs broke after Phase 7 verification — need re-audit
- PaddleOCR tested locally but not in CI
- generate-static chained into build script but Vercel may need manual config

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

---
*Last updated: 2026-03-18 after v1.0 milestone*
