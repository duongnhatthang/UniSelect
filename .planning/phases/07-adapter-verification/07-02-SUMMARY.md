---
phase: 07-adapter-verification
plan: "02"
subsystem: scraper
tags: [adapter, playwright, paddleocr, dcn, gha, sph, tla, ci-workflows, docs]
dependency_graph:
  requires: [07-01]
  provides:
    - lib/scraper/adapters/dcn.ts
    - lib/scraper/adapters/gha.ts
    - lib/scraper/adapters/sph.ts
    - lib/scraper/adapters/tla.ts
    - scripts/ocr_table.py
    - docs/adapter-strategies.md
  affects:
    - scrapers.json
    - .github/workflows/scrape-low.yml
    - .github/workflows/scrape-peak.yml
tech_stack:
  added:
    - playwright (devDependency) — headless browser for JS-rendered pages
  patterns:
    - Playwright adapter: chromium.launch + try/finally browser.close + page.content() -> cheerio
    - PaddleOCR adapter: fetchHTML -> find images -> execSync python3 script -> parse JSON
    - Static HTML adapter: fetchHTML -> cheerio + semantic header matching + digit-only row filtering
key_files:
  created:
    - lib/scraper/adapters/dcn.ts
    - tests/scraper/adapters/dcn.test.ts
    - scripts/ocr_table.py
    - tests/scraper/adapters/gha.test.ts
    - docs/adapter-strategies.md
  modified:
    - lib/scraper/adapters/gha.ts
    - lib/scraper/adapters/sph.ts
    - lib/scraper/adapters/tla.ts
    - scrapers.json
    - .github/workflows/scrape-low.yml
    - .github/workflows/scrape-peak.yml
    - package.json
decisions:
  - "DCN (HaUI) treated as Playwright adapter -- tuyensinh.haui.edu.vn has SSL cert issues with plain fetch; Playwright headless handles SSL transparently"
  - "SPH and TLA updated to HTC/BVH pattern with Vietnamese diacritics + ASCII fallback in header matching"
  - "SPH URL set to hnue.edu.vn cutoff path; TLA URL set to tuyensinh.tlu.edu.vn -- both candidates need annual URL update"
  - "GHA adapter fetches image URLs from announcement page then shells out to ocr_table.py with try/finally cleanup"
  - "vi.hoisted() used in DCN and GHA tests -- required to avoid ReferenceError from Vitest vi.mock hoisting"
  - "Playwright installed as devDependency only -- browser binaries (chromium) installed separately in CI via playwright install chromium"
  - "PaddleOCR warm-up step added to CI -- pre-downloads ~50-200MB models before scraper runs to avoid slow first-run in test window"
metrics:
  duration: 8min
  completed_date: "2026-03-18"
  tasks: 3
  files: 12
---

# Phase 7 Plan 02: Playwright/PaddleOCR Adapters and Static Verification Summary

**One-liner:** Playwright adapter for DCN (HaUI JS-rendered), PaddleOCR adapter for GHA (UTC JPEG images), two static-HTML adapters (SPH/TLA) enabled, CI updated with Playwright+Python setup, and three-strategy documentation created -- reaching 6 verified adapters total.

## What Was Built

### lib/scraper/adapters/dcn.ts (rewritten as Playwright adapter)

Reference pattern for JS-rendered university pages. Uses `chromium.launch({ headless: true })` with `page.goto(waitUntil: 'networkidle')` then `page.content()` to get rendered HTML, followed by the same cheerio parsing as static adapters. `browser.close()` is always called in a `finally` block to prevent leaked browser processes in CI.

### tests/scraper/adapters/dcn.test.ts (9 tests)

Behavioral tests using `vi.hoisted()` for safe mock references before Vitest hoisting. Tests verify: 3 rows from fixture, university_id=DCN, chromium.launch called with headless:true, browser.close() called on success, browser.close() called when page.content() throws, and error thrown on empty table HTML.

### lib/scraper/adapters/gha.ts (rewritten as PaddleOCR adapter)

Reference pattern for image-based university pages. Fetches announcement page with `fetchHTML`, finds JPEG/PNG score images by URL pattern, downloads to temp files, shells out to `scripts/ocr_table.py` via `execSync`, parses JSON OCR output for 7-digit major codes, and cleans up temp files in `finally` blocks.

### scripts/ocr_table.py

Python PaddleOCR helper script. Accepts image path and output JSON path as arguments. Runs PaddleOCR with Vietnamese language support (`lang='vi'`, `use_angle_cls=True`, `use_gpu=False`, `show_log=False`). Writes `{"lines": [...]}` JSON to output path. Syntactically verified.

