# Phase 7: Adapter Verification & Data Population - Research

**Researched:** 2026-03-18
**Domain:** Vietnamese university cutoff score page rendering analysis, Playwright JS scraping, PaddleOCR table extraction
**Confidence:** HIGH (rendering verdicts) / MEDIUM (Playwright/OCR integration patterns)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Target HTC (confirmed working static HTML) first, then top-tier demand: BKA, KHA (NEU), NTH (FTU), BVH (PTIT), GHA (UTC)
- Aim for 5-7 verified adapters (meets success criterion "at least 5")
- Add Playwright as optional dependency for JS-rendered page scraping
- Create 1 working Playwright adapter (e.g. NEU or FTU) as a reference pattern
- Document the Playwright adapter approach for future adapters
- Adds ~30s per adapter in CI when using Playwright
- Add PaddleOCR (Python, free) as a prototype for 1 image-based university (e.g. BKA)
- This requires Python in CI alongside Node — document the setup
- Prototype proves the pattern; full rollout deferred to future work
- Web fetch each target URL, check HTTP status + HTML content for score table markers
- Log results to a verification report
- Run generate-static after verified adapters scrape successfully
- Commit updated JSON to public/data/

### Claude's Discretion
- Specific URL paths for each university's cutoff score page (discovered during verification)
- Playwright dependency version and configuration
- PaddleOCR setup specifics and Python version requirements
- Verification report format and location

### Deferred Ideas (OUT OF SCOPE)
- Full rollout of Playwright to all JS-rendered universities (beyond 1 prototype)
- Full rollout of PaddleOCR to all image-based universities (beyond 1 prototype)
- Ministry portal adapter verification (URL changes between cycles)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PIPE-01 | System maintains a list of Vietnamese universities and their websites | scrapers.json already has 78 entries; this phase verifies and enables specific ones |
| PIPE-02 | System scrapes cutoff scores from university websites on a schedule | Enabling static_verified=true in scrapers.json activates adapters in CI workflow |
| PIPE-03 | Scraped data stores historical cutoff scores per university, major, tổ hợp, year | Existing runner.ts + normalizer pipeline handles this — no changes needed |
| INFRA-02 | App handles July traffic spike without manual intervention | Verified data populates scores-by-tohop.json which is the static fallback CDN file |
</phase_requirements>

---

## Summary

This phase operationalizes the scraper pipeline by verifying which of the 6 priority university pages can be scraped, fixing their URLs in scrapers.json, enabling static_verified=true, and populating the static fallback JSON. Research identified 3 distinct rendering categories across the target universities: static HTML (HTC confirmed, BVH/PTIT confirmed), image-based (GHA/UTC confirmed, BKA/HUST also uses images for some pages), and Google Drive / PDF links (NTH/FTU).

HTC is already fully verified and enabled. BVH (PTIT) was discovered to have a static HTML table at `https://tuyensinh.ptit.edu.vn/gioi-thieu/xem-diem-cac-nam-truoc/diem-trung-tuyen-2024/` — this is a strong second candidate. GHA (UTC) publishes scores as JPEG images. NTH (FTU) links to a Google Drive document. BKA (HUST) publishes some scores as PNG images embedded in news articles. KHA (NEU) offers PDF downloads for scores (older approach), but the `neu.edu.vn` main site likely has static HTML for some years.

**Primary recommendation:** Verify BVH (PTIT) as the second static-HTML adapter (confirmed working). Use BKA or GHA as the PaddleOCR prototype target (both publish image-based scores). Use KHA (NEU) or NTH (FTU) as the Playwright adapter target — but note these may resolve to PDFs/Drive rather than JS-rendered HTML, which makes DCN (HAUI, `https://tuyensinh.haui.edu.vn/diem-chuan-trung-tuyen-dai-hoc`) a strong Playwright candidate given its dedicated admissions portal with score tables.

---

## University Page Rendering Verdicts

This is the core research output. Each verdict was determined by fetching the actual page.

### HTC — Học viện Tài chính (Already verified)
| Property | Value |
|----------|-------|
| Ministry code | HTC |
| Adapter file | `lib/scraper/adapters/htc.ts` |
| Verified URL | `https://tuyensinh.hvtc.edu.vn/tabid/1699/catid/916/news/38174/TB-vv-Ket-qua-trung-tuyen-he-dai-hoc-chinh-quy-nam-2025/Default.aspx` |
| Rendering | Static HTML |
| static_verified | **true** (already enabled) |
| Table structure | `TT / Mã ngành / Tên ngành / Điểm trúng tuyển` columns; headers in first `<tr>` as `<td>` (no `<thead>`) |
| Notes | No tổ hợp column — emits `A00` as default. 2025 URL hardcoded; will need update each year. |

