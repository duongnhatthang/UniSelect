# Technology Stack

**Project:** UniSelect — Vietnamese University Admissions PWA
**Researched:** 2026-03-17
**Overall confidence:** MEDIUM-HIGH (core choices verified via official docs; library versions from training knowledge where fetch was blocked)

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | 15.x (latest) | Full-stack React framework, SSR + API routes | Native PWA manifest support (`app/manifest.ts`), App Router, Vercel-native deployment, excellent Vietnamese font/i18n handling via `next/font`. Turbopack stable in dev. React 19 included. |
| React | 19.x | UI library | Bundled with Next.js 15. Server Components reduce JS payload on slow devices — critical for mid-range Android phones on 4G. |
| TypeScript | 5.x | Type safety | Project has complex domain objects (tổ hợp codes, cutoff records, nguyện vọng slots). Strong typing prevents category errors in matching logic. |

**Why not Vite + React:** Vite is a build tool, not a full-stack framework. You would need to wire up API routes, SSR, manifest handling, and deployment separately. Next.js does all of this with zero config on Vercel and ships smaller bundles via Server Components. The App Router's server-first model means cutoff data queries never reach the client bundle.

**Why not Remix:** Similar capabilities but smaller ecosystem, fewer official integrations, and Vercel support is via adapter rather than native. No material advantage for this use case.

### PWA Layer

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Native Next.js PWA | (built-in) | Web app manifest, installability | Next.js 15 has first-class `app/manifest.ts` support (verified via nextjs.org/docs, March 2026). No library needed for manifest. |
| Serwist (`@serwist/next`) | ~9.x | Service worker, offline caching | Official Next.js docs explicitly recommend Serwist for offline support (confirmed). Replaces deprecated `next-pwa`. Built on Workbox. Requires webpack config — acceptable for this use case. |

**Why not next-pwa:** next-pwa is effectively abandoned and incompatible with Next.js 14+. Serwist is the maintained successor, explicitly referenced in official Next.js docs.

**Service worker scope:** Cache the current-year cutoff dataset on first load. This enables offline access (critical: students may look up data in exam halls with poor connectivity). Do not try to cache scraper outputs in the service worker — stale data risk is too high. Cache the read API responses only.

### Database

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Supabase (Postgres) | N/A (hosted) | Primary data store for scraped cutoff data, university metadata | Free tier: 500MB database, 2 active projects, 50MB file storage, unlimited API requests with Supabase JS client. Postgres gives full relational queries — critical for multi-axis filtering (university × major × tổ hợp × year). Row-level security for future multi-user features. Supabase pauses free projects after 1 week of inactivity; acceptable since scraper workflows can wake the project. |
| Drizzle ORM | ~0.30.x | Type-safe query builder for Postgres | Lightweight (~50KB), TypeScript-first, works with Supabase Postgres via `postgres` driver (`postgres.js`). Migration workflow via `drizzle-kit`. Alternative to Prisma which is heavier and has known cold-start issues on serverless. |

**Why not PlanetScale:** PlanetScale ended its free tier in 2024. Not viable for a zero-cost project.

**Why not Turso (libSQL/SQLite):** Turso has a generous free tier but SQLite's lack of native full-text search and the mismatch with Supabase's ecosystem (Auth, RLS, real-time) makes it a worse fit. Supabase's Postgres is the right tool for relational admissions data. Also Drizzle supports both if you need to migrate later.

**Why not Vercel Postgres:** Vercel Postgres (built on Neon) requires the Pro plan for meaningful usage. Not free-tier viable.

**Supabase inactivity caveat:** The free tier pauses databases after 1 week of inactivity. Mitigate by: (a) having the GitHub Actions scraper job ping Supabase on every run, and (b) using Supabase's built-in "prevent project pausing" toggle (now available on free tier in 2024).

