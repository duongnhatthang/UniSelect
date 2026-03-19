---
phase: 10-auto-discovery-crawler
plan: "02"
subsystem: discovery-crawler
tags: [crawlee, msw, robots-txt, rate-limiting, integration-tests]
dependency_graph:
  requires: [10-01]
  provides: [scripts/discover.ts, tests/scraper/discovery/discover.test.ts]
  affects: [discovery-candidates.json]
tech_stack:
  added: [FetchHttpClient (native fetch adapter for CheerioCrawler)]
  patterns: [CheerioCrawler with custom HttpClient for MSW test interception]
key_files:
  created:
    - scripts/discover.ts
    - tests/scraper/discovery/discover.test.ts
  modified: []
decisions:
  - "FetchHttpClient wraps native fetch instead of got-scraping so MSW can intercept all crawlee requests in tests (robots.txt + page fetches)"
  - "httpClient option passed to CheerioCrawler constructor when useMemoryStorage:true — production runs still use default got-scraping for stealth headers"
metrics:
  duration_seconds: 355
  completed_date: "2026-03-19"
  tasks_completed: 2
  files_created: 2
---

# Phase 10 Plan 02: Discovery Crawler + Integration Tests Summary

**One-liner:** CheerioCrawler-based discovery script with FetchHttpClient adapter enabling MSW test interception for robots.txt-compliant, rate-limited Vietnamese university URL ranking.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create discover.ts crawler script | 2d29f7c | scripts/discover.ts |
| 2 | Integration tests with MSW fake university homepages | 5ea53c5 | tests/scraper/discovery/discover.test.ts, scripts/discover.ts (FetchHttpClient) |

## What Was Built

### scripts/discover.ts

Standalone auto-discovery script that:
- Exports `runDiscover(startUrls, options)` for testable integration
- Uses `CheerioCrawler` with `sameDomainDelaySecs: 2`, `respectRobotsTxtFile: { userAgent: 'UniSelectBot/1.0' }`, `maxConcurrency: 1`, `maxRequestsPerCrawl: 50`
- Follows same-hostname links matching Vietnamese URL slug globs (`diem-chuan*`, `diem-trung-tuyen*`, `tuyen-sinh*`, etc.)
- Scores pages via `scorePageForCutoffs()` from Plan 01
- Filters by `SCORE_THRESHOLD=3`, sorts descending by score, deduplicates by URL
- Writes output to `discovery-candidates.json` only — never writes to `scrapers.json`
- Includes `FetchHttpClient` (native fetch adapter) for MSW test interception
- Main block reads `scrapers.json`, extracts unique homepage origins, runs discovery

### tests/scraper/discovery/discover.test.ts

5 integration tests with MSW fake university homepages:
1. Ranked candidates from 3 fake homepages (A: diem-chuan, B: tuyen-sinh/diem-trung-tuyen, C: no cutoff links)
2. robots.txt disallowed pages excluded (MSW throws if crawler attempts blocked URL)
3. Below-SCORE_THRESHOLD candidates filtered from output
4. URL deduplication — same URL from multiple links appears once
5. Empty array when no cutoff candidates found

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CheerioCrawler uses got-scraping which bypasses MSW interception**

- **Found during:** Task 2 (first test run)
- **Issue:** CheerioCrawler uses `got-scraping` (not native Node.js `http/https`) for all requests including robots.txt. MSW 2.x with `@mswjs/interceptors` intercepts native fetch and `http/https` module but NOT `got-scraping`. All 3 fake domains returned `getaddrinfo ENOTFOUND` DNS errors.
- **Fix:** Implemented `FetchHttpClient` class (implements `BaseHttpClient` interface) that wraps native `fetch`. When `useMemoryStorage: true`, CheerioCrawler receives this custom `httpClient` option. Production mode continues using the default `GotScrapingHttpClient` for stealth header generation.
- **Files modified:** `scripts/discover.ts` (added `FetchHttpClient`, threaded through `httpClient` option)
- **Commit:** 5ea53c5

## Verification Results

- `npx vitest run tests/scraper/discovery/` — 13 tests passing (2 files: keyword-scorer + discover)
- `npx vitest run` — 492 tests passing, zero regressions
- `grep "sameDomainDelaySecs: 2" scripts/discover.ts` — matches
- `grep "respectRobotsTxtFile" scripts/discover.ts` — matches
- `scripts/discover.ts` reads `scrapers.json` but never writes to it

## Self-Check

### Files exist:
- scripts/discover.ts — FOUND
- tests/scraper/discovery/discover.test.ts — FOUND
- .planning/phases/10-auto-discovery-crawler/10-02-SUMMARY.md — FOUND (this file)

### Commits exist:
- 2d29f7c — feat(10-02): create discover.ts CheerioCrawler discovery script
- 5ea53c5 — feat(10-02): integration tests for discover.ts with MSW fake homepages

## Self-Check: PASSED