### BVH — Học viện Công nghệ Bưu chính Viễn thông / PTIT (Static HTML confirmed)
| Property | Value |
|----------|-------|
| Ministry code | BVH |
| Adapter file | `lib/scraper/adapters/bvh.ts` |
| Current scrapers.json URL | `https://portal.ptit.edu.vn/` (homepage — incorrect) |
| Correct URL | `https://tuyensinh.ptit.edu.vn/gioi-thieu/xem-diem-cac-nam-truoc/diem-trung-tuyen-2024/` |
| Rendering | **Static HTML** (confirmed by WebFetch) |
| Recommended static_verified | **true** |
| Table structure | `TT / Mã ngành\/CT / Tên ngành\/ chương trình / BVH / BVS / THPT (100) / TN (302) / KH (410) / DGNL (402)` |
| Notes | Score format includes "TTNV<=N" annotation (priority constraint). Multiple admission method columns — adapter needs to handle or collapse to THPT method column. The correct sub-domain is `tuyensinh.ptit.edu.vn`, not `portal.ptit.edu.vn` (the portal redirects to a WordPress signup page). |

**BVH adapter update needed:** The existing `bvh.ts` looks for `Điểm chuẩn` header, but the real PTIT table uses method-specific columns (`THPT (100)`, etc.). The adapter must be updated to find the `THPT (100)` column as the primary score column, or emit one row per admission method.

### GHA — Trường Đại học Giao thông vận tải / UTC (Image-based — OCR candidate)
| Property | Value |
|----------|-------|
| Ministry code | GHA |
| Adapter file | `lib/scraper/adapters/gha.ts` |
| Candidate URL | `https://tuyensinh.utc.edu.vn/?q=tin-tuyen-sinh/diem-trung-tuyen-dai-hoc-he-chinh-quy-nam-2025` |
| Rendering | **JPEG images** (confirmed: `*_page-0001.jpg`, `*_page-0002.jpg`, etc.) |
| Recommended strategy | PaddleOCR prototype |
| Notes | UTC publishes cutoff scores as multi-page JPEG scans of official announcements. 4 image files for 2025. Also available as PDF. The tuyensinh.utc.edu.vn subdomain is a Drupal site. |

### BKA — Đại học Bách Khoa Hà Nội / HUST (Mixed — JS site, images in articles)
| Property | Value |
|----------|-------|
| Ministry code | BKA |
| Adapter file | `lib/scraper/adapters/bka.ts` |
| Found URL | `https://hust.edu.vn/vi/news/tin-tuc-su-kien/dai-hoc-bach-khoa-ha-noi-cong-bo-diem-chuan-xttn-2024-655155.html` |
| Rendering | **JS-rendered site + PNG images in news articles** |
| Notes | Main hust.edu.vn site requires JavaScript (shows warning without it). Score articles embed PNG files (e.g. `post-nguong-diem-xttn-2024_xttn-dien-1.1.png`). The THPT method scores (most relevant) may be in a different article. The ts.hust.edu.vn subdomain (SSL cert error) may have tabular data. **BKA is a complex case** — requires Playwright to navigate the JS site, then images for the actual data. Recommend using GHA for OCR prototype instead (simpler: known URL, JPEG images, non-JS page). |

### NTH — Trường Đại học Ngoại thương / FTU (Google Drive link)
| Property | Value |
|----------|-------|
| Ministry code | NTH |
| Adapter file | `lib/scraper/adapters/nth.ts` |
| Found URL | `https://ftu.edu.vn/tuyensinh/dai-hoc-chinh-quy/ftu-thong-tin-tuyen-sinh-chung/thong-tin-tuyen-sinh-chung-2024/5921-thong-bao-v-ngu-ng-di-m-trung-tuyen-dai-hoc-chinh-quy-nam-2024` |
| Rendering | **Google Drive link** (banner image + external Drive file) |
| Notes | FTU does not publish scores in HTML tables. Score data is in a Google Drive document linked from the announcements page. This makes NTH **not viable** for either static HTML or simple Playwright scraping. Deferred or manual-entry only. |

### KHA — Trường Đại học Kinh tế Quốc dân / NEU (PDF-based)
| Property | Value |
|----------|-------|
| Ministry code | KHA |
| Adapter file | `lib/scraper/adapters/kha.ts` |
| Found URL | `https://daotao.neu.edu.vn/vi/tuyen-sinh-dai-hoc-chinh-quy-2024/thong-bao-diem-chuan...` |
| Rendering | **PDF download** (confirmed: page links to PDF, not inline HTML table) |
| Notes | NEU offers scores as downloadable PDF files. The main site may have JS-rendered content. Not viable for simple cheerio scraping. Deferred or use daotao.neu.edu.vn subpage which may differ. |

### DCN — Đại học Công nghiệp Hà Nội / HAUI (Likely static — strong candidate)
| Property | Value |
|----------|-------|
| Ministry code | DCN |
| Adapter file | `lib/scraper/adapters/dcn.ts` |
| Candidate URL | `https://tuyensinh.haui.edu.vn/diem-chuan-trung-tuyen-dai-hoc` |
| Rendering | **Unknown** (SSL cert issue blocked WebFetch; dedicated admissions portal suggests structured data) |
| Notes | HAUI has a dedicated admissions portal (`tuyensinh.haui.edu.vn`) with a named cutoff scores page. The SSL cert error in WebFetch may be a self-signed cert issue (common for Vietnamese university subdomains). The existing `fetchHTML` utility uses Node's native `fetch` which also honors cert validation — may need `rejectUnauthorized: false` for this host. Recommend as the 3rd static-HTML candidate after manual verification. |

---

## Standard Stack

### Core (no changes needed)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| cheerio | 1.2.0 (installed) | HTML parsing for static adapters | Already in use for all 78 adapters |
| typescript | 5.x (installed) | Type safety | Already configured |
| tsx | 4.21.0 (installed) | Script execution | Already in devDependencies |
| vitest | 4.x (installed) | Tests | Existing test infrastructure |

### New: Playwright (for JS-rendered pages)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| playwright | 1.51.x (latest as of 2026-03) | Headless browser automation | Install as devDependency — optional, only used by Playwright adapters |

**Installation:**
```bash
npm install --save-dev playwright
npx playwright install chromium  # Only install chromium — smallest footprint
```

**Version guidance:** Latest is 1.51.x as of early 2026. Verify with `npm view playwright version` before pinning. Do NOT install `@playwright/test` — that pulls in the full test runner; we only need the `playwright` core package.

**CI consideration:** `npx playwright install chromium` adds ~300MB to CI and ~30s overhead per adapter. Must be added as a step in GitHub Actions workflows when Playwright adapters are enabled.

### New: PaddleOCR (for image-based pages — Python)
| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| Python | 3.9-3.12 | Runtime for PaddleOCR | GitHub Actions ubuntu-latest includes Python 3.10+ |
| paddleocr | 3.0.3 (latest June 2025) | OCR + table structure recognition | Install via pip |

**Installation:**
```bash
pip install "paddleocr[all]"   # includes PP-StructureV3 for table recognition
# Or minimal install:
pip install paddleocr
```

**Python version:** PaddleOCR 3.x supports Python 3.9, 3.10, 3.11, 3.12. GitHub Actions `ubuntu-latest` has Python 3.10+ available via `actions/setup-python`.

**Node.js integration pattern:** Call PaddleOCR from Node.js via `child_process.spawn()` (subprocess). PaddleOCR writes JSON output; Node.js reads and parses it. This is the standard pattern since PaddleOCR has no native Node.js bindings.

---

## Architecture Patterns

### Pattern 1: Static HTML Adapter (existing — reference pattern)

HTC adapter is the canonical example. The standard shape:
```typescript
// lib/scraper/adapters/htc.ts — reference for all static HTML adapters
export const htcAdapter: ScraperAdapter = {
  id: 'HTC',
  async scrape(url: string): Promise<RawRow[]> {
    const html = await fetchHTML(url);      // existing utility
    const $ = cheerio.load(html);
    const rows: RawRow[] = [];
    const year = new Date().getFullYear() - 1;

    $('table').each((_, table) => {
      // Find score column by semantic text anchor, not CSS position
      const headers = /* ... */;
      const scoreIdx = headers.findIndex(h => h.includes('điểm trúng tuyển') || h.includes('điểm chuẩn'));
      if (scoreIdx === -1) return;
      // ... parse rows
    });

    if (rows.length === 0) {
      throw new Error(`HTC adapter returned 0 rows — possible JS rendering at ${url}`);
    }
    return rows;
  },
};
```

