---
phase: 07-adapter-verification
plan: "01"
subsystem: scraper
tags: [adapter, verification, bvh, ptit, tdd, scrapers-json]
dependency_graph:
  requires: []
  provides: [scripts/verify-adapters.ts, lib/scraper/adapters/bvh.ts, tests/scraper/adapters/bvh.test.ts]
  affects: [scrapers.json, scraper pipeline registry]
tech_stack:
  added: []
  patterns: [TDD red-green, cheerio table parsing, THPT column detection]
key_files:
  created:
    - scripts/verify-adapters.ts
    - tests/scraper/adapters/bvh.test.ts
  modified:
    - lib/scraper/adapters/bvh.ts
    - scrapers.json
decisions:
  - "BVH adapter matches 'thpt' keyword first in scoreIdx — PTIT uses THPT (100) as column name, not generic diem chuan"
  - "tohop_raw emits empty string for PTIT table (no tohop column) — normalizer handles empty string gracefully"
  - "Row filtering skips non-numeric majorCode entries using /^\\d/.test() — prevents section header rows from producing garbage RawRows"
  - "SPH and TLA entries get candidate tuyensinh URLs but static_verified remains false until Plan 02 confirms table presence"
  - "KHA and NTH entries annotated as PDF/Google Drive — permanently not viable for cheerio scraping"
metrics:
  duration: 2min
  completed_date: "2026-03-18"
  tasks: 2
  files: 4
---

# Phase 7 Plan 01: Adapter Verification Script and BVH Fix Summary

**One-liner:** Verification script probing 9 candidates + BVH adapter fixed to parse PTIT THPT (100) column with full TDD cycle, scrapers.json updated to enable static_verified for HTC and BVH.

## What Was Built

### scripts/verify-adapters.ts
URL verification script that probes 9 candidate university URLs (HTC, BVH, DCN, GHA, BKA, KHA, NTH, SPH, TLA) and reports HTTP status, table presence, diem_chuan keyword match, and `<tr>` count per candidate. Exits 0 even if individual URLs fail — report-only, not a gate. Prints "STATIC HTML CANDIDATES" section at end listing IDs where `table=true AND tr_count >= 5`.

### lib/scraper/adapters/bvh.ts (updated)
Fixed to parse PTIT's actual table format. The PTIT tuyensinh page uses column "THPT (100)" for standard exam scores — not the generic "Diem chuan" the old adapter searched for. Updated header matching, added digit-only major code filtering, and set tohop_raw to empty string (PTIT has no tohop column).

### tests/scraper/adapters/bvh.test.ts
11 behavioral tests following bka.test.ts pattern. Fixture HTML mirrors PTIT's actual 9-column table structure with THPT (100) column. Tests verify: 3 rows returned, university_id=BVH, correct THPT score extraction, correct major codes from column index 1, empty tohop_raw, correct source_url, and error thrown on no-table HTML.

### scrapers.json (updated)
- BVH: URL updated to `tuyensinh.ptit.edu.vn/gioi-thieu/xem-diem-cac-nam-truoc/diem-trung-tuyen-2024/`, `static_verified: true`
- KHA: note annotated "Scores published as PDF download -- requires PDF parsing. Not viable for cheerio scraping."
- NTH: note annotated "Scores published via Google Drive link -- not viable for direct scraping."
- SPH: URL updated to `https://hnue.edu.vn/Tuyensinh` (candidate for Plan 02)
- TLA: URL updated to `https://www.tlu.edu.vn/tuyen-sinh` (candidate for Plan 02)

## Verification Results

```
npx vitest run tests/scraper/adapters/bvh.test.ts   → 11/11 passed
npx vitest run tests/scraper/adapters/adapter-contract.test.ts → 323/323 passed
grep -c '"static_verified": true' scrapers.json     → 2 (HTC + BVH)
grep 'tuyensinh.ptit.edu.vn' scrapers.json          → match found
grep 'hnue.edu.vn' scrapers.json                    → match found
grep 'tlu.edu.vn' scrapers.json                     → match found
```

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 RED | e6b3e33 | test(07-01): add failing BVH adapter tests and verify-adapters script |
| Task 2 GREEN | 985788a | feat(07-01): fix BVH adapter for PTIT THPT column and update scrapers.json |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED
