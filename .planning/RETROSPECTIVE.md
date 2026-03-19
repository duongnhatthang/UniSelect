# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-18
**Phases:** 7 | **Plans:** 19 | **Commits:** 103

### What Was Built
- Full data pipeline: schema, 78 adapter stubs, 6 verified adapters (static HTML + Playwright + PaddleOCR)
- Recommendation engine with tiered dream/practical/safe scoring against real cutoff data
- PWA frontend: score entry (quick + detailed), recommendations, nguyen vong list builder, university search with Vietnamese diacritics, i18n (vi/en)
- Infrastructure: static JSON fallback for DB timeouts, staleness alerting, 6-shard parallel scraping, peak July scheduling
- Tech debt cleanup and adapter verification with real data population

### What Worked
- GSD autonomous workflow executed 7 phases end-to-end with minimal manual intervention
- Three scraping strategies (cheerio/Playwright/PaddleOCR) proved the pattern works for all Vietnamese university page types
- Static JSON fallback is a clean solution for free-tier DB timeout resilience
- TDD approach in adapter tests caught real column-mapping issues (BVH PTIT's "THPT (100)" column)

### What Was Inefficient
- SPH and TLA were incorrectly marked as static_verified during Phase 7 — their URLs broke before the milestone even completed (URLs are inherently unstable)
- Manual URL verification doesn't scale: probing 78 university websites one by one is the bottleneck
- PaddleOCR 3.x API changed significantly from 2.x — ocr_table.py needed immediate fixes after initial implementation
- PaddleOCR OCR quality on low-res JPEG score tables was poor (single-character extraction) until switching to predict() API

### Patterns Established
- Adapter architecture: ScraperAdapter interface with id + scrape(url) pattern
- Three adapter variants: cheerio (static), Playwright (JS), PaddleOCR (image)
- scrapers.json as the single source of truth for adapter configuration and verification status
- scraping_method field for non-standard adapters (manual, playwright, deferred)
- Static JSON fallback pattern: generate at build time, serve from CDN, double-nested try/catch

### Key Lessons
1. **URL stability is the real problem** — University websites restructure annually. The v1 approach of hardcoding URLs per university per year doesn't scale. Auto-discovery from homepages is the critical v2 feature.
2. **Scraping strategy diversity matters** — No single approach works for all Vietnamese universities. The three-strategy pattern (static/Playwright/OCR) covers the full spectrum.
3. **Test against real pages early** — Mocked adapter tests passed but real URLs revealed different column headers, encodings, and rendering methods. Live verification should happen sooner.
4. **Free-tier constraints drive good architecture** — Static JSON fallback, serverless auto-scaling, and GitHub Actions cron are elegant solutions born from the zero-cost constraint.

### Cost Observations
- Model mix: ~40% opus (planning), ~60% sonnet (execution, verification, research)
- Sessions: ~5 sessions over 12 days
- Notable: Autonomous mode completed Phase 6 and 7 (discuss → plan → execute) without manual intervention beyond grey area decisions

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Commits | Phases | Key Change |
|-----------|---------|--------|------------|
| v1.0 | 103 | 7 | Full autonomous pipeline, three scraping strategies |

### Cumulative Quality

| Milestone | Tests | LOC | Verified Adapters |
|-----------|-------|-----|-------------------|
| v1.0 | 349 | 11,162 | 6/78 |

### Top Lessons (Verified Across Milestones)

1. URL instability is the #1 operational risk — auto-discovery is critical for v2
2. Free-tier constraints produce elegant architecture when embraced early
