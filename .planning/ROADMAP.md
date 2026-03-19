# Roadmap: UniSelect

## Milestones

- ✅ **v1.0 MVP** — Phases 1-7 (shipped 2026-03-18)
- 🚧 **v2.0 Scraper Expansion + Quality + UX** — Phases 8-14 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-7) — SHIPPED 2026-03-18</summary>

- [x] Phase 1: Data Foundation (3/3 plans) — completed 2026-03-18
- [x] Phase 2: Core API and Algorithm (2/2 plans) — completed 2026-03-18
- [x] Phase 3: Frontend PWA (5/5 plans) — completed 2026-03-18
- [x] Phase 4: Scraper Expansion (2/2 plans) — completed 2026-03-18
- [x] Phase 5: Infrastructure Hardening (3/3 plans) — completed 2026-03-18
- [x] Phase 6: Tech Debt Cleanup (1/1 plans) — completed 2026-03-18
- [x] Phase 7: Adapter Verification & Data Population (3/3 plans) — completed 2026-03-18

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

---

### 🚧 v2.0 Scraper Expansion + Quality + UX (In Progress)

**Milestone Goal:** Make the scraping pipeline self-sustaining (auto-discovery, resilience testing), fix data correctness bugs found in the 7-agent audit, and redesign the UI/UX for trust and usability.

- [x] **Phase 8: Scraper Foundation** — Generic adapter factory, batch inserts, zero-rows guard, static /api/recommend fallback (completed 2026-03-19)
- [x] **Phase 9: Scraper Resilience Testing** — Fake HTTP server, HTML fixture library, PaddleOCR CI job (completed 2026-03-19)
- [x] **Phase 10: Auto-Discovery Crawler** — Crawlee-based spider, keyword scoring, rate limiting, human-review output (completed 2026-03-19)
- [x] **Phase 11: Bug Fixes & Data Correctness** — Delta signs, trend colors, NaN propagation, type safety, timer leak, async I/O, error UI (completed 2026-03-19)
- [x] **Phase 12: Testing & CI** — Engine edge-case tests, CI workflow on PRs, dead src/ removal, sw.js gitignore (completed 2026-03-19)
- [x] **Phase 13: Infrastructure Hardening** — Actions cache, shard optimization, Supabase keep-alive (completed 2026-03-19)
- [x] **Phase 14: UI/UX Redesign** — Design tokens, font fix, error boundaries, editable list, onboarding, dark mode, empty states (completed 2026-03-19)

## Phase Details

### Phase 8: Scraper Foundation
**Goal**: The scraper pipeline is safe to extend — zero-rows failures are visible, DB writes are efficient, and 70+ copy-pasted adapters are replaced by a single config-driven factory
**Depends on**: Phase 7 (v1.0 complete)
**Requirements**: SCRP-01, SCRP-02, SCRP-03, FIX-06
**Plans:** 3/3 plans complete

Plans:
- [ ] 08-01-PLAN.md — Zero-rows guard and batch transaction inserts in runner
- [ ] 08-02-PLAN.md — Static JSON fallback for /api/recommend on DB timeout
- [ ] 08-03-PLAN.md — Config-driven adapter factory and registry migration

**Success Criteria** (what must be TRUE):
  1. Running a verified adapter through the factory-migrated runner produces identical rows in Supabase compared to the original copy-pasted adapter
  2. A scrape run where an adapter returns zero rows logs `status: 'zero_rows'` (not `'ok'`) and the scrape_run record reflects rows_written: 0 with an error message
  3. A university with 200+ cutoff rows writes to Supabase in 2 round-trips (one transaction) instead of N individual upserts
  4. When Supabase is unreachable, `GET /api/recommend` returns a 200 with data from the static scores-by-tohop.json fallback

### Phase 9: Scraper Resilience Testing
**Goal**: Every adapter format has an HTML fixture and can be integration-tested against a local fake HTTP server without hitting live university servers
**Depends on**: Phase 8
**Requirements**: SCRP-06, SCRP-07, SCRP-08
**Plans:** 1/2 plans executed

