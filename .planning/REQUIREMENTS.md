# Requirements: UniSelect v3.0

**Defined:** 2026-03-19
**Core Value:** Give every Vietnamese student the data and strategy to order their nguyện vọng list correctly — because getting the ranking wrong means being locked out of better options permanently.

## v3.0 Requirements

Requirements for v3.0 release. Priority: Data Pipeline > Monitoring > Scale.

### University Coverage

- [x] **UNIC-01**: System seeds 250+ Vietnamese universities and colleges from MOET-authoritative sources (up from 78; MOET recognizes ~243 degree-granting universities nationally)
- [x] **UNIC-02**: Each university record includes ministry code (ma truong), Vietnamese name, and homepage URL
- [x] **UNIC-03**: University master list is version-controlled as a committed data file (not dependent on external API)

### Registry & Scraper Fix

- [x] **SCRP-09**: Registry gate no longer silently skips adapters — replaces `static_verified` boolean with `scrape_url` presence check so any adapter with a known cutoff page URL runs
- [x] **SCRP-10**: Scraper produces real cutoff score data in Supabase for universities with verified cutoff page URLs
- [ ] **SCRP-11**: Adapters capture all tổ hợp combinations published on each university's cutoff page (not just A00 default)
- [ ] **SCRP-12**: Factory adapter handles wide-table format (one column per tổ hợp) in addition to existing row-per-combination format

### Auto-Discovery Integration

- [x] **DISC-01**: Auto-discovery crawler runs as a GitHub Actions workflow (weekly cron + manual dispatch), not just a standalone script
- [x] **DISC-02**: Discovery output produces a ranked candidate list that can be reviewed and applied to update scrapers.json
- [x] **DISC-03**: An apply-discovery script patches scrapers.json with verified cutoff page URLs from discovery output (human-gated, not automatic)

### Scrape Monitoring

- [x] **MON-01**: Scrape status is queryable — shows per-university last successful scrape time, rows written, and error status
- [ ] **MON-02**: scrape_runs table has a retention policy (90-day pruning) to stay within Supabase 500MB free-tier limit
- [ ] **MON-03**: GitHub Actions scrape workflow logs summary statistics (total universities attempted, succeeded, failed, zero-rows) at end of each run

### Infrastructure Scale

- [ ] **INFR-04**: Shard count scales from 6 to handle 400+ universities within GHA per-job timeout limits
- [ ] **INFR-05**: Playwright and OCR adapters are isolated to dedicated shards to prevent timeout cascade

## Previous Milestones (Archived)

v2.0 requirements: See `.planning/milestones/v2.0-REQUIREMENTS.md` (32 requirements, all complete)
v1.0 requirements: See `.planning/milestones/v1.0-ROADMAP.md`

## Future Requirements (v4+)

### Deferred from v3.0

- **FUTURE-01**: Client-side offline recommendation engine (bundle engine + data in service worker)
- **FUTURE-02**: Score scenario comparison mode ("what if I scored X vs Y")
- **FUTURE-03**: Visual share card generation for Zalo/Facebook
- **FUTURE-04**: Học bạ (GPA-based) admission pathway support
- **FUTURE-05**: Aptitude test pathways (VNU TSA, HUST TSA)
- **FUTURE-06**: Direct admission (xét tuyển thẳng)
- **FUTURE-07**: Admin dashboard UI for scrape monitoring (v3.0 uses API/logs only)
- **FUTURE-08**: Automatic adapter type detection (cheerio vs playwright vs OCR) based on page analysis
- **FUTURE-09**: Monthly automated URL re-validation workflow
- **FUTURE-10**: Ministry portal (MOET) direct integration for official cutoff announcements

## Out of Scope

| Feature | Reason |
|---------|--------|
| LLM-based scraping | Cost prohibitive for charity project |
| Automatic URL promotion from discovery (no human gate) | Silent data corruption risk; human review required |
| Full Playwright for all universities | Exceeds GHA free-tier budget; cheerio handles 80%+ of sites |
| Real-time scrape dashboard UI | API endpoint sufficient for v3.0; UI deferred to v4+ |
| Adapter for PDF-only universities | OCR covers images; PDF parsing adds complexity with low ROI |
| Native iOS/Android apps | PWA is sufficient |
| Account/user profiles | No login needed; URL state persistence via nuqs |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| UNIC-01 | Phase 15 | Complete |
| UNIC-02 | Phase 15 | Complete |
| UNIC-03 | Phase 15 | Complete |
| SCRP-09 | Phase 15 | Complete |
| SCRP-10 | Phase 15 | Complete |
| DISC-01 | Phase 16 | Complete |
| DISC-02 | Phase 16 | Complete |
| DISC-03 | Phase 16 | Complete |
| MON-01 | Phase 17 | Complete |
| MON-02 | Phase 17 | Pending |
| MON-03 | Phase 17 | Pending |
| SCRP-11 | Phase 18 | Pending |
| SCRP-12 | Phase 18 | Pending |
| INFR-04 | Phase 18 | Pending |
| INFR-05 | Phase 18 | Pending |

**Coverage:**
- v3.0 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-19 — traceability table populated during roadmap creation*
