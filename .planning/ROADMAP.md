# Roadmap: UniSelect

## Milestones

- ✅ **v1.0 MVP** — Phases 1-7 (shipped 2026-03-18)
- ✅ **v2.0 Scraper Expansion + Quality + UX** — Phases 8-14 (shipped 2026-03-19)
- 🚧 **v3.0 Complete Data Pipeline** — Phases 15-18 (in progress)

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

<details>
<summary>✅ v2.0 Scraper Expansion + Quality + UX (Phases 8-14) — SHIPPED 2026-03-19</summary>

- [x] Phase 8: Scraper Foundation (3/3 plans) — completed 2026-03-19
- [x] Phase 9: Scraper Resilience Testing (2/2 plans) — completed 2026-03-19
- [x] Phase 10: Auto-Discovery Crawler (2/2 plans) — completed 2026-03-19
- [x] Phase 11: Bug Fixes & Data Correctness (3/3 plans) — completed 2026-03-19
- [x] Phase 12: Testing & CI (2/2 plans) — completed 2026-03-19
- [x] Phase 13: Infrastructure Hardening (2/2 plans) — completed 2026-03-19
- [x] Phase 14: UI/UX Redesign (4/4 plans) — completed 2026-03-19

Full details: `.planning/milestones/v2.0-phases/`

</details>

---

### 🚧 v3.0 Complete Data Pipeline (In Progress)

**Milestone Goal:** Make the scraper pipeline actually produce data — expand university coverage from 78 to 250+ (MOET recognizes ~243 degree-granting universities), fix the registry gate that silently skips 95% of adapters, integrate auto-discovery into CI, and ensure all cutoff scores are stored in Supabase with monitoring.

- [x] **Phase 15: University Master List + Registry Gate Fix** — Seed 400+ MOET-authoritative universities, rewrite registry gate so adapters with known cutoff URLs actually run (completed 2026-03-20)
- [x] **Phase 16: Auto-Discovery CI Integration** — Wire discover.ts into GitHub Actions with weekly cron, produce human-reviewable candidate list, apply-discovery script patches scrapers.json (completed 2026-03-20)
- [x] **Phase 17: Scrape Monitoring + DB Health** — Per-university status queryable, scrape_runs pruned to stay within 500 MB free tier, CI summary logged per run (completed 2026-03-20)
- [ ] **Phase 18: tổ Hợp Coverage + Infrastructure Scale** — Factory handles wide-table format, shard count scales to cover 400+ universities, Playwright/OCR adapters isolated to dedicated shards

## Phase Details

### Phase 15: University Master List + Registry Gate Fix
**Goal**: The scraper pipeline runs against all universities that have a verified cutoff page URL — the registry gate no longer silently skips 95% of adapters, and the Supabase universities table holds 250+ MOET-authoritative institutions
**Depends on**: Phase 14 (v2.0 complete)
**Requirements**: UNIC-01, UNIC-02, UNIC-03, SCRP-09, SCRP-10
**Success Criteria** (what must be TRUE):
  1. `data/uni_list.json` exists in the repository with 250+ entries, each containing mã trường, Vietnamese name, and homepage URL from MOET-authoritative data (~243 degree-granting universities nationally)
  2. Running `scripts/seed-universities.ts` populates the Supabase `universities` table with 250+ rows — observable via Supabase table editor or a direct SQL count query
  3. `scrapers.json` no longer contains a `static_verified` field — entries have `website_url` (homepage) and `scrape_url` (cutoff page, null for unverified entries)
  4. The daily scrape cron runs adapters for all entries where `scrape_url` is present and `adapter_type` is not `skip` — confirmed by scrape_runs rows appearing for those universities
  5. At least 4 previously-verified adapters produce real cutoff score rows in Supabase after the registry gate fix
**Plans:** 2/2 plans complete
Plans:
- [x] 15-01-PLAN.md — Registry gate fix + scrapers.json schema migration (SCRP-09, SCRP-10)
- [x] 15-02-PLAN.md — University master list data + seed script (UNIC-01, UNIC-02, UNIC-03)

### Phase 16: Auto-Discovery CI Integration
**Goal**: The auto-discovery crawler runs automatically every week via GitHub Actions, producing a reviewed candidate list of cutoff page URLs that can be applied to scrapers.json through a human-gated script
**Depends on**: Phase 15
**Requirements**: DISC-01, DISC-02, DISC-03
**Success Criteria** (what must be TRUE):
  1. A `.github/workflows/discover.yml` workflow exists and runs on weekly cron and `workflow_dispatch` — visible in the GitHub Actions tab
  2. Each workflow run produces a `discovery-candidates.json` artifact downloadable from the Actions run summary, containing ranked URL candidates with confidence scores
  3. Running `scripts/apply-discovery.ts` with a reviewed candidates file patches `scrapers.json` — entries with existing `verified_at` are never overwritten
  4. After a manual `workflow_dispatch` run against all 400+ university homepages, at least some entries in `scrapers.json` have a non-null `scrape_url` populated from discovery output