Plans:
- [ ] 09-01-PLAN.md — HTML fixture library (7 formats) + MSW fake server + cheerio integration tests
- [ ] 09-02-PLAN.md — PaddleOCR CI workflow with cached model downloads

**Success Criteria** (what must be TRUE):
  1. `npm test` runs the full adapter integration suite against the fake server — no live network requests required
  2. The fixture library contains HTML covering at least 7 edge-case formats (generic table, no-thead headers, comma-decimal scores, Windows-1252 encoding, broken table, renamed headers, JS-stub page)
  3. The GitHub Actions PaddleOCR CI job runs the OCR pipeline end-to-end with cached model downloads and passes

### Phase 10: Auto-Discovery Crawler
**Goal**: Running the discovery crawler against university homepages produces a ranked list of candidate cutoff-page URLs in a review file — without touching scrapers.json or the production database
**Depends on**: Phase 9
**Requirements**: SCRP-04, SCRP-05
**Plans:** 2/2 plans complete

Plans:
- [ ] 10-01-PLAN.md — Keyword scorer, types, constants, and Crawlee dependency install
- [ ] 10-02-PLAN.md — CheerioCrawler discover.ts script and MSW integration tests

**Success Criteria** (what must be TRUE):
  1. Running `discover.ts` against 3+ fake university homepages (from Phase 9 fixtures) produces a `discovery-candidates.json` with correctly ranked URL candidates
  2. The crawler respects robots.txt: pages disallowed by robots.txt do not appear in discovery output
  3. The crawler does not exceed the configured per-domain rate limit (2-3 second delay between requests to the same domain)
  4. `scrapers.json` is never written by the crawler — all output is ephemeral to `discovery-candidates.json` for human review

### Phase 11: Bug Fixes & Data Correctness
**Goal**: All known data correctness bugs are fixed atomically — delta signs, trend colors, NaN scores, type mismatches, timer leak, async I/O, and error UI are all corrected in a single phase
**Depends on**: Phase 8
**Requirements**: FIX-01, FIX-02, FIX-03, FIX-04, FIX-05, FIX-07, FIX-08
**Plans:** 3/3 plans complete

Plans:
- [ ] 11-01-PLAN.md — Delta sign fix (computeDelta utility) and trend color correction
- [ ] 11-02-PLAN.md — NaN filtering in engine, scraped_at type fix, timer leak fix
- [ ] 11-03-PLAN.md — Error UI with retry and async readFile migration

**Success Criteria** (what must be TRUE):
  1. A student whose score is above cutoff sees a positive delta in both ResultsList and NguyenVongList (userScore - cutoff is positive = above cutoff)
  2. A university whose cutoff score rose year-over-year displays an amber/warning color (not green) in the trend indicator
  3. A university with a null or unparseable cutoff score is excluded from recommendation results — no NaN values appear in output
  4. When an API call fails, a visible error banner with a retry button appears in the UI (no silent failures)

### Phase 12: Testing & CI
**Goal**: The recommendation engine has tests covering all known edge cases, every pull request runs the full test suite automatically, and the repository is free of build artifacts and dead code
**Depends on**: Phase 11
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04
**Plans:** 2/2 plans complete

Plans:
- [ ] 12-01-PLAN.md — Engine edge-case tests and npm test script
- [ ] 12-02-PLAN.md — CI workflow for PRs, remove dead src/, untrack public/sw.js

**Success Criteria** (what must be TRUE):
  1. Opening a pull request triggers a GitHub Actions CI run that executes `npm test` and `npm run build` — both must pass for the check to go green
  2. The recommendation engine test suite covers: NaN input, null score, comma-decimal scores, all 5 tier boundary values, 0-practical pool, and exactly-15 pool — all passing
  3. The `src/` directory does not exist in the repository
  4. `public/sw.js` is listed in `.gitignore` and is not tracked by git

