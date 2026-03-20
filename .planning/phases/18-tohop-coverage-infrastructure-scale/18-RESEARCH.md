# Phase 18: tổ Hợp Coverage + Infrastructure Scale - Research

**Researched:** 2026-03-20
**Domain:** Cheerio HTML parsing (wide-table format), GitHub Actions matrix sharding, adapter type isolation
**Confidence:** HIGH

## Summary

Phase 18 has two distinct workstreams: (1) wide-table tổ hợp parsing (SCRP-11, SCRP-12) and (2) GHA shard scaling + adapter isolation (INFR-04, INFR-05). Both are well-bounded by reading the existing codebase — no new external dependencies are needed for either workstream.

**Wide-table format (SCRP-12):** The current `createCheerioAdapter` in `factory.ts` finds a single `tohopIdx` column and emits one row per data row. Wide-table format — where each tổ hợp is its own column (e.g., A00, A01, D01 as column headers) and the score for each tổ hợp sits in that column's cell — requires a different parsing path. The factory must detect wide-table layout (by testing whether any header cell matches a tổ hợp code pattern like `/^[A-D]\d{2}$/`) and then emit multiple `RawRow` objects per data row, one per tổ hợp column that contains a numeric score.

**All tổ hợp captured (SCRP-11):** The `CheerioAdapterConfig` needs a new optional field (`wideTable: boolean` or detected automatically) to signal which parsing path to use. The `normalizer.ts` requires no changes — it already validates `tohop_code` as `[A-D]\d{2}` and rejects empty/invalid. The runner and DB upsert logic (keying on `university_id + major_id + tohop_code + year + admission_method`) already correctly handles multiple rows per major.

**Shard scaling (INFR-04):** The current 6-shard matrix (`scrape-low.yml`, `scrape-peak.yml`) distributes adapters round-robin by index (`i % shardTotal === shardIndex`) via `run.ts`. At 400 active universities with ~20-45 seconds per cheerio adapter, 400/6 ≈ 67 adapters/shard × 45s = ~50 minutes — within the 300-minute limit. However Playwright adds 45-90s/adapter and OCR adds 60-180s/adapter. If one shard gets even 10 Playwright/OCR adapters mixed in, its runtime balloons. The fix is shard count increase plus type-aware distribution, not purely higher shard count.

**Adapter isolation (INFR-05):** `run.ts` loads the full registry and shards by `% shardTotal`. Adding a `SHARD_TYPE` environment variable (values: `cheerio`, `playwright`, `paddleocr`, or `all`) enables the workflow matrix to dedicate certain shard indices to specific adapter types. The registry already has `adapter_type` on every entry. Type-filtered loading requires one filter in `run.ts` before sharding.

**Primary recommendation:** Add `wideTable` detection to the factory (auto-detect via header analysis), add `SHARD_TYPE` env var filtering to `run.ts`, increase shard count to 20 for cheerio + 2 for playwright + 2 for paddleocr in the workflow matrix, and update both `scrape-low.yml` and `scrape-peak.yml` with the new type-aware matrix.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SCRP-11 | Adapters capture all tổ hợp combinations published on each university's cutoff page | Wide-table factory path emits one RawRow per tổ hợp column; normalizer already validates `[A-D]\d{2}`; runner's upsert key already includes `tohop_code` |
| SCRP-12 | Factory adapter handles wide-table format (one column per tổ hợp) in addition to existing row-per-combination format | New `wideTable` detection in `createCheerioAdapter`; auto-detect by scanning headers for `[A-D]\d{2}` pattern; existing narrow-table path unchanged |
| INFR-04 | Shard count scales from 6 to handle 400+ universities within GHA per-job 300-minute timeout limits | At 45s/cheerio adapter: 400 unis / 20 shards = 20 adapters × 45s = 15 min; well within 300 min. Playwright/OCR get dedicated shards. |
| INFR-05 | Playwright and OCR adapters isolated to dedicated shards — Cheerio shards never wait for browser/model setup | `SHARD_TYPE` env var filters registry by `adapter_type` before sharding; workflow matrix sets `shard_type` per job; Playwright/OCR shards keep their existing setup steps, cheerio shards skip them |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| cheerio | already installed | HTML parsing for wide-table detection and extraction | Already used in all factory adapters |
| vitest | ^4.1.0 | Unit tests for wide-table fixture | Already used throughout the codebase |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| playwright | already installed | Dedicated shard for JS-rendered adapters | Used in `dcn.ts` reference adapter |
| paddleocr (Python) | 2.9.1 (pinned) | Dedicated shard for image-based adapters | Used in `gha.ts` reference adapter |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Auto-detect wide-table in factory | `wideTable: true` flag in `scrapers.json` `factory_config` | Explicit flag is simpler and avoids false positives if a non-tổ hợp column header happens to match `[A-D]\d{2}`. Recommended: use explicit `wideTable` flag in `factory_config` — matches the existing pattern where config drives adapter behavior. |
| `SHARD_TYPE` env var in `run.ts` | Separate entry scripts per adapter type | Separate entry scripts multiply file count with no benefit. `SHARD_TYPE` filter in `run.ts` is minimal and testable. |
| Increase to 40 shards (all cheerio) | Type-aware 20+2+2 matrix | 40 equal shards gives no improvement for Playwright/OCR — those still block cheerio. Type isolation is the correct approach regardless of shard count. |

**Installation:** None required — all dependencies already present.

## Architecture Patterns

### Recommended Project Structure

```
lib/scraper/
├── factory.ts          # Add wideTable flag + wide-table parsing path
├── run.ts              # Add SHARD_TYPE filter before sharding

.github/workflows/
├── scrape-low.yml      # Update matrix: 20 cheerio + 2 playwright + 2 ocr shards
├── scrape-peak.yml     # Same matrix update as scrape-low.yml

tests/scraper/
├── factory.test.ts     # Add wide-table fixture test cases
└── fixtures/
    └── wide-table.html # Wide-table HTML fixture (new file)
```

No new directories needed. Three source file changes, two workflow file changes, one new test fixture.

### Pattern 1: Wide-Table Parsing in createCheerioAdapter

**What:** When `factory_config.wideTable: true`, instead of finding a single score column, scan the header row for cells matching `/^[A-D]\d{2}$/i` (tổ hợp codes). For each data row, emit one `RawRow` per tổ hợp header column that contains a numeric score value.

**When to use:** A university publishes a table where columns are: `Mã ngành | Tên ngành | A00 | A01 | D01 | ...` with score in each tổ hợp cell.

**CheerioAdapterConfig change:**
```typescript
// Source: lib/scraper/factory.ts (existing interface)
export interface CheerioAdapterConfig {
  id: string;
  scoreKeywords: string[];
  majorKeywords: string[];
  tohopKeywords?: string[];
  defaultTohop?: string;
  wideTable?: boolean;   // NEW: true = one col per tổ hợp
}
```

**Wide-table parsing path:**
```typescript
// Inside createCheerioAdapter, after headers are determined:
if (config.wideTable) {
  // Find all header indices that match a tổ hợp code pattern
  const tohopCols: Array<{ idx: number; code: string }> = [];
  headers.forEach((h, idx) => {
    const cleaned = h.trim().toUpperCase();
    if (/^[A-D]\d{2}$/.test(cleaned)) {
      tohopCols.push({ idx, code: cleaned });
    }
  });

  if (tohopCols.length === 0) return; // not a wide-table, skip

  allRows.slice(1).each((_, tr) => {
    const cells = $(tr).find('td').map((_, td) => $(td).text().trim()).get();
    if (cells.length < 3) return;
    const majorCode = codeIdx !== -1 ? cells[codeIdx] : '';
    if (!majorCode || !/^\d/.test(majorCode)) return;

    for (const col of tohopCols) {
      const scoreRaw = cells[col.idx] ?? '';
      if (!scoreRaw || !/\d/.test(scoreRaw)) continue; // empty cell = not offered
      rows.push({
        university_id: config.id,
        major_raw: majorCode,
        tohop_raw: col.code,
        year,
        score_raw: scoreRaw,
        source_url: url,
      });
    }
  });
  return; // wide-table path handled, don't fall through to narrow path
}
// existing narrow-table path continues unchanged...
```

**Key insight:** The `return` inside each table's `.each()` callback only exits the current table iteration, not the function. The wide-table path must be wrapped so it skips the narrow-table logic for the same table. A clean approach is to run the wide-table path as an early-return guard at the top of the per-table processing.

### Pattern 2: SHARD_TYPE Filter in run.ts

**What:** Read `SHARD_TYPE` env var in `run.ts`. If set to `cheerio`, `playwright`, or `paddleocr`, filter the registry to only entries matching that `adapter_type` before applying the `% shardTotal` modulo distribution.

**When to use:** Workflow matrix sets `shard_type: cheerio` (or `playwright`/`paddleocr`) on each job.

**run.ts change:**
```typescript
// Source: lib/scraper/run.ts (existing shard logic extended)
const shardType = process.env.SHARD_TYPE ?? 'all';

let filtered = registry;
if (shardType !== 'all') {
  // Load adapter_type from registry entries for filtering
  filtered = registry.filter((entry) => entry.adapterType === shardType);
}

const shard = filtered.filter((_, i) => i % shardTotal === shardIndex);
```

This requires `loadRegistry()` to return `adapterType` alongside `adapter` and `url`. Currently `ResolvedEntry` only has `{ id, adapter, url }`. Add `adapterType: string` to `ResolvedEntry` and populate it from the registry entry.

**ResolvedEntry change (registry.ts):**
```typescript
// Source: lib/scraper/registry.ts (extend ResolvedEntry)
interface ResolvedEntry {
  id: string;
  adapter: ScraperAdapter;
  url: string;
  adapterType: string;  // NEW: propagate from RegistryEntry.adapter_type
}
```

### Pattern 3: Workflow Matrix with Type-Aware Shards

**What:** Update the `strategy.matrix` in both `scrape-low.yml` and `scrape-peak.yml` to include a `shard_type` dimension alongside the numeric shard index.

**Workflow matrix structure:**
```yaml
strategy:
  matrix:
    include:
      # 20 cheerio shards (0-19)
      - { shard: 0,  shard_type: cheerio }
      - { shard: 1,  shard_type: cheerio }
      # ... through shard 19
      - { shard: 19, shard_type: cheerio }
      # 2 playwright shards (0-1)
      - { shard: 0,  shard_type: playwright }
      - { shard: 1,  shard_type: playwright }
      # 2 paddleocr shards (0-1)
      - { shard: 0,  shard_type: paddleocr }
      - { shard: 1,  shard_type: paddleocr }
  fail-fast: false
```

**Environment in run step:**
```yaml
- name: Run scraper shard ${{ matrix.shard }}/${{ matrix.shard_type }}
  run: npx tsx lib/scraper/run.ts
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
    SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
    GITHUB_RUN_ID: ${{ github.run_id }}
    SHARD_INDEX: ${{ matrix.shard }}
    SHARD_TOTAL: ${{ matrix.shard == 'cheerio' && '20' || '2' }}
    SHARD_TYPE: ${{ matrix.shard_type }}
```

**SHARD_TOTAL calculation:** Cheerio shards use SHARD_TOTAL=20, playwright and paddleocr shards use SHARD_TOTAL=2. The YAML expression approach (`&&` / `||`) is not supported in GHA expressions — use separate `env` blocks per job type via `if:` conditions or define SHARD_TOTAL as a variable in the matrix include:

```yaml
include:
  - { shard: 0, shard_type: cheerio,    shard_total: 20 }
  - { shard: 1, shard_type: cheerio,    shard_total: 20 }
  # ...
  - { shard: 0, shard_type: playwright, shard_total: 2 }
  - { shard: 1, shard_type: playwright, shard_total: 2 }
  - { shard: 0, shard_type: paddleocr,  shard_total: 2 }
  - { shard: 1, shard_type: paddleocr,  shard_total: 2 }
```

Then `SHARD_TOTAL: ${{ matrix.shard_total }}`.

### Pattern 4: Conditional Playwright/OCR Setup Steps

**What:** Playwright browser install and PaddleOCR model warmup steps are expensive (30-120 seconds + cache miss risk). Skip these on cheerio-only shards.

