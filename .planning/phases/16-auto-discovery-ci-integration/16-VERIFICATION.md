---
phase: 16-auto-discovery-ci-integration
verified: 2026-03-20T08:30:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 16: Auto-Discovery CI Integration Verification Report

**Phase Goal:** The auto-discovery crawler runs automatically every week via GitHub Actions, producing a reviewed candidate list of cutoff page URLs that can be applied to scrapers.json through a human-gated script
**Verified:** 2026-03-20T08:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `.github/workflows/discover.yml` exists and runs on weekly cron and workflow_dispatch | VERIFIED | File exists; contains `cron: '0 2 * * 0'` and `workflow_dispatch` trigger |
| 2 | Each run produces `discovery-candidates.json` artifact with ranked URL candidates | VERIFIED | `discover.yml` uploads artifact `discovery-candidates` via `actions/upload-artifact@v4`; `discover.ts` writes ranked, filtered candidates to `discovery-candidates.json` |
| 3 | `scripts/apply-discovery.ts` patches scrapers.json — entries with existing `scrape_url` are never overwritten | VERIFIED | Guard at line 47: `if (entry.scrape_url !== null) { return entry; }` — confirmed by 3 passing unit tests |
| 4 | After manual dispatch, some scrapers.json entries can get non-null `scrape_url` from discovery | VERIFIED | `applyDiscovery()` sets `entry.scrape_url = candidate.url` and `entry.adapter_type = 'cheerio'` for eligible entries; confirmed by unit test at line 35 |
| 5 | `apply-discovery.ts` is human-gated — not referenced in any CI workflow | VERIFIED | `grep -rn "apply-discovery" .github/workflows/` returns 0 matches |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.github/workflows/discover.yml` | Weekly discovery GHA workflow | VERIFIED | 29-line workflow; cron `0 2 * * 0`, workflow_dispatch, npx tsx invocation, upload-artifact@v4, `if-no-files-found: warn`, 30-day retention |
| `scripts/discover.ts` | Schema-migrated discovery crawler | VERIFIED | Updated `ScraperEntry` interface uses `website_url`, `scrape_url`, `adapter_type`; `buildStartUrlsFromScrapers()` reads `entry.website_url`; both skip guards present |
| `tests/scraper/discovery/discover.test.ts` | Integration tests for discovery crawler | VERIFIED | 5 MSW-based integration tests; all pass |
| `scripts/apply-discovery.ts` | Human-gated script to patch scrapers.json | VERIFIED | Exports pure `applyDiscovery()` function; both guards present; sets `adapter_type = 'cheerio'` on patch |
| `tests/scripts/apply-discovery.test.ts` | Unit tests for apply-discovery guards | VERIFIED | 7 unit tests; all pass; contains "never overwrites" (2 occurrences) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `.github/workflows/discover.yml` | `scripts/discover.ts` | `npx tsx scripts/discover.ts` | WIRED | Exact invocation at workflow line 21 |
| `scripts/discover.ts` | `scrapers.json` | `readFileSync + JSON.parse` | WIRED | `buildStartUrlsFromScrapers()` reads `configPath = resolve(process.cwd(), 'scrapers.json')` and parses as `ScraperEntry[]` |
| `scripts/discover.ts` | `discovery-candidates.json` | `writeFileSync` | WIRED | Main block writes `JSON.stringify(candidates, null, 2)` to `outputPath` after crawl |
| `scripts/apply-discovery.ts` | `scrapers.json` | `readFileSync + writeFileSync` | WIRED | Main block reads scrapers.json, calls `applyDiscovery()`, writes result back |
| `scripts/apply-discovery.ts` | `discovery-candidates.json` | `readFileSync` | WIRED | Main block reads from `candidatesPath` (arg or default cwd path) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DISC-01 | 16-01-PLAN.md | Auto-discovery crawler runs as a GHA workflow (weekly cron + manual dispatch) | SATISFIED | `discover.yml` exists with correct triggers; commit `e1a7ffd` |
| DISC-02 | 16-01-PLAN.md | Discovery output produces ranked candidate list reviewable before applying to scrapers.json | SATISFIED | `runDiscover()` filters by `SCORE_THRESHOLD` and sorts descending; writes JSON artifact; 5 integration tests pass |
| DISC-03 | 16-02-PLAN.md | apply-discovery script patches scrapers.json with discovery output (human-gated, not automatic) | SATISFIED | `apply-discovery.ts` is standalone script with usage comment; not called from any CI; 7 unit tests pass |

No orphaned DISC requirements found — all three map to a plan and all have implementation evidence.

### Anti-Patterns Found

No blockers or warnings detected in phase-modified files.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No TODO/FIXME/placeholder patterns found | — | — |

Checked: `scripts/discover.ts`, `.github/workflows/discover.yml`, `scripts/apply-discovery.ts`, `tests/scripts/apply-discovery.test.ts`, `tests/scraper/discovery/discover.test.ts`.

Old schema fields confirmed absent: `entry.url` occurrence count in `discover.ts` = 0; `static_verified` occurrence count = 0.

### Human Verification Required

#### 1. Live GHA Workflow Run

**Test:** Manually dispatch `discover.yml` from the GitHub Actions tab
**Expected:** Workflow completes without error; `discovery-candidates` artifact appears in the run summary with a non-empty JSON file containing ranked URL candidates
**Why human:** Cannot verify GHA execution or artifact upload programmatically from the local codebase

#### 2. End-to-End Patch Round-Trip

**Test:** Download `discovery-candidates.json` artifact from a completed dispatch run; run `npx tsx scripts/apply-discovery.ts path/to/discovery-candidates.json`; inspect `scrapers.json` diff
**Expected:** Only entries with `scrape_url: null` and `adapter_type != "skip"` are modified; existing `scrape_url` values are untouched; patched entries have `adapter_type: "cheerio"`
**Why human:** Requires a real artifact from a live GHA run to validate the round-trip

### Gaps Summary

No gaps. All five success criteria are met, all three DISC requirements are satisfied, all key links are wired, and both test suites pass (5 integration tests for `discover.ts`, 7 unit tests for `apply-discovery.ts`). Two items are flagged for human verification — they require a live GHA dispatch — but they do not block the phase from being considered complete since the underlying logic is fully tested locally.

---

_Verified: 2026-03-20T08:30:00Z_
_Verifier: Claude (gsd-verifier)_
