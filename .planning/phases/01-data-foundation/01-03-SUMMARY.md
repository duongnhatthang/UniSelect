---
phase: 01-data-foundation
plan: 03
subsystem: scraper
tags: [cheerio, typescript, github-actions, adapters, vitest, tsx]

# Dependency graph
requires:
  - phase: 01-data-foundation/01-02
    provides: ScraperAdapter interface, fetchHTML, runScraper, RawRow types
provides:
  - scrapers.json adapter registry with 6 entries (static_verified safety gate)
  - lib/scraper/registry.ts (loadRegistry — skips unverified adapters with warning)
  - lib/scraper/adapters/ministry.ts (Ministry portal adapter)
  - lib/scraper/adapters/bka.ts (BKA/HUST adapter)
  - lib/scraper/adapters/kha.ts (KHA/NEU adapter)
  - lib/scraper/adapters/nth.ts (NTH/FTU adapter)
  - lib/scraper/adapters/gha.ts (GHA/UTC adapter)
  - lib/scraper/adapters/dcn.ts (DCN/HAUI adapter)
  - lib/scraper/run.ts (CLI entry point — loadRegistry + runScraper)
  - .github/workflows/scrape-low.yml (daily cron + manual dispatch)
  - tests/scraper/adapters/adapter-contract.test.ts (shape contract for all 6 adapters)
  - tests/scraper/adapters/bka.test.ts (behavioral test with mock HTML fixture)
affects: [Phase 2 API routes, Phase 4 Scraper Expansion, GitHub Actions CI]

# Tech tracking
tech-stack:
  added: [tsx ^4.21.0]
  patterns:
    - Adapter registry pattern with static_verified safety gate (scrapers.json)
    - Semantic text anchor scraping (find th by text, not positional CSS)
    - Minimum-rows assertion to detect JS-rendering or layout changes
    - Mock fetchHTML with vi.mock for behavioral adapter testing

key-files:
  created:
    - scrapers.json
    - lib/scraper/registry.ts
    - lib/scraper/adapters/ministry.ts
    - lib/scraper/adapters/bka.ts
    - lib/scraper/adapters/kha.ts
    - lib/scraper/adapters/nth.ts
    - lib/scraper/adapters/gha.ts
    - lib/scraper/adapters/dcn.ts
    - lib/scraper/run.ts
    - .github/workflows/scrape-low.yml
    - tests/scraper/adapters/adapter-contract.test.ts
    - tests/scraper/adapters/bka.test.ts
  modified:
    - package.json (added tsx devDependency)
    - package-lock.json

key-decisions:
  - "All adapter static_verified flags default to false — adapters will not run until manually audited and enabled"
  - "Ministry adapter is structurally complete but selectors are placeholder TODOs pending manual URL/HTML audit"
  - "tsx declared as devDependency so npm ci in GitHub Actions installs it for npx tsx lib/scraper/run.ts"
  - "GitHub Actions uses single job for Phase 1 pilot (5-6 universities, <5 min); matrix sharding deferred to Phase 4"

patterns-established:
  - "Pattern: Semantic text anchors — find th/thead td by text content, never by positional CSS selector"
  - "Pattern: Minimum-rows assertion — throw if 0 rows returned (flags JS rendering or layout change)"
  - "Pattern: static_verified gate — registry skips adapters with static_verified=false and logs a warning"
  - "Pattern: Mock-based adapter tests — vi.mock fetchHTML, inject fixture HTML, assert RawRow shape"

requirements-completed: [PIPE-02, PIPE-03, INFRA-01]

# Metrics
duration: 15min
completed: 2026-03-18
---

# Phase 1 Plan 03: Scraper Adapters, Registry, and GitHub Actions Summary

**6 Cheerio adapters (ministry + 5 universities) with static_verified safety gate, adapter contract + BKA behavioral tests with mock HTML, and daily GitHub Actions cron workflow**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-18T07:12:00Z
- **Completed:** 2026-03-18T12:59:00Z
- **Tasks:** 3 of 3 complete
- **Files modified:** 14

## Accomplishments

- 6 adapter modules conforming to ScraperAdapter interface (ministry, bka, kha, nth, gha, dcn)
- Adapter registry (scrapers.json + registry.ts) with static_verified safety gate — no adapter runs until manually enabled
- CLI entry point (run.ts) wiring loadRegistry and runScraper together
- 35 tests passing: 24 contract tests (6 adapters x 4 shape assertions) + 11 behavioral BKA tests
- GitHub Actions daily workflow with cron schedule, manual dispatch, and correct secrets wiring

## Task Commits

Each task was committed atomically:

1. **Task 1: Adapter registry, 6 pilot adapters, CLI entry point, and behavioral tests** - `3fe256a` (feat)
2. **Task 2: GitHub Actions daily scrape workflow** - `7bbbdff` (feat)
3. **Deviation fix: tsx devDependency** - `a648066` (chore)