**Plans:** 2/2 plans complete
Plans:
- [x] 16-01-PLAN.md — discover.ts schema migration + discover.yml workflow (DISC-01, DISC-02)
- [x] 16-02-PLAN.md — apply-discovery.ts script + guard tests (DISC-03)

### Phase 17: Scrape Monitoring + DB Health
**Goal**: Pipeline health is observable — maintainers can query per-university scrape status, the scrape_runs table will not exhaust Supabase's 500 MB free tier, and each GHA scrape run logs a human-readable summary
**Depends on**: Phase 16
**Requirements**: MON-01, MON-02, MON-03
**Success Criteria** (what must be TRUE):
  1. Querying `/admin/scrape-status` (or an equivalent API endpoint) returns per-university last scrape time, rows written, and error status — without requiring a Supabase dashboard login
  2. The `scrape_runs` table has a pruning mechanism that deletes rows older than 90 days — confirmed by the keepalive workflow log showing a pruning step
  3. Each GitHub Actions scrape shard prints a summary line at job end showing total universities attempted, succeeded, failed, and zero-rows — visible in the workflow run log
**Plans:** 2/2 plans complete
Plans:
- [ ] 17-01-PLAN.md — RunSummary return type + GHA summary log + scrape_runs pruning (MON-02, MON-03)
- [ ] 17-02-PLAN.md — Scrape status API endpoint + tests (MON-01)

### Phase 18: tổ Hợp Coverage + Infrastructure Scale
**Goal**: The scraper captures all tổ hợp combinations from universities that publish wide-table format cutoff pages, and the GitHub Actions shard count is high enough that 400+ universities complete within per-job timeout limits with Playwright and OCR adapters safely isolated
**Depends on**: Phase 16
**Requirements**: SCRP-11, SCRP-12, INFR-04, INFR-05
**Success Criteria** (what must be TRUE):
  1. A wide-table fixture exists in the test suite and the factory processes it correctly — producing one row per major per tổ hợp column instead of collapsing to a single tổ hợp value
  2. A university that publishes a wide-table cutoff page has all its tổ hợp combinations stored as separate rows in Supabase after a scrape run
  3. The scrape workflow matrix uses enough shards that no shard exceeds 300 minutes of runtime during a simulated July peak run (4x/day × 400 universities)
  4. Playwright adapters and PaddleOCR adapters run in dedicated shard(s) — a Cheerio-only shard never waits for Playwright browser launch or OCR model download
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 15 → 16 → 17 → 18

Note: Phase 17 and Phase 18 both depend on Phase 16 completing. They can proceed in either order or in parallel — Phase 17 depends on real scrape runs happening; Phase 18 depends on real cutoff pages being available for format audit.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Data Foundation | v1.0 | 3/3 | Complete | 2026-03-18 |
| 2. Core API and Algorithm | v1.0 | 2/2 | Complete | 2026-03-18 |
| 3. Frontend PWA | v1.0 | 5/5 | Complete | 2026-03-18 |
| 4. Scraper Expansion | v1.0 | 2/2 | Complete | 2026-03-18 |
| 5. Infrastructure Hardening | v1.0 | 3/3 | Complete | 2026-03-18 |
| 6. Tech Debt Cleanup | v1.0 | 1/1 | Complete | 2026-03-18 |
| 7. Adapter Verification | v1.0 | 3/3 | Complete | 2026-03-18 |
| 8. Scraper Foundation | v2.0 | 3/3 | Complete | 2026-03-19 |
| 9. Scraper Resilience Testing | v2.0 | 2/2 | Complete | 2026-03-19 |
| 10. Auto-Discovery Crawler | v2.0 | 2/2 | Complete | 2026-03-19 |
| 11. Bug Fixes & Data Correctness | v2.0 | 3/3 | Complete | 2026-03-19 |
| 12. Testing & CI | v2.0 | 2/2 | Complete | 2026-03-19 |
| 13. Infrastructure Hardening | v2.0 | 2/2 | Complete | 2026-03-19 |
| 14. UI/UX Redesign | v2.0 | 4/4 | Complete | 2026-03-19 |
| 15. University Master List + Registry Gate Fix | v3.0 | 2/2 | Complete | 2026-03-20 |
| 16. Auto-Discovery CI Integration | v3.0 | 2/2 | Complete | 2026-03-20 |
| 17. Scrape Monitoring + DB Health | 2/2 | Complete   | 2026-03-20 | - |
| 18. tổ Hợp Coverage + Infrastructure Scale | v3.0 | 0/? | Not started | - |

---
*Last updated: 2026-03-20 — Phase 17 planned (2 plans, Wave 1)*