Key rules (do not deviate):
- Export named export `${adapter}Adapter` (e.g. `bvhAdapter`) — required by registry.ts
- Use semantic text anchors for column detection, never positional indexes
- Always throw on 0 rows (catches JS rendering failures)
- `year = new Date().getFullYear() - 1` is the convention

### Pattern 2: Playwright Adapter (new pattern — to establish)

For JS-rendered pages, the adapter swaps `fetchHTML` for Playwright's `page.content()`:

```typescript
// lib/scraper/adapters/dcn.ts (example Playwright adapter)
import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import { RawRow, ScraperAdapter } from '../types';

export const dcnAdapter: ScraperAdapter = {
  id: 'DCN',
  async scrape(url: string): Promise<RawRow[]> {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      // Wait for score table to appear in DOM
      await page.waitForSelector('table', { timeout: 15000 });
      const html = await page.content();  // get fully-rendered HTML
      const $ = cheerio.load(html);       // reuse existing cheerio parsing logic
      const rows: RawRow[] = [];
      // ... same table parsing logic as static adapter
      if (rows.length === 0) {
        throw new Error(`DCN adapter returned 0 rows at ${url}`);
      }
      return rows;
    } finally {
      await browser.close();
    }
  },
};
```

**Key design choices:**
- Always `browser.close()` in a `finally` block — leaked browser processes will kill CI jobs
- `waitUntil: 'networkidle'` is more reliable than `domcontentloaded` for SPA tables
- After `page.content()`, reuse cheerio parsing — keeps adapter logic uniform
- Playwright adapters still export the same `ScraperAdapter` interface — registry.ts needs no changes
- `playwright` import will fail gracefully if not installed — wrap in try/catch if needed

### Pattern 3: PaddleOCR Subprocess Adapter (prototype pattern)

For image-based pages, the adapter downloads images and shells out to a Python script:

```typescript
// lib/scraper/adapters/gha.ts (PaddleOCR variant)
import { execSync } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { fetchHTML } from '../fetch';
import * as cheerio from 'cheerio';

export const ghaAdapter: ScraperAdapter = {
  id: 'GHA',
  async scrape(url: string): Promise<RawRow[]> {
    // Step 1: Fetch announcement page to find image URLs
    const html = await fetchHTML(url);
    const $ = cheerio.load(html);
    const imageUrls: string[] = [];
    $('img').each((_, el) => {
      const src = $(el).attr('src') ?? '';
      if (src.match(/\.(jpg|jpeg|png)/i)) imageUrls.push(src);
    });

    // Step 2: Download first image to temp file
    const tempImg = join(tmpdir(), `gha_score_${Date.now()}.jpg`);
    // ... download image

    // Step 3: Shell out to Python PaddleOCR script
    const tempOut = join(tmpdir(), `gha_ocr_${Date.now()}.json`);
    execSync(`python3 scripts/ocr_table.py "${tempImg}" "${tempOut}"`, { timeout: 60000 });

    // Step 4: Parse PaddleOCR JSON output into RawRow[]
    const ocrResult = JSON.parse(readFileSync(tempOut, 'utf-8'));
    // ... extract rows from OCR result

    // Cleanup
    unlinkSync(tempImg);
    unlinkSync(tempOut);

    if (rows.length === 0) throw new Error(`GHA OCR returned 0 rows`);
    return rows;
  },
};
```

The Python helper script (`scripts/ocr_table.py`):
```python
#!/usr/bin/env python3
import sys
import json
from paddleocr import PaddleOCR

ocr = PaddleOCR(use_angle_cls=True, lang='vi', use_gpu=False)
result = ocr.ocr(sys.argv[1], cls=True)

# Flatten into list of text lines
lines = []
for page in result:
    for line in page:
        text = line[1][0]  # (bounding_box, (text, confidence))
        lines.append(text)

with open(sys.argv[2], 'w') as f:
    json.dump({'lines': lines}, f, ensure_ascii=False)
```