**Implementation:**
```yaml
# Playwright steps — only for playwright shards
- name: Cache Playwright browsers
  if: matrix.shard_type == 'playwright'
  uses: actions/cache@v4
  # ...

- name: Install Playwright browsers
  if: matrix.shard_type == 'playwright' && steps.playwright-cache.outputs.cache-hit != 'true'
  run: npx playwright install chromium --with-deps

# OCR steps — only for paddleocr shards
- uses: actions/setup-python@v5
  if: matrix.shard_type == 'paddleocr'
  with:
    python-version: '3.11'
    cache: 'pip'

- name: Install PaddleOCR
  if: matrix.shard_type == 'paddleocr'
  run: pip install -r requirements.txt

- name: Warm up PaddleOCR models
  if: matrix.shard_type == 'paddleocr'
  run: python3 -c "from paddleocr import PaddleOCR; PaddleOCR(lang='vi', use_gpu=False)"
```

**Why this matters:** Currently every shard (all 6) runs Playwright install and PaddleOCR warmup. On a cache miss, PaddleOCR model download is 200-400 MB and takes 3-8 minutes. For 20 cheerio shards, skipping these steps saves 20 × (2-8 min) = 40-160 minutes of CI setup time per run.

### Anti-Patterns to Avoid

- **Using `scoreIdx` for wide-table:** The wide-table format has no single "score" column. The `scoreKeywords` search is still useful for detecting whether a table is a cutoff score table at all, but score extraction must iterate over `tohopCols`. Don't try to reuse `scoreIdx` for wide-table score lookup.
- **Emitting empty-score rows in wide-table:** Universities often don't offer every major via every tổ hợp. Empty cells must be silently skipped (`if (!scoreRaw || !/\d/.test(scoreRaw)) continue`), not emitted as rows with empty `score_raw` (which the normalizer would reject anyway, but rejections inflate the `rows_rejected` counter).
- **Using a single SHARD_TOTAL for all job types:** Playwright/OCR pools are small (2 shards each). Setting SHARD_TOTAL=24 for all types would distribute 2 playwright adapters across 24 slots — most slots empty. Each type's SHARD_TOTAL must equal the number of shards for that type.
- **Conditional `if:` on the run step for type:** Don't gate the main scraper run step on `shard_type` — the `SHARD_TYPE` env var in `run.ts` handles filtering. The `if:` guards are only needed on the expensive setup steps (Playwright install, PaddleOCR warmup).
- **Applying wide-table to all factory adapters:** `wideTable` is an opt-in per-university flag in `factory_config`. Only add it to universities that actually publish wide-table format. Default (absent or `false`) preserves current narrow-table behavior.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| tổ hợp code validation in wide-table parser | Custom regex or lookup table | Reuse `/^[A-D]\d{2}$/` — same regex already in `normalizer.ts` | Consistent validation; normalizer catches anything the parser misses anyway |
| Adapter type dispatch in CI | Separate entry scripts per type | `SHARD_TYPE` env var + filter in `run.ts` | Single entry point, testable, no duplicate scripts |
| Per-type workflow files | `scrape-cheerio.yml`, `scrape-playwright.yml`, `scrape-ocr.yml` | Single file with `include` matrix | Three files to maintain in sync is fragile; matrix captures all dimensions in one file |
| Manual wide-table fixture HTML | Copying from a live university page | Write a minimal synthetic fixture with 2 majors × 3 tổ hợp columns | Synthetic fixtures are stable and offline; real pages change annually |

**Key insight:** The wide-table parser is a new branch in an existing function, not a new adapter type. The shard type filter is a 4-line addition to an existing script, not a new execution model.

## Common Pitfalls

### Pitfall 1: Wide-Table Header Row Contains Both tổ hợp Codes AND Regular Column Headers
**What goes wrong:** A table might have headers like `Mã ngành | Tên ngành | Chỉ tiêu | A00 | A01 | D01`. The `codeIdx` search still works (finds "mã ngành" column). The tổ hợp column detection (`/^[A-D]\d{2}$/`) correctly identifies A00, A01, D01. The "Chỉ tiêu" (quota) column must not be picked up as a tổ hợp column — it won't be, because "chỉ tiêu" fails the `[A-D]\d{2}` test. This is correct behavior.
**Warning signs:** A tổ hợp column that is actually a quota column (e.g., a university that names a column "A01" for an unrelated reason — extremely unlikely but worth noting).