4. **Task 3: Verify complete data pipeline and Vercel deployment** - user approved (no new files — verification confirmed existing artifacts correct; Vercel/Supabase are external manual steps)

**Plan metadata:** To be committed after SUMMARY.md update

## Files Created/Modified

- `scrapers.json` — 6-entry adapter registry with static_verified safety gate on every entry
- `lib/scraper/registry.ts` — loadRegistry() reads scrapers.json, skips unverified, dynamic-imports adapter modules
- `lib/scraper/adapters/ministry.ts` — Ministry portal adapter (structural, selectors are TODO pending manual audit)
- `lib/scraper/adapters/bka.ts` — BKA (HUST) adapter with semantic text anchors and minimum-rows assertion
- `lib/scraper/adapters/kha.ts` — KHA (NEU) adapter
- `lib/scraper/adapters/nth.ts` — NTH (FTU) adapter
- `lib/scraper/adapters/gha.ts` — GHA (UTC) adapter
- `lib/scraper/adapters/dcn.ts` — DCN (HAUI) adapter
- `lib/scraper/run.ts` — CLI entry point: loadRegistry + runScraper + GITHUB_RUN_ID from env
- `.github/workflows/scrape-low.yml` — Daily at 02:00 UTC cron, manual dispatch, DATABASE_URL + SUPABASE_SERVICE_ROLE_KEY secrets
- `tests/scraper/adapters/adapter-contract.test.ts` — Shape contract for all 6 adapter exports (id + scrape)
- `tests/scraper/adapters/bka.test.ts` — Behavioral test with mock HTML fixture (11 assertions including error case)
- `package.json` — Added tsx ^4.21.0 as devDependency
- `package-lock.json` — Updated lockfile

## Decisions Made

- All `static_verified` flags set to `false` by default — the pipeline is structurally complete but dormant until each university's cutoff page is manually audited for static HTML rendering
- Ministry adapter selectors are placeholder TODOs since the exact Ministry portal URL and HTML structure for điểm chuẩn data requires manual browser verification
- tsx added as declared devDependency so `npm ci` in GitHub Actions installs it correctly
- Single-job workflow for Phase 1 pilot; Phase 4 should add matrix sharding for 78+ universities

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added tsx as declared devDependency**
- **Found during:** Task 2 verification (GitHub Actions workflow)
- **Issue:** tsx was present in node_modules (used for `npx tsx lib/scraper/run.ts`) but not declared in package.json devDependencies. Without this, `npm ci` in GitHub Actions would not install tsx, causing the workflow to fail.
- **Fix:** Ran `npm install -D tsx` to add tsx ^4.21.0 to devDependencies
- **Files modified:** package.json, package-lock.json
- **Verification:** tsx in node_modules/.bin, `npx tsx lib/scraper/run.ts` executes and warns about no verified adapters
- **Committed in:** a648066

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing critical dependency declaration)
**Impact on plan:** Essential for GitHub Actions to work correctly. No scope creep.

## Issues Encountered

None beyond the auto-fixed tsx devDependency.

## User Setup Required

**External services require manual configuration before adapters can run:**

### Supabase
- Create a new Supabase project at Supabase Dashboard -> New Project
- Run migration SQL: Supabase Dashboard -> SQL Editor -> paste `drizzle/migrations/0001_init.sql` -> Run
- Enable Pause Prevention: Supabase Dashboard -> Project Settings -> General -> Pause Prevention toggle
- Collect: `DATABASE_URL` (pooler URL port 6543) and `SUPABASE_SERVICE_ROLE_KEY` (service_role key)

### GitHub Actions Secrets
- Add `DATABASE_URL` as repository secret: GitHub repo -> Settings -> Secrets and variables -> Actions
- Add `SUPABASE_SERVICE_ROLE_KEY` as repository secret

### Vercel
- Connect GitHub repo: Vercel Dashboard -> Add New Project -> Import Git Repository
- Add `DATABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as environment variables in Vercel Project Settings
- Verify deployment responds HTTP 200

### Manual adapter verification (before enabling any scraper)
For each adapter, before setting `static_verified: true` in scrapers.json:
1. Visit the university cutoff page URL in a browser
2. View page source (Ctrl+U) and confirm the cutoff table is in raw HTML (not JS-rendered)
3. Update the `url` in scrapers.json to the specific cutoff page URL (not just the homepage)
4. Set `static_verified: true` for that entry
5. For the Ministry adapter: determine which specific URL publishes điểm chuẩn (cutoff) scores — verify it's a different URL from điểm thi (exam score) pages

## Next Phase Readiness

- Data pipeline is structurally complete: schema, migrations, seed data, normalizer, runner, adapters, workflow
- Phase 2 API routes can build on the Drizzle schema and database connection immediately
- Adapters will remain dormant until manual page audits are performed (static_verified gates)
- Vercel deployment and Supabase setup are the final Phase 1 deliverables (Task 3 checkpoint)

---
*Phase: 01-data-foundation*
*Completed: 2026-03-18*