### Phase 13: Infrastructure Hardening
**Goal**: GitHub Actions scraping stays within the free-tier minute budget through July peak, and Supabase does not auto-pause during development quiet periods
**Depends on**: Phase 12
**Requirements**: INFR-01, INFR-02, INFR-03
**Plans:** 2/2 plans complete

Plans:
- [ ] 13-01-PLAN.md — PaddleOCR and Playwright caching in scrape workflows + July budget verification
- [ ] 13-02-PLAN.md — Supabase keep-alive cron workflow

**Success Criteria** (what must be TRUE):
  1. A simulated July peak scraping run (full schedule for one week) consumes fewer than 450 Actions minutes — verified by dry-run calculation or workflow log
  2. PaddleOCR models and Playwright browsers are restored from Actions cache on repeat runs (cache hit logged in workflow output)
  3. A Supabase keep-alive workflow runs `SELECT 1` on a schedule of every 5 days or fewer — visible in workflow history

### Phase 14: UI/UX Redesign
**Goal**: The UI communicates trust through correct data presentation, students can edit their nguyện vọng list directly, and first-time users understand what the app does and how to use it
**Depends on**: Phase 11
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, UI-08, UI-09
**Plans:** 4/4 plans complete

Plans:
- [ ] 14-01-PLAN.md — Design tokens, font fix, and dark mode (UI-01, UI-02, UI-08)
- [ ] 14-02-PLAN.md — Error boundaries, onboarding banner, empty state (UI-03, UI-06, UI-09)
- [ ] 14-03-PLAN.md — Editable nguyen vong list, tier grouping, tier badge tooltips (UI-04, UI-05, UI-07)
- [ ] 14-04-PLAN.md — Semantic token migration and visual verification checkpoint

**Success Criteria** (what must be TRUE):
  1. Be Vietnam Pro font is visibly applied to all body text — confirmed by DevTools computed font-family showing "Be Vietnam Pro"
  2. A student can reorder their nguyện vọng list using up/down buttons, add an item from search results, and remove an item — changes persist in the URL via nuqs
  3. A first-time visitor sees an onboarding banner explaining what UniSelect does before submitting their score
  4. Switching to dark mode persists across page reloads with no white flash on load
  5. Navigating to a non-existent route shows a Vietnamese/English not-found page with a link back to the home page

## Progress

**Execution Order:**
Phases execute in numeric order: 8 → 9 → 10 → 11 → 12 → 13 → 14

Note: Phase 14 depends on Phase 11 (not Phase 13) — UI work can proceed in parallel with infrastructure hardening if needed, but is scheduled last as it has no upstream dependents.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Data Foundation | v1.0 | 3/3 | Complete | 2026-03-18 |
| 2. Core API and Algorithm | v1.0 | 2/2 | Complete | 2026-03-18 |
| 3. Frontend PWA | v1.0 | 5/5 | Complete | 2026-03-18 |
| 4. Scraper Expansion | v1.0 | 2/2 | Complete | 2026-03-18 |
| 5. Infrastructure Hardening | v1.0 | 3/3 | Complete | 2026-03-18 |
| 6. Tech Debt Cleanup | v1.0 | 1/1 | Complete | 2026-03-18 |
| 7. Adapter Verification | v1.0 | 3/3 | Complete | 2026-03-18 |
| 8. Scraper Foundation | 3/3 | Complete   | 2026-03-19 | - |
| 9. Scraper Resilience Testing | 1/2 | In Progress|  | - |
| 10. Auto-Discovery Crawler | 2/2 | Complete    | 2026-03-19 | - |
| 11. Bug Fixes & Data Correctness | 3/3 | Complete    | 2026-03-19 | - |
| 12. Testing & CI | 2/2 | Complete    | 2026-03-19 | - |
| 13. Infrastructure Hardening | 2/2 | Complete    | 2026-03-19 | - |
| 14. UI/UX Redesign | 4/4 | Complete   | 2026-03-19 | - |

---
*Last updated: 2026-03-19 — Phase 14 planning complete (4 plans)*
