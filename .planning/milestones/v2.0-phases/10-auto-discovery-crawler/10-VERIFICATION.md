---
phase: 10-auto-discovery-crawler
verified: 2026-03-18T23:41:00Z
status: passed
score: 12/12 must-haves verified
re_verification: false
---

# Phase 10: Auto-Discovery Crawler Verification Report

**Phase Goal:** Running the discovery crawler against university homepages produces a ranked list of candidate cutoff-page URLs in a review file — without touching scrapers.json or the production database
**Verified:** 2026-03-18T23:41:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Keyword scorer returns high scores for HTML pages containing cutoff tables with Vietnamese keywords | VERIFIED | Test 4 (TABLE_WEIGHT=5) and Test 5 (score >= 11) pass; `scorePageForCutoffs` inspects table th/td cells for HEADING_KEYWORDS |
| 2 | Keyword scorer returns low or zero scores for generic news pages | VERIFIED | Test 6 asserts score=0 for body-text-only mention; body text is explicitly excluded from scoring |
| 3 | URL slug keywords boost score significantly | VERIFIED | Test 1 asserts score >= URL_SLUG_WEIGHT (3); URL_SLUG_WEIGHT=3 equals SCORE_THRESHOLD itself |
| 4 | Table detection with score-column headers is the strongest signal | VERIFIED | TABLE_WEIGHT=5 is the highest single weight constant; confirmed in constants.ts |
| 5 | DiscoveryCandidate type exists with url, universityId, score, reasons fields | VERIFIED | `candidate.ts` exports exact interface with all 4 fields |
| 6 | Running discover.ts against fake university homepages produces a ranked list of URL candidates | VERIFIED | Integration test 1 passes: 5 tests pass with MSW fake homepages; results sorted descending by score |
| 7 | Pages disallowed by robots.txt do not appear in discovery output | VERIFIED | Integration test 2 passes: MSW would throw on unhandled request if crawler fetched blocked URL; test passes without error |
| 8 | The crawler uses a 2-second per-domain delay between requests | VERIFIED | `sameDomainDelaySecs: 2` at line 188 in scripts/discover.ts |
| 9 | The crawler only follows same-hostname links matching Vietnamese slug patterns | VERIFIED | `strategy: 'same-hostname'` with 7 Vietnamese slug globs at lines 211-219 |
| 10 | Output goes to discovery-candidates.json only — scrapers.json is never written | VERIFIED | `writeFileSync` targets `discovery-candidates.json` only (line 289); scrapers.json is only read via `readFileSync` (line 259) |
| 11 | Candidates are sorted descending by score | VERIFIED | `.sort((a, b) => b.score - a.score)` at line 248 |
| 12 | Candidates below SCORE_THRESHOLD are excluded | VERIFIED | `.filter((c) => c.score >= SCORE_THRESHOLD)` at line 247; integration test 3 verifies this behavior |

