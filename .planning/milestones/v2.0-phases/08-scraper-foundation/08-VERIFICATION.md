---
phase: 08-scraper-foundation
verified: 2026-03-19T04:36:00Z
status: passed
score: 12/12 must-haves verified
re_verification: false
---

# Phase 8: Scraper Foundation Verification Report

**Phase Goal:** The scraper pipeline is safe to extend — zero-rows failures are visible, DB writes are efficient, and 70+ copy-pasted adapters are replaced by a single config-driven factory
**Verified:** 2026-03-19T04:36:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | An adapter that silently returns [] gets logged as status 'zero_rows' with rows_written 0 and an error message | VERIFIED | `runner.ts:33-43` — guard on `rawRows.length === 0` inserts `status: 'zero_rows'`, `rows_written: 0`, `error_log: 'Adapter returned 0 rows...'`; test at `runner.test.ts:175-186` asserts all three fields |
| 2  | An adapter that throws still gets logged as status 'error' (no double-logging) | VERIFIED | `runner.ts:107-117` — catch block inserts `status: 'error'`; zero-rows guard `continue`s before catch is reachable; dedicated test at `runner.test.ts:142-152` |
| 3  | 200+ normalized rows write to DB in chunked batches inside a single db.transaction() call | VERIFIED | `runner.ts:60-95` — `db.transaction(async (tx) => {...})` with `CHUNK_SIZE=500`; `chunks()` utility splits rows; test at `runner.test.ts:197-205` asserts `db.transaction` called once |
| 4  | Both majors and cutoffScores inserts happen inside the same transaction (no FK violations on partial failure) | VERIFIED | `runner.ts:63-94` — `tx.insert(majors)` runs before `tx.insert(cutoffScores)` inside same transaction callback; both use `tx.insert` not `db.insert` |
| 5  | Runner continues to next adapter after zero-rows or error (fail-open preserved) | VERIFIED | `runner.ts:42` — `continue` after zero-rows log; `runner.ts:117` comment "continue to next adapter — fail-open" in catch; two dedicated tests (`runner.test.ts:154` and `runner.test.ts:207`) |
| 6  | When Supabase is unreachable (DB_TIMEOUT), GET /api/recommend returns 200 with data from scores-by-tohop.json | VERIFIED | `route.ts:82-96` — DB_TIMEOUT catch reads `scores-by-tohop.json` via `readFile`, calls `recommend()`, returns `Response.json({...})`; test at `recommend-fallback.test.ts:73-81` asserts `res.status === 200` |
| 7  | The fallback response includes meta.fallback: true | VERIFIED | `route.ts:94` — `meta: { count: results.length, years_available: distinctYears, fallback: true }`; test at `recommend-fallback.test.ts:78` asserts `body.meta.fallback === true` |
| 8  | The fallback uses async readFile (not readFileSync) | VERIFIED | `route.ts:2` — `import { readFile } from 'fs/promises'`; `route.ts:84` — `await readFile(filePath, 'utf-8')`; no `readFileSync` present in file |
| 9  | Invalid params still return 400 even during fallback — validation runs before DB call | VERIFIED | `route.ts:19-27` — validation block executes before the `try` block containing the DB call; test at `recommend-fallback.test.ts:92-96` asserts 400 for invalid tohop |
| 10 | A config-driven createCheerioAdapter(config) function produces a ScraperAdapter that returns correct RawRow[] | VERIFIED | `factory.ts` exists with full implementation; 6 tests in `factory.test.ts` verify correct row extraction, section header skipping, tohop column extraction, 0-row throw, th/thead headers, and defaultTohop fallback |
| 11 | The registry loads factory configs from scrapers.json and creates adapters via the factory instead of dynamic file imports | VERIFIED | `registry.ts:37-39` — `if (entry.factory_config)` branch calls `createCheerioAdapter({ id: entry.id, ...entry.factory_config })`; `registry.ts:41-43` — dynamic import fallback for non-factory adapters |
| 12 | Non-cheerio adapters (GHA/PaddleOCR, DCN/Playwright) still use the old dynamic import path | VERIFIED | `scrapers.json` — 75 of 78 entries have `factory_config`; MINISTRY, GHA, DCN do not; GHA and DCN are `static_verified: true` and will use dynamic import path |