### Pitfall 2: `codeIdx` Points to Wrong Column in Wide-Table
**What goes wrong:** Wide-table pages often have more columns than narrow-table pages (one per tổ hợp). The `majorKeywords` search must still correctly identify the major code column. Column order may be: `TT | Mã ngành | Tên ngành | A00 | A01 | D01`. The search via `headers.findIndex` with `majorKeywords` still works correctly because it searches by keyword, not position.
**How to avoid:** Ensure `majorKeywords` in `factory_config` for wide-table universities includes both ASCII and Unicode Vietnamese variants of "mã ngành" — e.g., `["ma nganh", "mã ngành", "ma xet tuyen"]`.

### Pitfall 3: `run.ts` SHARD_TOTAL Mismatch Between Workflow and Script
**What goes wrong:** Workflow sets `SHARD_TOTAL: ${{ matrix.shard_total }}` and `SHARD_INDEX: ${{ matrix.shard }}`. If the matrix `include` object has `shard_total: 20` for cheerio but `shard: 19`, and only 5 cheerio adapters exist, shard 19 gets 0 adapters — this is fine (empty shard, no error). The danger is setting `shard_total` lower than the actual shard count, causing two shards to receive the same adapter (double-scrape). This is wasteful but not corrupt (upsert handles duplicates).
**How to avoid:** Always set `shard_total` to match the number of `include` entries for that `shard_type`.

### Pitfall 4: Wide-Table Factory Returns 0 Rows But Doesn't Throw
**What goes wrong:** If a wide-table URL is misconfigured (e.g., the university switched to narrow-table format), the wide-table path finds no tổ hợp columns, skips all tables, and the narrow-table fallback also produces no rows. The existing 0-rows `throw` at the end of `scrape()` handles this correctly — it fires when `rows.length === 0` regardless of which path ran.
**Why it happens:** Misunderstanding that the wide-table path returns early from the table's `.each()` callback, not from the outer `scrape()` function. The 0-rows guard is in the outer function scope.
**How to avoid:** Leave the existing `if (rows.length === 0) throw new Error(...)` guard untouched.

### Pitfall 5: GHA Matrix `include` Syntax for Mixed-Type Shards
**What goes wrong:** Using `strategy.matrix.shard: [0,1,...,23]` (flat array) and then filtering by type in the run step creates 24 copies of Playwright + OCR setup for jobs that don't need them. The correct approach is `strategy.matrix.include` with explicit objects — this creates exactly the jobs needed and allows per-job `if:` on setup steps.
**Warning signs:** Playwright cache step running on cheerio jobs in the GHA run log.

## Code Examples

Verified patterns from project source:

### Current Narrow-Table Path (factory.ts — preserving unchanged)
```typescript
// Source: lib/scraper/factory.ts (existing, verified)
const tohopIdx = config.tohopKeywords
  ? headers.findIndex((h) =>
      config.tohopKeywords!.some((kw) => h.includes(kw))
    )
  : -1;

// Narrow-table: one row emitted per data row
rows.push({
  university_id: config.id,
  major_raw: majorCode,
  tohop_raw: tohopIdx !== -1 ? cells[tohopIdx] : (config.defaultTohop ?? ''),
  year,
  score_raw: scoreRaw,
  source_url: url,
});
```

### Wide-Table Fixture Shape (for test)
```html
<!-- tests/scraper/fixtures/wide-table.html -->
<table>
  <thead>
    <tr>
      <th>Mã ngành</th>
      <th>Tên ngành</th>
      <th>A00</th>
      <th>A01</th>
      <th>D01</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>7480201</td>
      <td>Công nghệ thông tin</td>
      <td>27.50</td>
      <td>26.75</td>
      <td></td>
    </tr>
    <tr>
      <td>7520201</td>
      <td>Kỹ thuật điện tử</td>
      <td>25.00</td>
      <td></td>
      <td>24.50</td>
    </tr>
  </tbody>
</table>
```