### tests/scraper/adapters/gha.test.ts (6 tests)

Behavioral tests mocking `fetchHTML`, `child_process.execSync`, and `fs` functions. Tests verify: fetchHTML called with URL, execSync called with ocr_table.py command, RawRow[] returned with university_id=GHA, major codes extracted from OCR output, and errors thrown on no-images and no-parseable-rows.

### lib/scraper/adapters/sph.ts, lib/scraper/adapters/tla.ts (updated)

Both adapters updated to follow the HTC/BVH static HTML pattern:
- Headers checked in both `<th>` and first-row `<td>` format
- Score column matched by Vietnamese diacritics + ASCII fallback
- Non-numeric major codes filtered with `/^\d/.test()`
- Row parsing uses semantic column indexes, not positional

### scrapers.json (updated)

- DCN: URL updated to `tuyensinh.haui.edu.vn/diem-chuan-trung-tuyen-dai-hoc`, `static_verified: true`
- GHA: URL updated to `tuyensinh.utc.edu.vn/?q=tin-tuyen-sinh/diem-trung-tuyen-...2025`, `static_verified: true`
- SPH: URL updated to HNUE cutoff path, `static_verified: true`
- TLA: URL updated to TLU tuyensinh subdomain, `static_verified: true`

Total `static_verified: true` count: **6** (HTC + BVH + DCN + GHA + SPH + TLA)

### .github/workflows/scrape-low.yml and scrape-peak.yml (updated)

Both workflows now include four new steps after `npm ci`:
1. `npx playwright install chromium --with-deps` — installs Chromium + system deps
2. `actions/setup-python@v5` with Python 3.11 and pip cache
3. `pip install paddleocr`
4. PaddleOCR model warm-up (pre-downloads models before scraper window)

### docs/adapter-strategies.md (created)

Three-section documentation covering all adapter strategies with reference adapters, how each works, key rules, CI setup requirements, and a guide for adding new adapters. Includes a Non-Viable Universities table (BKA/KHA/NTH) and CI workflow setup reference.

## Verification Results

```
npx vitest run tests/scraper/adapters/dcn.test.ts     -> 9/9 passed
npx vitest run tests/scraper/adapters/gha.test.ts     -> 6/6 passed
npx vitest run tests/scraper/adapters/adapter-contract.test.ts -> 312/312 passed
npx vitest run tests/scraper/adapters/              -> 349/349 passed (5 test files)
grep -c '"static_verified": true' scrapers.json     -> 6
grep "playwright install chromium" scrape-low.yml   -> match found
grep "setup-python" scrape-low.yml                  -> match found
grep "playwright install chromium" scrape-peak.yml  -> match found
test -f docs/adapter-strategies.md                  -> exists
python3 -c "ast.parse(open('scripts/ocr_table.py').read())" -> PASS
```

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | c9f35f8 | feat(07-02): Playwright DCN adapter with tests |
| Task 2 | e2440dd | feat(07-02): PaddleOCR GHA adapter with Python helper and tests |
| Task 3 | 1c18491 | feat(07-02): enable SPH/TLA static adapters, CI with Playwright+PaddleOCR, strategy docs |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vi.hoisted() required for Playwright mock in dcn.test.ts**
- **Found during:** Task 1 test run
- **Issue:** Vitest throws "Cannot access 'mockBrowser' before initialization" — `vi.mock()` factories are hoisted to top of file, so `mockBrowser` defined after `vi.mock()` call is not yet initialized
- **Fix:** Used `vi.hoisted()` to create mock references before the hoisted `vi.mock()` call — same pattern as Phase 01 decision for mock factories
- **Files modified:** tests/scraper/adapters/dcn.test.ts
- **Commit:** c9f35f8

## Self-Check: PASSED

- `/Users/thangduong/Desktop/UniSelect/lib/scraper/adapters/dcn.ts` — FOUND
- `/Users/thangduong/Desktop/UniSelect/lib/scraper/adapters/gha.ts` — FOUND
- `/Users/thangduong/Desktop/UniSelect/lib/scraper/adapters/sph.ts` — FOUND
- `/Users/thangduong/Desktop/UniSelect/lib/scraper/adapters/tla.ts` — FOUND
- `/Users/thangduong/Desktop/UniSelect/scripts/ocr_table.py` — FOUND
- `/Users/thangduong/Desktop/UniSelect/docs/adapter-strategies.md` — FOUND
- commit c9f35f8 — verified
- commit e2440dd — verified
- commit 1c18491 — verified