**Score:** 12/12 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/scraper/runner.ts` | Zero-rows guard + batch transaction insert | VERIFIED | 119 lines; contains `status: 'zero_rows'`, `if (rawRows.length === 0)`, `db.transaction`, `tx.insert(majors)`, `tx.insert(cutoffScores)`, `CHUNK_SIZE = 500`, `function chunks`, `onConflictDoUpdate` with 5-column target |
| `tests/scraper/runner.test.ts` | Tests for zero-rows guard and batch transaction | VERIFIED | 225 lines; 8 tests (4 original + 4 new); `transaction: vi.fn()` mock present; `zero_rows` status test present |
| `app/api/recommend/route.ts` | Static JSON fallback on DB_TIMEOUT | VERIFIED | 99 lines; `import { readFile } from 'fs/promises'`, `scores-by-tohop.json`, `fallback: true`, `await readFile(`, `throw err` — all present; no `errorResponse('DB_UNAVAILABLE')` stub remaining |
| `tests/api/recommend-fallback.test.ts` | Test for fallback behavior | VERIFIED | 97 lines; `vi.mock('../../lib/db/timeout')` with DB_TIMEOUT, `vi.mock('fs/promises')`, 3 tests asserting 200+fallback, empty results, and 400 |
| `lib/scraper/factory.ts` | Config-driven adapter factory | VERIFIED | 93 lines; exports `createCheerioAdapter` and `CheerioAdapterConfig`; `fetchHTML(url)`, `cheerio.load(html)`, `th, thead td` header detection, first-row td fallback, `Array.some()` keyword matching, 0-row throw |
| `lib/scraper/registry.ts` | Updated registry with factory support | VERIFIED | 50 lines; `import { createCheerioAdapter }` from factory; `if (entry.factory_config)` branch; `await import(` fallback |
| `scrapers.json` | factory_config on all cheerio adapters | VERIFIED | 927 lines; 75/78 entries have `factory_config`; MINISTRY/GHA/DCN correctly excluded; HTC entry has `defaultTohop: "A00"` and correct scoreKeywords |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `lib/scraper/runner.ts` | `lib/db/schema.ts` | `db.transaction` with `tx.insert(cutoffScores/majors)` | VERIFIED | `runner.ts:60-95` — `await db.transaction(async (tx) => { ... tx.insert(majors) ... tx.insert(cutoffScores) ... })` |
| `app/api/recommend/route.ts` | `public/data/scores-by-tohop.json` | `readFile` in DB_TIMEOUT catch branch | VERIFIED | `route.ts:83-84` — `join(process.cwd(), 'public/data/scores-by-tohop.json')` then `await readFile(filePath, 'utf-8')` |
| `app/api/recommend/route.ts` | `lib/recommend/engine.ts` | `recommend()` called on fallback rows | VERIFIED | `route.ts:87-90` — `const results = recommend({ tohop_code: tohop, total_score: totalScore }, fallbackRows)` |
| `lib/scraper/registry.ts` | `lib/scraper/factory.ts` | `import createCheerioAdapter`, use `factory_config` from scrapers.json | VERIFIED | `registry.ts:4` — import present; `registry.ts:37-39` — `if (entry.factory_config)` creates adapter via factory |
| `lib/scraper/factory.ts` | `lib/scraper/fetch.ts` | `fetchHTML` for HTML retrieval | VERIFIED | `factory.ts:2` — `import { fetchHTML } from './fetch'`; `factory.ts:17` — `const html = await fetchHTML(url)` |
| `lib/scraper/registry.ts` | `scrapers.json` | reads `factory_config` field per entry | VERIFIED | `registry.ts:13` — `factory_config?: Omit<CheerioAdapterConfig, 'id'>` in RegistryEntry; `registry.ts:37` — `if (entry.factory_config)` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SCRP-01 | 08-03-PLAN.md | Generic adapter factory replaces 70+ copy-pasted cheerio adapters with `createCheerioAdapter(config)` | SATISFIED | `lib/scraper/factory.ts` exports `createCheerioAdapter`; `scrapers.json` has `factory_config` on 75/78 entries (all cheerio adapters) |
| SCRP-02 | 08-01-PLAN.md | Scraper runner uses batched DB inserts instead of row-by-row upserts | SATISFIED | `runner.ts` — two-phase normalize-then-transaction pattern with `CHUNK_SIZE=500`; no row-by-row `db.insert` in data path |
| SCRP-03 | 08-01-PLAN.md | Zero-rows guard in runner rejects adapters returning empty results with explicit error logging | SATISFIED | `runner.ts:33-43` — guard on `rawRows.length === 0` inserts `status: 'zero_rows'` with descriptive error_log |
| FIX-06 | 08-02-PLAN.md | /api/recommend falls back to static JSON when Supabase is unreachable | SATISFIED | `route.ts:82-96` — DB_TIMEOUT catch block reads `scores-by-tohop.json` and returns 200 with `meta.fallback: true` |

No orphaned requirements detected. All four IDs are claimed by plans and verified against codebase.

---

### Anti-Patterns Found

None detected across all modified files (`runner.ts`, `factory.ts`, `registry.ts`, `route.ts`, and test files). No TODOs, FIXMEs, empty returns, or placeholder implementations.

---

### Human Verification Required

None. All goal behaviors are mechanically verifiable:
- Zero-rows guard: tested by unit tests, implementation confirmed in runner.ts
- Batch transaction: tested by unit tests, `tx.insert` usage confirmed in runner.ts
- Fallback behavior: tested by unit tests, readFile + recommend() wiring confirmed in route.ts
- Factory output: tested by factory.test.ts with controlled HTML fixtures
- Registry routing: code inspection confirms factory_config branch and dynamic import fallback

---

### Test Suite Results

All 428 tests pass across 14 test files in `tests/scraper/` and `tests/api/` (confirmed by live test run). Breakdown for phase-08-specific files:

- `tests/scraper/runner.test.ts` — 8 tests pass (4 original + 4 new zero-rows/transaction tests)
- `tests/scraper/factory.test.ts` — 6 tests pass (all factory behavior coverage)
- `tests/api/recommend-fallback.test.ts` — 3 tests pass (200+fallback, empty-tohop, 400-invalid)

Commits verified in git history: `4447758`, `2e4f33b` (plan 01), `b9c1944`, `ebd6911` (plan 02). Plan 03 changes are in the working tree (not yet committed as a separate commit per git log).

---

### Summary

Phase 8 goal is fully achieved. All three sub-goals are delivered:

1. **Zero-rows visibility (SCRP-02, SCRP-03):** The runner now distinguishes between adapter throws (`status: 'error'`) and silent empty returns (`status: 'zero_rows'`). Both cases log to `scrape_runs` with meaningful error messages, and both preserve fail-open behavior via `continue`.

2. **Efficient DB writes (SCRP-02):** The row-by-row insert loop is replaced with a two-phase pattern: normalize all rows in memory, then write inside a single `db.transaction()` with chunked `tx.insert()` calls at 500 rows per batch. Both majors (FK dependency) and cutoffScores are in the same transaction, eliminating partial-failure data inconsistency.

3. **Config-driven factory (SCRP-01):** `createCheerioAdapter(config)` replaces 75 copy-pasted adapter files with JSON config entries in `scrapers.json`. The registry branches on `factory_config` presence, using the factory for cheerio adapters and dynamic import for the three non-cheerio adapters (GHA/PaddleOCR, DCN/Playwright, MINISTRY/special-structure). Old adapter files are retained as Phase 9 verification references.

4. **Recommend API resilience (FIX-06):** The 503 on DB_TIMEOUT is replaced with a 200 response using cached data from `scores-by-tohop.json`, with `meta.fallback: true` surfacing the stale-data state to the frontend.

---

_Verified: 2026-03-19T04:36:00Z_
_Verifier: Claude (gsd-verifier)_