**Important note on OCR accuracy:** Vietnamese diacritic marks are complex. PaddleOCR supports Vietnamese (`lang='vi'`) but accuracy on table cells containing codes like "A00", "D01" and scores like "27.50" is generally HIGH (numbers + short codes). Major names in Vietnamese may have OCR errors. The prototype should validate output manually before trusting row counts.

### Pattern 4: Verification Script

Before enabling adapters, a verification script runs each candidate URL and logs:
- HTTP status code
- Whether HTML contains score table markers (`điểm chuẩn`, `điểm trúng tuyển`)
- Row count estimate (table `<tr>` count)
- Rendering type guess (static vs suspected JS)

```typescript
// scripts/verify-adapters.ts
import { fetchHTML } from '../lib/scraper/fetch';

const CANDIDATES = [
  { id: 'BVH', url: 'https://tuyensinh.ptit.edu.vn/gioi-thieu/xem-diem-cac-nam-truoc/diem-trung-tuyen-2024/' },
  { id: 'DCN', url: 'https://tuyensinh.haui.edu.vn/diem-chuan-trung-tuyen-dai-hoc' },
  // ...
];

for (const c of CANDIDATES) {
  try {
    const html = await fetchHTML(c.url);
    const hasTable = html.includes('<table');
    const hasDiemChuan = html.includes('điểm chuẩn') || html.includes('điểm trúng tuyển');
    const trCount = (html.match(/<tr/g) ?? []).length;
    console.log(`${c.id}: OK | table=${hasTable} | diem_chuan=${hasDiemChuan} | tr_count=${trCount}`);
  } catch (err) {
    console.log(`${c.id}: ERROR ${err}`);
  }
}
```

### Recommended Project Structure (additions only)

```
lib/scraper/adapters/
├── htc.ts          # existing — reference pattern for static HTML
├── bvh.ts          # UPDATE: fix URL, update column detection for PTIT table format
├── dcn.ts          # UPDATE: convert to Playwright adapter (Playwright reference pattern)
├── gha.ts          # UPDATE: convert to PaddleOCR adapter (OCR reference pattern)
└── [others]        # remain as static HTML adapters, url updates only

scripts/
├── verify-adapters.ts    # NEW: verification script
└── ocr_table.py          # NEW: Python OCR helper for image-based adapters
```

### Anti-Patterns to Avoid

- **Positional column indexes:** Never use `cells[2]` to get a score — table layouts vary. Always find column by header text.
- **Checking static_verified in adapter code:** The `static_verified` gate is in `registry.ts`, not in adapters. Adapters should be unaware of this flag.
- **Leaving browser open on error:** Playwright adapters must use `try/finally` to close the browser instance even if scraping throws.
- **Assuming current year for scores:** Always use `getFullYear() - 1` for cutoff score year — cutoffs are announced for the previous admission cycle.
- **Hard-coding article URLs:** Annual pages (e.g. `/diem-trung-tuyen-2024/`) will break each year. Prefer listing pages or `xem-diem-cac-nam-truoc/` style archive URLs where available.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML parsing of JS-rendered pages | Custom HTTP client with cookie jar | Playwright `page.content()` → cheerio | Handles SPAs, lazy loading, AJAX tables |
| OCR of image tables | Custom image processing | PaddleOCR with `lang='vi'` | Handles Vietnamese diacritics, table structure recognition built-in |
| Encoding detection for Vietnamese pages | Manual charset sniffing | Existing `fetchHTML` in `lib/scraper/fetch.ts` | Already handles `chardet` + `iconv-lite` for windows-1252, UTF-8, etc. |
| Browser lifecycle management | Process spawning | Playwright's `chromium.launch()` + `browser.close()` | Handles timeouts, crashes, headless mode |

**Key insight:** The hardest part is not the parsing — it's the rendering layer. A university website that "shows" a table in a browser may deliver zero table elements to a plain `fetch()` call if the data is loaded via AJAX or React hydration. Playwright solves this; never try to replicate it with custom JS execution.

---

## Common Pitfalls

### Pitfall 1: scrapers.json URL is homepage, not cutoff page
**What goes wrong:** Adapter fetches university homepage which has no score data → 0 rows → throws error → scrape run logged as `error`.
**Why it happens:** Phase 4 generated adapter stubs with homepage URLs as placeholders. Every non-HTC adapter currently has this problem.
**How to avoid:** Always update `scrapers.json` URL to the specific cutoff page before setting `static_verified: true`. The verification script surfaces this by checking for `điểm chuẩn` markers.
**Warning signs:** `tr_count` < 5 in verification output; error log says "0 rows".

