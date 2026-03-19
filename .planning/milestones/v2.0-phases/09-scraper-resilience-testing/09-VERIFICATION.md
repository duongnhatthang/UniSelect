---
phase: 09-scraper-resilience-testing
verified: 2026-03-18T22:00:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
---

# Phase 9: Scraper Resilience Testing — Verification Report

**Phase Goal:** Every adapter format has an HTML fixture and can be integration-tested against a local fake HTTP server without hitting live university servers
**Verified:** 2026-03-18T22:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Running `npx vitest run tests/scraper/integration/` passes with all 7 fixture formats tested | VERIFIED | Live test run: 7 passed, 302ms, exit code 0 |
| 2 | Integration tests call real fetchHTML (not vi.mock) and MSW intercepts the requests | VERIFIED | No `vi.mock` in cheerio-integration.test.ts; imports real `createCheerioAdapter` from factory.ts |
| 3 | No live network requests are made during test execution (`onUnhandledRequest: error`) | VERIFIED | Line 17: `server.listen({ onUnhandledRequest: 'error' })` |
| 4 | Windows-1252 fixture exercises the iconv-lite decode path in fetchHTML | VERIFIED | `WINDOWS_1252_BODY` is `iconv.encode(html, 'windows-1252')` Buffer; test uses `Content-Type: text/html; charset=windows-1252` |
| 5 | Broken-table and js-stub fixtures trigger the 0-rows error correctly | VERIFIED | Both tests assert `.rejects.toThrow(/0 rows/)` and pass |
| 6 | ci-ocr.yml workflow caches `~/.paddlex` (PaddleOCR 3.x path) with actions/cache@v4 | VERIFIED | Line 27: `path: ~/.paddlex`; line uses `actions/cache@v4` |
| 7 | ci-ocr.yml runs `scripts/ocr_table.py` against a synthetic test image and asserts lines > 0 | VERIFIED | Workflow runs `ocr-smoke-generator.py` then `ocr_table.py` then `assert len(data['lines']) > 0` |
| 8 | ci-ocr.yml triggers on push to `scripts/ocr_table.py` or workflow file, plus manual dispatch | VERIFIED | `on.push.paths` includes both files; `workflow_dispatch` present |
| 9 | MSW is installed as a devDependency | VERIFIED | `package.json` line 44: `"msw": "^2.12.13"` |