Expected output: 4 rows (major 7480201 × A00+A01, major 7520201 × A00+D01). The empty cells (D01 for 7480201, A01 for 7520201) must be skipped.

### scrapers.json wide-table entry shape
```json
{
  "id": "XYZ",
  "adapter": "xyz",
  "website_url": "https://xyz.edu.vn/",
  "scrape_url": "https://tuyensinh.xyz.edu.vn/diem-chuan-2024",
  "adapter_type": "cheerio",
  "factory_config": {
    "scoreKeywords": ["điểm chuẩn", "diem chuan"],
    "majorKeywords": ["mã ngành", "ma nganh"],
    "wideTable": true
  }
}
```

Note: `scoreKeywords` is still present — it is used to verify the table is a cutoff score table before attempting wide-table parsing. The actual score values come from the tổ hợp column cells, not the `scoreIdx` column.

### ResolvedEntry with adapterType (registry.ts change)
```typescript
// Source: lib/scraper/registry.ts (extend existing interface)
interface ResolvedEntry {
  id: string;
  adapter: ScraperAdapter;
  url: string;
  adapterType: string;  // propagated from entry.adapter_type
}

// In the for loop:
resolved.push({
  id: entry.id,
  adapter,
  url: entry.scrape_url,
  adapterType: entry.adapter_type ?? 'cheerio',
});
```

