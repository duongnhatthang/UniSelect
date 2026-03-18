# Roadmap: UniSelect

## Overview

UniSelect is built in five phases that follow a strict dependency order: stable data before API, real API before frontend, validated frontend before scraper expansion, and everything hardened before the July peak traffic event. Phase 1 lays the schema and pipeline foundation that every other phase depends on. Phases 2 and 3 build the product layer — the algorithm and the user interface — against real data. Phase 4 scales the scraper to all 78+ universities. Phase 5 prepares the system to survive the admissions season spike without manual intervention.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Data Foundation** - Stable schema, scraper adapter framework, and seed data for the first universities
- [ ] **Phase 2: Core API and Algorithm** - All API endpoints live, recommendation algorithm verified against real data
- [ ] **Phase 3: Frontend PWA** - Complete user-facing product: score entry, recommendations, nguyện vọng builder, i18n
- [ ] **Phase 4: Scraper Expansion** - All 78+ university adapters, sharded parallel execution, July peak schedule
- [ ] **Phase 5: Infrastructure Hardening** - Load testing, edge caching, monitoring — production-ready before July

## Phase Details

### Phase 1: Data Foundation
**Goal**: A stable, validated data pipeline that scrapes and stores cutoff scores from initial universities into a production-ready schema
**Depends on**: Nothing (first phase)
**Requirements**: PIPE-01, PIPE-02, PIPE-03, INFRA-01
**Success Criteria** (what must be TRUE):
  1. Supabase database is live on free tier with all tables (universities, majors, tohop_codes, cutoff_scores, scrape_runs) and correct indexes
  2. A GitHub Actions workflow runs on a daily schedule and writes scraped cutoff scores to the database for at least 5 universities including the Ministry portal
  3. Every cutoff score record in the database has a source URL, scraped timestamp, year, tổ hợp code, and score value — no incomplete records pass validation
  4. The university seed list is queryable and contains at least the initial 78+ institutions with their websites
  5. The Next.js + Vercel project deploys successfully on free tier with environment variables connected to Supabase
**Plans:** 2/3 plans executed

Plans:
- [ ] 01-01-PLAN.md — Next.js project init, Drizzle schema, DB connection, seed migration, Vitest config
- [ ] 01-02-PLAN.md — Scraper framework: types, normalizer (TDD), encoding-safe fetch, fail-open runner
- [ ] 01-03-PLAN.md — Pilot adapters (6), adapter registry, CLI entry point, GitHub Actions workflow

### Phase 2: Core API and Algorithm
**Goal**: All API endpoints are live, edge-cached, and the recommendation algorithm produces correct tiered results against real scraped data
**Depends on**: Phase 1
**Requirements**: (API layer enabling SCOR-01, SCOR-02, NGVG-01, SRCH-01, SRCH-02 — user-observable in Phase 3)
**Success Criteria** (what must be TRUE):
  1. All six API endpoints respond correctly: /api/universities, /api/universities/[id], /api/scores, /api/recommend, /api/tohop, /api/years
  2. /api/recommend returns a tiered list (dream / practical / safe) given a tổ hợp code and total score, using multi-year cutoff trend weighting
  3. Static lookup endpoints (universities, tổ hợp codes) are edge-cached and return in under 200ms on repeat requests
  4. Supabase connection pooling (PgBouncer) is configured and the API does not exhaust connections under concurrent requests
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD
- [ ] 02-03: TBD

### Phase 3: Frontend PWA
**Goal**: Every user-facing feature works end-to-end: score entry, recommendations, nguyện vọng list builder, search, data staleness display, and both Vietnamese and English languages
**Depends on**: Phase 2
**Requirements**: SRCH-01, SRCH-02, SCOR-01, SCOR-02, NGVG-01, I18N-01, I18N-02, PIPE-05
**Success Criteria** (what must be TRUE):
  1. User can select a tổ hợp and enter a total score to see a ranked, color-coded list of universities and majors they qualify for (quick mode)
  2. User can enter individual subject scores and the app calculates applicable tổ hợp totals and shows matched universities (detailed mode)
  3. User can view a generated 15-choice nguyện vọng list tiered as dream / practical / safe and the list is encoded in the URL for sharing
  4. User can search universities by Vietnamese name (diacritic-aware) and filter by tổ hợp code
  5. Every displayed cutoff score shows its source and data age (staleness indicator)
  6. The entire app is usable in Vietnamese by default and switches to English on toggle — both languages complete, no untranslated strings
  7. The app is installable as a PWA and loads previously fetched data offline
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD
- [ ] 03-03: TBD
- [ ] 03-04: TBD

### Phase 4: Scraper Expansion
**Goal**: All 78+ Vietnamese universities have working scrapers, executing in parallel shards with July peak-frequency scheduling
**Depends on**: Phase 3
**Requirements**: PIPE-04
**Success Criteria** (what must be TRUE):
  1. Scrapers exist for all universities in the seed list and cutoff score data is present in the database for each
  2. GitHub Actions matrix jobs run scraper shards in parallel with each shard completing within 30 minutes
  3. The peak-frequency workflow (scrape-peak.yml) runs multiple times per day and can be toggled on/off without code changes
  4. A failed individual university scraper does not block other scrapers — the pipeline is fail-open and logs failures to scrape_runs
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD
- [ ] 04-03: TBD

### Phase 5: Infrastructure Hardening
**Goal**: The system handles the July traffic spike without manual intervention and monitoring catches data staleness or scrape failures before students are affected
**Depends on**: Phase 4
**Requirements**: INFRA-02
**Success Criteria** (what must be TRUE):
  1. Load testing confirms the API and database handle concurrent July-peak traffic without connection exhaustion or error rates above 1%
  2. Core university score data is served via static JSON from Vercel CDN — the most common queries return in under 500ms on 4G without hitting Supabase
  3. Core Web Vitals on the score entry page meet targets: LCP under 2.5s and TTI under 3s on simulated 4G mobile
  4. Scrape failure alerts fire automatically when a university has not been updated within the expected staleness window
  5. The app remains fully functional (reads from cache/CDN) during a Supabase cold start or temporary unavailability
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD
- [ ] 05-03: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Data Foundation | 2/3 | In Progress|  |
| 2. Core API and Algorithm | 0/3 | Not started | - |
| 3. Frontend PWA | 0/4 | Not started | - |
| 4. Scraper Expansion | 0/3 | Not started | - |
| 5. Infrastructure Hardening | 0/3 | Not started | - |
