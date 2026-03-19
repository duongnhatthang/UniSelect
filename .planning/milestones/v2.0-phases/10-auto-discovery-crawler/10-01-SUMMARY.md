---
phase: 10-auto-discovery-crawler
plan: 01
subsystem: scraper
tags: [crawlee, cheerio, crawler, discovery, vietnamese-keywords, tdd, vitest]

# Dependency graph
requires:
  - phase: 09-scraper-resilience-testing
    provides: MSW test infrastructure and scraper integration test patterns

provides:
  - DiscoveryCandidate interface (url, universityId, score, reasons)
  - Keyword constants with score weights (URL_SLUG_WEIGHT=3, TITLE_WEIGHT=2, HEADING_WEIGHT=1, TABLE_WEIGHT=5)
  - scorePageForCutoffs pure function scoring HTML pages for Vietnamese cutoff-score signals
  - @crawlee/cheerio and @crawlee/memory-storage dev dependencies installed
  - .gitignore entry for ephemeral discovery-candidates.json

affects:
  - 10-02 (auto-discovery crawler script that uses scorePageForCutoffs)

# Tech tracking
tech-stack:
  added:
    - "@crawlee/cheerio@3.16.0 (dev) — CheerioCrawler for auto-discovery script (Plan 02)"
    - "@crawlee/memory-storage@3.16.0 (dev) — in-memory storage for test isolation"
  patterns:
    - "Pure function scoring: scorePageForCutoffs(url, $) returns { score, reasons } with no side effects"
    - "Weighted signal scoring: URL slug > title > heading > table detection, body text excluded"
    - "TDD: RED (failing test commit) then GREEN (implementation commit) sequence"

key-files:
  created:
    - lib/scraper/discovery/candidate.ts
    - lib/scraper/discovery/constants.ts
    - lib/scraper/discovery/keyword-scorer.ts
    - tests/scraper/discovery/keyword-scorer.test.ts
  modified:
    - package.json (added @crawlee/cheerio, @crawlee/memory-storage devDependencies)
    - package-lock.json
    - .gitignore (added discovery-candidates.json)

key-decisions:
  - "scorePageForCutoffs receives CheerioAPI instance (not HTML string) — caller controls parsing, scorer stays pure"
  - "Body text deliberately excluded from scoring — only URL slugs, page titles, h1/h2/h3, and table headers count to avoid noise from news articles"
  - "TABLE_WEIGHT=5 is the strongest single signal — a page with a score table should always exceed SCORE_THRESHOLD=3"
  - "TABLE_HEADER_KEYWORDS reuses HEADING_KEYWORDS — same terms appear in both headings and table columns across all 78 scrapers.json entries"

patterns-established:
  - "Pattern 1: Signal-based scoring — each signal type has a named weight constant in constants.ts enabling future tuning without code changes"
  - "Pattern 2: Reasons array transparency — every score contribution appends a reason string (url:kw, title:kw, heading:kw, table:score-columns-detected) for debugging output"

requirements-completed: [SCRP-04]

# Metrics
duration: 4min
completed: 2026-03-19
---

# Phase 10 Plan 01: Keyword Scorer Foundation Summary

**Crawlee packages installed and Vietnamese cutoff-score keyword scorer implemented as a pure function with TDD (8 tests covering URL slugs, titles, headings, tables, noise rejection, and empty input)**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-19T06:27:58Z
- **Completed:** 2026-03-19T06:31:30Z
- **Tasks:** 2 (with 3 commits: chore + test RED + feat GREEN)
- **Files modified:** 7

## Accomplishments
- Installed @crawlee/cheerio@3.16.0 and @crawlee/memory-storage@3.16.0 as dev dependencies for use in Plan 02
- Created DiscoveryCandidate interface and keyword constants with all scoring weights derived from 78 scrapers.json entries
- Implemented scorePageForCutoffs pure function with weighted signal detection (URL slug 3pts, title 2pts, heading 1pt, table 5pts)
- 8 unit tests pass; full 487-test suite green with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Crawlee packages, create types and constants, update .gitignore** - `cefa2c6` (chore)
2. **Task 2: TDD RED — keyword scorer test file** - `7ca382a` (test)
3. **Task 2: TDD GREEN — keyword scorer implementation** - `633572f` (feat)

_Note: TDD task has two commits (test RED commit + feat GREEN commit)_

## Files Created/Modified
- `lib/scraper/discovery/candidate.ts` - DiscoveryCandidate interface (url, universityId, score, reasons)
- `lib/scraper/discovery/constants.ts` - Keyword arrays and scoring weight constants
- `lib/scraper/discovery/keyword-scorer.ts` - Pure function scorePageForCutoffs(url, $)
- `tests/scraper/discovery/keyword-scorer.test.ts` - 8 unit tests covering all scoring signals
- `package.json` - Added @crawlee/cheerio and @crawlee/memory-storage devDependencies
- `package-lock.json` - Lockfile updated
- `.gitignore` - Added discovery-candidates.json

## Decisions Made
- scorePageForCutoffs accepts CheerioAPI instance rather than HTML string — caller controls parsing, scorer stays side-effect free
- Body text excluded from scoring — only URL, title, h1/h2/h3, and table headers are checked to avoid false positives from news articles mentioning cutoff scores
- TABLE_HEADER_KEYWORDS reuses HEADING_KEYWORDS array — same Vietnamese terms appear in both contexts across all 78 scrapers.json entries
- SCORE_THRESHOLD=3 means a single URL slug match alone qualifies a page as a candidate

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- scorePageForCutoffs is ready for use in Plan 02 (discover.ts crawler script)
- @crawlee/cheerio and @crawlee/memory-storage are installed for Plan 02 CheerioCrawler implementation
- DiscoveryCandidate type is ready for the output format in Plan 02
- SCORE_THRESHOLD constant is available for filtering candidates in Plan 02

---
*Phase: 10-auto-discovery-crawler*
*Completed: 2026-03-19*

## Self-Check: PASSED

- FOUND: lib/scraper/discovery/candidate.ts
- FOUND: lib/scraper/discovery/constants.ts
- FOUND: lib/scraper/discovery/keyword-scorer.ts
- FOUND: tests/scraper/discovery/keyword-scorer.test.ts
- FOUND: commit cefa2c6 (chore: install Crawlee packages)
- FOUND: commit 7ca382a (test: RED phase)
- FOUND: commit 633572f (feat: GREEN phase)