### Pitfall 2: PTIT BVH adapter column mismatch
**What goes wrong:** Existing `bvh.ts` looks for `Điểm chuẩn` header. Real PTIT table has no such column — uses admission method codes (`THPT (100)`, `DGNL (402)`).
**Why it happens:** The adapter was generated with a generic template before the actual page was inspected.
**How to avoid:** Update `bvh.ts` to look for `THPT` in column headers as the primary score source. The `THPT (100)` column is the standard THPT exam method (the primary method for this project).
**Warning signs:** BVH adapter returns 0 rows even with correct URL.

### Pitfall 3: Playwright not installed in CI
**What goes wrong:** Playwright adapter imports succeed but `chromium.launch()` throws `Error: Executable doesn't exist at...`
**Why it happens:** `npm ci` installs the `playwright` npm package but not the browser binaries. Browser install requires a separate `npx playwright install chromium` step.
**How to avoid:** Add `npx playwright install chromium` as a GitHub Actions step before running the scraper. This step must come after `npm ci`.

### Pitfall 4: PaddleOCR first-run model download in CI
**What goes wrong:** First PaddleOCR import downloads ~50-200MB of models to `~/.paddleocr/`. This is slow and may fail in restricted CI environments.
**Why it happens:** PaddleOCR lazy-downloads models on first use.
**How to avoid:** Pre-download models in a CI setup step, or add a `--download-only` warm-up step. Use `PADDLEOCR_HOME` env var to point to a cached model directory.

### Pitfall 5: Vietnamese diacritics in cheerio header matching
**What goes wrong:** Header matching fails for strings like `Điểm chuẩn` because the page uses a different Unicode normalization form (NFC vs NFD) or because `iconv-lite` decoded to a slightly different character.
**Why it happens:** Vietnamese uses combining diacritics. `Đ` can be U+0110 or U+0044+combining. Some pages declare UTF-8 but are actually Windows-1252.
**How to avoid:** The existing `fetchHTML` handles encoding via `chardet`. For header matching, include both Vietnamese diacritics and ASCII-translit fallbacks (e.g., `h.includes('điểm') || h.includes('diem')`). This is already done in `bvh.ts` and `gha.ts` (has both forms).

### Pitfall 6: PTIT portal.ptit.edu.vn vs tuyensinh.ptit.edu.vn
**What goes wrong:** The existing BVH entry in scrapers.json uses `https://portal.ptit.edu.vn/` — this subdomain redirects to a WordPress signup page (`wp-signup.php?new=portal`).
**Root cause:** PTIT has multiple subdomains. The admissions portal is specifically `tuyensinh.ptit.edu.vn`.
**How to avoid:** Use `https://tuyensinh.ptit.edu.vn/gioi-thieu/xem-diem-cac-nam-truoc/diem-trung-tuyen-2024/` for the 2024 scores. Each new year will require a URL update (path ends with year).

### Pitfall 7: UTC GHA scores are in images, not text
**What goes wrong:** The cheerio-based `gha.ts` adapter fetches the UTC announcement page and finds 0 rows because the table data is in JPEG images.
**Root cause:** UTC publishes the official "thông báo" (notification) as a scanned document embedded as images.
**How to avoid:** The GHA adapter must be converted to the PaddleOCR subprocess pattern. The current cheerio-based stub will always return 0 rows on the real page.

---

## Code Examples

### Playwright Adapter — Full TypeScript Pattern
```typescript
// Source: official Playwright docs + project convention
import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import { RawRow, ScraperAdapter } from '../types';

export const dcnAdapter: ScraperAdapter = {
  id: 'DCN',
  async scrape(url: string): Promise<RawRow[]> {
    const browser = await chromium.launch({ headless: true });
    let html: string;
    try {
      const page = await browser.newPage();
      await page.setExtraHTTPHeaders({
        'User-Agent': 'UniSelectBot/1.0 (educational; open source)',
      });
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForSelector('table', { timeout: 15000 });
      html = await page.content();
    } finally {
      await browser.close();
    }

    const $ = cheerio.load(html);
    const rows: RawRow[] = [];
    const year = new Date().getFullYear() - 1;

    $('table').each((_, table) => {
      const headers = $(table)
        .find('th, thead td')
        .map((_, el) => $(el).text().trim().toLowerCase())
        .get();

      const scoreIdx = headers.findIndex(
        (h) => h.includes('điểm chuẩn') || h.includes('diem chuan')
      );
      if (scoreIdx === -1) return;
      // ... row parsing identical to static adapter
    });

    if (rows.length === 0) {
      throw new Error(`DCN adapter returned 0 rows at ${url}`);
    }
    return rows;
  },
};
```