### SHARD_TYPE filter in run.ts
```typescript
// Source: lib/scraper/run.ts (add after loadRegistry())
const shardType = process.env.SHARD_TYPE ?? 'all';
const shardIndex = parseInt(process.env.SHARD_INDEX ?? '0', 10);
const shardTotal = parseInt(process.env.SHARD_TOTAL ?? '1', 10);

const typeFiltered = shardType === 'all'
  ? registry
  : registry.filter((e) => e.adapterType === shardType);

const shard = typeFiltered.filter((_, i) => i % shardTotal === shardIndex);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single tổ hợp per row (narrow-table only) | Wide-table: N tổ hợp per major row | Phase 18 (new) | Universities publishing wide-table format now fully covered |
| 6 equal shards (all adapter types mixed) | 20 cheerio + 2 playwright + 2 paddleocr (24 total, type-isolated) | Phase 18 (new) | Cheerio shards skip Playwright/OCR setup; no timeout cascade |
| Playwright/OCR warmup on all 6 shards | Playwright/OCR warmup only on type-specific shards | Phase 18 (new) | Saves ~60-160 min CI setup per run at scale |

**Deprecated/outdated:**
- Flat `shard: [0,1,2,3,4,5]` matrix: replaced by `include` matrix with `shard_type` and `shard_total` per job
- `ResolvedEntry` without `adapterType`: will include `adapterType` after Phase 18

## Open Questions

1. **How many real universities publish wide-table format?**
   - What we know: Discovery has run against 400+ homepages; actual cutoff page format was not audited during discovery (discovery only finds URLs, not parses them)
   - What's unclear: Whether 1, 5, or 50+ universities use wide-table format
   - Recommendation: Phase 18 Plan should include a step to manually audit 5-10 discovered `scrape_url` pages to confirm wide-table prevalence and identify at least one real university to use as success criterion 2

2. **Should `scoreKeywords` still be required when `wideTable: true`?**
   - What we know: Current factory requires `scoreIdx !== -1` to process any table; wide-table has no single score column
   - What's unclear: What guard prevents wide-table path from processing non-cutoff tables (e.g., an enrollment table that also has columns matching `[A-D]\d{2}`)
   - Recommendation: When `wideTable: true`, use `scoreKeywords` to first verify the table context (look for any header containing score keywords), then proceed to tổ hợp column detection. This adds a safety guard.

3. **What shard count is optimal for playwright adapters at scale?**
   - What we know: Currently 1 playwright adapter (DCN); each Playwright page takes 30-90s including browser launch
   - What's unclear: If 50 universities end up needing Playwright, 2 shards × 25 adapters × 90s = ~37 minutes — still within 300 min limit. If 100+ Playwright adapters, 4-6 shards would be needed.
   - Recommendation: Start with 2 playwright shards (covers up to ~100 adapters at 90s each). Document threshold for increasing shard count.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.0 |
| Config file | none — configured via package.json `"test": "vitest run"` |
| Quick run command | `npx vitest run tests/scraper/factory.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCRP-12 | Wide-table fixture produces one row per major per tổ hợp column | unit | `npx vitest run tests/scraper/factory.test.ts` | ✅ (extend existing) |
| SCRP-12 | Empty tổ hợp cells in wide-table fixture are skipped | unit | `npx vitest run tests/scraper/factory.test.ts` | ✅ (extend existing) |
| SCRP-11 | Wide-table rows pass normalizer and produce valid NormalizedRow | unit | `npx vitest run tests/scraper/normalizer.test.ts` | ✅ (extend existing) |
| INFR-05 | SHARD_TYPE=cheerio filters out playwright/paddleocr entries | unit | `npx vitest run tests/scraper/run.test.ts` | ❌ Wave 0 |
| INFR-05 | SHARD_TYPE=playwright includes only playwright entries | unit | `npx vitest run tests/scraper/run.test.ts` | ❌ Wave 0 |
| INFR-04 | Workflow matrix has 24 jobs total (20+2+2) | manual | inspect GHA run | N/A — verify via GHA Actions tab |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/scraper/factory.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/scraper/fixtures/wide-table.html` — synthetic wide-table HTML fixture (2 majors × 3 tổ hợp columns with some empty cells)
- [ ] `tests/scraper/run.test.ts` — covers INFR-05: SHARD_TYPE filtering logic in run.ts

*(Existing `tests/scraper/factory.test.ts` and `tests/scraper/normalizer.test.ts` cover SCRP-11/SCRP-12 behavior after extending with wide-table test cases)*

## Sources

### Primary (HIGH confidence)
- Project source: `lib/scraper/factory.ts` — current narrow-table parsing logic; interface to extend
- Project source: `lib/scraper/types.ts` — `RawRow` and `NormalizedRow` shapes; normalizer regex `[A-D]\d{2}`
- Project source: `lib/scraper/normalizer.ts` — validation logic; confirms `/^[A-D]\d{2}$/` test on `tohop_code`
- Project source: `lib/scraper/registry.ts` — `RegistryEntry.adapter_type` field; `ResolvedEntry` interface to extend
- Project source: `lib/scraper/run.ts` — shard logic (`i % shardTotal === shardIndex`); env var pattern
- Project source: `lib/scraper/runner.ts` — upsert key `(university_id, major_id, tohop_code, year, admission_method)` handles multiple rows per major correctly
- Project source: `.github/workflows/scrape-low.yml` — current 6-shard flat matrix; Playwright/OCR setup steps to make conditional
- Project source: `.github/workflows/scrape-peak.yml` — mirrors scrape-low.yml; same changes required
- Project source: `scrapers.json` — 78 entries; counts: 2 cheerio, 1 playwright, 1 paddleocr, 3 skip, 70 pending
- Project source: `tests/scraper/factory.test.ts` — existing test patterns; `vi.mock` + inline HTML fixture pattern to replicate for wide-table

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` — SCRP-11, SCRP-12, INFR-04, INFR-05 definitions and success criteria
- `.planning/ROADMAP.md` — Phase 18 success criteria; 300-minute per-job timeout limit stated explicitly
- `.planning/STATE.md` — "Wide-table prevalence unknown until Phase 16 discovery run audits real cutoff pages" blocker noted

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in use; no new dependencies
- Architecture (wide-table): HIGH — direct extension of `factory.ts` narrow-table path; both paths verified by reading source
- Architecture (shard isolation): HIGH — `run.ts` shard logic fully understood; GHA matrix `include` syntax is standard
- Pitfalls: HIGH — derived from actual code structure (`.each()` return scope, `SHARD_TOTAL` mismatch, empty cells)

**Research date:** 2026-03-20
**Valid until:** 2026-06-20 (stable domain — Cheerio, GHA matrix syntax, Vitest patterns are stable)