**Score:** 9/9 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tests/fixtures/generic-table.ts` | Standard thead/th table HTML fixture | VERIFIED | Exports `GENERIC_TABLE_HTML`; full table with thead, 3 data rows |
| `tests/fixtures/no-thead-headers.ts` | HTC-style first-row td headers fixture | VERIFIED | Exports `NO_THEAD_HEADERS_HTML` |
| `tests/fixtures/comma-decimal.ts` | Vietnamese comma-decimal score fixture | VERIFIED | Exports `COMMA_DECIMAL_HTML` |
| `tests/fixtures/windows-1252.ts` | Windows-1252 encoded fixture as iconv Buffer | VERIFIED | Exports `WINDOWS_1252_BODY` as `iconv.encode(html, 'windows-1252')`; Buffer not string |
| `tests/fixtures/broken-table.ts` | Table with no score column match | VERIFIED | Exports `BROKEN_TABLE_HTML` |
| `tests/fixtures/renamed-headers.ts` | Headers with keyword variants | VERIFIED | Exports `RENAMED_HEADERS_HTML` |
| `tests/fixtures/js-stub.ts` | Empty JS-rendered page with no table | VERIFIED | Exports `JS_STUB_HTML` |
| `tests/scraper/integration/msw-server.ts` | MSW setupServer singleton | VERIFIED | 3 lines: imports `setupServer`, exports `server = setupServer()` |
| `tests/scraper/integration/cheerio-integration.test.ts` | Integration tests for all 7 fixtures | VERIFIED | 177 lines, 7 test cases, all passing |
| `.github/workflows/ci-ocr.yml` | PaddleOCR CI smoke test workflow | VERIFIED | Contains `paddleocr-models`, `ocr_table.py`, `workflow_dispatch`, `assert len` |
| `tests/fixtures/ocr-smoke-generator.py` | Synthetic JPEG generator for OCR CI testing | VERIFIED | Uses `from PIL import Image`; generates 400x200 JPEG at runtime |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `cheerio-integration.test.ts` | `lib/scraper/factory.ts` | `import createCheerioAdapter` | WIRED | Line 4: `import { createCheerioAdapter } from '../../../lib/scraper/factory'` |
| `cheerio-integration.test.ts` | `tests/scraper/integration/msw-server.ts` | `import server` | WIRED | Line 3: `import { server } from './msw-server'` |
| `lib/scraper/fetch.ts` | MSW interceptor | native fetch() intercepted by MSW at Node level | WIRED | No `vi.mock`; MSW `onUnhandledRequest: 'error'` confirms real fetch is intercepted (tests pass without network) |
| `.github/workflows/ci-ocr.yml` | `scripts/ocr_table.py` | `python3 scripts/ocr_table.py` | WIRED | Line 43: `python3 scripts/ocr_table.py /tmp/ocr-smoke.jpg /tmp/ocr-output.json` |
| `.github/workflows/ci-ocr.yml` | `~/.paddlex` | `actions/cache@v4` | WIRED | Lines 26-30: cache step with `path: ~/.paddlex` and key `paddleocr-models-...` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SCRP-06 | 09-01-PLAN.md | Fake HTTP server serves HTML fixtures for scraper integration tests | SATISFIED | MSW server singleton + cheerio-integration.test.ts with `onUnhandledRequest: 'error'`; 7 tests pass |
| SCRP-07 | 09-01-PLAN.md | HTML fixture library covers verified adapter formats plus irregular edge cases (comma-decimal, missing table, multi-method) | SATISFIED | 7 fixture files: generic-table, no-thead-headers, comma-decimal, windows-1252, broken-table, renamed-headers, js-stub |
| SCRP-08 | 09-02-PLAN.md | PaddleOCR pipeline runs in GitHub Actions CI with cached model downloads | SATISFIED | `ci-ocr.yml` with `actions/cache@v4` at `~/.paddlex`, `PADDLE_PDX_MODEL_SOURCE=BOS`, smoke test asserts `len(lines) > 0` |

All 3 requirements accounted for across both plans. No orphaned requirements for phase 9.

---

### Anti-Patterns Found

No blockers or warnings found. All fixture files contain substantive HTML content, not stubs. The integration test file uses real imports with no `vi.mock`. The workflow file is complete with all required steps.

---

### Human Verification Required

#### 1. PaddleOCR CI Workflow — Live GitHub Actions Run

**Test:** Push a change to `scripts/ocr_table.py` or manually trigger `workflow_dispatch` on `ci-ocr.yml` in the GitHub Actions UI.
**Expected:** Workflow runs to completion: models download (or restore from cache), synthetic image is generated, `ocr_table.py` extracts at least 1 line, job exits green.
**Why human:** The workflow depends on PaddleOCR model availability from the BOS endpoint and correct OCR output from a real image — cannot verify model download, cache hit behavior, or actual OCR accuracy programmatically without running in a real GitHub Actions environment.

---

### Gaps Summary

No gaps. All automated checks pass. Phase goal is fully achieved:

- 7 HTML fixture files exist with correct named exports covering all required edge-case formats.
- MSW server singleton is wired with `onUnhandledRequest: 'error'` — no live requests can escape.
- All 7 integration tests pass against real `fetchHTML` (no mocking), confirmed by live test run (7 passed, 302ms).
- Windows-1252 fixture is correctly a `Buffer` (not string), exercising the iconv decode path.
- Broken-table and js-stub both correctly assert `0 rows` error.
- `ci-ocr.yml` workflow is valid YAML with correct PaddleOCR 3.x cache path (`~/.paddlex`), `PADDLE_PDX_MODEL_SOURCE=BOS` env, synthetic image generation via Pillow, and lines > 0 assertion.
- All 3 requirements (SCRP-06, SCRP-07, SCRP-08) are satisfied with direct implementation evidence.
- Commits b368009, 554fcc7 (plan 01) and f35e415 (plan 02) confirmed in git log.

---

_Verified: 2026-03-18T22:00:00Z_
_Verifier: Claude (gsd-verifier)_