### GitHub Actions — Adding Playwright Browser Install
```yaml
# Addition to .github/workflows/scrape-low.yml
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'
- run: npm ci
- name: Install Playwright browsers (Playwright adapters only)
  run: npx playwright install chromium --with-deps
  # --with-deps installs system dependencies (libnss3, etc.) needed on ubuntu-latest
```

### GitHub Actions — Adding Python for PaddleOCR
```yaml
# Addition for OCR-capable scraper jobs
- uses: actions/setup-python@v5
  with:
    python-version: '3.11'
    cache: 'pip'
- name: Install PaddleOCR
  run: pip install paddleocr
- name: Warm up PaddleOCR models
  run: python3 -c "from paddleocr import PaddleOCR; PaddleOCR(lang='vi', use_gpu=False)"
```

### BVH Adapter Column Update
```typescript
// Key change in bvh.ts: find THPT column instead of generic "Điểm chuẩn"
// PTIT table headers: TT | Mã ngành/CT | Tên ngành/chương trình | BVH | BVS | THPT (100) | TN (302) | ...
const scoreIdx = headers.findIndex(
  (h) =>
    h.includes('thpt') ||          // matches "THPT (100)"
    h.includes('điểm chuẩn') ||
    h.includes('diem chuan') ||
    h.includes('điểm trúng tuyển')
);
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Adapter stubs with homepage URLs | Verified specific cutoff page URLs per adapter | static_verified can be set to true |
| All 78 adapters disabled (static_verified=false) | Enable 2-3 confirmed static HTML + 1 Playwright + 1 OCR | Real data flows into DB and static JSON |
| scrapers.json points to portal.ptit.edu.vn for BVH | Should point to tuyensinh.ptit.edu.vn with 2024 path | BVH adapter will actually work |
| Generic template column matchers | University-specific column matchers | Eliminates false 0-row errors |

**Deprecated/outdated:**
- `portal.ptit.edu.vn` for BVH: This subdomain redirects to a WordPress signup page. Use `tuyensinh.ptit.edu.vn` instead.
- Generic `diem chuan` ASCII-only header matching for BVH: PTIT table uses `THPT (100)` as score column name.

---

## Open Questions

1. **DCN (HAUI) rendering type**
   - What we know: A dedicated admissions portal exists at `tuyensinh.haui.edu.vn/diem-chuan-trung-tuyen-dai-hoc`; SSL cert verification fails for this subdomain
   - What's unclear: Whether the page is static HTML or JS-rendered; whether `fetchHTML` will work with SSL errors
   - Recommendation: During Wave 1, manually visit the URL and view source. If static HTML, update DCN entry and use as 3rd static adapter. If JS, use as Playwright prototype target. For SSL issues, the `fetchHTML` utility may need a `rejectUnauthorized: false` override for specific hosts.

2. **BVH URL is year-specific**
   - What we know: `tuyensinh.ptit.edu.vn/...diem-trung-tuyen-2024/` is the 2024 URL — the path includes the year
   - What's unclear: Whether there's a "latest" or redirect URL, or whether the URL must be updated manually each year
   - Recommendation: Check if `tuyensinh.ptit.edu.vn/gioi-thieu/xem-diem-cac-nam-truoc/` (the parent listing page) is static HTML and contains links to all years — if so, the adapter could follow links dynamically. For Phase 7, hard-code the 2024 URL; add a TODO comment for annual maintenance.

3. **PTIT BVH score column disambiguation**
   - What we know: Table has columns `THPT (100)`, `TN (302)`, `KH (410)`, `DGNL (402)` — multiple score types
   - What's unclear: Which column the project should treat as canonical (the THPT main exam method is standard, but `DGNL` is the aptitude test used by some students)
   - Recommendation: Use `THPT (100)` as primary score column and emit `tohop_raw = ''` (normalizer will handle). Consider emitting multiple rows (one per method) as a future enhancement.

4. **KHA and NTH feasibility**
   - What we know: KHA (NEU) links to PDFs; NTH (FTU) links to Google Drive
   - What's unclear: Whether alternative sub-pages have HTML tables for either university
   - Recommendation: Both are out of scope for static or Playwright scraping in Phase 7. Mark them in scrapers.json with a note: `"note": "Scores published as PDF/Google Drive — requires manual entry or PDF parsing"`. They should NOT be set `static_verified: true`.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vitest.config.mts` (exists) |
