---
phase: 18-tohop-coverage-infrastructure-scale
verified: 2026-03-20T09:00:00Z
status: human_needed
score: 11/12 must-haves verified
human_verification:
  - test: "Trigger a scrape run against a real wide-table university (one whose cutoff page publishes A00/A01/D01 columns). Inspect the database rows afterward."
    expected: "Multiple rows exist for the same major_raw — one row per non-empty to hop column — each with a distinct tohop_raw value (e.g., A00, A01). No row has an empty score_raw."
    why_human: "Requires a live network scrape against a real university website and database inspection. Cannot verify from static code analysis alone."
  - test: "Trigger workflow_dispatch on scrape-low.yml and inspect the GHA job list."
    expected: "24 jobs appear in the run (shards 0–19 for cheerio, shards 0–1 for playwright, shards 0–1 for paddleocr). Playwright jobs show browser install steps; cheerio jobs skip them. PaddleOCR jobs show pip install; cheerio jobs skip it."
    why_human: "Requires an actual GHA run to confirm conditional step guards behave correctly at runtime. Static YAML analysis verifies the conditions are written; only a live run verifies GHA evaluates them correctly."
  - test: "Monitor a July-peak simulated run (or review prior run logs) to confirm no single shard job exceeds 300 minutes."
    expected: "All 24 jobs complete within 300 minutes. With 400 universities split across 20 cheerio shards that is approximately 20 universities per shard, well within the limit assuming each cheerio scrape takes under 15 minutes per university."
    why_human: "The 300-minute per-shard bound is a capacity claim. The math (400 unis / 20 shards = 20 unis per shard) gives high confidence but actual timing depends on network conditions and page complexity. Cannot be verified without a live GHA run or timing data."
---

# Phase 18: To Hop Coverage and Infrastructure Scale — Verification Report

**Phase Goal:** The scraper captures all to hop combinations from universities that publish wide-table format cutoff pages, and the GitHub Actions shard count is high enough that 400+ universities complete within per-job timeout limits with Playwright and OCR adapters safely isolated.

**Verified:** 2026-03-20T09:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Wide-table HTML (one column per to hop) produces one RawRow per major per to hop column | VERIFIED | `factory.ts` lines 56–88: wide-table guard detects `[A-D]\d{2}` headers and emits one row per non-empty cell; test in `factory.test.ts` asserts 4 rows from 2-major x 3-col fixture with 2 empty cells |
| 2 | Empty to hop cells are silently skipped — no rows with missing score_raw | VERIFIED | `factory.ts` line 76: `if (!scoreRaw \|\| !/\d/.test(scoreRaw)) continue;`; test at line 168–178 of `factory.test.ts` asserts no row has empty `score_raw` and D01/7480201, A01/7520201 are absent |
| 3 | Existing narrow-table adapters continue to work unchanged | VERIFIED | `factory.ts` line 90 onward: narrow-table path follows unchanged after `if (config.wideTable) { ... return; }` guard; regression test at line 181–195 of `factory.test.ts` passes (2 rows from standardHtml) |
| 4 | The wideTable flag is opt-in via factory_config — default behavior is narrow-table | VERIFIED | `CheerioAdapterConfig.wideTable?: boolean` (optional, undefined = falsy); guard at line 56 only triggers when explicitly `true` |
| 5 | SHARD_TYPE=cheerio filters registry to only cheerio adapters before sharding | VERIFIED | `run.ts` line 14–16: `registry.filter((e) => e.adapterType === shardType)`; `run.test.ts` line 22–26 asserts 3 of 5 entries returned |
| 6 | SHARD_TYPE=playwright filters registry to only playwright adapters | VERIFIED | `run.test.ts` line 28–32 asserts 1 entry with id='uni-4' returned |
| 7 | SHARD_TYPE=paddleocr filters registry to only paddleocr adapters | VERIFIED | `run.test.ts` line 34–38 asserts 1 entry with id='uni-5' returned |
| 8 | SHARD_TYPE=all or unset includes all adapter types (backward compatible) | VERIFIED | `run.ts` line 12–13: `shardType === 'all' ? registry : ...`; default env value is 'all' (line 33); `run.test.ts` line 40–43 asserts all 5 returned |
| 9 | Workflow matrix has 24 jobs: 20 cheerio + 2 playwright + 2 paddleocr | VERIFIED | Both `scrape-low.yml` and `scrape-peak.yml` contain `strategy.matrix.include` with exactly 24 explicit objects (lines 18–43 in both files) |
| 10 | Playwright setup steps only run on playwright shards | VERIFIED | `scrape-low.yml` lines 54, 62, 65: all three Playwright steps carry `if: matrix.shard_type == 'playwright'`; same in `scrape-peak.yml` |
| 11 | PaddleOCR setup steps only run on paddleocr shards | VERIFIED | `scrape-low.yml` lines 68, 73, 81, 84: all four PaddleOCR steps carry `if: matrix.shard_type == 'paddleocr'`; same in `scrape-peak.yml` |
| 12 | A real wide-table university has all to hop stored as separate rows | ? NEEDS HUMAN | Requires live scrape + database inspection — see Human Verification section |