**Score:** 12/12 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/scraper/discovery/candidate.ts` | DiscoveryCandidate interface | VERIFIED | 6 lines; exports `interface DiscoveryCandidate` with url, universityId, score, reasons |
| `lib/scraper/discovery/constants.ts` | Keyword arrays and score threshold | VERIFIED | 46 lines; exports SCORE_THRESHOLD=3, URL_SLUG_WEIGHT=3, TITLE_WEIGHT=2, HEADING_WEIGHT=1, TABLE_WEIGHT=5, and all four keyword arrays |
| `lib/scraper/discovery/keyword-scorer.ts` | scorePageForCutoffs pure function | VERIFIED | 80 lines; exports `scorePageForCutoffs(url, $)` importing from ./constants |
| `tests/scraper/discovery/keyword-scorer.test.ts` | Unit tests for keyword scorer (min 40 lines) | VERIFIED | 124 lines; 8 tests covering all scoring signals |
| `scripts/discover.ts` | Discovery crawler entry point with CheerioCrawler | VERIFIED | 299 lines; contains CheerioCrawler, FetchHttpClient, runDiscover export, main block |
| `tests/scraper/discovery/discover.test.ts` | Integration tests with MSW fake homepages (min 60 lines) | VERIFIED | 315 lines; 5 integration tests covering all specified scenarios |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `lib/scraper/discovery/keyword-scorer.ts` | `lib/scraper/discovery/constants.ts` | import keyword arrays | VERIFIED | Line 2-11: named imports of all keyword arrays and weights from `./constants` |
| `scripts/discover.ts` | `lib/scraper/discovery/keyword-scorer.ts` | import scorePageForCutoffs | VERIFIED | Line 15: `import { scorePageForCutoffs } from '../lib/scraper/discovery/keyword-scorer'` |
| `scripts/discover.ts` | `scrapers.json` | readFileSync to load university homepage URLs | VERIFIED | Line 259: `readFileSync(configPath, 'utf-8')` where configPath resolves to `scrapers.json` — read-only |
| `scripts/discover.ts` | `discovery-candidates.json` | fs.writeFile output | VERIFIED | Line 289: `writeFileSync(outputPath, ...)` where outputPath resolves to `discovery-candidates.json` |
| `tests/scraper/discovery/discover.test.ts` | `tests/scraper/integration/msw-server.ts` | import MSW server singleton | VERIFIED | Line 3: `import { server } from '../integration/msw-server'` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SCRP-04 | 10-01-PLAN, 10-02-PLAN | Auto-discovery crawler scans university homepages and outputs ranked cutoff-page URL candidates to a review file | SATISFIED | `scripts/discover.ts` reads scrapers.json homepages, scores pages, writes ranked candidates to `discovery-candidates.json`; integration tests verify ranking behavior with 3 fake universities |
| SCRP-05 | 10-02-PLAN | Auto-discovery enforces per-domain rate limiting and robots.txt compliance | SATISFIED | `sameDomainDelaySecs: 2` (line 188) for rate limiting; `respectRobotsTxtFile: { userAgent: 'UniSelectBot/1.0' }` (line 189) for robots.txt; integration test 2 verifies robots.txt compliance by asserting blocked URL is never fetched |

No orphaned requirements found — REQUIREMENTS.md maps both SCRP-04 and SCRP-05 to Phase 10 and both are covered by plans 10-01 and 10-02.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None found | — | — |

No TODOs, FIXMEs, placeholder returns, empty handlers, or stub implementations detected in any phase 10 files.

---

### Human Verification Required

None. All phase 10 behaviors are fully verifiable programmatically:
- Scoring logic verified by 8 unit tests (all pass)
- Crawler integration verified by 5 integration tests (all pass)
- No UI components, visual output, or external live services involved

---

### Test Execution Results

**Keyword scorer unit tests:**
- `npx vitest run tests/scraper/discovery/keyword-scorer.test.ts` — 8/8 tests pass

**Discover integration tests:**
- `npx vitest run tests/scraper/discovery/discover.test.ts` — 5/5 tests pass

**Notes from test run:**
- Test "returns empty array when no candidates found" shows WARN log `Failed to fetch robots.txt for request https://fake-uni-empty.test/` — this is expected behavior when MSW intercepts robots.txt fetches in that specific test configuration; the test still passes and returns an empty array as asserted.
- Tests run with 30-second timeout per describe block (CheerioCrawler startup overhead).

---

### Package Installation

```
@crawlee/cheerio@3.16.0 (devDependency) — installed
@crawlee/memory-storage@3.16.0 (devDependency) — installed
```

### .gitignore

`discovery-candidates.json` is present in `.gitignore` (ephemeral output file, never committed).

---

### Summary

Phase 10 goal is fully achieved. The discovery crawler (`scripts/discover.ts`) correctly:

1. Reads university homepage URLs from scrapers.json (read-only)
2. Crawls same-hostname links matching Vietnamese slug patterns
3. Scores pages using the keyword scorer from Plan 01
4. Respects robots.txt and enforces 2-second per-domain rate limiting
5. Writes ranked candidates (score >= 3) to `discovery-candidates.json` only
6. Never writes to scrapers.json or any production database

All 12 observable truths verified. Both SCRP-04 and SCRP-05 satisfied. 13 tests pass (8 unit + 5 integration).

---

_Verified: 2026-03-18T23:41:00Z_
_Verifier: Claude (gsd-verifier)_
