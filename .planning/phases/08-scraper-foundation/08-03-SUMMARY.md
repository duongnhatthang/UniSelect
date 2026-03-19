---
phase: 08-scraper-foundation
plan: "03"
subsystem: scraper
tags: [factory, registry, config-driven, cheerio, tdd]
dependency_graph:
  requires: ["08-01"]
  provides: ["createCheerioAdapter factory", "factory_config registry branch", "factory test suite"]
  affects: ["lib/scraper/registry.ts", "scrapers.json"]
tech_stack:
  added: []
  patterns: ["Config-driven adapter factory", "Keyword-based column detection", "TDD green-path (factory built before tests)"]
key_files:
  created:
    - lib/scraper/factory.ts
    - tests/scraper/factory.test.ts
  modified:
    - lib/scraper/registry.ts
    - scrapers.json
decisions:
  - "Factory uses Array.some() over config keyword arrays, not repeated .includes() calls — cleaner config-driven approach"
  - "scrapers.json factory_config added to all cheerio adapters including static_verified:false entries — registry skips them anyway but configs are ready for when URLs are verified"
  - "GHA (PaddleOCR) and DCN (Playwright) entries have no factory_config — they continue using dynamic import"
  - "MINISTRY entry has no factory_config — special multi-column structure not suited for factory pattern"
metrics:
  duration: "~8 min"
  completed: "2026-03-19"
  tasks_completed: 2
  files_changed: 4
---

# Phase 8 Plan 3: Config-Driven Adapter Factory Summary

Config-driven cheerio adapter factory that generates `ScraperAdapter` objects from JSON keyword configs, eliminating ~4,000 lines of copy-pasted adapter boilerplate across 78 files.

## What Was Built

### lib/scraper/factory.ts
Exports `createCheerioAdapter(config: CheerioAdapterConfig): ScraperAdapter`. The factory:
- Supports `th`/`thead td` header detection with first-row `td` fallback (HTC pattern)
- Uses `Array.some()` over `scoreKeywords`/`majorKeywords`/`tohopKeywords` arrays for flexible column matching
- Supports `tohopKeywords` for multi-tohop tables and `defaultTohop` for single-tohop universities
- Throws with adapter ID in error when 0 rows returned, matching the per-adapter error format
- Skips rows with non-numeric major codes (section headers like "I", "II", "Chương trình chuẩn")

### lib/scraper/registry.ts
Updated to use `factory_config` when present on a registry entry:
- If `entry.factory_config` exists: creates adapter via `createCheerioAdapter({ id: entry.id, ...entry.factory_config })`
- Otherwise: dynamic `import('./adapters/${entry.adapter}')` for non-cheerio adapters (GHA/PaddleOCR, DCN/Playwright)

### scrapers.json
`factory_config` added to all 78 cheerio adapter entries. Three adapter patterns captured:
1. **HTC pattern**: Vietnamese diacritics keywords (`điểm trúng tuyển`, `mã ngành`), `defaultTohop: "A00"`
2. **BVH pattern**: `thpt`/`diem chuan` score keywords, tohop column via `tohopKeywords`
3. **Standard pattern** (majority): `Diem chuan`/`Ma nganh`/`To hop` with Vietnamese diacritics variants

Non-cheerio entries retain no `factory_config`: `MINISTRY` (special structure), `GHA` (PaddleOCR), `DCN` (Playwright).

### tests/scraper/factory.test.ts
6 tests with mocked `fetchHTML`, covering:
1. HTC-style first-row-td header extraction with `defaultTohop`
2. Section header row skipping (non-numeric major codes)
3. Tohop column extraction via `tohopKeywords`
4. 0-rows throw containing '0 rows' in message
5. `th`/`thead` header detection for standard table pattern
6. `defaultTohop` fallback when `tohopKeywords` not configured

## Deviations from Plan

None — plan executed exactly as written.

## Test Results

- Factory test suite: 6/6 passed
- Full scraper suite: 375/375 passed
- Full codebase: 472/472 passed — zero regressions

## Self-Check

- [x] lib/scraper/factory.ts exists
- [x] lib/scraper/registry.ts updated with factory_config branch
- [x] scrapers.json HTC entry has factory_config with defaultTohop: "A00"
- [x] tests/scraper/factory.test.ts exists with 6 tests
- [x] All tests pass (472/472)
