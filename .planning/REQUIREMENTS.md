# Requirements: UniSelect v2.0

**Defined:** 2026-03-18
**Core Value:** Give every Vietnamese student the data and strategy to order their nguyện vọng list correctly — because getting the ranking wrong means being locked out of better options permanently.

## v2.0 Requirements

Requirements for v2.0 release. Each maps to roadmap phases. Priority: Scraper Expansion > Bug Fixes/Testing > UI/UX.

### Scraper Infrastructure

- [ ] **SCRP-01**: Generic adapter factory replaces 70+ copy-pasted cheerio adapters with a config-driven `createCheerioAdapter(config)` function
- [ ] **SCRP-02**: Scraper runner uses batched DB inserts (one INSERT per table per adapter) instead of row-by-row upserts
- [ ] **SCRP-03**: Zero-rows guard in runner rejects adapters returning empty results with explicit error logging
- [ ] **SCRP-04**: Auto-discovery crawler scans university homepages and outputs ranked cutoff-page URL candidates to a review file
- [ ] **SCRP-05**: Auto-discovery enforces per-domain rate limiting and robots.txt compliance
- [ ] **SCRP-06**: Fake HTTP server serves HTML fixtures for scraper integration tests (cheerio + Playwright adapters)
- [ ] **SCRP-07**: HTML fixture library covers verified adapter formats plus irregular edge cases (comma-decimal, missing table, multi-method)
- [ ] **SCRP-08**: PaddleOCR pipeline runs in GitHub Actions CI with cached model downloads

### Bug Fixes & Data Correctness

- [ ] **FIX-01**: Delta sign convention is consistent across ResultsList and NguyenVongList (userScore - cutoff everywhere; positive = above cutoff)
- [ ] **FIX-02**: Trend colors reflect student perspective (rising cutoff = amber/warning, falling cutoff = green/favorable)
- [ ] **FIX-03**: Recommendation engine filters out null/unparseable scores before computing weighted averages (no NaN propagation)
- [ ] **FIX-04**: CutoffDataRow type matches Drizzle return types (scraped_at: Date | null, not string | null)
- [ ] **FIX-05**: withTimeout clears the setTimeout on promise resolution (no timer leak)
- [ ] **FIX-06**: /api/recommend falls back to static JSON (scores-by-tohop.json) when Supabase is unreachable
- [ ] **FIX-07**: Failed API calls show visible error banners with retry capability (replace silent .catch(() => {}))
- [ ] **FIX-08**: readFileSync in API fallback paths replaced with async readFile

### Testing & CI

- [ ] **TEST-01**: Recommendation engine has synthetic data tests covering NaN input, null score, comma-decimal, all 5 tier boundary values, 0-practical pool, and exactly-15 pool
- [ ] **TEST-02**: GitHub Actions CI workflow runs `npm test` and `npm run build` on pull requests
- [ ] **TEST-03**: Dead `src/` directory removed from repository
- [ ] **TEST-04**: `public/sw.js` added to .gitignore (build artifact, not source)

### Infrastructure

- [ ] **INFR-01**: GitHub Actions caches PaddleOCR models and Playwright browsers across workflow runs
- [ ] **INFR-02**: Scraping shard count optimized to fit within GitHub Actions free-tier budget for July peak
- [ ] **INFR-03**: Supabase keep-alive cron workflow prevents auto-pause during low-activity periods

### UI/UX

- [ ] **UI-01**: Design token system established in Tailwind v4 @theme (semantic colors, spacing, typography scale)
- [ ] **UI-02**: Be Vietnam Pro font correctly applied via --font-sans token (fix broken font-sans reference)
- [ ] **UI-03**: Error boundaries added (error.tsx, not-found.tsx) with Vietnamese/English messaging and retry
- [ ] **UI-04**: Nguyện vọng list is editable: user can reorder (up/down buttons + optional drag), add from results, and remove items
- [ ] **UI-05**: Nguyện vọng list shows tier grouping headers (practical 1-5, dream 6-10, safe 11-15) with 5+5+5 strategy explanation
- [ ] **UI-06**: First-time users see an onboarding banner explaining what UniSelect does and what information they need
- [ ] **UI-07**: Tier badges show concrete score margins on hover/tap (e.g., "Your score is 2.3 above cutoff")
- [ ] **UI-08**: Dark mode toggle with next-themes, persisted to localStorage, using semantic token variants
- [ ] **UI-09**: Empty state before first submission shows guidance text instead of "No matching results"

## Future Requirements (v3+)

### Deferred from v2.0

- **FUTURE-01**: Client-side offline recommendation engine (bundle engine + data in service worker)
- **FUTURE-02**: Score scenario comparison mode ("what if I scored X vs Y")
- **FUTURE-03**: Visual share card generation for Zalo/Facebook
- **FUTURE-04**: Học bạ (GPA-based) admission pathway support
- **FUTURE-05**: Aptitude test pathways (VNU TSA, HUST TSA)
- **FUTURE-06**: Direct admission (xét tuyển thẳng)

## Out of Scope

| Feature | Reason |
|---------|--------|
| LLM-based scraping | Cost prohibitive for charity project |
| Fully automatic URL updates from auto-discovery | Silent data corruption risk; human gate required |
| Native iOS/Android apps | PWA is sufficient |
| Account/user profiles | No login needed; URL state persistence via nuqs |
| Real-time seat availability tracking | Cutoff scores are annual data |
| dnd-kit as sole reorder interaction | iOS Safari scroll conflict; up/down buttons are primary |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCRP-01 | Phase 8 | Pending |
| SCRP-02 | Phase 8 | Pending |
| SCRP-03 | Phase 8 | Pending |
| SCRP-04 | Phase 10 | Pending |
| SCRP-05 | Phase 10 | Pending |
| SCRP-06 | Phase 9 | Pending |
| SCRP-07 | Phase 9 | Pending |
| SCRP-08 | Phase 9 | Pending |
| FIX-01 | Phase 11 | Pending |
| FIX-02 | Phase 11 | Pending |
| FIX-03 | Phase 11 | Pending |
| FIX-04 | Phase 11 | Pending |
| FIX-05 | Phase 11 | Pending |
| FIX-06 | Phase 8 | Pending |
| FIX-07 | Phase 11 | Pending |
| FIX-08 | Phase 11 | Pending |
| TEST-01 | Phase 12 | Pending |
| TEST-02 | Phase 12 | Pending |
| TEST-03 | Phase 12 | Pending |
| TEST-04 | Phase 12 | Pending |
| INFR-01 | Phase 13 | Pending |
| INFR-02 | Phase 13 | Pending |
| INFR-03 | Phase 13 | Pending |
| UI-01 | Phase 14 | Pending |
| UI-02 | Phase 14 | Pending |
| UI-03 | Phase 14 | Pending |
| UI-04 | Phase 14 | Pending |
| UI-05 | Phase 14 | Pending |
| UI-06 | Phase 14 | Pending |
| UI-07 | Phase 14 | Pending |
| UI-08 | Phase 14 | Pending |
| UI-09 | Phase 14 | Pending |

**Coverage:**
- v2.0 requirements: 32 total
- Mapped to phases: 32
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-18*
*Last updated: 2026-03-18 — traceability filled after roadmap creation*