**Score:** 11/12 truths verified (1 requires human testing)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/scraper/factory.ts` | Wide-table parsing path in `createCheerioAdapter` | VERIFIED | 129 lines; `wideTable?: boolean` at line 11; guard block lines 56–88; contains `wideTable`, `tohopCols`, `/^[A-D]\d{2}$/` |
| `tests/scraper/fixtures/wide-table.html` | Synthetic fixture: 2 majors x 3 to hop columns with empty cells | VERIFIED | 33 lines; thead with A00/A01/D01 headers; 7480201 row with D01 empty; 7520201 row with A01 empty |
| `tests/scraper/factory.test.ts` | Wide-table test cases | VERIFIED | 213 lines; 4 wide-table tests in `describe('createCheerioAdapter — wide-table', ...)` starting line 143; `wideTable` appears 10 times |
| `lib/scraper/registry.ts` | ResolvedEntry with adapterType field | VERIFIED | `ResolvedEntry` exported at line 17; `adapterType: string` field at line 21; populated at line 48 with default 'cheerio' |
| `lib/scraper/run.ts` | SHARD_TYPE env var filtering before shard distribution | VERIFIED | `filterAndShard` exported function lines 6–17; `SHARD_TYPE` read at line 33; used in `main()` at line 36 |
| `.github/workflows/scrape-low.yml` | Type-aware matrix with 24 jobs and conditional setup steps | VERIFIED | 94 lines; 24 include objects; 7 `shard_type` conditional guards on setup steps |
| `.github/workflows/scrape-peak.yml` | Same type-aware matrix as scrape-low.yml | VERIFIED | 109 lines; identical 24-job matrix; PEAK_SCHEDULE_ENABLED job-level if condition preserved at line 24 |
| `tests/scraper/run.test.ts` | Unit tests for SHARD_TYPE filtering | VERIFIED | 53 lines; 5 `filterAndShard` test cases; `filterAndShard` appears 7 times |

All 8 artifacts: VERIFIED (exist, substantive, wired).

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `lib/scraper/factory.ts` | `CheerioAdapterConfig` | `wideTable boolean field` | VERIFIED | Interface at line 5–12; `wideTable?: boolean` at line 11 |
| `tests/scraper/factory.test.ts` | `tests/scraper/fixtures/wide-table.html` | `readFileSync` | VERIFIED | `readFileSync(join(__dirname, 'fixtures/wide-table.html'), 'utf-8')` at lines 12–15 |
| `lib/scraper/run.ts` | `lib/scraper/registry.ts` | `loadRegistry returns ResolvedEntry[] with adapterType` | VERIFIED | `import type { ResolvedEntry }` at line 4; `loadRegistry()` called inside `main()` at line 24; `filterAndShard` receives registry with `adapterType` |
| `.github/workflows/scrape-low.yml` | `lib/scraper/run.ts` | `SHARD_TYPE env var passed from matrix.shard_type` | VERIFIED | `SHARD_TYPE: ${{ matrix.shard_type }}` at line 94 |
| `.github/workflows/scrape-peak.yml` | `lib/scraper/run.ts` | `SHARD_TYPE env var passed from matrix.shard_type` | VERIFIED | `SHARD_TYPE: ${{ matrix.shard_type }}` at line 109 |

All 5 key links: VERIFIED.

---

### Test Suite Results

All 15 tests pass across both test files:

- `tests/scraper/factory.test.ts`: 11 tests (6 original narrow-table + 4 wide-table + 1 additional) — all pass
- `tests/scraper/run.test.ts`: 5 tests (all SHARD_TYPE filtering scenarios including modulo-after-filter) — all pass

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SCRP-11 | 18-01 | Adapters capture all to hop combinations published on each university's cutoff page | VERIFIED | Wide-table guard in `factory.ts` extracts one row per non-empty to hop column; 4 test cases confirm correct behavior |
| SCRP-12 | 18-01 | Factory adapter handles wide-table format (one column per to hop) | VERIFIED | `wideTable?: boolean` flag on `CheerioAdapterConfig`; wide-table parsing path confirmed working |
| INFR-04 | 18-02 | Shard count scales from 6 to handle 400+ universities within GHA per-job timeout limits | VERIFIED (with caveat) | 20 cheerio shards = ~20 unis/shard at 400 total; structural guarantee in place; actual timing is human-verifiable |
| INFR-05 | 18-02 | Playwright and OCR adapters are isolated to dedicated shards to prevent timeout cascade | VERIFIED (with caveat) | `SHARD_TYPE` filtering isolates adapter types before sharding; conditional step guards in both workflows; live GHA run needed to confirm runtime behavior |

---

### Anti-Patterns Found

No anti-patterns detected in phase-modified files:

- No TODO/FIXME/PLACEHOLDER comments in `factory.ts`, `registry.ts`, `run.ts`, workflow files, or test files
- No empty return stubs (`return null`, `return {}`, `return []`)
- No console-only handlers
- The `Warm up PaddleOCR models` step in both workflow files uses the deprecated `show_log=False` kwarg (removed in PaddleOCR 3.x per commit history), but this step is gated to `paddleocr` shards only and is flagged as a pre-existing issue in prior CI fixes — not introduced by this phase.

---

### Human Verification Required

#### 1. Live wide-table university scrape

**Test:** Configure a scrapers.json entry for a real Vietnamese university that publishes a wide-table cutoff page (one column per to hop code), set `"wideTable": true` in its `factory_config`, and run `npx tsx lib/scraper/run.ts` against it.

**Expected:** Database contains multiple rows for the same major code at that university — one per non-empty to hop column — each with a distinct `tohop_raw` value. No row has a blank `score_raw`. D01/A01/A00 rows exist as separate entries in the database rather than a single collapsed row.

**Why human:** Requires a live network request to a real university website and database inspection. Static code analysis confirms the parsing logic is correct but cannot confirm the page structure is what the adapter expects in production.

#### 2. GHA 24-job matrix execution

**Test:** Trigger `workflow_dispatch` on `scrape-low.yml` on GitHub. Inspect the resulting run's job list.

**Expected:** 24 jobs appear. Playwright jobs (2) show "Install Playwright browsers" or "Cache Playwright browsers" steps running. PaddleOCR jobs (2) show "Install PaddleOCR" and "Warm up PaddleOCR models" steps running. All 20 cheerio jobs skip both Playwright and PaddleOCR steps entirely (steps skipped, not failed).

**Why human:** GHA's `if:` conditions on steps require runtime evaluation. The YAML is syntactically correct and the conditions reference valid matrix variables, but only a live run confirms GHA evaluates them as expected.

#### 3. Shard timeout verification at scale

**Test:** Review GHA run logs from a peak-season run (or simulate with 400 entries in scrapers.json) and check the wall-clock duration of each job.

**Expected:** No cheerio shard job exceeds 300 minutes. The capacity math (400 unis / 20 shards = 20 unis/shard at ~1–5 min per cheerio scrape = 20–100 min max) provides strong confidence, but actual network conditions during July peak may differ.

**Why human:** Cannot simulate network timing or GHA runner performance from static analysis. Requires a real or representative run with timing data.

---

### Gaps Summary

No automated gaps found. All code-verifiable must-haves are fully implemented, wired, and tested. The three items requiring human verification are capacity/runtime claims that depend on live GHA execution and real university website behavior — they are structurally sound in code.

---

_Verified: 2026-03-20T09:00:00Z_
_Verifier: Claude (gsd-verifier)_
