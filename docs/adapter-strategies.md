# Adapter Strategies

UniSelect scrapers handle three types of university cutoff score pages.
Each type has a reference adapter that serves as a template for new adapters.

## Strategy 1: Static HTML (Cheerio)

**When to use:** Page source contains `<table>` with score data visible in View Source.

**Reference adapter:** `lib/scraper/adapters/htc.ts` (HTC -- Hoc vien Tai chinh)

**How it works:**
1. `fetchHTML(url)` fetches raw HTML
2. `cheerio.load(html)` parses the DOM
3. Find score table by semantic header text
4. Extract rows into `RawRow[]`

**Key rules:**
- Use semantic text anchors for column detection, never positional indexes
- Always throw on 0 rows (catches JS rendering failures or layout changes)
- Support both Vietnamese diacritics and ASCII-translit fallbacks in header matching
- Skip non-numeric major codes using `/^\d/.test(majorCode)` to filter section headers

**Verified adapters:** HTC, BVH (PTIT), SPH (HNUE), TLA (TLU)

---

## Strategy 2: Playwright (JS-Rendered Pages)

**When to use:** Page shows score table in browser but View Source has no `<table>`.
Score data is loaded via AJAX, React hydration, or other JavaScript rendering.

**Reference adapter:** `lib/scraper/adapters/dcn.ts` (DCN -- HaUI)

**How it works:**
1. `chromium.launch({ headless: true })` starts headless browser
2. `page.goto(url, { waitUntil: 'networkidle' })` loads with full JS execution
3. `page.waitForSelector('table')` waits for score table to appear in DOM
4. `page.content()` gets fully-rendered HTML
5. Cheerio parsing (same as static HTML strategy)
6. `browser.close()` in `finally` block — CRITICAL, prevents leaked browser processes

**CI setup:** `npx playwright install chromium --with-deps`

**Key rules:**
- Always wrap page operations in `try/finally { await browser.close(); }` — leaked browsers kill CI jobs
- Set a custom User-Agent via `page.setExtraHTTPHeaders` to identify the bot
- `waitUntil: 'networkidle'` is more reliable than `domcontentloaded` for SPA tables
- After `page.content()`, reuse cheerio parsing — keeps adapter logic uniform

---

## Strategy 3: PaddleOCR (Image-Based Pages)

**When to use:** Score data is published as JPEG or PNG image scans (official announcements).

**Reference adapter:** `lib/scraper/adapters/gha.ts` (GHA -- UTC)

**How it works:**
1. Fetch announcement page, find image URLs matching score file pattern
2. Download images to temp files
3. Shell out to `scripts/ocr_table.py` via `child_process.execSync`
4. Parse OCR JSON output into `RawRow[]`
5. Clean up temp files in `finally` block

**Python helper:** `scripts/ocr_table.py` — takes image path + output path as args, writes `{"lines": [...]}` JSON

**CI setup:** Python 3.11 + `pip install paddleocr` + model warm-up step

**Key rules:**
- Always clean up temp files in `finally` blocks
- OCR accuracy is high for codes (A00, 7480201) and numbers (27.50), lower for Vietnamese names
- Validate output: check for parseable 7-digit major codes in OCR lines
- The Python script must be run from `cwd: process.cwd()` so relative path `scripts/ocr_table.py` resolves

---

## Adding a New Adapter

1. **Determine rendering type** (View Source check):
   - Source has `<table>` with data → Strategy 1 (static HTML)
   - Source shows no table, but browser renders one → Strategy 2 (Playwright)
   - Data is in JPEG/PNG images → Strategy 3 (PaddleOCR)

2. **Copy reference adapter** for matching strategy:
   - Static: copy `lib/scraper/adapters/htc.ts`
   - Playwright: copy `lib/scraper/adapters/dcn.ts`
   - OCR: copy `lib/scraper/adapters/gha.ts`

3. **Update constants:** university ID, column header matchers, error messages

4. **Create test file** following `tests/scraper/adapters/bka.test.ts` pattern:
   - Use `vi.hoisted()` for mock references to avoid ReferenceError from hoisting
   - Include fixture HTML that mirrors real page table structure
   - Test: correct row count, correct university_id, correct field extraction, error on no-table HTML

5. **Update `scrapers.json`:** Set correct cutoff page URL and `static_verified: true`

6. **Run tests:** `npx vitest run tests/scraper/adapters/`

---

## Non-Viable Universities

| University | Ministry Code | Format | Status |
|-----------|--------------|--------|--------|
| HUST | BKA | JS site + PNG images | Requires Playwright + OCR combined -- complex |
| NEU | KHA | PDF download | Requires PDF parsing library |
| FTU | NTH | Google Drive link | Requires Google Drive API |

These cannot be scraped with the current three strategies without additional tooling.

---

## CI Workflow Setup

Both `scrape-low.yml` and `scrape-peak.yml` include:

```yaml
- name: Install Playwright browsers
  run: npx playwright install chromium --with-deps
- uses: actions/setup-python@v5
  with:
    python-version: '3.11'
    cache: 'pip'
- name: Install PaddleOCR
  run: pip install paddleocr
- name: Warm up PaddleOCR models
  run: python3 -c "from paddleocr import PaddleOCR; PaddleOCR(lang='vi', use_gpu=False, show_log=False)"
```

The `--with-deps` flag for Playwright installs system dependencies (libnss3, etc.) needed on ubuntu-latest.
The PaddleOCR warm-up step pre-downloads model weights (~50-200MB) before the scraper runs.