| Quick run command | `npx vitest run tests/scraper/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PIPE-02 | BVH adapter returns RawRow[] from PTIT HTML fixture | unit | `npx vitest run tests/scraper/adapters/bvh.test.ts` | ❌ Wave 0 |
| PIPE-02 | DCN/GHA Playwright adapter returns RawRow[] from rendered fixture | unit | `npx vitest run tests/scraper/adapters/dcn.test.ts` | ❌ Wave 0 |
| PIPE-02 | Adapter contract: all adapters export correct ScraperAdapter shape | unit | `npx vitest run tests/scraper/adapters/adapter-contract.test.ts` | ✅ exists |
| PIPE-03 | Verification script outputs correct render-type verdict per adapter | unit | `npx vitest run tests/scraper/verify-adapters.test.ts` | ❌ Wave 0 |
| INFRA-02 | generate-static produces scores-by-tohop.json with real data after scrape | integration | Manual — requires DB with real data | manual-only |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/scraper/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/scraper/adapters/bvh.test.ts` — behavioral tests for updated BVH adapter with PTIT table format
- [ ] `tests/scraper/adapters/dcn.test.ts` — behavioral tests for Playwright adapter (mock playwright with vi.mock)
- [ ] `tests/scraper/adapters/gha.test.ts` — behavioral tests for PaddleOCR adapter (mock execSync)
- [ ] `scripts/ocr_table.py` — PaddleOCR Python helper script
- [ ] `scripts/verify-adapters.ts` — verification report script

---

## Sources

### Primary (HIGH confidence)
- Direct WebFetch of live URLs — verified rendering type for BVH (PTIT), GHA (UTC), NTH (FTU), BKA (HUST)
- `lib/scraper/adapters/htc.ts` — source of truth for static HTML adapter pattern
- `lib/scraper/registry.ts` — source of truth for `static_verified` gate behavior
- `scrapers.json` — current URLs and static_verified state for all 78 adapters
- `tests/scraper/adapters/bka.test.ts` — canonical example of adapter behavioral test pattern
- Playwright docs (playwright.dev) — `page.content()`, `waitUntil: 'networkidle'`, `browser.close()` patterns

### Secondary (MEDIUM confidence)
- WebSearch + official GitHub: Playwright 1.51.x is latest as of early 2026; `playwright` package (not `@playwright/test`) for scraping use
- WebSearch + PyPI: PaddleOCR 3.0.3 latest June 2025; Python 3.9-3.12 supported; `pip install paddleocr`
- WebFetch of PTIT tuyensinh page: Column headers `TT / Mã ngành\/CT / Tên ngành / THPT (100) / DGNL (402)` observed directly

### Tertiary (LOW confidence — needs manual verification)
- DCN (HAUI) rendering type: Candidate URL found via search; SSL cert error blocked WebFetch verification; must verify manually
- NEU (KHA) static page existence: Search found `daotao.neu.edu.vn` subdomain with 2024 scores but structure not confirmed as HTML table
- BKA (HUST) THPT method scores location: Main HUST site JS-rendered; specific THPT scores page (not XTTN talent method) not confirmed

---

## Metadata

**Confidence breakdown:**
- University page rendering verdicts (BVH, GHA, NTH): HIGH — direct WebFetch confirmed
- University page rendering verdicts (BKA, KHA, DCN): MEDIUM — indirect (search + partial fetch)
- Playwright integration pattern: HIGH — standard npm package, well-documented
- PaddleOCR version + install: MEDIUM — verified via search, not direct pip query
- PTIT BVH column structure: HIGH — directly observed from live page content
- GHA/UTC image format: HIGH — directly confirmed (JPEG filenames visible in HTML)

**Research date:** 2026-03-18
**Valid until:** 2026-09-18 (stable domain; 6 months). URL paths may change each admission cycle (July-August annually) — re-verify BVH URL when 2025 cycle data publishes.