### Scraping Layer

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Cheerio | ~1.0.x | HTML parsing for static/server-rendered pages | jQuery-like API, pure Node.js (no browser binaries), ~100KB installed. Works inside Vercel serverless functions and GitHub Actions. The vast majority of Vietnamese university pages and the MOET portal serve full HTML without JavaScript rendering — Cheerio is sufficient. |
| node-fetch / native `fetch` | built-in (Node 18+) | HTTP requests for scraping | Node.js 18+ includes native `fetch`. No additional HTTP library needed. Set custom User-Agent and respect rate limits to avoid blocks. |

**Why not Playwright:** Playwright installs Chromium/Firefox/WebKit binaries totalling ~300-600MB. This exceeds Vercel's serverless function bundle limit and is impractical in GitHub Actions without caching. Use it only as a last resort for the handful of university pages that require JavaScript rendering (estimate: <5 of 78 sites). If needed, run Playwright exclusively in GitHub Actions (not Vercel functions) where Docker images can pre-cache the browser binary.

**Why not Puppeteer:** Same reason as Playwright — binary size. Puppeteer is also single-browser (Chromium only). Playwright is strictly better if you must use a headless browser.

**Scraping strategy:** Tier the scrapers:
1. **Tier 1 (Cheerio + fetch):** Ministry portal + majority of university sites (~73/78). Fast, zero overhead.
2. **Tier 2 (Playwright in GitHub Actions):** JS-rendered pages only (<5 sites). Isolated to scraper workflow, never in API routes.

### Scheduling (Scraping Cron)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| GitHub Actions (scheduled workflows) | N/A | Run scraper on cron schedule | **Critical:** Vercel Hobby cron is limited to once per day (verified via vercel.com/docs/cron-jobs/usage-and-pricing, March 2026). GitHub Actions schedules support any cron expression (minimum 5-minute intervals) and are **free for public repositories with no minute limits**. UniSelect is open source — zero scheduling cost. |

**Vercel Hobby cron limitation (verified):** Cron jobs on Hobby plan run at most once per day, with ±59 minute precision. This is unsuitable for peak-season scraping (July) where hourly runs are needed. GitHub Actions solves this entirely.

**Scheduling design:**
- **Off-season (Aug–June):** Daily GitHub Actions run. Scrape MOET portal + ~10 major universities.
- **Peak season (July, registration period):** Multiple runs per day (e.g., every 4–6 hours). Triggered by date logic in the workflow file.
- **Scraper writes to Supabase directly** using the service-role key stored as a GitHub Actions secret.

### i18n (Internationalization)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| next-intl | ~3.x | Vietnamese/English translation, locale routing | Best-in-class i18n for Next.js App Router. Supports Server Components, Client Components, and middleware-based locale detection. Type-safe with TypeScript. Built-in ICU message format for plurals/dates (needed for score display like "điểm chuẩn năm 2024"). Alternative `react-i18next` requires more boilerplate and lacks native App Router Server Component support. |

**Why not react-i18next:** Works well with Pages Router but requires extra bridging for App Router Server Components. next-intl is purpose-built for App Router and has substantially less boilerplate.

**Locale strategy:** `vi` as default locale (no prefix in URL: `/`), `en` at `/en/*`. Middleware handles detection from `Accept-Language` header. All cutoff data labels, university names, and major names stored in Vietnamese; English translations cover UI chrome only.

### Styling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tailwind CSS | 4.x | Utility-first styling | Near-zero CSS bundle with purging, mobile-first responsive utilities, excellent performance on low-end devices. v4 removes the PostCSS config step; configure in `app/globals.css` directly. Ideal for the dense, data-heavy tables this app requires. |
| shadcn/ui | latest | Accessible component library | Unstyled Radix UI primitives + Tailwind + copy-paste model = no dependency bloat. Provides accessible table, dialog, slider, and tooltip components needed for the nguyện vọng builder and score simulator. **Not installed as a package** — components are copied into the repo, so there are no upstream breaking changes. |

**Why not Chakra UI / MUI:** Both are heavy (large JS bundles) and opinionated in ways that conflict with dense Vietnamese data layouts. Tailwind + shadcn gives full control with minimal overhead.

