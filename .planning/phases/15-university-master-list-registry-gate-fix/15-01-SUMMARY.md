---
phase: 15-university-master-list-registry-gate-fix
plan: "01"
subsystem: scraper/registry
tags: [scraper, registry, schema-migration, tdd]
dependency_graph:
  requires: []
  provides: [registry-gate-scrape_url, scrapers-json-new-schema]
  affects: [lib/scraper/registry.ts, lib/scraper/run.ts, scrapers.json]
tech_stack:
  added: []
  patterns: [TDD red-green, vi.mock hoisted mocks, vi.resetModules per test]
key_files:
  created:
    - tests/scraper/registry.test.ts
  modified:
    - scrapers.json
    - lib/scraper/registry.ts
    - lib/scraper/run.ts
decisions:
  - "scrapers.json url field renamed to website_url; scrape_url is now the authoritative URL passed to adapters"
  - "Registry gate checks scrape_url presence, not static_verified boolean"
  - "MINISTRY/KHA/NTH marked adapter_type=skip to prevent runtime load attempts"
  - "SPH marked adapter_type=playwright with scrape_url=null (pending Playwright impl)"
metrics:
  duration_seconds: 331
  completed_date: "2026-03-20"
  tasks_completed: 2
  files_modified: 4
---

# Phase 15 Plan 01: Registry Gate Fix + scrapers.json Schema Migration Summary

Registry gate replaced: `static_verified` boolean removed from all 79 scrapers.json entries; new `scrape_url` presence check activates only the 4 verified adapters (GHA, DCN, BVH, HTC) with known cutoff page URLs.

## What Was Built

- **`tests/scraper/registry.test.ts`** — 5 vitest unit tests covering the new gate logic: loads entries with non-null scrape_url, skips null scrape_url entries (logging "no scrape_url yet"), skips adapter_type=skip entries, verifies scrape_url (not website_url) is passed to resolved entries, and verifies MINISTRY is never loaded.
- **`scrapers.json` (schema migration)** — All 79 entries migrated: `url` renamed to `website_url`, `scrape_url` added (null for 74 unverified entries, populated for 4 verified), `adapter_type` added (`cheerio`/`playwright`/`paddleocr`/`skip`/`pending`), `static_verified` and `scraping_method` fields removed.
- **`lib/scraper/registry.ts`** — `RegistryEntry` interface updated to new schema; gate logic replaced with `!entry.scrape_url || entry.adapter_type === 'skip'` check; `resolved.push` uses `entry.scrape_url` instead of `entry.url`.
- **`lib/scraper/run.ts`** — Warning message updated from `static_verified=true` reference to `scrape_url configured` reference.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create registry gate unit tests + migrate scrapers.json schema | 0577e38 | tests/scraper/registry.test.ts, scrapers.json |
| 2 | Fix registry.ts gate logic and update run.ts warning | c1b67e3 | lib/scraper/registry.ts, lib/scraper/run.ts |

## Verification Results

- `npx vitest run tests/scraper/registry.test.ts` — 5 tests pass
- `npx vitest run` — 578 tests pass across 32 files (no regressions)
- `grep -c static_verified scrapers.json` — returns 0
- `grep -c scrape_url scrapers.json` — returns 78 (one per non-MINISTRY entry)
- `grep -c adapter_type scrapers.json` — returns 78
- `node -e "...filter(e=>e.scrape_url).length"` — returns 4 (GHA, DCN, BVH, HTC)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- tests/scraper/registry.test.ts — FOUND
- lib/scraper/registry.ts — FOUND
- lib/scraper/run.ts — FOUND
- Commit 0577e38 — FOUND
- Commit c1b67e3 — FOUND