### State Management

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React built-ins (`useState`, `useReducer`, `useContext`) | built-in | Session state for nguyện vọng list, score input | No account required, no server-side session. The nguyện vọng list (max 15 items) and score inputs are ephemeral session state — `useReducer` with `useContext` is sufficient. No Zustand or Redux needed for this complexity level. |
| URL state (`nuqs`) | ~1.x | Encode nguyện vọng list + scores in URL | Enables the share-list feature without a backend. `nuqs` is a type-safe URL search parameter library for Next.js App Router. Encodes the full session state as URL params — shareable on Zalo with link preview. |

**Why not Zustand:** Zustand is a fine library but adds unnecessary dependency for state that lives entirely in URL params + React local state. Adds to bundle size on mobile.

### Testing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vitest | ~2.x | Unit tests for matching algorithm, score calculations | Fast (Vite-based), zero config with Next.js. The nguyện vọng matching logic and tổ hợp calculation are pure functions — ideal for unit testing. Critical to test edge cases (tied scores, boundary conditions). |
| Playwright | ~1.x | E2E tests for the score input → list generation flow | Same Playwright used for JS-rendering fallback in scrapers. Run in CI on PRs. Focus on the critical user path: enter scores → see ranked list → build nguyện vọng list. |

---

## Infrastructure Map

```
[GitHub Actions]
  scheduled cron (daily off-season, 4x/day in July)
    → Scraper (Node.js, Cheerio)
    → Writes to Supabase Postgres

[Vercel (Hobby)]
  Next.js 15 App
    → app/manifest.ts         (PWA manifest)
    → public/sw.js (Serwist)  (service worker, offline cache)
    → app/[locale]/           (next-intl locale routing: vi / en)
    → app/api/universities/   (Route Handlers → Supabase query via Drizzle)
    → app/api/scrape/         (optional manual trigger endpoint, protected)

[Supabase (Free)]
  Postgres tables:
    - universities
    - majors
    - cutoff_scores (year, university_id, major_id, to_hop, diem_chuan)
    - scrape_runs (timestamp, status, rows_upserted)
```

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Framework | Next.js 15 | Vite + React | No full-stack, no SSR, no native Vercel integration |
| Framework | Next.js 15 | Remix | Smaller ecosystem, Vercel via adapter not natively |
| Database | Supabase Postgres | PlanetScale | Free tier discontinued 2024 |
| Database | Supabase Postgres | Turso (libSQL) | Less relational capability; no clear advantage |
| Database | Supabase Postgres | Vercel Postgres (Neon) | Requires paid plan for usable limits |
| ORM | Drizzle | Prisma | Heavier bundle, known serverless cold-start issues |
| Scraping | Cheerio | Playwright (primary) | 300-600MB binary, cannot run in Vercel functions |
| Scraping | Cheerio | Puppeteer | Same binary size issue as Playwright |
| PWA | Serwist | next-pwa | Abandoned, incompatible with Next.js 14+ |
| Scheduling | GitHub Actions | Vercel Cron | Vercel Hobby cron is once/day maximum — insufficient for peak season |
| i18n | next-intl | react-i18next | Lacks native App Router Server Component support |
| Styling | Tailwind + shadcn | Chakra UI | Heavy JS bundle, bad for mid-range Android devices |
| Styling | Tailwind + shadcn | MUI | Same reason; opinionated design conflicts with dense Vietnamese data layouts |
| State | nuqs + useReducer | Zustand | Overkill for session-only, URL-encodable state |

---

## Installation

```bash
# Create Next.js 15 app
npx create-next-app@latest uniselect --typescript --tailwind --app --src-dir

# Database
npm install drizzle-orm postgres
npm install -D drizzle-kit

# Supabase client
npm install @supabase/supabase-js

# i18n
npm install next-intl

# Scraping (runs in GitHub Actions + API routes)
npm install cheerio

# URL state
npm install nuqs

# PWA service worker
npm install @serwist/next serwist

# Dev / test
npm install -D vitest @vitejs/plugin-react
npm install -D playwright @playwright/test
```

---

## Critical Constraints Summary

| Constraint | Impact | Mitigation |
|------------|--------|------------|
| Vercel Hobby cron: once/day max | Cannot scrape hourly during July peak | Use GitHub Actions scheduled workflows (free for public repos) |
| Vercel Hobby function: 300s max (with Fluid Compute) | Scraping 78+ universities in one function call would exceed limit | Split scraping into batches; scraper runs in GitHub Actions, not Vercel functions |
| Supabase free: project pauses after 1 week inactivity | Database unavailable if no traffic for 7 days | Scraper job pings DB on every run; enable "pause prevention" in Supabase dashboard |
| Vercel Hobby: 12 bundled functions max (Next.js) | Hard limit on API routes | Unlikely to hit this with App Router's bundling behavior; monitor |
| Playwright binary (~300-600MB) | Cannot run in Vercel functions | Playwright exclusively in GitHub Actions; Cheerio for all Vercel-side scraping |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Next.js 15 as framework | HIGH | Official docs verified March 2026 (nextjs.org) |
| PWA manifest approach | HIGH | Official Next.js docs verified March 2026 |
| Serwist for service worker | HIGH | Explicitly referenced in official Next.js PWA docs |
| Vercel Hobby cron (once/day) | HIGH | Verified via vercel.com/docs/cron-jobs/usage-and-pricing March 2026 |
| Vercel function max duration (300s) | HIGH | Verified via vercel.com/docs/functions/configuring-functions/duration March 2026 |
| GitHub Actions as scheduler | HIGH | Public repos get free unlimited minutes; well-established pattern |
| Cheerio for scraping | MEDIUM | Training knowledge; library is mature and stable; version ~1.0 is current as of Aug 2025 training cutoff |
| Supabase free tier limits | MEDIUM | Training knowledge (500MB DB, pause after 7 days inactivity); verify current limits at supabase.com/pricing before starting |
| Drizzle ORM version | MEDIUM | Training knowledge; verify current version at npmjs.com/package/drizzle-orm |
| next-intl version | MEDIUM | Training knowledge; verify at npmjs.com/package/next-intl |
| serwist version | MEDIUM | Training knowledge; verify at npmjs.com/package/@serwist/next |
| nuqs compatibility with Next.js 15 | MEDIUM | Library actively maintained; verify Next.js 15 compatibility at npmjs.com/package/nuqs |
| Tailwind CSS v4 | MEDIUM | Training knowledge as of Aug 2025; verify current config approach (v4 changed PostCSS setup) |

---

## Gaps to Address Before Starting

1. **Verify Supabase free tier limits** — confirm 500MB database and 7-day pause rule are still current at supabase.com/pricing
2. **Verify current library versions** — run `npm info cheerio version`, `npm info drizzle-orm version`, `npm info next-intl version`, `npm info @serwist/next version` before pinning
3. **Audit Vietnamese university target pages** — manually check if the MOET portal and top 20 universities render data server-side (Cheerio-compatible) or require JavaScript. This determines Tier 1 vs Tier 2 scraper allocation.
4. **Confirm Supabase "pause prevention"** — verify the free tier toggle to prevent project pausing exists in the current Supabase dashboard

---

## Sources

- Next.js 15 release blog: https://nextjs.org/blog/next-15 (verified March 2026)
- Next.js PWA guide: https://nextjs.org/docs/app/guides/progressive-web-apps (verified March 2026, docs version 16.1.7)
- Next.js deployment docs: https://nextjs.org/docs/app/getting-started/deploying (verified March 2026)
- Vercel cron usage and pricing: https://vercel.com/docs/cron-jobs/usage-and-pricing (verified March 2026)
- Vercel function duration limits: https://vercel.com/docs/functions/configuring-functions/duration (verified March 2026)
- Vercel limits overview: https://vercel.com/docs/limits/overview (verified March 2026)
- Cheerio, Drizzle, next-intl, serwist, nuqs: training knowledge, August 2025 cutoff (MEDIUM confidence — verify versions before use)
- Supabase free tier: training knowledge, August 2025 cutoff (MEDIUM confidence — verify before use)
